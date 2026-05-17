#!/usr/bin/env python3
"""
浦易达政策整理脚本 - JSON → Excel
读取抓取输出的 JSON，生成精简 Excel

字段映射（原样保留浦易达字段名）：
  id                    → id
  name                  → name（列表显示名）
  title                 → title（文件通知名）
  r2212SpecialCategoryName → r2212SpecialCategoryName
  policyObject          → content.support
  policyCondition       → content.conditions
  policyContent        → content.content
  paymentStandard       → content.process
  contactInfo          → content.policyConsult
  claimMethod          → r2509ApplyType
  amount               → r2509MaxAmount
  applicableRegion     → r2509Area
  leadDepartment       → content.otherConsult / leadDeptName
  start                → declareStartTime
  end                  → declareEndTime
  zcReleaseTime        → publishTime

用法：
  python pudong_process.py -i data/pudong_policies.json
  python pudong_process.py -i data/pudong_policies.json -o /path/to/output.xlsx
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


# Excel 列名（与飞书表格列顺序一致）
EXCEL_FIELDS = [
    "id",
    "name",
    "title",
    "r2212SpecialCategoryName",
    "policyObject",
    "policyCondition",
    "policyContent",
    "paymentStandard",
    "contactInfo",
    "claimMethod",
    "amount",
    "applicableRegion",
    "leadDepartment",
    "start",
    "end",
    "zcReleaseTime",
    "applyStatus",
]


def get_field(item: dict, excel_field: str):
    """根据 Excel 字段名从 item 中取值的映射函数"""
    content = item.get("content", {})

    mapping = {
        "id": item.get("id", ""),
        "name": item.get("name", ""),
        "title": item.get("title", ""),
        "r2212SpecialCategoryName": item.get("r2212SpecialCategoryName", ""),
        "policyObject": clean_text(content.get("support", "")),
        "policyCondition": clean_text(content.get("conditions", "")),
        "policyContent": clean_text(content.get("content", "")),
        "paymentStandard": clean_text(content.get("process", "")),
        "contactInfo": clean_text(content.get("policyConsult", "")),
        "claimMethod": item.get("r2509ApplyType", ""),
        "amount": item.get("r2509MaxAmount", ""),
        "applicableRegion": item.get("r2509Area", ""),
        "leadDepartment": clean_text(content.get("otherConsult", "")) or item.get("leadDeptName", ""),
        "start": format_datetime(item.get("declareStartTime", "")),
        "end": format_datetime(item.get("declareEndTime", "")),
        "zcReleaseTime": format_datetime(item.get("publishTime", "")),
        "applyStatus": item.get("applyStatus", ""),
    }
    return mapping.get(excel_field, "")


def main():
    args = parse_args()

    print(f"读取: {args.input}")
    data = json.loads(args.input.read_text(encoding="utf-8"))
    print(f"共 {len(data)} 条政策")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet"
    ws.append(EXCEL_FIELDS)

    for i, item in enumerate(data, 1):
        row = [get_field(item, field) for field in EXCEL_FIELDS]
        ws.append(row)

        if i % 50 == 0:
            print(f"  已处理 {i}/{len(data)} 条")

    wb.save(args.output)
    print(f"已保存到: {args.output}")


if __name__ == "__main__":
    main()