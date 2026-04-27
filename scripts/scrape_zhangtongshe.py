#!/usr/bin/env python3
"""
张通社新闻抓取 → 飞书表格
Usage: python scripts/scrape_zhangtongshe.py [--dry-run] [--limit 50]
"""
import os
import sys
import argparse
import re
import json

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

FEISHU_APP_ID = os.getenv("FEISHU_APP_ID", "cli_a950307a10b8dcb1")
FEISHU_APP_SECRET = os.getenv("FEISHU_APP_SECRET", "TFlBj160Jm4p48uZ3t4RETpL3qz1oxaj")
NEWS_SHEET_TOKEN = "JtEFsWqVRhPyPetC7Jyc19Oongt"
NEWS_SHEET_ID = "b6daf2"  # 第一个 Sheet tab 的 ID
TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
SHEET_URL = "https://open.feishu.cn/open-apis/sheets/v2/spreadsheets"

import urllib.request

def get_token():
    payload = json.dumps({"app_id": FEISHU_APP_ID, "app_secret": FEISHU_APP_SECRET}).encode()
    req = urllib.request.Request(TOKEN_URL, data=payload,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.load(resp)
    if data.get("code") != 0:
        raise Exception(f"Token error {data.get('code')}: {data.get('msg')}")
    return data["tenant_access_token"]

def read_sheet(token, range_str="A2:E200"):
    url = f"{SHEET_URL}/{NEWS_SHEET_TOKEN}/values/{NEWS_SHEET_ID}!{range_str}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.load(resp)
    if data.get("code") != 0:
        raise Exception(f"Sheet read error {data.get('code')}: {data.get('msg')}")
    return data.get("data", {}).get("valueRange", {}).get("values", [])

def append_rows(token, rows):
    url = f"{SHEET_URL}/{NEWS_SHEET_TOKEN}/values"
    col_letter = chr(65 + len(rows[0]) - 1)
    payload = {
        "valueRange": {
            "range": f"{NEWS_SHEET_ID}!A2:{col_letter}{1 + len(rows)}",
            "values": rows
        }
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="PUT")
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.load(resp)
    return result.get("code") == 0

def fetch_news(limit=50):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("ERROR: playwright not installed. Run: pip install playwright && playwright install chromium")
        sys.exit(1)

    print(f"Fetching https://www.zhangtongshe.com/news ...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://www.zhangtongshe.com/news", wait_until="networkidle", timeout=30000)
        text = page.inner_text("body")
        browser.close()
    return parse_news(text, limit)

def parse_news(html: str, limit: int):
    """解析张通社新闻。

    页面结构（按顺序）：
      日期行: "2026年04月27日，星期一"
      时间行: "10:00"
      标题行: "IPO | 上海新能源独角兽，拟赴港上市！"
      摘要行: 多行摘要文字...
    """
    date_pat = re.compile(r"(\d{4})年(\d{2})月(\d{2})日")
    time_pat = re.compile(r"^(\d{2}):(\d{2})$")
    title_pat = re.compile(r"^(IPO|投融资|人事|新增企业|政策|收并购|产业项目|新品发布|出海|业绩发布|人事|其他动态)\s*\|\s*(.+)$")

    lines = html.split("\n")
    items = []
    current_date = ""

    i = 0
    while i < len(lines) and len(items) < limit:
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        dm = date_pat.search(line)
        if dm:
            current_date = f"{dm.group(2)}/{dm.group(3)}"
            i += 1
            continue

        tm = time_pat.match(line)
        if tm and current_date:
            time_str = f"{tm.group(1)}:{tm.group(2)}"
            # 下一行是标题行
            i += 1
            if i >= len(lines):
                break
            title_line = lines[i].strip()
            m = title_pat.match(title_line)
            if m:
                category = m.group(1)
                title = m.group(2).strip()
            else:
                # 没有 | 分隔，当作普通文本跳过
                i += 1
                continue

            # 收集摘要（下一行开始直到日期/时间/标题）
            summary_parts = []
            for j in range(i + 1, len(lines)):
                sl = lines[j].strip()
                if not sl:
                    continue
                if date_pat.search(sl) or time_pat.match(sl) or title_pat.match(sl):
                    i = j - 1  # 回退一行，让外层处理这个时间戳
                    break
                summary_parts.append(sl)
                if len(" ".join(summary_parts)) > 600:
                    break
            else:
                i += 1

            items.append({
                "time": f"{current_date} {time_str}",
                "category": category or "其他动态",
                "title": title[:200],
                "link": "",
                "summary": " ".join(summary_parts)[:500],
            })
        i += 1

    return items

def main():
    parser = argparse.ArgumentParser(description="张通社新闻抓取 → 飞书表格")
    parser.add_argument("--dry-run", action="store_true", help="只打印不写入")
    parser.add_argument("--limit", type=int, default=50, help="最多抓取条数")
    args = parser.parse_args()

    token = get_token()

    existing = read_sheet(token)
    existing_titles = {row[2].strip() for row in existing if len(row) >= 3 and row[2]}
    print(f"已有 {len(existing_titles)} 条记录")

    news_items = fetch_news(args.limit)
    print(f"抓取到 {len(news_items)} 条")

    new_items = [n for n in news_items if n["title"] not in existing_titles]
    print(f"新增 {len(new_items)} 条")

    if not new_items:
        print("没有新增内容，退出")
        return

    if args.dry_run:
        print("\n=== 预览新增条目 ===")
        for item in new_items[:10]:
            print(f"  [{item['time']}] [{item['category']}] {item['title']}")
        return

    rows = [[n["time"], n["category"], n["title"], n["link"], n["summary"]] for n in new_items]
    success = append_rows(token, rows)
    if success:
        print(f"\n✅ 成功写入 {len(new_items)} 条到飞书表格")
    else:
        print("\n❌ 写入飞书失败")
        sys.exit(1)

if __name__ == "__main__":
    main()
