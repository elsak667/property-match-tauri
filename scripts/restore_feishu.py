#!/usr/bin/env python3
"""紧急恢复脚本：从本地 Excel 直接推 317 条数据到飞书"""
import os, time, openpyxl, requests

FEISHU_SCHEMA = [
    "id", "policyName", "policyObject", "policyCondition",
    "policyContent", "paymentStandard", "contactInfo",
    "claimMethod", "amount", "amount_s",
    "applicableRegion", "leadDepartment",
    "start", "end", "zcReleaseTime",
    "行业标签", "申报主体", "政策能力", "门槛标签",
    "行业细分", "specialAbbreviat", "belongPolicy"
]

def get_token():
    r = requests.post(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        json={"app_id": "cli_a950307a10b8dcb1", "app_secret": "TFlBj160Jm4p48uZ3t4RETpL3qz1oxaj"},
        timeout=10, proxies={"http": None, "https": None}
    )
    return r.json()["tenant_access_token"]

def main():
    wb = openpyxl.load_workbook('/Users/els/Downloads/pudong_policy_full_v2.xlsx')
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))[1:]
    print(f"Excel: {len(rows)} 条")
    token = get_token()
    BATCH = 50
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i+BATCH]
        next_row = i + 2
        end_row = i + len(batch) + 1
        col_last = chr(ord('A') + len(FEISHU_SCHEMA) - 1)
        url = f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/DwqqsS6TShlGhAteDf3cHRwvnHe/values_batch_update"
        resp = requests.post(url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"valueRanges": [{"range": f"0aad30!A{next_row}:{col_last}{end_row}", "values": list(batch)}]},
            timeout=20, proxies={"http": None, "https": None})
        if resp.json().get("code") == 0:
            print(f"  ✓ {next_row}-{end_row}")
        else:
            print(f"  ✗ {resp.json().get('msg')}")
        time.sleep(0.5)
    print("完成！")

main()