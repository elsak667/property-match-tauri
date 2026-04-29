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
import unicodedata
import datetime

try:
    from dotenv import load_dotenv
    for p in ["../.env", ".env"]:
        load_dotenv(p, override=True)
except ImportError:
    pass

FEISHU_APP_ID = os.environ["FEISHU_APP_ID"]
FEISHU_APP_SECRET = os.environ["FEISHU_APP_SECRET"]
NEWS_SHEET_TOKEN = os.environ["NEWS_SHEET_TOKEN"]
NEWS_SHEET_ID = os.environ["NEWS_SHEET_ID"]
TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
SHEET_URL = "https://open.feishu.cn/open-apis/sheets/v2/spreadsheets"

import urllib.request

def normalize_title(title: str) -> str:
    """Normalize Chinese/smart quotes to ASCII double quotes for consistent dedup."""
    return title.replace('“', '"').replace('”', '"').replace('「', '"').replace('」', '"')

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

def append_rows(token, rows, start_row=2):
    """Append rows starting at start_row (1-indexed, sheet row)."""
    url = f"{SHEET_URL}/{NEWS_SHEET_TOKEN}/values"
    col_letter = chr(65 + len(rows[0]) - 1)
    payload = {
        "valueRange": {
            "range": f"{NEWS_SHEET_ID}!A{start_row}:{col_letter}{start_row - 1 + len(rows)}",
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
        # 逐条提取：每个 .news-item 是一个完整条目
        items = []
        date_pat = re.compile(r"(\d{4})年(\d{2})月(\d{2})日")
        time_pat = re.compile(r"^(\d{2}):(\d{2})$")
        title_pat = re.compile(r"^(IPO|投融资|人事|新增企业|政策|收并购|产业项目|新品发布|出海|业绩发布|其他动态)\s*\|\s*(.+)$")

        # 用 locator 遍历所有新闻条目
        news_items = page.locator("div.news-item, div.news-list-item, .article-item, [class*=news-item]").all()
        for el in news_items:
            if len(items) >= limit:
                break
            try:
                text = el.inner_text()
                lines = text.strip().split("\n")
            except Exception:
                continue

            current_date = ""
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                dm = date_pat.search(line)
                if dm:
                    current_date = f"{dm.group(1)}/{dm.group(2)}/{dm.group(3)}"
                    continue
                tm = time_pat.match(line)
                if tm and current_date:
                    time_str = f"{tm.group(1)}:{tm.group(2)}"
                    # 找标题
                    idx = lines.index(line)
                    if idx + 1 < len(lines):
                        title_line = lines[idx + 1].strip()
                        m = title_pat.match(title_line)
                        if m:
                            category = m.group(1)
                            title = m.group(2).strip()
                        else:
                            continue
                    else:
                        continue
                    # 摘要：从标题后一行开始，收集到下一个日期/时间/分类标题出现为止
                    summary_parts = []
                    for sl in lines[idx + 2:]:
                        sl = sl.strip()
                        if not sl:
                            continue
                        # 只在行首匹配日期（避免摘要里的"2026年"字样误触发）
                        if date_pat.match(sl) or time_pat.match(sl) or title_pat.match(sl):
                            break
                        summary_parts.append(sl)
                        if len(" ".join(summary_parts)) > 600:
                            break
                    # 尝试提取链接
                    link = ""
                    try:
                        link_el = el.locator("a[href]")
                        if link_el.count() > 0:
                            link = link_el.first.get_attribute("href") or ""
                            if link and not link.startswith("http"):
                                link = "https://www.zhangtongshe.com" + link
                    except Exception:
                        pass
                    items.append({
                        "time": f"{current_date} {time_str}",
                        "category": category or "其他动态",
                        "title": normalize_title(title[:200]),
                        "link": link,
                        "summary": " ".join(summary_parts)[:500],
                    })
                    break  # 本条目已解析，跳到下一个
        browser.close()
    return items

def main():
    parser = argparse.ArgumentParser(description="张通社新闻抓取 → 飞书表格")
    parser.add_argument("--dry-run", action="store_true", help="只打印不写入")
    parser.add_argument("--limit", type=int, default=50, help="最多抓取条数")
    parser.add_argument("--force", action="store_true", help="强制重写全部数据（忽略已存在判断）")
    args = parser.parse_args()

    token = get_token()

    if args.force:
        news_items = fetch_news(args.limit)
        print(f"抓取到 {len(news_items)} 条")
        rows = [[n["time"], n["category"], n["title"], n["link"], n["summary"]] for n in news_items]
        success = append_rows(token, rows)
        if success:
            print(f"✅ 成功写入 {len(news_items)} 条到飞书表格")
        else:
            print("❌ 写入飞书失败")
            sys.exit(1)
        return

    existing = read_sheet(token)
    existing_titles = {normalize_title(row[2].strip()) for row in existing if len(row) >= 3 and row[2]}
    print(f"已有 {len(existing_titles)} 条记录")

    news_items = fetch_news(args.limit)
    print(f"抓取到 {len(news_items)} 条")

    new_items = [n for n in news_items if n["title"] not in existing_titles]
    print(f"新增 {len(new_items)} 条")

    if not new_items:
        print("没有新增内容，退出")
        return

    # 只保留最近7天的新闻
    cutoff = datetime.date.today() - datetime.timedelta(days=7)
    date_pat = re.compile(r"(\d{4})/(\d{2})/(\d{2})")
    filtered = []
    for n in new_items:
        m = date_pat.match(n["time"].split(" ")[0])
        if m:
            item_date = datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            if item_date >= cutoff:
                filtered.append(n)
    print(f"最近7天: {len(filtered)} 条（已过滤 {len(new_items) - len(filtered)} 条旧数据）")
    new_items = filtered

    if not new_items:

    if args.dry_run:
        print("\n=== 预览新增条目 ===")
        for item in new_items[:10]:
            print(f"  [{item['time']}] [{item['category']}] {item['title']}")
        return

    # Compute next empty row: existing data + header row (row 1) + 1-based index
    next_row = len(existing_titles) + 2
    rows = [[n["time"], n["category"], n["title"], n["link"], n["summary"]] for n in new_items]
    success = append_rows(token, rows, start_row=next_row)
    if success:
        print(f"\n✅ 成功写入 {len(new_items)} 条到飞书表格")
    else:
        print("\n❌ 写入飞书失败")
        sys.exit(1)

if __name__ == "__main__":
    main()
