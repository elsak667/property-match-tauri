#!/usr/bin/env python3
import json, time
from playwright.sync_api import sync_playwright

def main():
    print("开始抓取浦易达政策...")
    all_items = []
    seen_ids = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        collected = {}

        def on_response(resp):
            if "r2509/special/" in resp.url and resp.status == 200:
                try:
                    raw = resp.json()
                    if isinstance(raw, dict) and "items" in raw:
                        items = raw.get("items", [])
                        cp = raw.get("currentPage", 0)
                        if items and cp and cp not in collected:
                            collected[cp] = items
                except:
                    pass

        page.on("response", on_response)
        page.goto("https://pyd.pudong.gov.cn/website/pud/policyretrieval",
                  timeout=20000, wait_until="networkidle")
        time.sleep(2)

        for _ in range(20):
            if 1 in collected:
                break
            time.sleep(0.5)

        if 1 not in collected:
            print("第1页数据获取失败")
            return

        items = collected[1]
        for item in items:
            iid = item["id"]
            if iid not in seen_ids:
                seen_ids.add(iid)
                all_items.append(item)
        print(f"第1页: +{len(items)} 条, 累计 {len(all_items)}")

        for page_num in range(2, 35):
            clicked = page.evaluate(f"() => {{ const btn = document.querySelector('.ant-pagination-item-{page_num} a'); if(!btn) return 'not found'; btn.click(); return 'ok'; }}")
            if clicked != "ok":
                print(f"第{page_num}页: 按钮未找到，停止")
                break
            for _ in range(30):
                if page_num in collected:
                    break
                time.sleep(0.5)
            if page_num not in collected:
                print(f"第{page_num}页: 数据未到达，停止")
                break
            items = collected[page_num]
            for item in items:
                iid = item["id"]
                if iid not in seen_ids:
                    seen_ids.add(iid)
                    all_items.append(item)
            print(f"第{page_num}页: +{len(items)} 条, 累计 {len(all_items)}")

        browser.close()

    print(f"\n共抓取: {len(all_items)} 条")
    with open("/tmp/pudong_policies_raw.json", "w", encoding="utf-8") as f:
        json.dump(all_items, f, ensure_ascii=False, indent=2)
    print("已保存到 /tmp/pudong_policies_raw.json")

if __name__ == "__main__":
    main()
