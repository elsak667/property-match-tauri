/**
 * 浦东政策匹配算法库
 * 从 Python Flask app (v1.2) 移植
 */
import { feishuCacheRead, feishuCacheWrite } from "./tauri";

// Try Tauri HTTP plugin first, fall back to native fetch

// ── 类型声明 ───────────────────────────────────────────────────────────────
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

import profilesData from "../app/property/industry_profiles.json";

// ── 标签映射 ─────────────────────────────────────────────────────────────────

export const IND_LABEL_MAP: Record<string, string> = {
  "人工智能": "ai",
  "智能制造": "manufacturing",
  "生物医药": "biomed",
  "绿色低碳": "green",
  "消费文旅": "culture",
  "航运贸易": "shipping",
  "金融法律": "finance",
  "科技服务": "tech_service",
  "企业服务": "enterprise_service",
  "集成电路": "ic",
  "教育": "education",
  "农业": "agriculture",
  "质量标杆": "quality",
  "建设交通": "construction",
  "商务服务": "business",
};

export const INDUSTRY_ORDER = [
  "人工智能", "智能制造", "集成电路", "生物医药", "绿色低碳",
  "消费文旅", "航运贸易", "金融法律", "科技服务", "企业服务",
  "教育", "农业",
];

export const CAPS_K_MAP: Record<string, string> = {
  "资金补贴": "fund",
  "研发支持": "rd",
  "荣誉表彰": "honor",
  "人才支持": "talent",
  "资质认定": "qualify",
  "示范推广": "promote",
  "融资支持": "finance",
  "税费减免": "tax",
  "税收优惠": "tax",
  "费用减免": "fee",
  "场地支持": "space",
  "综合支持": "comprehensive",
  "一站式服务": "service",
};

export const THRESHOLD_K_MAP: Record<string, string> = {
  "无限定": "unlimited",
  "中小微企业": "sme",
  "高新技术企业": "hightech",
  "专精特新企业": "specialized",
  "张江区域企业": "zhangjiang",
  "新招引企业": "newly_introduced",
  "外资企业": "foreign",
  "金融机构": "financial_inst",
  "高校科研院所": "university",
  "社会组织": "social_org",
};

export const LOCATIONS = [
  { k: "pudong", l: "浦东新区" },
  { k: "zhangjiang", l: "张江科学城" },
  { k: "resort", l: "度假区" },
  { k: "free_trade", l: "自贸试验区" },
];

export const SUBJECTS = [
  { k: "enterprise", l: "企业" },
  { k: "individual", l: "个人" },
  { k: "social_org", l: "社会组织" },
];

export const CAPS_LIST = [
  { k: "fund", l: "💰 资金补贴" },
  { k: "rd", l: "🔬 研发支持" },
  { k: "honor", l: "🏆 荣誉表彰" },
  { k: "talent", l: "👤 人才支持" },
  { k: "qualify", l: "🏅 资质认定" },
  { k: "promote", l: "🚀 示范推广" },
  { k: "finance", l: "💳 融资支持" },
  { k: "tax", l: "📉 税费减免" },
  { k: "fee", l: "📋 费用减免" },
  { k: "space", l: "🏠 场地支持" },
  { k: "comprehensive", l: "📋 综合支持" },
  { k: "service", l: "🏗️ 一站式服务" },
];

// ── 权重 ───────────────────────────────────────────────────────────────────

const P_IND = 5;
const P_SUB = 2;
const P_CAP = 1;
const P_LOC = 1;
const P_THRESHOLD = 1;

// ── 辅助函数 ────────────────────────────────────────────────────────────────

