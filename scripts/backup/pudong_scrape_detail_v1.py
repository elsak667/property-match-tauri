#!/usr/bin/env python3
"""
浦易达政策详情爬虫 - v1
抓取 /tmp/pudong_policies_v5.json 中所有296条的详情页
从页面 DOM 解析：政策对象、政策条件、兑付标准、联系方式
同时补充 get-special-single API 数据

用法：
  python pudong_scrape_detail_v1.py                      # 抓全量
  python pudong_scrape_detail_v1.py --max 5              # 仅测试5条
  python pudong_scrape_detail_v1.py -o /path/to/detail.json  # 指定输出
"""
import argparse
import asyncio
import json
import re
from pathlib import Path

from cloakbrowser import launch_async as browser_launch


def parse_detail_text(text: str) -> dict:
    """从页面文本中解析各区块内容"""
    result = {}

    marker_map = {
        "policy_object": "政策对象",
        "policy_conditions": "政策条件",
        "payment_standards": "兑付标准",
        "contact": "联系方式",
    }

    lines = text.split("\n")
    current_section = None
    current_lines = []

    for line in lines:
        stripped = line.strip()
        is_header = stripped in marker_map.values()

        if is_header:
            if current_section:
                result[current_section] = "\n".join(current_lines).strip()
            current_section = [k for k, v in marker_map.items() if v == stripped][0]
            current_lines = []
        elif current_section:
            if stripped:
                current_lines.append(stripped)

    if current_section:
        result[current_section] = "\n".join(current_lines).strip()

    # 元数据
    lead = re.search(r"牵头部门\s+\n\s+(.+?)\s*\n", text)
    if lead:
        result["lead_dept"] = lead.group(1).strip()

    period = re.search(r"申报期限\s+\n\s+(\d{4}-\d{2})\s+至\s+(\d{4}-\d{2})", text)
    if period:
        result["start_date"] = period.group(1)
        result["end_date"] = period.group(2)

    method = re.search(r"兑付方式\s+\n\s+(.+?)\s*\n", text)
    if method:
        result["payment_method"] = method.group(1).strip()

    publish = re.search(r"发布时间\s+\n\s+(\d{4}-\d{2})", text)
    if publish:
        result["publish_date"] = publish.group(1)

    return result


async def scrape_detail(
    browser, item: dict, semaphore: asyncio.Semaphore
) -> dict | None:
    """抓取单条详情"""
    async with semaphore:
        sid = item.get("id", "")
        bid = item.get("specialBatchId", "")
        if not sid or not bid:
            return None

        url = (
            f"https://pyd.pudong.gov.cn/website/pud/policyretrieval/details"
            f"?specialBatchId={bid}&specialId={sid}&ZCZD=1&isWebShow=1"
        )

        api_data = {}
        ctx = await browser.new_context()

        async def on_response(resp):
            if "get-special-single" in resp.url and resp.status == 200:
                try:
                    d = await resp.json()
                    api_data.update(d)
                except Exception:
                    pass

        try:
            page = await ctx.new_page()
            page.on("response", on_response)

            await page.goto(url, timeout=60000, wait_until="domcontentloaded")
            await asyncio.sleep(4)

            text = await page.inner_text("body")
            dom_fields = parse_detail_text(text)

            # 合并：list数据 + API详情 + DOM富文本
            result = {**item}
            result.update({k: v for k, v in api_data.items() if k not in result})
            result.update(dom_fields)
            result["_detail_url"] = url

            return result

        except Exception as e:
            print(f"  [!] {sid}: {e}")
            return None
        finally:
            await ctx.close()


async def main():
    parser = argparse.ArgumentParser(description="浦易达详情爬虫 v1")
    parser.add_argument(
        "-i", "--input",
        type=Path,
        default=Path("/tmp/pudong_policies_v5.json"),
        help="输入列表 JSON"
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("/tmp/pudong_detail_v1.json"),
        help="输出 JSON 路径"
    )
    parser.add_argument(
        "--max",
        type=int,
        default=None,
        help="最多抓取条数（用于测试）"
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=5,
        help="并发数（默认5）"
    )
    args = parser.parse_args()

    items = json.loads(args.input.read_text(encoding="utf-8"))
    if args.max:
        items = items[: args.max]

    print(f"待抓取: {len(items)} 条详情（并发 {args.concurrency}）...")

    browser = await browser_launch(headless=True)
    semaphore = asyncio.Semaphore(args.concurrency)

    results = []
    tasks = [
        scrape_detail(browser, item, semaphore) for item in items
    ]

    for i, coro in enumerate(asyncio.as_completed(tasks), 1):
        result = await coro
        if result:
            results.append(result)
            print(f"  [{i}/{len(items)}] {result.get('name', '?')[:40]}")
        else:
            print(f"  [{i}/{len(items)}] 失败")

    await browser.close()

    print(f"\n成功: {len(results)} / {len(items)}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"已保存到 {args.output}")


if __name__ == "__main__":
    asyncio.run(main())
