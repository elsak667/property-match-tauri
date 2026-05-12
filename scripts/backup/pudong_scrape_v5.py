#!/usr/bin/env python3
"""
浦易达官网政策爬虫 - v5 (CloakBrowser版)
基于 v4 的 API 拦截逻辑，换用 CloakBrowser 绕过反爬
策略：拦截 pdkjwpolicy-mobileapi/r2509/special/ API 响应，收集所有页数据
每条数据包含 id + specialBatchId，可拼接详情页 URL

用法：
  python pudong_scrape_v5.py                      # 抓全量（34页）
  python pudong_scrape_v5.py --resume             # 增量（只抓新ID）
  python pudong_scrape_v5.py -o /path/to/output.json   # 指定输出路径
"""
import argparse
import asyncio
import json
from pathlib import Path

from cloakbrowser import launch_async as browser_launch


def parse_args():
    parser = argparse.ArgumentParser(description="浦易达政策爬虫 v5（CloakBrowser版）")
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("/tmp/pudong_policies_v5.json"),
        help="输出 JSON 文件路径"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="增量模式：从已有 JSON 读已有 ID，追加新数据"
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="最多抓取页数（默认自动检测）"
    )
    return parser.parse_args()


async def main():
    args = parse_args()
    output_path: Path = args.output
    resume_mode = args.resume
    max_pages = args.max_pages

    print("开始抓取浦易达政策（v5 CloakBrowser版）...")

    # 增量模式：加载已有 ID
    all_items = []
    seen_ids = set()
    if resume_mode and output_path.exists():
        existing = json.loads(output_path.read_text(encoding="utf-8"))
        for item in existing:
            seen_ids.add(item["id"])
            all_items.append(item)
        print(f"增量模式：已加载 {len(all_items)} 条已有记录")

    collected_pages: dict[int, dict] = {}
    total_pages = 0

    async with (await browser_launch(headless=True)) as browser:
        ctx = await browser.new_context()
        page = await ctx.new_page()

        async def on_response(resp):
            nonlocal total_pages
            url = resp.url
            if "pdkjwpolicy-mobileapi/r2509/special/" in url \
                    and "pageIndex" in url and resp.status == 200:
                try:
                    data = await resp.json()
                    if isinstance(data, dict) and "items" in data:
                        cp = data.get("currentPage", 0)
                        tp = data.get("totalPages", 0)
                        if cp and cp not in collected_pages:
                            collected_pages[cp] = data
                            if not total_pages:
                                total_pages = tp
                            new_count = 0
                            for item in data["items"]:
                                item_id = item.get("id")
                                if item_id and item_id not in seen_ids:
                                    seen_ids.add(item_id)
                                    all_items.append(item)
                                    new_count += 1
                            print(
                                f"[API] page {cp}/{tp}, "
                                f"+{new_count} new / {len(data['items'])} total, "
                                f"累计 {len(all_items)}"
                            )
                except Exception:
                    pass

        page.on("response", on_response)

        await page.goto(
            "https://pyd.pudong.gov.cn/website/pud/policyretrieval",
            timeout=30000,
        )
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(3)

        # 等待第1页数据
        for _ in range(40):
            if 1 in collected_pages:
                break
            await asyncio.sleep(0.5)
        else:
            print("第1页数据获取失败")
            await browser.close()
            return

        if max_pages:
            total_pages = min(max_pages, total_pages)
            print(f"限制最大 {total_pages} 页")
        else:
            print(f"检测到总页数：{total_pages}")

        # 翻页（2..total_pages）
        for page_num in range(2, total_pages + 1):
            if page_num in collected_pages:
                continue

            clicked = await page.evaluate(f"""
                () => {{
                    const btn = document.querySelector(".ant-pagination-item-{page_num} a");
                    if (!btn) return "not_found";
                    btn.click();
                    return "ok";
                }}
            """)
            if clicked != "ok":
                print(f"第{page_num}页: 按钮未找到，停止")
                break

            # 等待分页器切换到目标页
            for _ in range(30):
                active = await page.evaluate(
                    '() => document.querySelector(".ant-pagination-item-active")?.innerText'
                )
                if active == str(page_num):
                    await asyncio.sleep(2)
                    break
                await asyncio.sleep(0.5)
            else:
                print(f"第{page_num}页: 切换超时，停止")
                break

            # 等待 API 响应数据
            for _ in range(20):
                if page_num in collected_pages:
                    break
                await asyncio.sleep(0.5)
            else:
                print(f"第{page_num}页: 数据未到达，停止")
                break

        await browser.close()

    print(f"\n共抓取: {len(all_items)} 条（来自 {len(collected_pages)} 页）")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(all_items, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"已保存到 {output_path}")

    # 生成详情页 URL 列表
    detail_urls_path = output_path.with_suffix(".detail_urls.txt")
    with open(detail_urls_path, "w", encoding="utf-8") as f:
        for item in all_items:
            special_id = item.get("id", "")
            batch_id = item.get("specialBatchId", "")
            if special_id and batch_id:
                url = (
                    f"https://pyd.pudong.gov.cn/website/pud/policyretrieval/details"
                    f"?specialBatchId={batch_id}&specialId={special_id}&ZCZD=1&isWebShow=1"
                )
                f.write(url + "\n")
    print(f"详情页URL已保存到 {detail_urls_path}")


if __name__ == "__main__":
    asyncio.run(main())
