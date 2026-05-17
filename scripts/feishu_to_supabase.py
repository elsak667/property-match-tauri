#!/usr/bin/env python3
"""
飞书政策表 → Supabase policies 表同步脚本
增量 Upsert，按 id 去重

用法：
  python3 scripts/feishu_to_supabase.py              # 正式执行
  python3 scripts/feishu_to_supabase.py --dry-run    # 只打印不写入
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════
FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "")
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://rgnncmgrumwjjgzyhmkt.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

FEISHU_SHEET_TOKEN = "DwqqsS6TShlGhAteDf3cHRwvnHe"
FEISHU_SHEET_ID = "0aad30"

SHEET_API = "https://open.feishu.cn/open-apis/sheets/v2/spreadsheets"
TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"


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


def get_feishu_token():
    resp = requests.post(
        TOKEN_URL,
        json={"app_id": FEISHU_APP_ID, "app_secret": FEISHU_APP_SECRET},
        timeout=15,
        proxies={"http": None, "https": None}
    )
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Feishu token error {data.get('code')}: {data.get('msg')}")
    return data["tenant_access_token"]


def read_sheet(token, spreadsheet, sheet_id, range_str="A1:U1000"):
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
    """将飞书富文本格式转为纯字符串"""
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


# ═══════════════════════════════════════════════════════════════
# 飞书 → 结构化数据
# ═══════════════════════════════════════════════════════════════
def read_policies_from_feishu(token):
    """读取飞书政策表，返回 [{id, policy_name, ...}, ...]"""
    rows = read_sheet(token, FEISHU_SHEET_TOKEN, FEISHU_SHEET_ID, "A1:U1000")
    if not rows or len(rows) < 2:
        log("  政策表为空")
        return []

    headers = [str(h) if h is not None else "" for h in rows[0]]
    policies = []
    for row in rows[1:]:
        if not isinstance(row, list) or not row:
            continue
        normalized = normalize_row(row)
        obj = {}
        for h, v in zip(headers, normalized):
            if h:
                obj[h] = v
        if obj.get("id"):
            policies.append(obj)

    log(f"  读取 {len(policies)} 条政策")
    return policies


# ═══════════════════════════════════════════════════════════════
# Supabase Upsert
# ═══════════════════════════════════════════════════════════════
def build_policy_record(policy: dict) -> dict:
    """将飞书政策行转为 Supabase policies 表记录格式"""
    def fmt_date(v):
        v = str(v) if v else ""
        return v if v and len(v) >= 10 else None

    return {
        "id": str(policy.get("id", "") or ""),
        "name": str(policy.get("name", "") or ""),
        "title": str(policy.get("title", "") or ""),
        "r2212_special_category_name": str(policy.get("r2212SpecialCategoryName", "") or ""),
        "policy_object": str(policy.get("policyObject", "") or ""),
        "policy_condition": str(policy.get("policyCondition", "") or ""),
        "policy_content": str(policy.get("policyContent", "") or ""),
        "payment_standard": str(policy.get("paymentStandard", "") or ""),
        "contact_info": str(policy.get("contactInfo", "") or ""),
        "claim_method": str(policy.get("claimMethod", "") or ""),
        "amount": str(policy.get("amount", "") or ""),
        "applicable_region": str(policy.get("applicableRegion", "") or ""),
        "lead_department": str(policy.get("leadDepartment", "") or ""),
        "start": fmt_date(policy.get("start")),
        "declare_end": fmt_date(policy.get("end")),
        "publish_time": fmt_date(policy.get("zcReleaseTime")),
        "apply_status": str(policy.get("applyStatus", "") or ""),
    }


def get_existing_ids() -> set:
    """获取 Supabase policies 表已有 id 集合"""
    url = f"{SUPABASE_URL}/rest/v1/policies?select=id"
    resp = requests.get(
        url,
        headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "apikey": SUPABASE_SERVICE_KEY,
        },
        timeout=20,
        proxies={"http": None, "https": None}
    )
    if resp.status_code == 200:
        return {str(r["id"]) for r in resp.json()}
    log(f"  ⚠ 获取已有记录失败: {resp.status_code}")
    return set()


def upsert_policies(policies: list, dry_run: bool):
    """批量 Upsert 政策到 Supabase（按 id 去重）"""
    if not policies:
        log("  无政策需要同步")
        return

    if dry_run:
        log(f"  [DRY_RUN] 跳过写入，共 {len(policies)} 条")
        return

    existing_ids = get_existing_ids()
    log(f"  已有 {len(existing_ids)} 条记录")

    to_insert = [p for p in policies if str(p.get("id", "")) not in existing_ids]
    to_update = [p for p in policies if str(p.get("id", "")) in existing_ids]
    log(f"  新增: {len(to_insert)}, 更新: {len(to_update)}")

    all_records = to_insert + to_update
    if not all_records:
        log("  无变动")
        return

    batch_size = 100
    for i in range(0, len(all_records), batch_size):
        batch = all_records[i:i + batch_size]
        url = f"{SUPABASE_URL}/rest/v1/policies"
        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "apikey": SUPABASE_SERVICE_KEY,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            },
            json=batch,
            timeout=30,
            proxies={"http": None, "https": None}
        )
        if resp.status_code in (200, 201):
            log(f"  ✓ 批次 {i // batch_size + 1} 完成 ({len(batch)} 条)")
        else:
            log(f"  ✗ 批次失败: {resp.status_code} {resp.text[:200]}")
            time.sleep(1)


# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="飞书政策 → Supabase 同步")
    parser.add_argument("--dry-run", action="store_true", help="只读不写")
    args = parser.parse_args()

    if not FEISHU_APP_ID or not FEISHU_APP_SECRET:
        fatal("缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET")
    if not SUPABASE_SERVICE_KEY:
        fatal("缺少 SUPABASE_SERVICE_KEY 环境变量")

    try:
        token = get_feishu_token()
        log("已获取飞书 token")
    except Exception as e:
        fatal(f"获取 token 失败: {e}")

    policies = read_policies_from_feishu(token)
    if not policies:
        log("无政策数据，退出")
        return

    records = [build_policy_record(p) for p in policies]
    upsert_policies(records, args.dry_run)

    log("✓ 同步完成")


if __name__ == "__main__":
    main()