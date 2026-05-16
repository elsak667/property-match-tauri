/**
 * 浦东政策匹配算法库
 * 从 Python Flask app (v1.2) 移植
 */
import { cacheOrRefresh } from "./policy/cache";
import { getPolicySheetRows } from "./policy/feishu";
import {
  IND_LABEL_MAP,
  LOCATIONS,
  SUBJECTS,
  INDUSTRY_ORDER,
  CAPS_K_MAP,
  THRESHOLD_K_MAP,
} from "./policy/constants";
import type {
  Policy,
  MatchQuery,
  MatchResult,
} from "./policy/types";
import {
  industryToKs,
  classifySubject,
  capsToKs,
  thresholdToKs,
  parseDate,
  stripHtml,
  getField,
  parseFeishuRichText,
  fmtDate,
} from "./policy/parser";
// ── 权重 ───────────────────────────────────────────────────────────────────
const P_IND = 5;
const P_SUB = 2;
const P_CAP = 1;
const P_LOC = 1;
const P_THRESHOLD = 1;
// ── 政策数据加载 ─────────────────────────────────────────────────────────────
export async function loadPolicies(): Promise<Policy[]> {
  return cacheOrRefresh<Policy[]>("policies", async () => {
    const rows = await getPolicySheetRows();
    if (!rows || rows.length < 2) {
      console.warn("[loadPolicies] No rows, length:", rows?.length);
      return [];
    }
    const headers = (rows[0] as unknown[]).map((h: unknown) => String(h || "").trim());
    console.log("[loadPolicies] headers:", headers.slice(0, 8), "| rows:", rows.length);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const policies: Policy[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (!row || row.length === 0) continue;
      if (!row.some((cell: unknown) => cell !== null && cell !== undefined && String(cell).trim() !== "")) continue;
      const industryVal = getField(row, headers, "行业标签").replace("[待复核]", "");
      const isOffline = industryVal === "[已下架]";
      const endRaw = getField(row, headers, "end");
      const end = parseDate(endRaw || null);
      let amount: number | null = null;
      const amountRaw = getField(row, headers, "amount");
      try {
        if (amountRaw && amountRaw !== "—" && amountRaw !== "待定" && amountRaw !== "") {
          amount = parseFloat(amountRaw);
          if (isNaN(amount)) amount = null;
        }
      } catch { amount = null; }
      const contentRaw = getField(row, headers, "policyContent");
      const contentClean = stripHtml(parseFeishuRichText(contentRaw));
      const contentHtml = contentRaw;
      const subjectRaw = getField(row, headers, "申报主体");
      const thresholdRaw = getField(row, headers, "门槛标签").replace("[待复核]", "");
      const capRaw = getField(row, headers, "政策能力").replace("[待复核]", "");
      const daysLeft = end ? Math.floor((end.getTime() - today.getTime()) / 86400000) : 9999;
      policies.push({
        id: getField(row, headers, "id").trim(),
        name: getField(row, headers, "policyName").trim(),
        start: parseDate(getField(row, headers, "start") || null),
        end,
        zcReleaseTime: getField(row, headers, "zcReleaseTime"),
        amount,
        amount_s: getField(row, headers, "amount_s") || "待定",
        method: getField(row, headers, "claimMethod"),
        area: getField(row, headers, "applicableRegion"),
        dept: getField(row, headers, "leadDepartment"),
        phone: getField(row, headers, "contactInfo"),
        industry: industryVal,
        industry_ks: industryToKs(getField(row, headers, "行业标签")),
        subject: subjectRaw,
        subject_ks: classifySubject(subjectRaw),
        threshold: thresholdRaw,
        threshold_ks: thresholdToKs(getField(row, headers, "门槛标签")),
        cap: capRaw,
        cap_ks: capsToKs(getField(row, headers, "政策能力")),
        content: contentClean,
        contentHtml,
        policyObject: getField(row, headers, "policyObject"),
        policyCondition: getField(row, headers, "policyCondition"),
        paymentStandard: getField(row, headers, "paymentStandard"),
        contactInfo: getField(row, headers, "contactInfo"),
        specialAbbreviat: getField(row, headers, "specialAbbreviat"),
        specialCat: getField(row, headers, "specialCat"),
        expired: isOffline || (end !== null && end < today),
        days_left: isOffline ? 0 : daysLeft,
      });
    }
    console.log("[loadPolicies] parsed", policies.length, "policies");
    return policies;
  });
}
// ── 匹配引擎 ────────────────────────────────────────────────────────────────
export function matchPolicies(
  policies: Policy[],
  query: MatchQuery,
  topN: number = 999,
  sortByStart: boolean = false
): MatchResult[] {
  const qLower = (query.query || "").toLowerCase().trim();
  const industryKs = (query.industries || []).map(ind => IND_LABEL_MAP[ind] || ind);
  const location = query.location || "";
  const subjectKs = query.subjects || [];
  const capKs = query.caps || [];
  const thresholdKs = query.thresholds || [];
  const dept = query.dept || "";
  const cat = query.cat || "";
  const results: (Policy & { _score: number; _reasons: string[] })[] = [];
  for (const p of policies) {
    if (qLower) {
      const text = (
        p.name + p.industry + p.subject + p.specialAbbreviat +
        p.dept + p.cap + p.area + p.threshold
      ).toLowerCase();
      if (!text.includes(qLower)) continue;
    }
    if (industryKs.length > 0) {
      if (!industryKs.some(ik => p.industry_ks.includes(ik))) continue;
    }
    if (dept && p.dept !== dept) continue;
    if (cat && p.specialCat !== cat) continue;
    if (location) {
      const locLabel = LOCATIONS.find(l => l.k === location)?.l || location;
      const areaVal = p.area || "";
      if (location === "pudong") {
        if (!areaVal.includes(locLabel) && areaVal.trim() !== "") continue;
      } else {
        if (!areaVal.includes(locLabel)) continue;
      }
    }
    if (subjectKs.length > 0) {
      if (!subjectKs.some(sk => p.subject_ks.includes(sk))) continue;
    }
    if (capKs.length > 0) {
      if (!capKs.some(ck => p.cap_ks.includes(ck))) continue;
    }
    if (thresholdKs.length > 0) {
      if (!thresholdKs.some(tk => p.threshold_ks.includes(tk))) continue;
    }
    let score = 0;
    const reasons: string[] = [];
    if (qLower) { score += 8; reasons.push("关键词命中"); }
    if (industryKs.length > 0) {
      const hit = industryKs.find(ik => p.industry_ks.includes(ik));
      if (hit) { score += P_IND; reasons.push(`行业匹配`); }
    }
    if (location) {
      score += P_LOC;
      reasons.push(`区域:${LOCATIONS.find(l => l.k === location)?.l || location}`);
    }
    if (subjectKs.length > 0) {
      const hit = subjectKs.find(sk => p.subject_ks.includes(sk));
      if (hit) {
        score += P_SUB;
        reasons.push(`主体:${SUBJECTS.find(s => s.k === hit)?.l || hit}`);
      }
    }
    if (capKs.length > 0) {
      if (capKs.some(ck => p.cap_ks.includes(ck))) { score += P_CAP; }
    }
    if (thresholdKs.length > 0) {
      const hit = thresholdKs.find(tk => p.threshold_ks.includes(tk));
      if (hit) {
        score += P_THRESHOLD;
        reasons.push(`门槛匹配`);
      }
    }
    results.push({ ...p, _score: score, _reasons: reasons });
  }
  results.sort((a, b) => b._score - a._score);
  if (sortByStart) {
    results.sort((a, b) => {
      const aTime = a.zcReleaseTime ? new Date(a.zcReleaseTime).getTime() : 0;
      const bTime = b.zcReleaseTime ? new Date(b.zcReleaseTime).getTime() : 0;
      if (aTime === 0 && bTime === 0) return 0;
      if (aTime === 0) return 1;
      if (bTime === 0) return -1;
      return bTime - aTime;
    });
  }
  return results.slice(0, topN).map((p, i) => {
    const { industry_ks, subject_ks, threshold_ks, cap_ks, ...rest } = p;
    return {
      ...rest,
      _rank: i + 1,
      _reasons: p._reasons,
    };
  });
}

