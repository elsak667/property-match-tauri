#!/usr/bin/env python3
"""
浦易达政策飞书同步脚本
读取 Excel，推送到飞书

用法：
  python pudong_sync.py                          # 默认处理 /tmp/pudong_policies_full.xlsx
  python pudong_sync.py -i /path/to/input.xlsx   # 指定输入
"""
import argparse
import os
import re
import sys
import time
from pathlib import Path

import openpyxl
import requests

FEISHU = {
    "app_id": os.environ.get("FEISHU_APP_ID", ""),
    "app_secret": os.environ.get("FEISHU_APP_SECRET", ""),
    "sheet_token": os.environ.get("FEISHU_SHEET_TOKEN", ""),
    "sheet_id": "0aad30",
}


def parse_args():
    parser = argparse.ArgumentParser(description="浦易达飞书同步")
    parser.add_argument(
        "-i", "--input",
        type=Path,
        default=Path("/tmp/pudong_policies_full.xlsx"),
        help="输入 Excel 路径"
    )
    return parser.parse_args()


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


def get_feishu_token():
    r = requests.post(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        json={"app_id": FEISHU["app_id"], "app_secret": FEISHU["app_secret"]},
        timeout=10,
        proxies={"http": None, "https": None}
    )
    return r.json()["tenant_access_token"]


def feishu_get(url, token):
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15,
                     proxies={"http": None, "https": None})
    if r.status_code != 200:
        return {"code": -1, "msg": f"HTTP {r.status_code}"}
    return r.json()


def feishu_post(url, payload, token):
    r = requests.post(url, headers={"Authorization": f"Bearer {token}",
                                    "Content-Type": "application/json"},
                      json=payload, timeout=20, proxies={"http": None, "https": None})
    if r.status_code != 200:
        return {"code": -1, "msg": f"HTTP {r.status_code}"}
    return r.json()


def col_letter(n):
    return chr(ord('A') + n)


def range_str(c0, c1, r0, r1):
    return f"{FEISHU['sheet_id']}!{col_letter(c0)}{r0}:{col_letter(c1)}{r1}"


def strip_html(text):
    if not text:
        return ""
    return re.sub(r'<[^>]+>', '', str(text))


def main():
    args = parse_args()

    if not FEISHU["app_id"] or not FEISHU["app_secret"]:
        log("错误：缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET 环境变量")
        sys.exit(1)

    log(f"读取: {args.input}")
    wb = openpyxl.load_workbook(args.input)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        log("Excel 为空")
        sys.exit(1)

    headers = rows[0]
    data_rows = rows[1:]

    log(f"共 {len(data_rows)} 条政策，{len(headers)} 列")

    token = get_feishu_token()

    feishu_data = []
    row = 2
    while True:
        end_row = min(row + 500 - 1, 2000)
        url = (f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/"
               f"{FEISHU['sheet_token']}/values/{range_str(0, len(headers)-1, row, end_row)}")
        resp = feishu_get(url, token)
        if resp.get("code") != 0:
            break
        vals = resp["data"]["valueRange"]["values"]
        if not vals or (len(vals) == 1 and not vals[0][0]):
            break
        feishu_data.extend(vals)
        if len(vals) < 500:
            break
        row = end_row + 1
        time.sleep(0.1)

    feishu_index = {str(v[0]): i + 2 for i, v in enumerate(feishu_data) if v and v[0]}
    excel_index = {str(r[0]): r for r in data_rows if r and r[0]}

    new_records, updated = [], []

    for pid, excel_row in excel_index.items():
        if pid not in feishu_index:
            new_records.append(list(excel_row))
        else:
            feishu_row_num = feishu_index[pid]
            feishu_row = feishu_data[feishu_row_num - 2]
            changed = any(
                strip_html(str(feishu_row[c] if c < len(feishu_row) else ""))
                != strip_html(str(excel_row[c] if c < len(excel_row) else ""))
                for c in range(1, len(headers))
            )
            if changed:
                updated.append((feishu_row_num, list(excel_row)))

    log(f"差异: 新增={len(new_records)} 更新={len(updated)}")

    if not new_records and not updated:
        log("无变动")
        return

    if new_records:
        next_row = len(feishu_data) + 2
        end_row = next_row + len(new_records) - 1
        resp = feishu_post(
            f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{FEISHU['sheet_token']}/values_batch_update",
            {"valueRanges": [{"range": range_str(0, len(headers)-1, next_row, end_row),
                              "values": new_records}]},
            token
        )
        if resp.get("code") == 0:
            log(f"✓ 新增 {len(new_records)} 行")
        else:
            log(f"✗ 新增失败: {resp.get('msg')}")

    for row_num, row_data in updated:
        resp = feishu_post(
            f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{FEISHU['sheet_token']}/values_batch_update",
            {"valueRanges": [{"range": range_str(0, len(headers)-1, row_num, row_num),
                              "values": [row_data]}]},
            token
        )
        status = "✓" if resp.get("code") == 0 else f"✗ {resp.get('msg')}"
        log(f"  {status} 更新行{row_num}")

    log("同步完成")


if __name__ == "__main__":
    main()
