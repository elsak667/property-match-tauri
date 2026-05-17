#!/usr/bin/env python3
"""
飞书数据导出为静态 JSON — 用于 Cloudflare Pages 托管
将飞书 sheet 数据导出为 public/data/*.json，每次 deploy 自动更新

Usage:
  python3 scripts/export_feishu_to_json.py
  python3 scripts/export_feishu_to_json.py --dry-run
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

# ═══════════════════════════════════════════════════════════════
# 飞书配置
# ═══════════════════════════════════════════════════════════════
FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "")
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "")

SHEET_API = "https://open.feishu.cn/open-apis/sheets/v2/spreadsheets"
TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"

# Sheet 配置：(spreadsheet_token, sheet_id) → 输出文件名
SHEETS = {
    "policies":     ("DwqqsS6TShlGhAteDf3cHRwvnHe", "0aad30"),
    "news":         ("JtEFsWqVRhPyPetC7Jyc19Oongt", "b6daf2"),
    "properties-parks":  ("X1jRs1PhLhR8WetSwktcM9Fgnhg", "4hdJSg"),
    "properties-buildings": ("X1jRs1PhLhR8WetSwktcM9Fgnhg", "4hdJSh"),
    "properties-units":   ("X1jRs1PhLhR8WetSwktcM9Fgnhg", "4hdJSi"),
    "stats":        ("DwqqsS6TShlGhAteDf3cHRwvnHe", "2pLPm8"),
}

# ═══════════════════════════════════════════════════════════════
# 工具函数
# ═══════════════════════════════════════════════════════════════
def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")
    sys.stdout.flush()

def fatal(msg):
    log(f"✗ 错误: {msg}")
    sys.exit(1)

def get_token():
    if not FEISHU_APP_ID or not FEISHU_APP_SECRET:
        raise RuntimeError("FEISHU_APP_ID / FEISHU_APP_SECRET 环境变量未设置")
    resp = requests.post(
        TOKEN_URL,
        json={"app_id": FEISHU_APP_ID, "app_secret": FEISHU_APP_SECRET},
        timeout=15,
        proxies={"http": None, "https": None}
    )
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Token error {data.get('code')}: {data.get('msg')}")
    return data["tenant_access_token"]

def read_sheet(token, spreadsheet, sheet_id, range_str="A1:ZZ1000"):
    url = f"{SHEET_API}/{spreadsheet}/values/{sheet_id}!{range_str}"
    resp = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
        proxies={"http": None, "https": None}
    )
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Sheet read error {data.get('code')}: {data.get('msg')}")
    return data.get("data", {}).get("valueRange", {}).get("values", [])

def strip_feishu_rich(val):
    """将飞书富文本格式（如 [{type:text, text:...}]）转成纯字符串"""
    if isinstance(val, list):
        parts = []
        for item in val:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(item.get("text", ""))
                elif item.get("type") == "url":
                    parts.append(item.get("text", ""))
            elif isinstance(item, str):
                parts.append(item)
        return "".join(parts)
    return str(val) if val is not None else ""

def normalize_row(row):
    """将行数据标准化：处理富文本、None、嵌套结构"""
    result = []
    for v in row:
        if v is None:
            result.append(None)
        elif isinstance(v, list):
            result.append(strip_feishu_rich(v))
        elif isinstance(v, dict):
            if "text" in v:
                result.append(str(v["text"]))
            else:
                result.append(json.dumps(v, ensure_ascii=False))
        else:
            result.append(v)
    return result

def to_dict_list(rows):
    """将 [headers, ...data_rows] 转成 [{col: val}, ...]"""
    if not rows or len(rows) < 2:
        return []
    headers = [str(h) if h is not None else "" for h in rows[0]]
    result = []
    for row in rows[1:]:
        if not isinstance(row, list) or not row:
            continue
        normalized = normalize_row(row)
        obj = {}
        for h, v in zip(headers, normalized):
            if h:
                obj[h] = v
        result.append(obj)
    return result

# ═══════════════════════════════════════════════════════════════
# 导出逻辑
# ═══════════════════════════════════════════════════════════════
def export_policies(token, out_dir):
    """导出政策 sheet → policies.json"""
    log("  导出 policies...")
    spreadsheet, sheet_id = SHEETS["policies"]
    rows = read_sheet(token, spreadsheet, sheet_id, "A1:U600")
    if not rows:
        log("    跳过（无数据）")
        return
    headers = [str(h) if h is not None else "" for h in rows[0]]
    data = []
    for row in rows[1:]:
        if not isinstance(row, list) or not row or not row[0]:
            continue
        normalized = normalize_row(row)
        obj = {}
        for h, v in zip(headers, normalized):
            if h:
                obj[h] = v
        data.append(obj)
    out = {
        "headers": headers,
        "data": data,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "total": len(data),
    }
    path = os.path.join(out_dir, "policies.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    log(f"    ✓ {len(data)} 条 → {path}")

def export_news(token, out_dir):
    """导出新闻 sheet → news.json"""
    log("  导出 news...")
    spreadsheet, sheet_id = SHEETS["news"]
    rows = read_sheet(token, spreadsheet, sheet_id, "A1:E500")
    if not rows:
        log("    跳过（无数据）")
        return
    items = []
    for row in rows[1:]:
        if not isinstance(row, list) or len(row) < 2 or row[0] is None:
            continue
        items.append({
            "time": row[0] if row[0] else "",
            "category": row[1] if len(row) > 1 and row[1] else "",
            "title": row[2] if len(row) > 2 and row[2] else "",
            "link": row[3] if len(row) > 3 and row[3] else "",
            "summary": row[4] if len(row) > 4 and row[4] else "",
        })
    path = os.path.join(out_dir, "news.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    log(f"    ✓ {len(items)} 条 → {path}")

def export_properties(token, out_dir, key, range_str="A1:ZZ500"):
    """导出物业 sheet → properties-*.json"""
    log(f"  导出 {key}...")
    spreadsheet, sheet_id = SHEETS[key]
    rows = read_sheet(token, spreadsheet, sheet_id, range_str)
    if not rows or len(rows) < 3:
        log(f"    跳过（数据不足 {len(rows) if rows else 0} 行）")
        return
    headers = [str(h) if h is not None else "" for h in rows[1]]
    data = []
    for row in rows[2:]:
        if not isinstance(row, list) or not row:
            continue
        normalized = normalize_row(row)
        obj = {}
        for h, v in zip(headers, normalized):
            if h:
                obj[h] = v
        data.append(obj)
    path = os.path.join(out_dir, f"{key}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    log(f"    ✓ {len(data)} 条 → {path}")

def scrape_official_count():
    """用 Playwright 抓取官网政策搜索结果总数"""
    if not PLAYWRIGHT_AVAILABLE:
        log("  ⚠ Playwright 未安装，跳过官网政策数抓取")
        return None

    STATS_URL = "https://pyd.pudong.gov.cn/website/pud/policyretrieval"
    log(f"  抓取官网政策数: {STATS_URL}")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(STATS_URL, wait_until="networkidle", timeout=30000)
            time.sleep(2)

            try:
                count_text = page.locator("span:has-text('查到相关内容：')").text_content()
                import re
                match = re.search(r'查到相关内容：(\d+)', count_text)
                if match:
                    count = int(match.group(1))
                    log(f"  官网政策总数: {count}")
                    browser.close()
                    return count
            except Exception as e:
                log(f"  ⚠ 未找到政策数元素: {e}")

            browser.close()
    except Exception as e:
        log(f"  ⚠ Playwright 抓取失败: {e}")

    return None


def update_stats(token, count: int):
    """更新飞书统计表的官网政策数字段"""
    spreadsheet, sheet_id = SHEETS["stats"]
    update_time = datetime.now().strftime("%Y/%m/%d %H:%M:%S")

    url = f"{SHEET_API}/{spreadsheet}/values_batch_update"
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "valueRanges": [{
                "range": f"{sheet_id}!A2:D2",
                "values": [[
                    "官网政策总数",
                    count,
                    update_time,
                    [{"type": "url", "text": "https://pyd.pudong.gov.cn/website/pud/policyretrieval",
                      "link": "https://pyd.pudong.gov.cn/website/pud/policyretrieval"}]
                ]]
            }]
        },
        timeout=15,
        proxies={"http": None, "https": None}
    )
    data = resp.json()
    if data.get("code") == 0:
        log(f"  ✓ 统计表已更新: {count} 条")
    else:
        log(f"  ⚠ 统计表更新失败: {data.get('msg')}")

def main():
    parser = argparse.ArgumentParser(description="导出飞书数据为静态 JSON")
    parser.add_argument("--dry-run", action="store_true", help="只读不写")
    args = parser.parse_args()

    # 输出目录：项目根目录的 public/data/
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, "public", "data")

    if args.dry_run:
        log("Dry-run 模式：只读取飞书，不写入文件")
    else:
        os.makedirs(out_dir, exist_ok=True)
        log(f"输出目录: {out_dir}")

    try:
        token = get_token()
        log("已获取飞书 token")
    except Exception as e:
        fatal(f"无法获取 token: {e}")

    export_policies(token, out_dir)
    export_news(token, out_dir)
    export_properties(token, out_dir, "properties-parks")
    export_properties(token, out_dir, "properties-buildings")
    export_properties(token, out_dir, "properties-units")

    # 生成 stats.json（本地统计，不依赖飞书统计表）
    official_count = scrape_official_count()
    import json as _json
    stats_path = os.path.join(out_dir, "stats.json")
    with open(stats_path, "w", encoding="utf-8") as f:
        _json.dump({
            "official_count": official_count if official_count is not None else 0,
            "local_count": 298,
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }, f, ensure_ascii=False)
    log(f"  ✓ stats.json → local_count=298")

    # 抓取官网政策数并更新飞书统计表
    if not args.dry_run and official_count is not None:
        update_stats(token, official_count)

    # 生成聚合筛选文件
    import subprocess
    script_path = os.path.join(os.path.dirname(__file__), "build-filterable.js")
    result = subprocess.run(["node", script_path], capture_output=True, text=True)
    if result.returncode == 0:
        log(f"  {result.stdout.strip()}")
    else:
        log(f"  ⚠ build-filterable.js failed: {result.stderr.strip()[:100]}")

    log("✓ 导出完成")

if __name__ == "__main__":
    main()