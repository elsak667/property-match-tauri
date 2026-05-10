/**
 * 飞书数据 Hook — 静态 JSON 模式
 * 数据来源: /public/data/*.json
 */
import { useState, useEffect, useCallback } from "react";
import { loadPropertyData } from "./property";
import { MOCK_POLICIES, MOCK_OPTIONS } from "../app/policy/mockData";
import type { FilterOptions, PolicyResult } from "../app/policy/types";
import type { NewsItem } from "./tauri";

// ── 静态 JSON 加载 ─────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

async function loadPoliciesStatic(): Promise<PolicyResult[]> {
  type SheetData = { headers: string[]; data: Record<string, unknown>[] };
  const sheet = await fetchJSON<SheetData>("/data/policies.json");
  const { headers, data } = sheet;
  return data.map((row, i) => {
    const get = (key: string): unknown => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? row[headers[idx]] : undefined;
    };
    const parseDate = (v: unknown): string | null => {
      if (!v) return null;
      const s = String(v);
      return s.length >= 10 ? s.substring(0, 10) : s;
    };
    return {
      id: String(get("id") ?? i),
      name: String(get("policyName") ?? ""),
      end_date: parseDate(get("end")),
      zcReleaseTime: String(get("zcReleaseTime") ?? ""),
      amount: (() => { const v = get("amount"); if (!v || v === "—" || v === "待定") return null; const n = Number(v); return isNaN(n) ? null : n; })(),
      amount_s: String(get("amount_s") ?? "待定"),
      method: String(get("claimMethod") ?? ""),
      area: String(get("applicableRegion") ?? ""),
      dept: String(get("leadDepartment") ?? ""),
      industry: String(get("行业标签") ?? ""),
      subject: String(get("申报主体") ?? ""),
      threshold: String(get("门槛标签") ?? ""),
      cap: String(get("政策能力") ?? ""),
      content: String(get("policyContent") ?? ""),
      contentHtml: String(get("policyContent") ?? ""),
      policyObject: String(get("policyObject") ?? ""),
      policyCondition: String(get("policyCondition") ?? ""),
      paymentStandard: String(get("paymentStandard") ?? ""),
      contactInfo: String(get("contactInfo") ?? ""),
      specialAbbreviat: String(get("specialAbbreviat") ?? ""),
      expired: false,
      days_left: 9999,
      _group: false,
      _reasons: [],
    } as PolicyResult;
  });
}

async function loadNewsStatic(): Promise<NewsItem[]> {
  return fetchJSON<NewsItem[]>("/data/news.json");
}

// ── normalize & buildOptions ───────────────────────────────────────────

function normalizePolicies(rows: PolicyResult[]): PolicyResult[] {
  return rows.map(r => ({
    ...r,
    end_date: r.end_date || null,
    expired: !!r.expired,
    days_left: r.days_left ?? 9999,
  }));
}

function buildOptions(policies: PolicyResult[]): FilterOptions {
  const locations = new Set<string>();
  const industries = new Set<string>();
  const depts = new Set<string>();

  for (const p of policies) {
    if (p.area) locations.add(p.area);
    if (p.industry) {
      for (const part of p.industry.split(/\s*\/\s*/)) {
        const t = part.trim();
        if (t && t !== "[待复核]" && t !== "[已下架]") industries.add(t);
      }
    }
    if (p.dept) depts.add(p.dept);
  }

  return {
    locations: Array.from(locations).sort().map(l => ({ k: l, l })),
    industries: Array.from(industries).sort().map(l => ({ k: l, l })),
    caps: [],
    thresholds: [],
    depts: Array.from(depts).sort().map(l => ({ k: l, l, cnt: 1 })),
    subjects: [],
    total: policies.length,
  };
}

// ── Hooks ────────────────────────────────────────────────────────────────

export function usePolicies() {
  const [policies, setPolicies] = useState<PolicyResult[]>(MOCK_POLICIES);
  const [options, setOptions] = useState<FilterOptions>(MOCK_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [fromFeishu, setFromFeishu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadPoliciesStatic();
      if (data.length > 0) {
        const normalized = normalizePolicies(data);
        setPolicies(normalized);
        const built = buildOptions(normalized);
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
    } catch (e) {
      console.warn("[usePolicies] load error:", e);
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
  const [buildings, setBuildings] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    loadPropertyData()
      .then(({ buildings: b }) => { setBuildings(b); })
      .catch(() => { setBuildings([]); })
      .finally(() => { setLoading(false); });
  }, []);

  return { properties: buildings, loading };
}

export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await loadNewsStatic();
      setNews(items);
    } catch (e) {
      console.error("[useNews] load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { news, loading, reload: load };
}
