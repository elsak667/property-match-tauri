/**
 * 飞书数据 Hook — 优先飞书 API，失配时降级到 Mock
 */
import { useState, useEffect, useCallback } from "react";
import {
  getFeishuConfig,
  fetchPoliciesFromFeishu,
  type SheetData,
} from "./tauri";
import { MOCK_POLICIES, MOCK_OPTIONS } from "../app/policy/mockData";
import type { FilterOptions, PolicyResult } from "../app/policy/types";
import { PROPERTIES } from "../app/property/mockData";

function buildOptions(policies: PolicyResult[]): FilterOptions {
  const locations = new Set<string>();
  const industries = new Set<string>();
  const depts = new Set<string>();
  const subjects = new Set<string>();
  const caps = new Set<string>();
  const thresholds = new Set<string>();

  for (const p of policies) {
    if (p.area) for (const a of p.area.split(/[/\n]/)) { const t = a.trim(); if (t) locations.add(t); }
    if (p.industry) for (const i of p.industry.split(/[/\n]/)) { const t = i.trim(); if (t) industries.add(t); }
    if (p.dept) depts.add(p.dept);
    if (p.subject) subjects.add(p.subject);
    if (p.cap) for (const c of p.cap.split(/[/\n]/)) { const t = c.trim(); if (t) caps.add(t); }
    if (p.threshold) thresholds.add(p.threshold);
  }

  const make = (set: Set<string>) =>
    [...set].sort().map(v => ({ k: v, l: v }));

  return {
    locations: make(locations),
    industries: make(industries),
    depts: make(depts),
    subjects: make(subjects),
    caps: make(caps),
    thresholds: make(thresholds),
    total: policies.length,
  };
}

// ── 政策数据转换 ──────────────────────────────────────────────────────────────
function normalizePolicies(raw: SheetData) {
  return raw.data.map((row, i) => {
    // 提取字段值，处理好对象/数组等复杂类型
    const str = (keys: string[]) => {
      for (const k of keys) {
        const v = row[k];
        if (v == null || v === "") continue;
        if (typeof v === "string") return v;
        if (typeof v === "number") return String(v);
        if (Array.isArray(v)) {
          // 飞书内容列可能是 [{text, type, link?}] 数组，提取纯文本
          return v.map(item => {
            if (typeof item === "object" && item !== null && "text" in item) {
              return (item as {text?: string}).text || "";
            }
            return String(item);
          }).join("");
        }
        if (typeof v === "object") {
          // 可能是 {"text": "...", "type": "text", "link": "..."} 结构
          const obj = v as Record<string, unknown>;
          if (obj.text != null) return String(obj.text);
          return JSON.stringify(v);
        }
        return String(v);
      }
      return "";
    };
    const num = (keys: string[]) => {
      for (const k of keys) {
        const v = row[k];
        if (v == null) continue;
        if (typeof v === "number") return v;
        if (typeof v === "string") {
          if (v === "None" || v === "null" || v === "") return 0;
          const n = parseFloat(v);
          return isNaN(n) ? 0 : n;
        }
      }
      return 0;
    };

    const amount = num(["amount", "金额", "amount_s"]);
    const endDate = str(["end", "申报截止", "截止日期"]);
    const releaseDate = str(["zcReleaseTime", "发布时间", "发布于"]);

    let days_left = 9999;
    let expired = false;
    if (endDate) {
      const end = new Date(endDate);
      const now = new Date();
      if (!isNaN(end.getTime())) {
        const diff = Math.ceil((end.getTime() - now.getTime()) / 86400000);
        days_left = diff;
        expired = diff <= 0;
      }
    }

    const raw_amount_s = str(["amount_s", "金额_显示", "资助金额"]);
    let amount_s: string;
    if (raw_amount_s && raw_amount_s !== "None") {
      amount_s = raw_amount_s;
    } else {
      amount_s = amount > 0
        ? amount >= 10000 ? `${(amount / 10000).toFixed(0)}亿` : `${amount}万元`
        : "待定";
    }

    return {
      _group: false,
      name: str(["policyName", "政策名称", "name"]) || `政策${i + 1}`,
      amount,
      amount_s,
      zcReleaseTime: releaseDate,
      end_date: endDate,
      days_left,
      expired,
      method: str(["claimMethod", "兑现方式", "method"]),
      dept: str(["leadDepartment", "发布单位", "dept"]),
      area: str(["applicableRegion", "适用区域", "area"]),
      industry: str(["行业标签", "适用行业", "industry"]),
      subject: str(["申报主体", "subject"]),
      threshold: str(["门槛标签", "threshold"]),
      cap: str(["政策能力", "cap"]),
      content: str(["policyContent", "政策内容", "content", "主要内容"]),
      contentHtml: "",
      policyObject: str(["policyObject", "政策对象"]),
      policyCondition: str(["policyCondition", "申报条件"]),
      paymentStandard: str(["paymentStandard", "扶持标准"]),
      contactInfo: str(["contactInfo", "联系方式"]),
      _reasons: [] as string[],
      stars: calcStars(amount),
    };
  });
}

function calcStars(amount: number): string {
  if (amount >= 300) return "★★★";
  if (amount >= 100) return "★★☆";
  if (amount > 0) return "★☆☆";
  return "☆☆☆";
}

// ── 物业数据转换 ──────────────────────────────────────────────────────────────


// ── Hooks ────────────────────────────────────────────────────────────────────

export function usePolicies() {
  const [policies, setPolicies] = useState(MOCK_POLICIES);
  const [options, setOptions] = useState<FilterOptions>(MOCK_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [fromFeishu, setFromFeishu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await getFeishuConfig();
      if (cfg.has_credentials === "true") {
        const raw = await fetchPoliciesFromFeishu();
        if (raw.data.length > 0) {
          const normalized = normalizePolicies(raw);
          setPolicies(normalized);
          const built = buildOptions(normalized);
          // 动态构建缺字段时用 MOCK_OPTIONS 兜底
          const opts: FilterOptions = {
            ...built,
            caps: built.caps.length > 0 ? built.caps : MOCK_OPTIONS.caps,
            thresholds: built.thresholds.length > 0 ? built.thresholds : MOCK_OPTIONS.thresholds,
          };
          setOptions(opts);
          setFromFeishu(true);
          setLoading(false);
          return;
        }
      }
    } catch {
      // 降级到 mock
    }
    setPolicies(MOCK_POLICIES);
    setOptions(MOCK_OPTIONS);
    setFromFeishu(false);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { policies, options, loading, fromFeishu, reload: load };
}

export function useProperties() {
  const [properties] = useState(PROPERTIES);
  const [loading] = useState(false);
  const [fromFeishu] = useState(false);

  return { properties, loading, fromFeishu };
}
