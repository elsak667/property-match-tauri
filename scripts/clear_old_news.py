#!/usr/bin/env python3
"""
清理飞书表格中 12/31 的旧记录（张通社新闻）
Usage: python scripts/clear_old_news.py
"""
import json
import os
import re
import sys
import urllib.request

try:
    from dotenv import load_dotenv
    for p in ["../.env", ".env"]:
        load_dotenv(p, override=True)
except ImportError:
    pass

FEISHU_APP_ID = os.environ["FEISHU_APP_ID"]
FEISHU_APP_SECRET = os.environ["FEISHU_APP_SECRET"]
NEWS_SHEET = os.environ["NEWS_SHEET"]
NEWS_SHEET_ID = os.environ["NEWS_SHEET_ID"]
FEISHU_HOST = os.environ.get("FEISHU_HOST", "https://open.feishu.cn")


def get_token() -> str:
    url = f"{FEISHU_HOST}/open-apis/auth/v3/tenant_access_token/internal"
    req = urllib.request.Request(url,
        data=json.dumps({"app_id": FEISHU_APP_ID, "app_secret": FEISHU_APP_SECRET}).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.load(resp)
    if data.get("code") != 0:
        raise Exception(f"Token error: {data}")
    return data["tenant_access_token"]


def read_sheet(token: str) -> list[list]:
    url = f"{FEISHU_HOST}/open-apis/sheets/v2/spreadsheets/{NEWS_SHEET}/values/{NEWS_SHEET_ID}!A1:E500"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.load(resp)
    if data.get("code") != 0:
        raise Exception(f"Read error: {data}")
    return data.get("data", {}).get("valueRange", {}).get("values", [])


def clear_rows(token: str, sheet_id: str, row_numbers: list[int]) -> bool:
    ranges = [f"A{r}:E{r}" for r in row_numbers]
    payload = {
        "valueRange": {
            "values": [[""] * 5 for _ in row_numbers]
        }
    }
    url = f"{FEISHU_HOST}/open-apis/sheets/v2/spreadsheets/{NEWS_SHEET}/values"
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="PUT")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.load(resp)
        return result.get("code") == 0
    except Exception as e:
        print(f"Delete error: {e}")
        return False


def main():
    token = get_token()
    rows = read_sheet(token)
    print(f"共 {len(rows)} 行（含表头）")

    old_rows = []
    for idx, row in enumerate(rows):
        if idx == 0:
            continue
        if not row or not row[0]:
            continue
        time_str = str(row[0])
        if re.match(r"^\d{4}/12/31 ", time_str) or re.match(r"^\d{2}/12/31 ", time_str):
            old_rows.append((idx + 1, row))

    if not old_rows:
        print("没有找到 12/31 的旧记录")
        return

    print(f"找到 {len(old_rows)} 条 12/31 旧数据:")
    for excel_row, row in old_rows:
        print(f"  行 {excel_row}: {row[0]} | {row[1]} | {str(row[2])[:40]}")

    confirm = input("\n确认清空这 {} 条记录（内容置空，行仍保留）？(y/N): ".format(len(old_rows)))
    if confirm.strip().lower() != "y":
        print("取消")
        return

    excel_rows = [r[0] for r in old_rows]
    success = clear_rows(token, NEWS_SHEET_ID, excel_rows)
    if success:
        print(f"✅ 已清空 {len(excel_rows)} 行")
    else:
        print("❌ 操作失败")
        sys.exit(1)


if __name__ == "__main__":
    main()