#!/usr/bin/env python3
"""
浦易达政策整理脚本 - JSON → Excel
读取抓取输出的 JSON，生成精简 Excel（15字段）

字段：
  id, policyName, r2212SpecialCategoryName,
  policyObject, policyCondition, policyContent,
  claimMethod, maxPaymentAmount, paymentStandard,
  leadDepartment, contactInfo,
  declarStartTime, declarEndTime,
  zcReleaseTime

用法：
  python pudong_process.py                          # 默认处理 /tmp/pudong_policies_full.json
  python pudong_process.py -i /path/to/input.json   # 指定输入
  python pudong_process.py -o /path/to/output.xlsx  # 指定输出
"""
import argparse
import json
import re
from pathlib import Path

import openpyxl


def parse_args():
    parser = argparse.ArgumentParser(description="浦易达政策整理")
    parser.add_argument(
        "-i", "--input",
        type=Path,
        default=Path("/tmp/pudong_policies_full.json"),
        help="输入 JSON 路径"
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("/tmp/pudong_policies_full.xlsx"),
        help="输出 Excel 路径"
    )
    return parser.parse_args()


def clean_text(text):
    """清理 HTML 标签和多余空白"""
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', str(text))
    text = re.sub(r'[　 \xa0]+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def format_datetime(val):
    """格式化日期时间"""
    if not val:
        return ""
    val = str(val)
    if "T" in val:
        val = val.split("T")[0]
    return val[:10] if len(val) >= 10 else val


FIELDS = [
    "id",
    "policyName",
    "r2212SpecialCategoryName",
    "policyObject",
    "policyCondition",
    "policyContent",
    "claimMethod",
    "maxPaymentAmount",
    "paymentStandard",
    "leadDepartment",
    "contactInfo",
    "declarStartTime",
    "declarEndTime",
    "zcReleaseTime",
]


def main():
    args = parse_args()

    print(f"读取: {args.input}")
    data = json.loads(args.input.read_text(encoding="utf-8"))
    print(f"共 {len(data)} 条政策")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet"
    ws.append(FIELDS)

    for i, item in enumerate(data, 1):
        row = []
        for field in FIELDS:
            val = item.get(field, "")

            if field in ("declarStartTime", "declarEndTime", "zcReleaseTime"):
                val = format_datetime(val)
            elif field in ("policyObject", "policyCondition", "policyContent",
                           "paymentStandard", "claimMethod", "contactInfo",
                           "maxPaymentAmount"):
                val = clean_text(val)
            elif field == "leadDepartment":
                val = val or item.get("leadDeptName", "")

            row.append(val)

        ws.append(row)

        if i % 50 == 0:
            print(f"  已处理 {i}/{len(data)} 条")

    wb.save(args.output)
    print(f"已保存到: {args.output}")


if __name__ == "__main__":
    main()