// ── 标签动态构建 ──────────────────────────────────────────────────────────────

export interface FilterOptions {
  industries: { k: string; l: string }[];
  caps: { k: string; l: string }[];
  thresholds: { k: string; l: string }[];
  depts: { k: string; l: string; cnt: number }[];
  cats: { k: string; l: string; cnt: number }[];
}

export async function buildFilterOptions(policies: Policy[]): Promise<FilterOptions> {
  const industrySet = new Set<string>();
  const capSet = new Set<string>();
  const thresholdSet = new Set<string>();
  const deptMap = new Map<string, number>();
  const catMap = new Map<string, number>();

  for (const p of policies) {
    if (p.industry && !["X", "[待复核]", "[已下架]"].includes(p.industry)) {
      for (const part of p.industry.split(/\s*\/\s*/)) {
        const trimmed = part.trim();
        if (trimmed && !["[待复核]"].includes(trimmed)) industrySet.add(trimmed);
      }
    }
    if (p.cap && !["X", "[待复核]"].includes(p.cap)) {
      for (const part of p.cap.split(/\s*\/\s*/)) {
        const trimmed = part.trim();
        if (trimmed && !["[待复核]"].includes(trimmed)) capSet.add(trimmed);
      }
    }
    if (p.threshold && !["X", "无限定", "[待复核]"].includes(p.threshold)) {
      for (const part of p.threshold.split(/\s*\/\s*/)) {
        const trimmed = part.trim();
        if (trimmed) thresholdSet.add(trimmed);
      }
    }
    if (p.dept) {
      deptMap.set(p.dept, (deptMap.get(p.dept) || 0) + 1);
    }
    if (p.specialCat) {
      catMap.set(p.specialCat, (catMap.get(p.specialCat) || 0) + 1);
    }
  }

  const sortedIndustries = Array.from(industrySet).sort(
    (a, b) => {
      const ai = INDUSTRY_ORDER.indexOf(a);
      const bi = INDUSTRY_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }
  );

  return {
    industries: sortedIndustries.filter(l => l !== "质量标杆").map(l => ({ k: IND_LABEL_MAP[l] || l, l })),
    caps: Array.from(capSet).sort().map(l => ({ k: CAPS_K_MAP[l] || l, l })),
    thresholds: Array.from(thresholdSet).filter(l => l !== "人才").sort().map(l => ({
      k: THRESHOLD_K_MAP[l] || l, l
    })),
    depts: Array.from(deptMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([l, cnt]) => ({ k: l, l, cnt })),
    cats: Array.from(catMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([l, cnt]) => ({ k: l, l, cnt })),
  };
}

