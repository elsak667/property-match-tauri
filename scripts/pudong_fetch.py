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

import requests

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
        "--max-pages",
        type=int,
        default=None,
        help="最多抓取页数（默认自动检测）"
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
    parser.add_argument(
        "--apply-status",
        type=int,
        default=None,
        help="按申报状态过滤：1=未开始, 2=申报中（默认全量）"
    )
    parser.add_argument(
        "--wait-seconds",
        type=int,
        default=5,
        help="详情页等待 content 响应秒数（默认5）"
    )
    parser.add_argument(
        "--retry-missing",
        action="store_true",
        help="只重试无 content 的记录（需配合 --input）"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="从已有 JSON 读取记录（用于重试）"
    )
    return parser.parse_args()


async def fetch_list(browser, apply_status=None):
    """抓取列表页，返回政策列表
    apply_status: None=全量, 1=未开始, 2=申报中
    """
    collected_pages = {}
    total_pages = 0
    all_items = []
    seen_ids = set()

    ctx = await browser.new_context()
    page = await ctx.new_page()

    params = "businessType=policy&r2509Area=1&r2509IsWebShow=1&ZCZD=1&isWebShow=1"
    if apply_status is not None:
        params += f"&applyStatus={apply_status}"

    def build_url(page_idx):
        return f"https://pyd.pudong.gov.cn/pdkjwpolicy-mobileapi/r2509/special/?pageIndex={page_idx}&pageSize=20&{params}"

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

    status_label = {1: "未开始", 2: "申报中"}.get(apply_status, "全量")
    print(f"  [{status_label}] 抓取列表...")
    await page.goto("https://pyd.pudong.gov.cn/website/pud/policyretrieval" +
                    (f"?applyStatus={apply_status}" if apply_status is not None else ""),
                    timeout=30000)
    await page.wait_for_load_state("networkidle")
    await asyncio.sleep(3)

    # 等待第1页
    for _ in range(40):
        if 1 in collected_pages:
            break
        await asyncio.sleep(0.5)

    if not collected_pages:
        print("第1页数据获取失败")
        await ctx.close()
        return []

    print(f"检测到总页数：{total_pages}")

    # 翻页
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


async def fetch_detail(browser, item, semaphore, wait_seconds=5, apply_status=None):
    """抓取单条详情：
    1. get-special-single → 基础字段（name、dates、policyId）
    2. Playwright 访问详情页，拦截 /policy/policy/{policyId} → 完整 content
    合并结果
    """
    async with semaphore:
        sid = item.get("id", "")
        bid = item.get("specialBatchId", "")
        pid = item.get("policyId", "")
        if not sid or not bid:
            return item

        result = {**item}

        # 标记申报状态（已从列表合并时设置的，保留）
        if apply_status is not None:
            result.setdefault("applyStatus", apply_status)

        # Step 1: get-special-single — 获取基础字段（快，直接调）
        try:
            resp = requests.get(
                f"https://pyd.pudong.gov.cn/pdkjwpolicy-mobileapi/r2509/special/get-special-single?id={sid}&specialBatchId={bid}",
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Referer": "https://pyd.pudong.gov.cn/",
                },
                timeout=15,
                proxies={"http": None, "https": None}
            )
            if resp.status_code == 200:
                data = resp.json()
                if data:
                    result.update({k: v for k, v in data.items() if k not in result})
        except Exception:
            pass

        # Step 2: Playwright 访问详情页，拦截 content
        if pid:
            detail_url = (
                f"https://pyd.pudong.gov.cn/website/pud/policyretrieval/details"
                f"?specialBatchId={bid}&specialId={sid}&ZCZD=1&isWebShow=1"
            )
            ctx = await browser.new_context()
            policy_data = {}

            async def on_response(resp):
                if f"/policy/policy/{pid}" in resp.url and resp.status == 200:
                    try:
                        d = await resp.json()
                        if d.get("content") or d.get("conditions"):
                            policy_data.update(d)
                    except Exception:
                        pass

            try:
                page = await ctx.new_page()
                page.on("response", on_response)
                await page.goto(detail_url, timeout=30000, wait_until="domcontentloaded")
                await asyncio.sleep(wait_seconds)
                result.update({k: v for k, v in policy_data.items() if k not in result})
            except Exception:
                pass
            finally:
                await ctx.close()

        has_content = bool(result.get("content") or result.get("conditions"))
        print(f"  [{'✓' if has_content else '✗'}] {item.get('name', '?')[:40]}")
        return result


async def main():
    args = parse_args()

    print("开始抓取浦易达政策...")

    # 加载已有记录或抓新列表
    print("开始抓取浦易达政策...")

    all_items = []
    seen_ids = set()

    if args.input and args.input.exists():
        # 从已有 JSON 加载（用于重试）
        existing = json.loads(args.input.read_text(encoding="utf-8"))
        for item in existing:
            sid = item.get("id", "")
            seen_ids.add(sid)
            all_items.append(item)
        print(f"已从 {args.input} 加载 {len(all_items)} 条记录")
        if args.retry_missing:
            # 过滤只保留无 content 的记录
            all_items = [i for i in all_items if not i.get("content")]
            print(f"过滤无 content 后：{len(all_items)} 条")
    elif args.resume and args.output.exists():
        # 增量模式
        existing = json.loads(args.output.read_text(encoding="utf-8"))
        for item in existing:
            seen_ids.add(item.get("id", ""))
            all_items.append(item)
        print(f"增量模式：已加载 {len(all_items)} 条已有记录")

    # 抓取列表（--input 模式跳过，直接用文件数据）
    if args.input:
        print("Step 1: 跳过（从 --input 加载）")
    else:
        print("Step 1: 抓取列表...")
        async with (await browser_launch(headless=True)) as browser:
            if args.apply_status in (1, 2):
                items1 = await fetch_list(browser, apply_status=1)
                for item in items1:
                    item["applyStatus"] = 1
                items2 = await fetch_list(browser, apply_status=2)
                for item in items2:
                    item["applyStatus"] = 2
                seen2 = set()
                merged = []
                for items in [items1, items2]:
                    for item in items:
                        iid = item.get("id", "")
                        if iid and iid not in seen2:
                            seen2.add(iid)
                            merged.append(item)
                new_items = merged
            else:
                new_items = await fetch_list(browser)
            if args.resume:
                for item in new_items:
                    if item.get("id") not in seen_ids:
                        all_items.append(item)
                        seen_ids.add(item.get("id"))
            else:
                all_items = new_items
        print(f"列表抓取完成：{len(all_items)} 条")

    # 详情补全
    if args.max_detail:
        all_items = all_items[:args.max_detail]

    print(f"Step 2: 补全详情（并发 {args.concurrency}，等待{args.wait_seconds}秒）...")
    async with (await browser_launch(headless=True)) as browser:
        semaphore = asyncio.Semaphore(args.concurrency)
        tasks = [fetch_detail(browser, item, semaphore, args.wait_seconds, args.apply_status) for item in all_items]

        done_count = 0
        results = []
        for i, coro in enumerate(asyncio.as_completed(tasks), 1):
            result = await coro
            done_count += 1
            results.append(result)
            print(f"  [{done_count}/{len(all_items)}] {result.get('name', '?')[:40]}")

    # 保存
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"已保存到 {args.output}")


if __name__ == "__main__":
    asyncio.run(main())