export function industryToKs(raw: string): string[] {
  if (!raw) return [];
  const result: string[] = [];
  for (const part of raw.split(/\s*\/\s*/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const k = IND_LABEL_MAP[trimmed];
    if (k) result.push(k);
  }
  return result;
}

export function classifySubject(raw: string): string[] {
  if (!raw) return ["enterprise"];
  if (raw.includes("社会组织") && !raw.includes("企业") && !raw.includes("个人")) return ["social_org"];
  if (raw.includes("企业")) {
    if (raw.includes("个人")) return ["enterprise", "individual"];
    return ["enterprise"];
  }
  if (raw.includes("个人") || raw.includes("居民") || raw.includes("自然人")) return ["individual"];
  return ["enterprise"];
}

export function capsToKs(capRaw: string): string[] {
  if (!capRaw) return [];
  const result: string[] = [];
  for (const part of capRaw.split(/\s*\/\s*|\s*■\s*/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const k = CAPS_K_MAP[trimmed];
    if (k) result.push(k);
  }
  return result;
}

export function thresholdToKs(thresholdRaw: string): string[] {
  if (!thresholdRaw || thresholdRaw === "[待复核]") return [];
  const result: string[] = [];
  for (const part of thresholdRaw.split(/\s*\/\s*/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const k = THRESHOLD_K_MAP[trimmed];
    if (k && k !== "unlimited") result.push(k);
  }
  return result;
}

function parseDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  try {
    if (v instanceof Date) return v;
    if (typeof v === "string" && v.length >= 10) {
      return new Date(v.substring(0, 10) + "T00:00:00");
    }
  } catch { /* ignore */ }
  return null;
}

export function stripHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function getField(row: unknown[], headers: string[], key: string): string {
  const idx = headers.findIndex(h => h.toLowerCase() === key.toLowerCase());
  if (idx < 0 || idx >= row.length) return "";
  const val = row[idx];
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val)) {
    // 飞书富文本：[{"text": "..."}]
    const parts: string[] = [];
    for (const item of val) {
      if (typeof item === "object" && item !== null && "text" in item) {
        parts.push(String((item as {text: unknown}).text || ""));
      } else {
        parts.push(String(item));
      }
    }
    return parts.join("");
  }
  return String(val);
}

// ── 数据模型 ────────────────────────────────────────────────────────────────

export interface Policy {
  id: string;
  name: string;
  start: Date | null;
  end: Date | null;
  zcReleaseTime: string;
  amount: number | null;
  amount_s: string;
  method: string;
  area: string;
  dept: string;
  phone: string;
  industry: string;
  industry_ks: string[];
  subject: string;
  subject_ks: string[];
  threshold: string;
  threshold_ks: string[];
  cap: string;
  cap_ks: string[];
  content: string;
  contentHtml: string;
  policyObject: string;
  policyCondition: string;
  paymentStandard: string;
  contactInfo: string;
  specialAbbreviat: string;
  specialCat: string;
  expired: boolean;
  days_left: number;
}

export interface MatchQuery {
  query?: string;
  industries?: string[];
  location?: string;
  subjects?: string[];
  caps?: string[];
  thresholds?: string[];
  dept?: string;
  cat?: string;
}

// ── 飞书数据加载 ─────────────────────────────────────────────────────────────

function parseFeishuRichText(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") {
    try {
      const outer = JSON.parse(val);
      if (Array.isArray(outer) && outer.length > 0) {
        const first = outer[0];
        if (typeof first === "object" && first !== null && "text" in first) {
          const innerText = String((first as {text: unknown}).text || "");
          try {
            const inner = JSON.parse(innerText);
            if (Array.isArray(inner)) {
              return inner.map(item =>
                typeof item === "object" && item !== null ? String((item as {text: unknown}).text || "") : String(item)
              ).join("");
            }
          } catch { /* not JSON */ }
          return innerText;
        }
        return String(first);
      }
      return String(outer);
    } catch { return val; }
  }
  if (Array.isArray(val)) {
    const parts: string[] = [];
    for (const item of val) {
      if (typeof item === "object" && item !== null && "text" in item) {
        parts.push(String((item as {text: unknown}).text || ""));
      }
    }
    return parts.join("");
  }
  return String(val);
}