// ── 飞书 API 集成（适配 Vite/Tauri 浏览器环境）───────────────────────────────
// Uses Tauri invoke to call Rust backend Feishu proxy commands.

// ── 物业数据加载（适配 Vite/Tauri 浏览器环境）───────────────────────────────

export interface Park {
  park_id: string;
  name: string;
  district: string;
  address: string;
  industry_direction: string;
  built_year: number | null;
  canteen: string | null;
  dormitory: string | null;
  parking_total: string | null;
  exhibition_hall: string | null;
  meeting_rooms: string | null;
  fire_rating: string | null;
  security_level: string | null;
  land_nature: string | null;
  is_104_block: string | null;
  lat: number | null;
  lng: number | null;
}

export interface Building {
  building_id: string;
  park_id: string;
  name: string;
  type: string;
  floors: number | null;
  area_vacant: number | null;
  occupancy_rate: number | null;
  built_year: number | null;
  property_fee: number | null;
  ac_type: string | null;
  ac_hours: string | null;
  network_mbps: number | null;
  power_kv: number | null;
  has_gas: string | null;
  has_drainage: string | null;
  waste_gas_facility: string | null;
  column_spacing: number | null;
  floor_thickness: number | null;
  has_crane_beam: string | null;
  fire_sprinkler: string | null;
  fire_extinguisher: string | null;
  hydrant: string | null;
  independent_access: string | null;
  industry: string | null;
  contact: string | null;
  phone: string | null;
  rel_x: number | null;
  rel_y: number | null;
  elevator_p: number | null;
  elevator_c: number | null;
  "纬度(lat)": number | null;
  "经度(lng)": number | null;
}

export interface Unit {
  unit_id: string;
  building_id: string;
  floor: number | null;
  unit_no: string | null;
  area_total: number | null;
  area_rented: number | null;
  area_vacant: number | null;
  area_min_split: number | null;
  support_split: string | null;
  floor_height: number | null;
  load: number | null;
  price: number | null;
  deposit_ratio: number | null;
  min_lease_year: number | null;
  wc_count: number | null;
  pantry: string | null;
  allow_catering: string | null;
  allow_hazardous: string | null;
  remark: string | null;
}

export interface Property {
  unit_id: string;
  floor: number | null;
  unit_no: string | null;
  area_total: number | null;
  area_vacant: number | null;
  area_min_split: number | null;
  support_split: string | null;
  floor_height: number | null;
  load: number | null;
  price: number | null;
  deposit_ratio: number | null;
  min_lease_year: number | null;
  wc_count: number | null;
  pantry: string | null;
  allow_catering: string | null;
  allow_hazardous: string | null;
  remark: string | null;
  building_id: string;
  building_name: string;
  building_type: string;
  floors: number | null;
  elevator_p: number | null;
  elevator_c: number | null;
  occupancy_rate: number | null;
  property_fee: number | null;
  ac_type: string | null;
  ac_hours: string | null;
  network_mbps: number | null;
  power_kv: number | null;
  has_gas: string | null;
  has_drainage: string | null;
  waste_gas_facility: string | null;
  column_spacing: number | null;
  fire_sprinkler: string | null;
  industry: string | null;
  contact: string | null;
  phone: string | null;
  park_id: string;
  park_name: string;
  district: string;
  address: string;
  canteen: string | null;
  dormitory: string | null;
  parking_total: string | null;
  exhibition_hall: string | null;
  meeting_rooms: string | null;
  land_nature: string | null;
  is_104_block: string | null;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_PREFIX = "pm_cache_";
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch { return null; }
}

export function setCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* storage full or unavailable */ }
}

// cacheOrRefresh imported from ./policy/cache
// ── 工具函数 re-export ───────────────────────────────────────────────────────
export { fmtDate };
