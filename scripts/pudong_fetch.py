#!/usr/bin/env python3
"""
浦易达政策抓取脚本 - 一体化版
列表 API → 详情页补全 → JSON输出

用法：
  python pudong_fetch.py                      # 全量抓取
  python pudong_fetch.py --resume             # 增量（只抓新的）
  python pudong_fetch.py -o /path/to/out.json # 指定输出
"""
import argparse
import asyncio
import json
from pathlib import Path

from cloakbrowser import launch_async as browser_launch


def parse_args():
    parser = argparse.ArgumentParser(description="浦易达政策抓取")
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("/tmp/pudong_policies_full.json"),
        help="输出 JSON 路径"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="增量模式：从已有 JSON 读已有 ID，追加新数据"
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=10,
        help="详情页并发数（默认10）"
    )
    parser.add_argument(
        "--max-detail",
        type=int,
        default=None,
        help="最多抓取详情数（用于测试）"
    )
    return parser.parse_args()


async def fetch_list(browser):
    """抓取列表页，返回所有政策"""
    collected_pages = {}
    total_pages = 0
    all_items = []
    seen_ids = set()

    ctx = await browser.new_context()
    page = await ctx.new_page()

    def build_url(page_idx):
        return (
            f"https://pyd.pudong.gov.cn/pdkjwpolicy-mobileapi/r2509/special/"
            f"?pageIndex={page_idx}&pageSize=20&businessType=policy"
            f"&r2509Area=1&r2509IsWebShow=1&ZCZD=1&isWebShow=1"
        )

    async def on_response(resp):
        nonlocal total_pages
        url = resp.url
        if "pdkjwpolicy-mobileapi/r2509/special/" in url and resp.status == 200:
            try:
                data = await resp.json()
                if isinstance(data, dict) and "items" in data:
                    cp = data.get("currentPage", 0)
                    tp = data.get("totalPages", 0)
                    if cp and cp not in collected_pages:
                        collected_pages[cp] = data
                        if not total_pages:
                            total_pages = tp
                        for item in data["items"]:
                            item_id = item.get("id")
                            if item_id and item_id not in seen_ids:
                                seen_ids.add(item_id)
                                all_items.append(item)
            except Exception:
                pass

    page.on("response", on_response)

    await page.goto(build_url(1), timeout=30000)
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(2)

    for _ in range(40):
        if 1 in collected_pages:
            break
        await asyncio.sleep(0.5)

    if not collected_pages:
        print("第1页数据获取失败")
        await ctx.close()
        return []

    print(f"检测到总页数：{total_pages}")

    for page_num in range(2, total_pages + 1):
        if page_num in collected_pages:
            continue
        await page.evaluate(f"""
            () => {{
                const btn = document.querySelector(".ant-pagination-item-{page_num} a");
                if (btn) btn.click();
            }}
        """)
        for _ in range(30):
            active = await page.evaluate(
                '() => document.querySelector(".ant-pagination-item-active")?.innerText'
            )
            if active == str(page_num):
                await asyncio.sleep(2)
                break
            await asyncio.sleep(0.5)
        for _ in range(20):
            if page_num in collected_pages:
                break
            await asyncio.sleep(0.5)

    await ctx.close()
    return all_items


async def fetch_detail(browser, item, semaphore):
    """抓取单条详情页"""
    async with semaphore:
        sid = item.get("id", "")
        bid = item.get("specialBatchId", "")
        if not sid or not bid:
            return item

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

            try:
                await asyncio.wait_for(done.wait(), timeout=10)
            except asyncio.TimeoutError:
                pass

            result = {**item}
            result.update({k: v for k, v in api_data.items() if k not in result})
            return result
        except Exception:
            return item
        finally:
            await ctx.close()


async def main():
    args = parse_args()

    print("开始抓取浦易达政策...")

    all_items = []
    seen_ids = set()
    if args.resume and args.output.exists():
        existing = json.loads(args.output.read_text(encoding="utf-8"))
        for item in existing:
            seen_ids.add(item.get("id", ""))
            all_items.append(item)
        print(f"增量模式：已加载 {len(all_items)} 条已有记录")

    print("Step 1: 抓取列表...")
    async with (await browser_launch(headless=True)) as browser:
        new_items = await fetch_list(browser)
        if args.resume:
            for item in new_items:
                if item.get("id") not in seen_ids:
                    all_items.append(item)
                    seen_ids.add(item.get("id"))
        else:
            all_items = new_items

    print(f"列表抓取完成：{len(all_items)} 条")

    if args.max_detail:
        all_items = all_items[:args.max_detail]

    print(f"Step 2: 补全详情（并发 {args.concurrency}）...")
    async with (await browser_launch(headless=True)) as browser:
        semaphore = asyncio.Semaphore(args.concurrency)
        tasks = [fetch_detail(browser, item, semaphore) for item in all_items]

        done_count = 0
        for coro in asyncio.as_completed(tasks):
            result = await coro
            done_count += 1
            print(f"  [{done_count}/{len(all_items)}] {result.get('name', '?')[:40]}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(all_items, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"已保存到 {args.output}")


if __name__ == "__main__":
    asyncio.run(main())