export async function loadPolicies(): Promise<Policy[]> {
  // Always fetch fresh data — stale empty cache causes blank policy cards.
  // Subsequent calls within the session get the already-cached (fresh) data.
  return cacheOrRefresh<Policy[]>("policies", async () => {
    const rows = await getPolicySheetRows();
    if (!rows || rows.length < 2) {
      console.warn("[loadPolicies] No rows, length:", rows?.length);
      return []; // still cache empty so we don't repeatedly hit API
    }
      console.warn("[loadPolicies] No rows, length:", rows?.length);

    const headers = (rows[0] as unknown[]).map((h: unknown) => String(h || "").trim());
    console.log("[loadPolicies] headers:", headers.slice(0,8), "| rows:", rows.length);
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

export interface MatchResult {
  id: string;
  name: string;
  start: Date | null;
  end: Date | null;
  zcReleaseTime: string;
  amount: number | null;
  amount_s: string;
  method: string;
  area: string;
  dept: string;
  industry: string;
  subject: string;
  threshold: string;
  cap: string;
  content: string;
  contentHtml: string;
  policyObject: string;
  policyCondition: string;
  paymentStandard: string;
  contactInfo: string;
  specialAbbreviat: string;
  expired: boolean;
  days_left: number;
  _score: number;
  _reasons: string[];
  _rank: number;
  _group?: boolean;
  group_name?: string;
  group_count?: number;
  children?: MatchResult[];
}

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
    // 关键词过滤
    if (qLower) {
      const text = (
        p.name + p.industry + p.subject + p.specialAbbreviat +
        p.dept + p.cap + p.area + p.threshold
      ).toLowerCase();
      if (!text.includes(qLower)) continue;
    }

    // 行业过滤
    if (industryKs.length > 0) {
      if (!industryKs.some(ik => p.industry_ks.includes(ik))) continue;
    }

    // 部门过滤
    if (dept && p.dept !== dept) continue;

    // 专项分类过滤
    if (cat && p.specialCat !== cat) continue;

    // 区域过滤
    if (location) {
      const locLabel = LOCATIONS.find(l => l.k === location)?.l || location;
      const areaVal = p.area || "";
      if (location === "pudong") {
        if (!areaVal.includes(locLabel) && areaVal.trim() !== "") continue;
      } else {
        if (!areaVal.includes(locLabel)) continue;
      }
    }

    // 申报主体过滤
    if (subjectKs.length > 0) {
      if (!subjectKs.some(sk => p.subject_ks.includes(sk))) continue;
    }

    // 政策能力过滤
    if (capKs.length > 0) {
      if (!capKs.some(ck => p.cap_ks.includes(ck))) continue;
    }

    // 门槛标签过滤
    if (thresholdKs.length > 0) {
      if (!thresholdKs.some(tk => p.threshold_ks.includes(tk))) continue;
    }

    // 计算分数
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

export function fmtDate(d: Date | null): string {
  if (!d) return "长期有效";
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, "0")}月${String(d.getDate()).padStart(2, "0")}日`;
}

export function getStars(rank: number): string {
  return rank <= 3 ? "★★★" : rank <= 8 ? "★★☆" : "★☆☆";
}

// ── 飞书 API 集成（适配 Vite/Tauri 浏览器环境）───────────────────────────────
// Uses Tauri invoke to call Rust backend Feishu proxy commands.

const POLICY_SPREADSHEET = "DwqqsS6TShlGhAteDf3cHRwvnHe";
const POLICY_SHEET_ID = "0aad30";

interface TenantToken { token: string; expiresAt: number; }
let cachedToken: TenantToken | null = null;

// 凭证缺失时抛出此错误，调用方应降级到 mock 数据
export class FeishuCredentialsMissing extends Error {
  constructor() {
    super("FEISHU_CREDENTIALS_MISSING");
    this.name = "FeishuCredentialsMissing";
  }
}

async function getTenantToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt - 300000) {
    return cachedToken.token;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    const token: string = await invoke("feishu_token", {});
    cachedToken = { token, expiresAt: now + 3600 * 1000 };
    return token;
  } catch (e: unknown) {
    const msg = String(e);
    if (msg.includes("not set") || msg.includes("未设置") || msg.includes("missing")) {
      throw new FeishuCredentialsMissing();
    }
    throw e;
  }
}

async function getSheetData(sheetToken: string, sheetId: string, range?: string): Promise<unknown[][]> {
  const queryRange = range || "A1:AA1000";
  const token = await getTenantToken();
  const { invoke } = await import("@tauri-apps/api/core");
  const result: any = await invoke("feishu_sheet", {
    token,
    spreadsheet: sheetToken,
    sheetId,
    range: queryRange,
  });
  if (result?.code !== 0) throw new Error(`Feishu API error: ${result?.msg}`);
  return result?.data?.valueRange?.values || [];
}

export async function getPolicySheetRows(): Promise<unknown[][]> {
  return getSheetData(POLICY_SPREADSHEET, POLICY_SHEET_ID, "A1:U600");
}

// ── 物业数据加载（适配 Vite/Tauri 浏览器环境）───────────────────────────────

const PROPERTY_SPREADSHEET = "X1jRs1PhLhR8WetSwktcM9Fgnhg";
const PROPERTY_SHEET_IDS: Record<string, string> = {
  "园区": "4hdJSg",
  "楼宇": "4hdJSh",
  "单元": "4hdJSi",
  "产业字典": "4hdJSj",
};

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

// Background refresh — returns cached data immediately, fetches new in background
async function cacheOrRefresh<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) {
    console.log('[cacheOrRefresh] Using cached data for', key);
    // Kick off background refresh (fire-and-forget)
    fetcher().then(data => { console.log('[cacheOrRefresh] Background refresh OK for', key); setCache(key, data); }).catch(e => { console.warn('[cacheOrRefresh] Background refresh failed for', key, e); });
    return cached;
  }
  const data = await fetcher();
  setCache(key, data);
  return data;
}

async function getSheetAsObjects<T = Record<string, unknown>>(sheetName: string, startRow = 3): Promise<T[]> {
  const sheetId = PROPERTY_SHEET_IDS[sheetName];
  if (!sheetId) throw new Error(`Sheet "${sheetName}" not found`);

  const data = await getSheetData(PROPERTY_SPREADSHEET, sheetId);

  if (!data || data.length < 2) return [];

  const headers = data[1] as string[];
  if (!headers) return [];

  const result: T[] = [];

  for (let i = startRow - 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    if (!row || row.length === 0 || !row[0]) continue;

    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] ?? null;
    }
    result.push(obj as T);
  }

  return result;
}

// ── 产业字典数据 ─────────────────────────────────────────────────────────────

// 本地 mock fallback（飞书凭证缺失时使用）
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

export interface IndustryProfile {
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
  remark: string | null;
}

interface RawIndustry {
  category_name: string | null;
  category_code: string | null;
  code: string;
  name: string;
  alias: string | null;
  load_min: number | null;
  height_min: number | null;
  price_max: number | null;
  power_kv: number | null;
  dual_power: string | null;
  cleanliness: string | null;
  fire_rating: string | null;
  env_assessment: string | null;
  special: string | null;
  remark: string | null;
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

interface IndustryCategory {
  name: string;
  code: string;
  industries: IndustryProfile[];
}

export async function loadIndustries(): Promise<{ categories: IndustryCategory[] }> {
  return cacheOrRefresh<{ categories: IndustryCategory[] }>("industries", async () => {
    let rawIndustries: RawIndustry[];
    try {
      rawIndustries = await getSheetAsObjects<RawIndustry>("产业字典", 3);
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

      categoryMap.get(catCode)!.industries.push(parseIndustry(raw));
    }

    const categories = Array.from(categoryMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    return { categories };
  });
}

// ── 物业数据加载 ─────────────────────────────────────────────────────────────

export async function loadPropertyData(): Promise<{ parks: Park[]; buildings: Building[]; units: Unit[] }> {
  return cacheOrRefresh<{ parks: Park[]; buildings: Building[]; units: Unit[] }>("property_data_v2", async () => {
    let parks: Park[], buildings: Building[], units: Unit[];
    try {
      [parks, buildings, units] = await Promise.all([
        getSheetAsObjects<Park>("园区", 3),
        getSheetAsObjects<Building>("楼宇", 3),
        getSheetAsObjects<Unit>("单元", 3),
      ]);
      const result = { parks, buildings, units };
      // 写入本地缓存
      feishuCacheWrite("property_data_v2", result as unknown as Record<string, unknown>).catch(() => {});
      return result;
    } catch (e) {
      if (e instanceof FeishuCredentialsMissing) {
        console.warn("[loadPropertyData] Feishu credentials missing, trying local cache...");
      }
      // 飞书失败：读本地缓存
      try {
        const cached = await feishuCacheRead("property_data_v2") as { parks: Park[]; buildings: Building[]; units: Unit[] } | null;
        if (cached && (cached.parks?.length > 0 || cached.buildings?.length > 0 || cached.units?.length > 0)) {
          console.log(`[loadPropertyData] Loaded ${cached.units?.length ?? 0} units from local cache`);
          return cached;
        }
      } catch {}
      console.warn("[loadPropertyData] No local cache, returning empty data");
      return { parks: [], buildings: [], units: [] };
    }
  });
}

// ── 物业匹配引擎 ─────────────────────────────────────────────────────────────

export interface PropertyMatchQuery {
  areaMin?: number;
  areaMax?: number;
  priceMax?: number;
  types?: string[];
  industries?: string[];
  loadMin?: number;
  heightMin?: number;
  powerKVMin?: number;
  tolerance?: number;
  is104Block?: string;
}

const WEIGHTS = {
  area: 0.22,
  price: 0.18,
  type: 0.15,
  industry: 0.22,
  load: 0.08,
  height: 0.08,
  is104: 0.07,
  powerKV: 0.05,
};

function scoreExactMatch(userVals: string[], propVal: string): number {
  if (!userVals?.length || !userVals[0]) return 100;
  if (!propVal) return 50;
  const pv = propVal.toLowerCase();
  const hit = userVals.some((uv) => uv && (pv.includes(uv.toLowerCase()) || uv.toLowerCase().includes(pv)));
  return hit ? 100 : 0;
}

function scoreRangeMatch(userVals: string[], propVal: string): number {
  if (!userVals?.length || !userVals[0]) return 100;
  if (!propVal) return 50;
  const pv = propVal.toLowerCase();
  const matched = userVals.filter((uv) => uv && (pv.includes(uv.toLowerCase()) || uv.toLowerCase().includes(pv))).length;
  if (matched === userVals.length) return 100;
  if (matched > 0) return Math.round((matched / userVals.length) * 80 + 20);
  return 0;
}

function scoreArea(uMin: number | undefined, uMax: number | undefined, pMin: number | null, pMax: number | null): number {
  if (pMax == null) return 50;
  if (uMin == null && uMax == null) return 100;
  const pMinSafe = pMin ?? 0;

  if (uMin != null && uMax != null) {
    if (pMinSafe <= uMin && pMax >= uMax) return 100;
    const overlapMin = Math.max(pMinSafe, uMin);
    const overlapMax = Math.min(pMax, uMax);
    if (overlapMin <= overlapMax) {
      const overlap = overlapMax - overlapMin;
      const userRange = uMax - uMin;
      const iou = overlap / userRange;
      return Math.round(Math.min(iou * 100, 100));
    } else {
      const gap = Math.min(Math.abs(pMinSafe - uMax), Math.abs(pMax - uMin));
      const penalty = Math.min((gap / uMax) * 80, 80);
      return Math.max(0, Math.round(70 - penalty));
    }
  } else if (uMin != null) {
    if (pMinSafe <= uMin && uMin <= pMax) return 100;
    if (uMin > pMax) {
      const gap = uMin - pMax;
      return Math.max(0, Math.round(70 - Math.min(gap / uMin * 70, 70)));
    }
    return Math.max(0, Math.round(80 - ((pMinSafe - uMin) / pMinSafe) * 20));
  } else if (uMax != null) {
    if (pMinSafe <= uMax) return pMax >= uMax ? 100 : Math.round((pMax / uMax) * 100);
    return 0;
  }
  return 100;
}

function scorePrice(uMax: number | undefined, pPrice: number | null): number {
  if (pPrice == null) return 50;
  if (uMax == null) return 100;
  if (pPrice <= uMax) {
    const ratio = pPrice / uMax;
    return Math.round(Math.min(100, 80 + (1 - ratio) * 20));
  } else {
    const over = (pPrice - uMax) / uMax;
    return Math.max(0, Math.round(80 - over * 80));
  }
}

function scoreNumericHard(uMin: number | undefined, pVal: number | null): number {
  if (uMin == null) return 100;
  if (pVal == null) return 0;
  return pVal >= uMin ? 100 : 0;
}

function scoreIs104(userVal: string | undefined, propVal: string | null): number {
  if (!userVal || userVal === "不限") return 100;
  if (!propVal) return 0;
  if (userVal === "是") return propVal === "是" ? 100 : 0;
  if (userVal === "否") return propVal === "否" ? 100 : 0;
  return 100;
}

function buildReason(s: Record<string, number>): string {
  const parts: string[] = [];
  if ((s.area ?? 0) >= 80) parts.push("面积");
  if ((s.price ?? 0) >= 80) parts.push("价格");
  if ((s.type ?? 0) >= 80) parts.push("类型");
  if ((s.industry ?? 0) >= 80) parts.push("产业");
  return parts.join(" | ") || "基础匹配";
}

function getStar(score: number): string {
  if (score >= 90) return "⭐⭐⭐";
  if (score >= 75) return "⭐⭐";
  return "⭐";
}

export interface PropertyMatchResult {
  property: Property;
  totalScore: number;
  stars: string;
  scores: Record<string, number>;
  matchReason: string;
}

export async function matchProperties(query: PropertyMatchQuery): Promise<PropertyMatchResult[]> {
  const tolerance = query.tolerance ?? 50;

  const { parks, buildings, units } = await loadPropertyData();

  const parkMap = new Map(parks.map(p => [p.park_id, p]));
  const buildingMap = new Map(buildings.map(b => [b.building_id, b]));

  const properties: Property[] = units
    .filter(unit => unit.area_vacant && unit.area_vacant > 0)
    .map(unit => {
      const building = buildingMap.get(unit.building_id);
      const park = building ? parkMap.get(building.park_id) : null;

      return {
        unit_id: unit.unit_id,
        floor: unit.floor,
        unit_no: unit.unit_no,
        area_total: unit.area_total,
        area_vacant: unit.area_vacant,
        area_min_split: unit.area_min_split,
        support_split: unit.support_split,
        floor_height: unit.floor_height,
        load: unit.load,
        price: unit.price,
        deposit_ratio: unit.deposit_ratio,
        min_lease_year: unit.min_lease_year,
        wc_count: unit.wc_count,
        pantry: unit.pantry,
        allow_catering: unit.allow_catering,
        allow_hazardous: unit.allow_hazardous,
        remark: unit.remark,
        building_id: building?.building_id ?? "",
        building_name: building?.name ?? "",
        building_type: building?.type ?? "",
        floors: building?.floors,
        elevator_p: building?.elevator_p,
        elevator_c: building?.elevator_c,
        occupancy_rate: building?.occupancy_rate,
        property_fee: building?.property_fee,
        ac_type: building?.ac_type,
        ac_hours: building?.ac_hours,
        network_mbps: building?.network_mbps,
        power_kv: building?.power_kv,
        has_gas: building?.has_gas,
        has_drainage: building?.has_drainage,
        waste_gas_facility: building?.waste_gas_facility,
        column_spacing: building?.column_spacing,
        fire_sprinkler: building?.fire_sprinkler,
        industry: building?.industry,
        contact: building?.contact,
        phone: building?.phone,
        park_id: park?.park_id ?? building?.park_id ?? "",
        park_name: park?.name ?? "",
        district: park?.district ?? "",
        address: park?.address ?? "",
        canteen: park?.canteen,
        dormitory: park?.dormitory,
        parking_total: park?.parking_total,
        exhibition_hall: park?.exhibition_hall,
        meeting_rooms: park?.meeting_rooms,
        land_nature: park?.land_nature,
        is_104_block: park?.is_104_block,
      } as Property;
    });

  const hasFilters = [
    query.areaMin, query.areaMax, query.priceMax,
    (query.types?.length ?? 0) > 0,
    (query.industries?.length ?? 0) > 0,
    query.loadMin, query.heightMin, query.powerKVMin,
    query.is104Block,
  ].some(Boolean);

  const results = properties
    .map((p) => {
      const sArea = scoreArea(query.areaMin, query.areaMax, p.area_min_split ?? null, p.area_vacant ?? null);
      const sPrice = scorePrice(query.priceMax ?? undefined, p.price ?? null);
      const sType = scoreExactMatch(query.types ?? [], p.building_type);
      const sIndustry = scoreRangeMatch(query.industries ?? [], p.industry ?? "");
      const sLoad = scoreNumericHard(query.loadMin ?? undefined, p.load);
      const sHeight = scoreNumericHard(query.heightMin ?? undefined, p.floor_height);
      const sPowerKV = scoreNumericHard(query.powerKVMin ?? undefined, p.power_kv);
      const s104 = scoreIs104(query.is104Block, p.is_104_block);

      const raw =
        sArea * WEIGHTS.area +
        sPrice * WEIGHTS.price +
        sType * WEIGHTS.type +
        sIndustry * WEIGHTS.industry +
        sLoad * WEIGHTS.load +
        sHeight * WEIGHTS.height +
        s104 * WEIGHTS.is104 +
        sPowerKV * WEIGHTS.powerKV;
      const total = Math.min(100, raw);

      const scores = { area: sArea, price: sPrice, type: sType, industry: sIndustry, load: sLoad, height: sHeight, is104: s104, powerKV: sPowerKV };

      return {
        property: p,
        totalScore: Math.round(total * 10) / 10,
        stars: getStar(total),
        scores,
        matchReason: hasFilters ? buildReason(scores) : "综合推荐",
      };
    })
    .filter((r) => !hasFilters || r.totalScore >= tolerance)
    .filter((r) => !query.is104Block || query.is104Block === "不限" || (r.scores.is104 ?? 100) > 0)
    .filter((r) => !query.loadMin || (r.scores.load ?? 100) > 0)
    .filter((r) => !query.heightMin || (r.scores.height ?? 100) > 0)
    .filter((r) => !query.powerKVMin || (r.scores.powerKV ?? 100) > 0)
    .sort((a, b) => b.totalScore - a.totalScore);

  return results;
}
