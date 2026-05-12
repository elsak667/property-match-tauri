#!/usr/bin/env python3
"""
浦易达官网政策爬虫 - DOM 提取版本
通过点击分页按钮触发页面渲染，直接从 DOM 提取政策列表数据
解决第2页及之后 API 返回 ACCESS_DENIED 的问题
"""
import argparse
import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


def parse_args():
    parser = argparse.ArgumentParser(description="浦易达政策爬虫（DOM提取版）")
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


def extract_page_items(page) -> list[dict]:
    """从当前 DOM 提取政策列表数据"""
    return page.evaluate("""
        () => {
            const items = document.querySelectorAll(".retrieval-list-item");
            return Array.from(items).map(item => {
                const customColor4s = Array.from(item.querySelectorAll(".custom-color4"))
                    .map(el => el.innerText.trim());
                let publishDate = customColor4s[0] || "";
                let dept = "";
                let fundingAmount = "";

                if (customColor4s.length === 2) {
                    dept = customColor4s[1] || "";
                } else if (customColor4s.length >= 3) {
                    const second = customColor4s[1] || "";
                    if (second.includes("万") || second.includes("元")) {
                        fundingAmount = second;
                        dept = customColor4s[2] || "";
                    } else {
                        dept = customColor4s[1] || "";
                    }
                }

                return {
                    title: item.querySelector(".col-title")?.innerText?.trim() || "",
                    status: item.querySelector(".list-left-top")?.innerText?.trim() || "",
                    remaining_days: item.querySelector(".list-left-bottom")?.innerText?.trim() || "",
                    policy_type: item.querySelector(".new-tag-custom")?.innerText?.trim() || "",
                    publish_date: publishDate,
                    department: dept,
                    funding_amount: fundingAmount,
                };
            });
        }
    """)


def wait_for_page(page, expected_page_num: str, timeout: float = 5000) -> bool:
    """等待分页切换到指定页码（轮询方式）"""
    deadline = time.time() + timeout / 1000
    while time.time() < deadline:
        active = page.evaluate(
            '() => document.querySelector(".ant-pagination-item-active")?.innerText'
        )
        if active == expected_page_num:
            # 额外等 DOM 稳定
            time.sleep(1.0)
            return True
        time.sleep(0.1)
    return False


def detect_total_pages(page) -> int | None:
    """动态检测总页数"""
    try:
        page.wait_for_selector(".ant-pagination-item", timeout=5000)
    except Exception:
        return None

    nums = page.evaluate("""
        () => {
            const btns = document.querySelectorAll(".ant-pagination-item");
            const nums = [];
            btns.forEach(b => {
                const m = b.className.match(/ant-pagination-item-(\d+)/);
                if (m) nums.push(parseInt(m[1]));
            });
            return nums.length ? Math.max(...nums) : null;
        }
    """)
    return nums


def main():
    args = parse_args()
    output_path: Path = args.output
    resume_mode = args.resume
    max_pages = args.max_pages

    print("开始抓取浦易达政策（DOM提取模式）...")

    all_items = []
    seen_ids = set()
    if resume_mode and output_path.exists():
        existing = json.loads(output_path.read_text(encoding="utf-8"))
        for item in existing:
            seen_ids.add(item.get("id") or item.get("title", ""))
            all_items.append(item)
        print(f"增量模式：已加载 {len(all_items)} 条已有记录")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        page.goto(
            "https://pyd.pudong.gov.cn/website/pud/policyretrieval",
            timeout=30000,
            wait_until="networkidle",
        )
        time.sleep(2)

        total_pages = max_pages
        if total_pages is None:
            total_pages = detect_total_pages(page)
            if total_pages is None:
                print("无法检测总页数，使用默认值 34")
                total_pages = 34
            else:
                print(f"检测到总页数：{total_pages}")

        # 第1页
        items_p1 = extract_page_items(page)
        for item in items_p1:
            item_id = item["title"]
            if item_id not in seen_ids:
                seen_ids.add(item_id)
                item["id"] = item_id
                all_items.append(item)
        print(f"第1页: +{len(items_p1)} 条, 累计 {len(all_items)}")

        # 翻页
        for page_num in range(2, total_pages + 1):
            btn = page.query_selector(f".ant-pagination-item-{page_num} a")
            if not btn:
                print(f"第{page_num}页: 按钮未找到，停止")
                break

            btn.click()

            if not wait_for_page(page, str(page_num), timeout=5000):
                print(f"第{page_num}页: 切换超时，停止")
                break

            items = extract_page_items(page)
            new_count = 0
            for item in items:
                item_id = item["title"]
                if item_id not in seen_ids:
                    seen_ids.add(item_id)
                    item["id"] = item_id
                    all_items.append(item)
                    new_count += 1

            print(f"第{page_num}页: +{new_count} 条, 累计 {len(all_items)}")
            time.sleep(0.5)

        browser.close()

    print(f"\n共抓取: {len(all_items)} 条")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(all_items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"已保存到 {output_path}")


if __name__ == "__main__":
    main()
