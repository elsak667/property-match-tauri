#!/usr/bin/env python3
"""
浦易达官网政策爬虫 - Playwright v4 (async版)
策略：拦截 pdkjwpolicy-mobileapi/r2509/special/ API 响应，收集所有页数据
每条数据包含 specialId + specialBatchId，可拼接详情页 URL

用法：
  python pudong_scrape_v4.py                      # 抓全量（34页）
  python pudong_scrape_v4.py --resume            # 增量（只抓新ID）
  python pudong_scrape_v4.py -o /path/to/output.json   # 指定输出路径
"""
import argparse
import asyncio
import json
import time
from pathlib import Path

from playwright.async_api import async_playwright


def parse_args():
    parser = argparse.ArgumentParser(description="浦易达政策爬虫 v4（API拦截版）")
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("/tmp/pudong_policies_v4.json"),
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

    print("开始抓取浦易达政策（v4 API拦截版）...")

    # 增量模式：加载已有 ID
    all_items = []
    seen_ids = set()
    if resume_mode and output_path.exists():
        existing = json.loads(output_path.read_text(encoding="utf-8"))
        for item in existing:
            seen_ids.add(item["id"])
            all_items.append(item)
        print(f"增量模式：已加载 {len(all_items)} 条已有记录")

    collected: dict[int, dict] = {}

    async def on_response(resp):
        try:
            url = resp.url
            if "pdkjwpolicy-mobileapi/r2509/special/" in url and resp.status == 200:
                raw = await resp.json()
                if isinstance(raw, dict) and "currentPage" in raw:
                    cp = raw.get("currentPage", 0)
                    if cp and cp not in collected:
                        collected[cp] = raw
                        print(f"[API] page {cp}/{raw.get('totalPages', '?')}, {len(raw.get('items', []))} items")
        except Exception:
            pass

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})

        page.on("response", on_response)
        await page.goto(
            "https://pyd.pudong.gov.cn/website/pud/policyretrieval",
            timeout=30000,
            wait_until="networkidle",
        )
        await asyncio.sleep(3)

        # 等待第1页
        for _ in range(20):
            if 1 in collected:
                break
            await asyncio.sleep(0.5)

        if 1 not in collected:
            print("第1页数据获取失败")
            await browser.close()
            return

        total_pages = max_pages
        if total_pages is None:
            total_pages = collected[1].get("totalPages", 0)
            print(f"检测到总页数：{total_pages}")
        else:
            print(f"限制最大 {total_pages} 页")

        # 收集第1页
        items_p1 = collected[1].get("items", [])
        for item in items_p1:
            item_id = item["id"]
            if item_id not in seen_ids:
                seen_ids.add(item_id)
                all_items.append(item)
        print(f"第1页: +{len(items_p1)} 条, 累计 {len(all_items)}")

        # 翻页（2..total_pages）
        for page_num in range(2, total_pages + 1):
            clicked = await page.evaluate(f'''
                () => {{
                    const btn = document.querySelector(".ant-pagination-item-{page_num} a");
                    if (!btn) return "not found";
                    btn.click();
                    return "ok";
                }}
            ''')
            if clicked != "ok":
                print(f"第{page_num}页: 按钮未找到，停止")
                break

            # 等待分页器切换完成
            for _ in range(30):
                active = await page.evaluate(
                    '() => document.querySelector(".ant-pagination-item-active")?.innerText'
                )
                if active == str(page_num):
                    await asyncio.sleep(2)  # 等API响应处理完成（关键！）
                    break
                await asyncio.sleep(0.5)
            else:
                print(f"第{page_num}页: 切换超时，停止")
                break

            # 等待该页数据到达
            for _ in range(30):
                if page_num in collected:
                    break
                await asyncio.sleep(0.5)
            else:
                print(f"第{page_num}页: 数据未到达，停止")
                break

            items = collected[page_num].get("items", [])
            new_count = 0
            for item in items:
                item_id = item["id"]
                if item_id not in seen_ids:
                    seen_ids.add(item_id)
                    all_items.append(item)
                    new_count += 1
            print(f"第{page_num}页: +{new_count} 条, 累计 {len(all_items)}")

        await browser.close()

    print(f"\n共抓取: {len(all_items)} 条")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(all_items, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"已保存到 {output_path}")

    # 同时生成详情页 URL 列表
    detail_urls_path = output_path.with_suffix(".detail_urls.txt")
    with open(detail_urls_path, "w", encoding="utf-8") as f:
        for item in all_items:
            special_id = item.get("id", "")
            batch_id = item.get("specialBatchId", "")
            if special_id and batch_id:
                url = f"https://pyd.pudong.gov.cn/website/pud/policyretrieval/details?specialBatchId={batch_id}&specialId={special_id}&ZCZD=1&isWebShow=1"
                f.write(url + "\n")
    print(f"详情页URL已保存到 {detail_urls_path}")


if __name__ == "__main__":
    asyncio.run(main())
