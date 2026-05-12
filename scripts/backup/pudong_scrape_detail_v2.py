#!/usr/bin/env python3
"""
浦易达政策详情爬虫 - v2
抓取 /tmp/pudong_policies_v5.json 中所有296条的详情页

优化策略（相比 v1）：
  - 并发 3 + 事件等待（10s timeout）= ~3.7s/item，约18分钟全量
  - v1 固定 sleep 方案约 27 分钟
  - 同时捕获 API（content.content、conditionGroupList 等）+ DOM 字段

v2 新增字段：
  - content.content: 政策原文完整 HTML
  - conditionGroupList: 结构化申报条件列表
  - applyTags: 政策标签
  - declareAttach: 申报附件列表
  - declareObject / declareCondition / supportStandard: 结构化内容
  - declareStartTime / declareEndTime: 申报时间窗口

用法：
  python pudong_scrape_detail_v2.py                      # 抓全量
  python pudong_scrape_detail_v2.py --max 5              # 测试5条
  python pudong_scrape_detail_v2.py -o /path/to/out.json  # 指定输出
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
    """抓取单条详情：同时捕获 policy/policy API + DOM 文本"""
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
        done = asyncio.Event()

        ctx = await browser.new_context()

        async def on_response(resp):
            if "/policy/policy/" in resp.url and resp.status == 200:
                try:
                    d = await resp.json()
                    api_data.update(d)
                    done.set()
                except Exception:
                    pass

        try:
            page = await ctx.new_page()
            page.on("response", on_response)

            await page.goto(url, timeout=60000, wait_until="domcontentloaded")

            # 等待 API 响应（最多10s），超时也继续用 DOM
            try:
                await asyncio.wait_for(done.wait(), timeout=10)
            except asyncio.TimeoutError:
                pass

            text = await page.inner_text("body")
            dom_fields = parse_detail_text(text)

            # 合并：list数据 + API详情（优先）+ DOM富文本
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
    parser = argparse.ArgumentParser(description="浦易达详情爬虫 v2（优化版）")
    parser.add_argument(
        "-i", "--input",
        type=Path,
        default=Path("/tmp/pudong_policies_v5.json"),
        help="输入列表 JSON"
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("/tmp/pudong_detail_v2.json"),
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
        default=3,
        help="并发数（默认3）"
    )
    args = parser.parse_args()

    items = json.loads(args.input.read_text(encoding="utf-8"))
    if args.max:
        items = items[: args.max]

    print(
        f"待抓取: {len(items)} 条详情（并发 {args.concurrency}，"
        f"预估 ~{3.7 * len(items) / 60:.0f} 分钟）..."
    )

    browser = await browser_launch(headless=True)
    semaphore = asyncio.Semaphore(args.concurrency)

    results = []
    tasks = [scrape_detail(browser, item, semaphore) for item in items]

    for i, coro in enumerate(asyncio.as_completed(tasks), 1):
        result = await coro
        if result:
            results.append(result)
            api_extra = len(result) - len(items[0])
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
