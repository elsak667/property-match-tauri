#!/usr/bin/env python3
"""
浦易达官网政策爬虫 - Playwright 版本
用 .ant-pagination-item-{n} 精确点击页码，拦截 API 响应收集数据
修复：线程安全、动态页数、增量抓取、CLI 参数、content 字段提取
"""
import argparse
import json
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


def parse_args():
    parser = argparse.ArgumentParser(description="浦易达政策爬虫")
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("/tmp/pudong_policies_raw.json"),
        help="输出 JSON 文件路径（默认 /tmp/pudong_policies_raw.json）"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="增量模式：从已有 JSON 文件读取已有 ID，追加新数据"
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="最多抓取页数（默认自动检测）"
    )
    return parser.parse_args()


def main():
    args = parse_args()
    output_path: Path = args.output
    resume_mode = args.resume
    max_pages = args.max_pages

    print("开始抓取浦易达政策...")

    # 增量模式：加载已有 ID
    all_items = []
    seen_ids = set()
    if resume_mode and output_path.exists():
        existing = json.loads(output_path.read_text(encoding="utf-8"))
        for item in existing:
            seen_ids.add(item["id"])
            all_items.append(item)
        print(f"增量模式：已加载 {len(all_items)} 条已有记录")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        collected: dict[int, list] = {}
        lock = threading.Lock()

        def on_response(resp):
            if "r2509/special/" in resp.url and resp.status == 200:
                try:
                    raw = resp.json()
                    if isinstance(raw, dict) and "items" in raw:
                        items = raw.get("items", [])
                        cp = raw.get("currentPage", 0)
                        if items and cp:
                            with lock:
                                if cp not in collected:
                                    collected[cp] = items
                                    print(f"[DEBUG] collected page {cp}, {len(items)} items, url={resp.url[:80]}")
                except Exception:
                    pass

        page.on("response", on_response)
        page.goto(
            "https://pyd.pudong.gov.cn/website/pud/policyretrieval",
            timeout=30000,
            wait_until="load"
        )
        time.sleep(5)

        # 等待第1页
        for _ in range(20):
            with lock:
                has_page_1 = 1 in collected
            if has_page_1:
                break
            time.sleep(0.5)

        with lock:
            has_page_1 = 1 in collected
        if not has_page_1:
            print("第1页数据获取失败")
            return

        # 动态检测总页数
        total_pages = None
        if max_pages is None:
            total_pages = page.evaluate('''
                () => {
                    const btns = document.querySelectorAll(".ant-pagination-item");
                    if (!btns.length) return null;
                    const pageNums = [];
                    btns.forEach(b => {
                        const m = b.className.match(/ant-pagination-item-(\d+)/);
                        if (m) pageNums.push(parseInt(m[1]));
                    });
                    return pageNums.length ? Math.max(...pageNums) : null;
                }
            ''')
            if total_pages is None:
                print("无法检测总页数，使用默认值 34")
                total_pages = 34
            else:
                print(f"检测到总页数：{total_pages}")
        else:
            total_pages = max_pages

        # 收集第1页
        with lock:
            items_page_1 = collected[1]
        for item in items_page_1:
            if item["id"] not in seen_ids:
                seen_ids.add(item["id"])
                enriched = _enrich_item(item)
                all_items.append(enriched)
        print(f"第1页: +{len(items_page_1)} 条, 累计 {len(all_items)}")

        # 翻页
        for page_num in range(2, total_pages + 1):
            clicked = page.evaluate(f'''
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

            # 等待该页数据（最多15秒）
            for _ in range(30):
                with lock:
                    has_page = page_num in collected
                if has_page:
                    break
                time.sleep(0.5)

            with lock:
                has_page = page_num in collected
            if not has_page:
                print(f"第{page_num}页: 数据未到达，停止")
                break

            with lock:
                items = collected[page_num]
            new_count = 0
            for item in items:
                if item["id"] not in seen_ids:
                    seen_ids.add(item["id"])
                    enriched = _enrich_item(item)
                    all_items.append(enriched)
                    new_count += 1
            print(f"第{page_num}页: +{new_count} 条, 累计 {len(all_items)}")

        browser.close()

    print(f"\n共抓取: {len(all_items)} 条")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(all_items, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"已保存到 {output_path}")


def _enrich_item(item: dict) -> dict:
    """
    提取并统一政策条目关键字段，保证匹配算法有内容可用。
    """
    return {
        "id": item.get("id"),
        "title": item.get("title") or item.get("name") or "",
        "abstract": item.get("abstract") or item.get("summary") or item.get("description") or "",
        "content": item.get("content") or item.get("detail") or item.get("text") or "",
        "publish_date": item.get("publishDate") or item.get("publish_date")
                        or item.get("publishTime") or item.get("date") or "",
        "source": item.get("source") or item.get("department") or "浦易达",
        "url": item.get("url") or item.get("link") or "",
        "raw": item,
    }


if __name__ == "__main__":
    main()
