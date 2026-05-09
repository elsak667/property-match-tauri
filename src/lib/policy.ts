/**
 * 浦东政策匹配算法库
 * 从 Python Flask app (v1.2) 移植
 */
import { cacheOrRefresh } from "./policy/cache";
import { getPolicySheetRows, getSheetAsObjects, FeishuCredentialsMissing } from "./policy/feishu";
import {
  IND_LABEL_MAP,
  LOCATIONS,
  SUBJECTS,
} from "./policy/constants";
import type {
  Policy,
  MatchQuery,
  MatchResult,
  IndustryProfile,
  IndustryCategory,
  RawIndustry,
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
import profilesData from "../app/property/industry_profiles.json";
// ── 权重 ───────────────────────────────────────────────────────────────────
const P_IND = 5;
const P_SUB = 2;
const P_CAP = 1;
const P_LOC = 1;
const P_THRESHOLD = 1;
// ── 行业字典 mock fallback ─────────────────────────────────────────────────
interface IndustryProfiles {
  description: string;
  version: string;
  lastUpdated: string;
  categories: Array<{
    name: string;
    code: string;
    industries: Array<{
      code: string;
      name: string;
      alias: string[];
      loadMin: number | null;
      heightMin: number | null;
      priceMax: number | null;
      powerKV: number | null;
      dualPower: boolean | null;
      cleanliness: string | null;
      fireRating: string | null;
      envAssessment: string | null;
      special: string[];
      remark: string;
    }>;
  }>;
}
const MOCK_INDUSTRIES_FALLBACK: { categories: IndustryCategory[] } = {
  categories: (profilesData as IndustryProfiles).categories.map(cat => ({
    name: cat.name,
    code: cat.code,
    industries: cat.industries.map(ind => ({
      code: ind.code,
      name: ind.name,
      alias: ind.alias,
      loadMin: ind.loadMin,
      heightMin: ind.heightMin,
      priceMax: ind.priceMax,
      powerKV: ind.powerKV,
      dualPower: ind.dualPower,
      cleanliness: ind.cleanliness,
      fireRating: ind.fireRating,
      envAssessment: ind.envAssessment,
      special: ind.special,
      remark: ind.remark,
    })),
  })),
};
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
// ── 过滤器构建 ──────────────────────────────────────────────────────────────
export { buildFilterOptions } from "./policy/parser";
// ── 产业字典加载 ─────────────────────────────────────────────────────────────
export async function loadIndustries(): Promise<{ categories: IndustryCategory[] }> {
  return cacheOrRefresh<{ categories: IndustryCategory[] }>("industries", async () => {
    let rawIndustries: RawIndustry[];
    const PROPERTY_SPREADSHEET = "X1jRs1PhLhR8WetSwktcM9Fgnhg";
    try {
      rawIndustries = await getSheetAsObjects<RawIndustry>(PROPERTY_SPREADSHEET, "4hdJSj", 3);
    } catch (e) {
      if (e instanceof FeishuCredentialsMissing) {
        console.warn("[loadIndustries] Feishu credentials missing, using mock data");
        return MOCK_INDUSTRIES_FALLBACK;
      }
      throw e;
    }
    const categoryMap = new Map<string, IndustryCategory>();
    for (const raw of rawIndustries) {
      const catCode = raw.category_code || "other";
      const catName = raw.category_name || "其他";
      if (!categoryMap.has(catCode)) {
        categoryMap.set(catCode, {
          name: catName,
          code: catCode,
          industries: [],
        });
      }
      const cat = categoryMap.get(catCode);
      if (cat) cat.industries.push(parseIndustry(raw));
    }
    const categories = Array.from(categoryMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
    return { categories };
  });
}
function parseIndustry(raw: RawIndustry): IndustryProfile {
  const alias: string[] = raw.alias ? raw.alias.toString().split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
  const special: string[] = raw.special ? raw.special.toString().split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
  return {
    code: raw.code,
    name: raw.name,
    alias,
    loadMin: raw.load_min ?? null,
    heightMin: raw.height_min ?? null,
    priceMax: raw.price_max ?? null,
    powerKV: raw.power_kv ?? null,
    dualPower: raw.dual_power === "是" || raw.dual_power === "true" || raw.dual_power === "1",
    cleanliness: raw.cleanliness ?? null,
    fireRating: raw.fire_rating ?? null,
    envAssessment: raw.env_assessment ?? null,
    special,
    remark: raw.remark ?? null,
  };
}
// ── 工具函数 re-export ───────────────────────────────────────────────────────
export { fmtDate };
