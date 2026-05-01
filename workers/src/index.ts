/**
 * Cloudflare Workers — 飞书 API 代理 + AI 智能匹配（RAG 模式）
 */

interface Env {
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  PROPERTY_SHEET: string;
  PROPERTY_BUILDING_SHEET_ID: string;
  POLICY_SHEET: string;
  POLICY_SHEET_ID: string;
  STATS_SHEET_ID: string;
  NEWS_SHEET: string;
  NEWS_SHEET_ID: string;
  PROPERTY_PARK_SHEET_ID: string;
  PROPERTY_UNIT_SHEET_ID: string;
  PROPERTY_INDUSTRY_SHEET_ID: string;
  FEEDBACK_BITABLE_TOKEN: string;
  FEEDBACK_TABLE_ID: string;
  SERVERCHAN_KEY: string;
  NVIDIA_API_KEY: string;
  HF_ACCESS_TOKEN: string;
  CACHE: KVNamespace;
}

interface PolicySummary {
  name: string;
  industry: string;
  amount_s: string;
  area: string;
  subject: string;
  end_date: string;
  content: string;
}

interface PropertySummary {
  name: string;      // 单元编号
  building_id: string; // 楼宇ID
  building: string;   // 楼宇名称
  park: string;
  district: string;
  area_total: string;
  area_vacant: string;
  price: string;
  industry: string;
  floor_height: string;
  load: string;
  power_kv: string;
}

// 物业多条件过滤参数（从飞书真实字段提取）
interface PropertyFilter {
  district?: string;      // 区域（如"金桥"、"浦东"）
  park?: string;          // 园区名（模糊匹配）
  building?: string;      // 楼宇名（模糊匹配）
  area_min?: number;      // 最小面积（㎡）
  area_max?: number;      // 最大面积（㎡）
  price_max?: number;     // 最高租金（元/㎡/天）
  floor_height_min?: number; // 最低层高（m）
  industry?: string;      // 产业方向（模糊匹配楼宇 industry 列）
  allow_catering?: boolean;  // 是否允许餐饮
  has_crane_beam?: boolean;  // 是否有行车梁
  page?: number;          // 页码
  page_size?: number;     // 每页条数
}

// 物业原始行数据（用于精细过滤）
interface RawUnitRow {
  unit_id: string;
  building_id: string;
  floor: number | null;
  unit_no: string;
  area_total: number | null;
  area_vacant: number | null;
  floor_height: number | null;
  load: number | null;
  price: number | null;
  allow_hazardous: string;  // 用途分类
  remark: string;
}

// 楼宇信息（含坐标）
interface RawBuildingRow {
  building_id: string;
  park_id: string;
  name: string;
  industry: string;
  has_crane_beam: boolean;
  lat: number | null;   // 园区相对坐标
  lng: number | null;  // 园区相对坐标
}

// 物业缓存（含原始行，用于精细过滤）
interface PropertyCache {
  units: RawUnitRow[];
  buildings: Record<string, RawBuildingRow>;
  parks: Record<string, { name: string; district: string }>;
  updated_at: number;
}

interface DataCache {
  policies: PolicySummary[];
  properties: PropertySummary[];
  updated_at: number;
}

const TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
const SHEET_URL = "https://open.feishu.cn/open-apis/sheets/v2/spreadsheets";

// ── KV 缓存层（30分钟 TTL）────────────────────────────────────────────────────
const CACHE_KEY = "feishu_data";
const PROPERTY_CACHE_KEY = "property_full_data";
const CACHE_TTL_SEC = 30 * 60; // 30 分钟

async function getCachedData(env: Env): Promise<DataCache | null> {
  try {
    const val = await env.CACHE.get(CACHE_KEY);
    if (!val) return null;
    const data = JSON.parse(val) as DataCache;
    if (Date.now() - data.updated_at > CACHE_TTL_SEC * 1000) return null;
    return data;
  } catch { return null; }
}

async function setCachedData(env: Env, data: DataCache): Promise<void> {
  try {
    await env.CACHE.put(CACHE_KEY, JSON.stringify(data), {
      expirationTtl: CACHE_TTL_SEC + 60,
    });
  } catch { /* 静默失败，不阻塞请求 */ }
}

// ── 物业精细缓存（原始行数据，用于多条件过滤）──────────────────────────────
async function getPropertyCache(env: Env): Promise<PropertyCache | null> {
  try {
    const val = await env.CACHE.get(PROPERTY_CACHE_KEY);
    if (!val) return null;
    const data = JSON.parse(val) as PropertyCache;
    if (Date.now() - data.updated_at > CACHE_TTL_SEC * 1000) return null;
    return data;
  } catch { return null; }
}

async function refreshPropertyCache(env: Env): Promise<PropertyCache> {
  const [unitRows, buildingRows, parkRows] = await Promise.all([
    fetchSheet(env, env.PROPERTY_SHEET, env.PROPERTY_UNIT_SHEET_ID || "4hdJSi", "A2:T200").catch(() => []),
    fetchSheet(env, env.PROPERTY_SHEET, env.PROPERTY_BUILDING_SHEET_ID || "4hdJSh", "A2:Z30").catch(() => []),
    fetchSheet(env, env.PROPERTY_SHEET, env.PROPERTY_PARK_SHEET_ID || "4hdJSg", "A2:F30").catch(() => []),
  ]);

  // parse building
  const buildings: Record<string, RawBuildingRow> = {};
  if (buildingRows.length >= 1) {
    const bHdr = (buildingRows[0] as unknown[]).map(v => String(v ?? ""));
    const bId = bHdr.indexOf("building_id"); const bName = bHdr.indexOf("name");
    const bPark = bHdr.indexOf("park_id"); const bInd = bHdr.indexOf("industry");
    const bCrane = bHdr.indexOf("has_crane_beam");
    const bLat = bHdr.indexOf("纬度(lat)"); const bLng = bHdr.indexOf("经度(lng)");
    for (const row of buildingRows.slice(1)) {
      const r = row as unknown[];
      if (!Array.isArray(r) || !r[bId]) continue;
      const bid = str(r[bId]);
      buildings[bid] = {
        building_id: bid,
        park_id: str(r[bPark]),
        name: str(r[bName]),
        industry: str(r[bInd]),
        has_crane_beam: str(r[bCrane]) === "有" || str(r[bCrane]) === "是",
        lat: typeof r[bLat] === "number" ? r[bLat] as number : null,
        lng: typeof r[bLng] === "number" ? r[bLng] as number : null,
      };
    }
  }

  // parse park
  const parks: Record<string, { name: string; district: string }> = {};
  if (parkRows.length >= 1) {
    const pHdr = (parkRows[0] as unknown[]).map(v => String(v ?? ""));
    const pId = pHdr.indexOf("park_id"); const pName = pHdr.indexOf("name");
    const pDist = pHdr.indexOf("district");
    for (const row of parkRows.slice(1)) {
      const r = row as unknown[];
      if (!Array.isArray(r) || !r[pId]) continue;
      const pid = str(r[pId]);
      parks[pid] = { name: str(r[pName]), district: str(r[pDist]) };
    }
  }

  // parse units
  const units: RawUnitRow[] = [];
  if (unitRows.length >= 1) {
    const uHdr = (unitRows[0] as unknown[]).map(v => String(v ?? ""));
    const uId = uHdr.indexOf("unit_id"); const uBid = uHdr.indexOf("building_id");
    const uFloor = uHdr.indexOf("floor"); const uNo = uHdr.indexOf("unit_no");
    const uTot = uHdr.indexOf("area_total"); const uVac = uHdr.indexOf("area_vacant");
    const uFH = uHdr.indexOf("floor_height"); const uLoad = uHdr.indexOf("load");
    const uPrice = uHdr.indexOf("price"); const uCater = uHdr.indexOf("allow_catering");
    const uHazard = uHdr.indexOf("allow_hazardous"); const uRemark = uHdr.indexOf("remark");
    for (const row of unitRows.slice(1)) {
      const r = row as unknown[];
      if (!Array.isArray(r) || !r[uId]) continue;
      units.push({
        unit_id: str(r[uId]),
        building_id: str(r[uBid]),
        floor: typeof r[uFloor] === "number" ? r[uFloor] as number : null,
        unit_no: str(r[uNo]),
        area_total: typeof r[uTot] === "number" ? r[uTot] as number : null,
        area_vacant: typeof r[uVac] === "number" ? r[uVac] as number : null,
        floor_height: typeof r[uFH] === "number" ? r[uFH] as number : null,
        load: typeof r[uLoad] === "number" ? r[uLoad] as number : null,
        price: typeof r[uPrice] === "number" ? r[uPrice] as number : null,
        allow_hazardous: str(r[uHazard]),
        remark: str(r[uRemark]),
      });
    }
  }

  return { units, buildings, parks, updated_at: Date.now() };
}

function filterUnits(units: RawUnitRow[], buildings: Record<string, { park_id: string; name: string; industry: string; has_crane_beam: boolean }>, parks: Record<string, { name: string; district: string }>, filter: PropertyFilter): RawUnitRow[] {
  return units.filter(u => {
    const b = buildings[u.building_id] || {} as any;

    // 面积
    if (filter.area_min != null && (u.area_total == null || u.area_total < filter.area_min)) return false;
    if (filter.area_max != null && (u.area_total == null || u.area_total > filter.area_max)) return false;

    // 价格
    if (filter.price_max != null && (u.price == null || u.price > filter.price_max)) return false;

    // 层高
    if (filter.floor_height_min != null && (u.floor_height == null || u.floor_height < filter.floor_height_min)) return false;

    // 餐饮
    if (filter.allow_catering != null) {
      const ok = str(u.allow_hazardous).includes("餐饮") || str(u.remark).includes("餐饮");
      if (filter.allow_catering && !ok) return false;
    }

    // 区域（通过楼宇的园区查）
    if (filter.district) {
      const park = parks[b.park_id];
      if (!park || !park.district.includes(filter.district)) return false;
    }

    // 园区
    if (filter.park) {
      const park = parks[b.park_id];
      if (!park || !park.name.includes(filter.park)) return false;
    }

    // 楼宇名
    if (filter.building && !b.name.includes(filter.building)) return false;

    // 产业方向
    if (filter.industry && !b.industry.includes(filter.industry)) return false;

    // 行车梁
    if (filter.has_crane_beam && !b.has_crane_beam) return false;

    return true;
  });
}

async function getToken(env: Env): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
  });
  const data = await res.json() as { code: number; msg?: string; tenant_access_token?: string };
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Token error ${data.code}: ${data.msg}`);
  }
  return data.tenant_access_token;
}

async function fetchSheet(
  env: Env,
  spreadsheet: string,
  sheetId: string,
  range: string,
): Promise<any[]> {
  const token = await getToken(env);
  const url = `${SHEET_URL}/${spreadsheet}/values/${sheetId}!${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json() as {
    code: number; msg?: string;
    data?: { valueRange?: { values?: any[] } };
  };
  if (data.code !== 0) throw new Error(`Sheet error ${data.code}: ${data.msg}`);
  return data.data?.valueRange?.values ?? [];
}

function str(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    return v.map(item => {
      if (typeof item === "object" && item !== null && "text" in item) {
        return (item as {text?: string}).text || "";
      }
      return String(item);
    }).join("");
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (obj.text != null) return String(obj.text);
  }
  return String(v);
}

async function getFeishuData(env: Env): Promise<DataCache> {
  const cached = await getCachedData(env);
  if (cached) return cached;
  const data = await refreshFeishuData(env);
  setCachedData(env, data).catch(() => {});
  return data;
}

// 获取飞书数据并构建缓存
async function refreshFeishuData(env: Env): Promise<DataCache> {
  const [policyRows, unitRows, buildingRows, parkRows] = await Promise.all([
    fetchSheet(env, env.POLICY_SHEET, env.POLICY_SHEET_ID, "A1:U600").catch(() => []),
    fetchSheet(env, env.PROPERTY_SHEET, env.PROPERTY_UNIT_SHEET_ID || "4hdJSi", "A1:ZZ500").catch(() => []),
    fetchSheet(env, env.PROPERTY_SHEET, env.PROPERTY_BUILDING_SHEET_ID || "4hdJSh", "A1:ZZ100").catch(() => []),
    fetchSheet(env, env.PROPERTY_SHEET, env.PROPERTY_PARK_SHEET_ID || "4hdJSg", "A1:ZZ100").catch(() => []),
  ]);

  // ── 政策摘要 ────────────────────────────────────────────────────────────────
  const policies: PolicySummary[] = [];
  if (policyRows.length >= 2) {
    const headers: string[] = (policyRows[0] as unknown[]).map((v) => String(v ?? ""));
    const col = (name: string) => headers.indexOf(name);
    const iName = col("policyName"); const iInd = col("行业标签"); const iAmt = col("amount");
    const iArea = col("applicableRegion"); const iSubj = col("申报主体"); const iEnd = col("end");
    const iCont = col("policyContent");

    for (let r = 1; r < policyRows.length; r++) {
      const row = policyRows[r] as unknown[];
      if (!Array.isArray(row) || row.length === 0 || row[0] == null) continue;
      const name = str(row[iName]); if (!name) continue;
      const end = str(row[iEnd]);
      if (end) {
        const endDate = new Date(end);
        if (!isNaN(endDate.getTime()) && endDate < new Date()) continue;
      }
      const amountRaw = str(row[iAmt]);
      let amount_s = amountRaw;
      if (amountRaw && !/万|亿|元/.test(amountRaw) && !isNaN(Number(amountRaw))) {
        const n = Number(amountRaw);
        amount_s = n >= 10000 ? `${(n / 10000).toFixed(0)}亿` : `${n}万元`;
      }
      policies.push({
        name, industry: str(row[iInd]), amount_s: amount_s || "待定",
        area: str(row[iArea]), subject: str(row[iSubj]),
        end_date: str(row[iEnd]).substring(0, 10),
        content: str(row[iCont]).substring(0, 100),
      });
      if (policies.length >= 50) break;
    }
  }

  // ── 物业摘要（单元 + 楼宇 + 园区 join）────────────────────────────────────
  // park_id → 园区名+区域
  const parkMap: Record<string, string> = {};
  const parkDistrictMap: Record<string, string> = {};
  if (parkRows.length >= 3) {
    const phdr = (parkRows[1] as unknown[]).map((v) => String(v ?? ""));
    const piId = phdr.indexOf("park_id"); const piName = phdr.indexOf("name");
    const piDist = phdr.indexOf("district");
    for (let r = 2; r < parkRows.length; r++) {
      const row = parkRows[r] as unknown[];
      if (!Array.isArray(row) || !row[piId]) continue;
      const pid = str(row[piId]); const pname = str(row[piName]); const pdist = str(row[piDist]);
      if (pid) { parkMap[pid] = pname; parkDistrictMap[pid] = pdist; }
    }
  }

  // building_id → {name, park_id, industry}
  const buildingInfo: Record<string, {name: string; park_id: string; industry: string}> = {};
  if (buildingRows.length >= 3) {
    const bhdr = (buildingRows[1] as unknown[]).map((v) => String(v ?? ""));
    const biId = bhdr.indexOf("building_id"); const biName = bhdr.indexOf("name");
    const biPark = bhdr.indexOf("park_id"); const biInd = bhdr.indexOf("industry");
    for (let r = 2; r < buildingRows.length; r++) {
      const row = buildingRows[r] as unknown[];
      if (!Array.isArray(row) || !row[biId]) continue;
      const bid = str(row[biId]);
      if (bid) buildingInfo[bid] = {
        name: str(row[biName]),
        park_id: str(row[biPark]),
        industry: str(row[biInd]),
      };
    }
  }

  const properties: PropertySummary[] = [];
  if (unitRows.length >= 3) {
    const hdr = (unitRows[1] as unknown[]).map((v) => String(v ?? ""));
    const col = (name: string) => hdr.indexOf(name);
    const iName = col("unit_no"); const iBid = col("building_id"); const iArea = col("area_total");
    const iVac = col("area_vacant"); const iPrice = col("price"); const iFH = col("floor_height");
    const iLoad = col("load"); const iPwr = col("power_kv");

    for (let r = 2; r < unitRows.length; r++) {
      const row = unitRows[r] as unknown[];
      if (!Array.isArray(row) || row.length === 0 || row[0] == null) continue;
      const name = str(row[iName]); if (!name) continue;
      const bid = str(row[iBid]);
      const bInfo = buildingInfo[bid] || {};
      const pid = bInfo.park_id || "";
      const pname = parkMap[pid] || bInfo.name || "";
      const pdist = parkDistrictMap[pid] || "";
      properties.push({
        name, building_id: bid,
        building: bInfo.name || "",
        park: pname, district: pdist,
        area_total: str(row[iArea]) || str(row[iVac]),
        area_vacant: str(row[iVac]),
        price: str(row[iPrice]),
        industry: bInfo.industry || "",
        floor_height: str(row[iFH]),
        load: str(row[iLoad]),
        power_kv: str(row[iPwr]),
      });
      if (properties.length >= 50) break;
    }
  }

  const data: DataCache = { policies, properties, updated_at: Date.now() };
  return data;
}

function buildContextSummary(data: DataCache): string {
  const polLines = data.policies.map((p, i) =>
    `${i + 1}. ${p.name} | 行业:${p.industry || "不限"} | 补贴:${p.amount_s} | 区域:${p.area || "不限"} | 主体:${p.subject || "不限"} | 截止:${p.end_date || "长期"}`
  ).join("\n");

  const propLines = data.properties.map((p, i) =>
    `${i + 1}. ${p.name} | 园区:${p.park || "—"} | 区域:${p.district || "—"} | 面积:${p.area_total || p.area_vacant || "—"}㎡ | 租金:${p.price || "—"}元/㎡·天 | 行业:${p.industry || "不限"} | 层高:${p.floor_height || "—"}m | 荷载:${p.load || "—"}kg/㎡ | 配电:${p.power_kv || "—"}kVA`
  ).join("\n");

  return `【政策库】（共 ${data.policies.length} 条）\n${polLines}\n\n【物业载体库】（共 ${data.properties.length} 条）\n${propLines}`;
}

// ── 结构化评分 + 理由生成 ────────────────────────────────────────────────────

// 英文关键词 → 中文扩展词（提升中英文混合查询召回率）
const EXPANSIONS: Record<string, string[]> = {
  ai: ["人工智能", "ai", "AI", "Artificial Intelligence"],
  "5g": ["5G", "第五代移动通信"],
  "3g": ["3G", "第三代移动通信"],
  "4g": ["4G", "第四代移动通信"],
  iot: ["物联网"],
  物联网: ["IoT"],
  ic: ["芯片", "集成电路", "半导体"],
  ev: ["新能源汽车", "电动车"],
  人工智能: ["AI", "人工智能"],
};

function expandQuery(q: string): string[] {
  const lower = q.toLowerCase();
  const out: string[] = [lower];
  // 整体查询词扩展
  const full = EXPANSIONS[lower];
  if (full) out.push(...full);
  // 空格分词扩展
  const tokens = lower.split(/\s+/);
  for (const token of tokens) {
    const expanded = EXPANSIONS[token];
    if (expanded) out.push(...expanded);
    // 英文+中文混合词，提取英文前缀做扩展（如 ai企业补贴 → ai）
    const english = token.match(/^[a-z0-9]+/i);
    if (english) {
      const prefix = english[0].toLowerCase();
      const ep = EXPANSIONS[prefix];
      if (ep) out.push(...ep);
    }
  }
  return [...new Set(out)];
}

function keywordSet(text: string): Set<string> {
  const out = new Set<string>();
  // 空格分词
  text.toLowerCase()
    .replace(/[^a-z0-9一-鿿]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .forEach((w) => out.add(w));
  // 中文 2-gram（帮助"人工智能企业"匹配"人工智能"）
  const chinese = text.match(/[一-鿿]{2,}/g);
  if (chinese) {
    for (const seg of chinese) {
      for (let i = 0; i < seg.length - 1; i++) {
        out.add(seg.slice(i, i + 2));
      }
    }
  }
  return out;
}

function keywordScore(query: string, ...fields: string[]): { score: number; hits: string[] } {
  const expanded = expandQuery(query);
  const hits: string[] = [];
  let score = 0;
  for (const field of fields) {
    if (!field) continue;
    const lowerField = field.toLowerCase();
    for (const w of expanded) {
      const lw = w.toLowerCase();
      if (lw.length < 2) continue;
      // 精确 token 匹配（最高权重，字段本身的分词命中）
      const fSet = keywordSet(field);
      if (fSet.has(lw)) { score += 15; hits.push(w); }
      // 字段全文包含该词（次高权重，字符串子串命中）
      else if (lowerField.includes(lw)) { score += 7; hits.push(w); }
    }
  }
  return { score: Math.min(score, 100), hits: [...new Set(hits)] };
}

interface ScoredPolicy {
  id: number;
  name: string;
  score: number;
  hits: string[];
  detail: PolicySummary;
}

interface ScoredProperty {
  id: number;
  name: string;
  building: string;
  park: string;
  score: number;
  hits: string[];
  detail: PropertySummary;
}

function scorePolicy(query: string, policy: PolicySummary, id: number): ScoredPolicy {
  const { score, hits } = keywordScore(
    query,
    policy.name,
    policy.industry,
    policy.area,
    policy.subject,
    policy.amount_s,
    policy.content,
  );
  const titleKw = keywordSet(policy.name);
  for (const w of keywordSet(query)) {
    if (titleKw.has(w)) return { id, name: policy.name, score: Math.min(score + 20, 100), hits, detail: policy };
  }
  return { id, name: policy.name, score, hits, detail: policy };
}

function scoreProperty(query: string, prop: PropertySummary, id: number): ScoredProperty {
  const { score, hits } = keywordScore(
    query,
    prop.name,         // 单元编号
    prop.building,     // 楼宇名称
    prop.park,
    prop.district,
    prop.industry,
    prop.area_total,   // 面积（字符串形式，参与关键词匹配）
  );

  // 提取面积数值并做容差评分（±20%）
  let areaScore = 0;
  const areaNum = parseFloat(prop.area_total);
  if (!isNaN(areaNum) && areaNum > 0) {
    const areaMatch = String(prop.area_total); // 面积数字字符串参与关键词匹配已由上方 keywordScore 覆盖
    // 补充：查询中的数字面积 vs 物业面积 容差评分
    const queryNums = (query.match(/\d+/g) || []).map(Number);
    for (const qn of queryNums) {
      if (qn >= 50) { // 忽略小数字（如年份、门牌号）
        const ratio = areaNum / qn;
        if (ratio >= 0.8 && ratio <= 1.2) areaScore += 20; // ±20% 命中
        else if (ratio >= 0.5 && ratio <= 2.0) areaScore += 5; // ±50% 部分命中
      }
    }
  }

  // 搜"厂房/车间"时，提高工业类物业权重
  const q = query.toLowerCase();
  const isFactory = /厂房|车间|生产|制造|仓储|仓库/.test(q);
  let typeBonus = 0;
  if (isFactory) {
    if (/厂房|车间|生产|制造/.test(prop.industry || "")) typeBonus += 10;
  }

  // 楼宇名称关键词命中
  const titleKw = keywordSet(prop.building || prop.name);
  for (const w of keywordSet(query)) {
    if (titleKw.has(w)) {
      const finalScore = Math.min(score + 20 + areaScore + typeBonus, 100);
      return { id, name: prop.name, building: prop.building, park: prop.park, score: finalScore, hits, detail: prop };
    }
  }
  return { id, name: prop.name, building: prop.building, park: prop.park, score: Math.min(score + areaScore + typeBonus, 100), hits, detail: prop };
}

const AI_SYSTEM_PROMPT_RAG = `你是一个专业的浦发集团招商政策顾问。你的任务是根据已计算好的匹配分数，为每条命中的政策或物业生成一句简洁的推荐理由。

重要约束：
1. 理由中必须引用具体字段值（补贴金额、面积、园区、楼栋名称等），不能模糊表述
2. 物业理由中楼栋名称是核心信息，必须在理由中体现（如"位于XX楼宇XX㎡"）
3. 你的输出score字段必须原样使用下面提供的已计算好的分数，不得自行更改
4. 一句话说完，不要重复标题
5. 输出纯JSON，以{开头，不要任何其他文字：

{"policies":[{"name":"政策名称","match_reason":"该政策可获最高X万元补贴，覆盖行业为X，适用于X区域，申报主体为X","score":90}],"properties":[{"name":"单元编号","building":"楼宇名称","park":"园区名称","match_reason":"位于X楼宇，面积X㎡，租金X元/㎡·天，适合X行业","score":85,"building_id":"BLD001"}],"summary":"整体建议一句话"}

- policies最多5条，properties最多3条
- 如果某类没有匹配，该数组为空`;

const AI_SYSTEM_PROMPT_INTENT = `你是一个浦发集团招商顾问助手。请从用户的查询中提取结构化信息，输出纯JSON（以{开头，无其他文字）。

用户查询格式可能是：
- "招引/招商XX行业/规模企业"（业务人员想找的目标企业）
- "XX行业企业补贴/优惠政策"
- "需要XX平米/配电/荷载的载体"
- "在XX区域找物业"
- "XX企业想入驻/落地"

请提取以下字段（没有的填空字符串）：
{
  "industry": "目标行业，如：人工智能、芯片半导体、生物医药（只填行业，不要企业名）",
  "intent": "意图：recruit=招引企业落地，subsidy=申请政策补贴，space=寻找物业载体，info=查询了解",
  "company_type": "企业类型，如：独角兽、专精特新、上市公司、中小型，初创企业",
  "space_area": "面积需求（只填数字，如：500、1000、2000）",
  "power_kv": "配电需求（填数字如500、1000）",
  "district": "偏好区域，如：张江、金桥、浦东（只填区域名）",
  "budget": "租金预算（填数字，单位元/㎡·天）",
  "summary": "一句话总结用户需求的本质"
}

示例：
查询："招引AI芯片独角兽，需要1000平米，双回路电，张江区域"
输出：{"industry":"芯片半导体","intent":"recruit","company_type":"独角兽","space_area":"1000","power_kv":"","district":"张江","budget":"","summary":"招引AI芯片独角兽企业，1000平米，双回路电，张江"}

查询："人工智能企业补贴，最高500万"
输出：{"industry":"人工智能","intent":"subsidy","company_type":"","space_area":"","power_kv":"","district":"","budget":"","summary":"查询人工智能企业可申请的政策补贴"}

输出JSON：`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

const EMBEDDING_MODEL = "BAAI/bge-base-zh-v1.5";
const EMBEDDING_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${EMBEDDING_MODEL}`;

async function getHybridPolicyScores(query: string, policies: PolicySummary[], env: Env): Promise<Record<number, number>> {
  // 尝试向量相似度（KV 中已有 policy_embeddings 时）
  const embStr = await env.CACHE.get("policy_embeddings");
  if (!embStr) return {};

  let queryVec: number[] | null = null;
  for (let retries = 0; retries < 3; retries++) {
    try {
      const res = await fetch(EMBEDDING_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.HF_ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: [query], options: { wait_for_model: true } }),
      });
      if (!res.ok) throw new Error(`HF ${res.status}`);
      queryVec = (await res.json() as number[][])[0];
      break;
    } catch { await new Promise(r => setTimeout(r, 2000)); }
  }
  if (!queryVec) return {};

  // 读原始 sheet 取 id→text 映射（用于 id 对齐）
  const policyRows = await fetchSheet(env, env.POLICY_SHEET, env.POLICY_SHEET_ID, "A1:T600").catch(() => []);
  if (policyRows.length < 2) return {};

  const hdr = (policyRows[0] as unknown[]).map((v) => String(v ?? ""));
  const iId = hdr.indexOf("id");
  const iName = hdr.indexOf("policyName");
  const iCond = hdr.indexOf("policyCondition");
  const iCont = hdr.indexOf("policyContent");

  const policyTextById: Record<string, string> = {};
  for (let r = 1; r < policyRows.length; r++) {
    const row = policyRows[r] as unknown[];
    if (!Array.isArray(row) || row[iId] == null) continue;
    const id = String(row[iId]);
    const text = [str(row[iName]), str(row[iCond]), str(row[iCont])]
      .filter(Boolean).join(" ").slice(0, 2000);
    if (text) policyTextById[id] = text;
  }

  // 从 KV 读嵌入（id 为 string → number 对齐）
  const policyEmbeddings = JSON.parse(embStr) as Record<string, number[]>;
  const hybridScores: Record<number, number> = {};

  for (let i = 0; i < policies.length; i++) {
    const pol = policies[i];
    // 从 PolicySummary.name 找对应 id（sheet 的 id 列不存在于 PolicySummary，用 index对齐）
    // 用 index 直接对齐 KV 中的 id（KV 中 id 为飞书行 id）
    const idStr = String(i);
    const vec = policyEmbeddings[idStr];
    if (!vec) continue;
    let dot = 0;
    for (let k = 0; k < queryVec.length; k++) dot += queryVec[k] * (vec[k] ?? 0);
    hybridScores[i] = dot; // 0~1 范围
  }
  return hybridScores;
}

async function handleAiQuery(query: string, env: Env): Promise<Response> {
  try {
    const data = await getFeishuData(env);
    const nvidiaKey = env.NVIDIA_API_KEY || "";

    // 关键词评分
    const scoredPolicies = data.policies.map((p, i) => scorePolicy(query, p, i));
    const scoredProperties = data.properties.map((p, i) => scoreProperty(query, p, i));

    // 向量相似度（异步，不阻塞）
    const hybridPromise = getHybridPolicyScores(query, data.policies, env);

    // 基于关键词类型的意图加权
    const q = query.toLowerCase();
    const isRecruit = /招引|引进|落地|入驻|搬迁|选址|扩大|扩产|新设/.test(q);
    const isSubsidy = /补贴|资助|奖励|扶持|优惠|减免|申报|申请|政策/.test(q);
    const isSpace = /面积|平米|平方|层高|荷载|配电|电力|租金|载体|楼宇|园区|厂房|办公室/.test(q);

    const propMultiplier = isRecruit || isSpace ? 1.3 : isSubsidy ? 0.8 : 1.0;
    const polMultiplier = isSubsidy ? 1.3 : isRecruit ? 0.8 : 1.0;

    const boostedPolicies = scoredPolicies.map((p) => ({ ...p, score: Math.min(Math.round(p.score * polMultiplier), 100) }));
    const boostedProperties = scoredProperties.map((p) => ({ ...p, score: Math.min(Math.round(p.score * propMultiplier), 100) }));

    // 等待向量相似度结果并混合
    const hybridScores = await hybridPromise;
    if (Object.keys(hybridScores).length > 0) {
      const maxKw = Math.max(...boostedPolicies.map(p => p.score), 1);
      for (const [idx, vecScore] of Object.entries(hybridScores)) {
        const i = Number(idx);
        if (boostedPolicies[i]) {
          const kwNorm = boostedPolicies[i].score / maxKw;       // 归一化关键词分
          const hybrid = kwNorm * 0.6 + vecScore * 0.4;          // 混合
          boostedPolicies[i] = { ...boostedPolicies[i], score: Math.min(Math.round(hybrid * 100), 100) };
        }
      }
    }

    const maxPol = Math.max(...boostedPolicies.map((p) => p.score), 0);
    const maxProp = Math.max(...boostedProperties.map((p) => p.score), 0);
    const norm = (raw: number, max: number): number => max === 0 ? 0 : Math.round((raw / max) * 100);

    const topPolicies = boostedPolicies
      .map((p) => ({ ...p, score: norm(p.score, maxPol) }))
      .filter((p) => p.score >= 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const topProperties = boostedProperties
      .map((p) => ({ ...p, score: norm(p.score, maxProp) }))
      .filter((p) => p.score >= 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (topPolicies.length === 0 && topProperties.length === 0) {
      return json({ success: true, data: { policies: [], properties: [], summary: `未找到与"${query}"直接相关的政策或物业，建议调整关键词或扩大搜索范围。` }, query });
    }

    // RAG 理由生成
    const policyCtx = topPolicies.map((p) => `【得分${p.score}】${p.detail.name} | 行业:${p.detail.industry || "不限"} | 补贴:${p.detail.amount_s} | 区域:${p.detail.area || "不限"} | 主体:${p.detail.subject || "不限"}`).join("\n");
    const propCtx = topProperties.map((p) => `【得分${p.score}】${p.building || p.name}（${p.park || "—"}）| 面积:${p.area_total || p.area_vacant || "—"}㎡ | 租金:${p.price || "—"}元/㎡·天 | 行业:${p.industry || "不限"} | building_id:${p.detail.building_id}`).join("\n");

    const ragRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${nvidiaKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta/llama-3.1-8b-instruct",
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT_RAG },
          { role: "user", content: `用户需求：${query}\n\n【待生成理由的政策（已按关键词评分，已归一化）】\n${policyCtx}\n\n【待生成理由的物业载体（已按关键词评分，已归一化）】\n${propCtx}` },
        ],
        max_tokens: 1024,
        stream: false,
      }),
    });
    const ragText: string = (await ragRes.json() as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";

    const jsonMatch = ragText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return json({ success: true, data: parsed, query });
      } catch {
        return json({ success: true, raw: ragText, query });
      }
    }
    return json({ success: true, raw: ragText, query });
  } catch (err: unknown) {
    return json({ success: false, error: (err as Error).message }, 500);
  }
}

async function handleFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    if (path === "/api/policies" && request.method === "GET") {
      const rows = await fetchSheet(env, env.POLICY_SHEET, env.POLICY_SHEET_ID, "A1:U600");
      if (rows.length < 2) return json({ headers: [], data: [] });
      const headers: string[] = (rows[0] as unknown[]).map((v) => String(v ?? ""));
      const data = rows.slice(1)
        .filter((row) => Array.isArray(row) && row.length > 0 && row[0] != null)
        .map((row) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = (row as unknown[])[i] ?? null; });
          return obj;
        });
      return json({ headers, data });
    }

    if (path === "/api/news" && request.method === "GET") {
      const rows = await fetchSheet(env, env.NEWS_SHEET, env.NEWS_SHEET_ID, "A1:E200");
      const items = rows.slice(1)
        .filter((row) => Array.isArray(row) && row.length >= 2 && row[0] != null)
        .map((row) => ({
          time: row[0] ?? "",
          category: row[1] ?? "",
          title: row[2] ?? "",
          link: row[3] ?? "",
          summary: row[4] ?? "",
        }));
      return json(items);
    }

    if (path === "/api/config" && request.method === "GET") {
      return json({
        has_app_id: !!env.FEISHU_APP_ID,
        has_credentials: !!(env.FEISHU_APP_ID && env.FEISHU_APP_SECRET),
        property_sheet: env.PROPERTY_SHEET,
        policy_sheet: env.POLICY_SHEET,
      });
    }

    if (path === "/api/property-stats" && request.method === "GET") {
      const rows = await fetchSheet(env, env.POLICY_SHEET, env.STATS_SHEET_ID, "A1:B10");
      let officialCount = -1;
      let dataRowCount = 0;
      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 2) continue;
        const name = String(row[0] ?? "");
        if (name === "官网政策总数") officialCount = Number(row[1]) || 0;
        if (name === "数据行数") dataRowCount = Number(row[1]) || 0;
      }
      if (officialCount < 0) officialCount = dataRowCount;
      return json({
        local_count: -1,
        official_count: officialCount,
        coverage: "—",
        diff: 0,
        source: "浦易达官网",
        official_link: "https://pyd.pudong.gov.cn/website/pud/policyretrieval",
      });
    }

    // /api/ai/search?q=自然语言查询（RAG 模式）
    if (path === "/api/ai/search" && request.method === "GET") {
      const q = url.searchParams.get("q") || "";
      return handleAiQuery(q, env);
    }

    // /api/embeddings/generate — 触发生成政策向量并存 KV（仅供初始化或强制刷新）
    if (path === "/api/embeddings/generate" && request.method === "POST") {
      const token = url.searchParams.get("secret") || "";
      if (token !== env.HF_ACCESS_TOKEN) {
        return json({ error: "Unauthorized" }, 401);
      }
      const policyRows = await fetchSheet(env, env.POLICY_SHEET, env.POLICY_SHEET_ID, "A1:T600");
      if (policyRows.length < 2) {
        return json({ error: "No policy data" }, 400);
      }
      const headers: string[] = (policyRows[0] as unknown[]).map((v) => String(v ?? ""));
      const col = (name: string) => headers.indexOf(name);
      const iId = col("id"); const iName = col("policyName");
      const iCond = col("policyCondition"); const iCont = col("policyContent");

      // 构建 id → 文本
      const policyTexts: { id: string; text: string }[] = [];
      for (let r = 1; r < policyRows.length; r++) {
        const row = policyRows[r] as unknown[];
        if (!Array.isArray(row) || row[iId] == null) continue;
        const id = String(row[iId]);
        const text = [str(row[iName]), str(row[iCond]), str(row[iCont])]
          .filter(Boolean).join(" ").slice(0, 2000);
        if (text) policyTexts.push({ id, text });
      }

      // 分批调用 HF Inference API（每批 50 条，HF 限制 50/请求）
      const EMBEDDING_MODEL = "BAAI/bge-base-zh-v1.5";
      const EMBEDDING_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${EMBEDDING_MODEL}`;
      const BATCH_SIZE = 50;
      const embeddings: Record<string, number[]> = {};

      for (let i = 0; i < policyTexts.length; i += BATCH_SIZE) {
        const batch = policyTexts.slice(i, i + BATCH_SIZE);
        const texts = batch.map(p => p.text);

        let retries = 0, vecs: number[][] | null = null;
        while (retries < 3) {
          try {
            const res = await fetch(EMBEDDING_URL, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${env.HF_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
            });
            if (!res.ok) throw new Error(`HF ${res.status}: ${await res.text()}`);
            vecs = await res.json() as number[][];
            break;
          } catch (e) {
            retries++;
            await new Promise(r => setTimeout(r, retries * 2000));
          }
        }

        if (vecs) {
          for (let j = 0; j < batch.length; j++) {
            embeddings[batch[j].id] = vecs[j];
          }
          await env.CACHE.put("policy_embeddings", JSON.stringify(embeddings));
          console.log(`[EMBEDDINGS] 已生成 ${Object.keys(embeddings).length}/${policyTexts.length} 条`);
        } else {
          console.warn(`[EMBEDDINGS] batch ${i}-${i + batch.length} 全部失败`);
        }
        await new Promise(r => setTimeout(r, 1000)); // 避免 HF 限速
      }

      return json({ success: true, count: Object.keys(embeddings).length, dim: Object.values(embeddings)[0]?.length ?? 0 });
    }

    // /api/embeddings/match?q=查询词 — 向量相似度匹配
    if (path === "/api/embeddings/match" && request.method === "GET") {
      const q = url.searchParams.get("q") || "";
      if (!q) return json({ error: "q required" }, 400);

      // 获取预存的政策向量
      const embStr = await env.CACHE.get("policy_embeddings");
      if (!embStr) {
        return json({ error: "Embeddings not generated yet. POST /api/embeddings/generate first." }, 503);
      }
      const policyEmbeddings = JSON.parse(embStr) as Record<string, number[]>;

      // 生成查询向量
      const EMBEDDING_MODEL = "BAAI/bge-base-zh-v1.5";
      const EMBEDDING_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${EMBEDDING_MODEL}`;
      let queryVec: number[] | null = null;
      for (let retries = 0; retries < 3; retries++) {
        try {
          const res = await fetch(EMBEDDING_URL, {
            method: "POST",
            headers: { "Authorization": `Bearer ${env.HF_ACCESS_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ inputs: [q], options: { wait_for_model: true } }),
          });
          if (!res.ok) throw new Error(`HF ${res.status}`);
          queryVec = (await res.json() as number[][])[0];
          break;
        } catch { await new Promise(r => setTimeout(r, 2000)); }
      }
      if (!queryVec) return json({ error: "Failed to encode query" }, 503);

      // 余弦相似度（向量已归一化，直接点积）
      const scores: { id: string; score: number }[] = [];
      for (const [pid, vec] of Object.entries(policyEmbeddings)) {
        let dot = 0;
        for (let i = 0; i < queryVec.length; i++) dot += queryVec[i] * (vec[i] ?? 0);
        scores.push({ id: pid, score: dot });
      }
      scores.sort((a, b) => b.score - a.score);

      // 返回 top-20 id 列表
      const topIds = scores.slice(0, 20).map(s => s.id);
      return json({ success: true, top_ids: topIds, query: q });
    }

    // /api/buildings — 全量楼栋聚合数据（用于地图展示）
    if (path === "/api/buildings" && request.method === "GET") {
      let cache = await getPropertyCache(env);
      if (!cache) {
        cache = await refreshPropertyCache(env);
        await env.CACHE.put(PROPERTY_CACHE_KEY, JSON.stringify(cache), { expirationTtl: CACHE_TTL_SEC + 60 }).catch(() => {});
      }
      // 按 building_id 聚合单元
      const bldMap: Record<string, { building_id: string; name: string; industry: string; lat: number | null; lng: number | null; park_id: string; park_name: string; district: string; units: RawUnitRow[] }> = {};
      for (const u of cache.units) {
        const b = cache.buildings[u.building_id];
        if (!b) continue;
        if (!bldMap[u.building_id]) {
          const park = cache.parks[b.park_id];
          bldMap[u.building_id] = { building_id: u.building_id, name: b.name, industry: b.industry, lat: b.lat, lng: b.lng, park_id: b.park_id, park_name: park?.name || "", district: park?.district || "", units: [] };
        }
        bldMap[u.building_id].units.push(u);
      }
      const results = Object.values(bldMap).map(b => ({
        building_id: b.building_id,
        name: b.name,
        industry: b.industry,
        lat: b.lat,
        lng: b.lng,
        park_id: b.park_id,
        park_name: b.park_name,
        district: b.district,
        floors: b.units.length,
        area_total: b.units.reduce((s, u) => s + (u.area_total ?? 0), 0),
        area_vacant: b.units.reduce((s, u) => s + (u.area_vacant ?? 0), 0),
        price: b.units[0]?.price ?? null,
      }));
      return json(results);
    }

    // /api/properties?type=园区|楼宇|单元|产业字典
    if (path === "/api/properties" && request.method === "GET") {
      const type = url.searchParams.get("type") || "单元";
      const sheetIdMap: Record<string, string> = {
        "园区": env.PROPERTY_PARK_SHEET_ID || "4hdJSg",
        "楼宇": env.PROPERTY_BUILDING_SHEET_ID || "4hdJSh",
        "单元": env.PROPERTY_UNIT_SHEET_ID || "4hdJSi",
        "产业字典": env.PROPERTY_INDUSTRY_SHEET_ID || "4hdJSj",
      };
      const sheetId = sheetIdMap[type];
      if (!sheetId) return json({ error: "Unknown type" }, 400);
      const data = await fetchSheet(env, env.PROPERTY_SHEET, sheetId, "A1:ZZ500");
      if (!data || data.length < 3) return json([]);
      const headers = (data[1] as unknown[]).map((v) => String(v ?? ""));
      const items = data.slice(2)
        .filter((row) => Array.isArray(row) && row.length > 0 && row[0] != null)
        .map((row) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = (row as unknown[])[i] ?? null; });
          return obj;
        });
      return json(items);
    }

    // /api/property-filter — 多条件物业精细过滤
    // GET ?area_min=&area_max=&price_max=&floor_height_min=&district=&park=&building=&industry=&page=&page_size=
    if (path === "/api/property-filter" && request.method === "GET") {
      let cache = await getPropertyCache(env);
      if (!cache) {
        cache = await refreshPropertyCache(env);
        await env.CACHE.put(PROPERTY_CACHE_KEY, JSON.stringify(cache), { expirationTtl: CACHE_TTL_SEC + 60 }).catch(() => {});
      }

      const f: PropertyFilter = {
        district: url.searchParams.get("district") || undefined,
        park: url.searchParams.get("park") || undefined,
        building: url.searchParams.get("building") || undefined,
        area_min: url.searchParams.has("area_min") ? Number(url.searchParams.get("area_min")) : undefined,
        area_max: url.searchParams.has("area_max") ? Number(url.searchParams.get("area_max")) : undefined,
        price_max: url.searchParams.has("price_max") ? Number(url.searchParams.get("price_max")) : undefined,
        floor_height_min: url.searchParams.has("floor_height_min") ? Number(url.searchParams.get("floor_height_min")) : undefined,
        industry: url.searchParams.get("industry") || undefined,
        allow_catering: url.searchParams.has("allow_catering") ? url.searchParams.get("allow_catering") === "true" : undefined,
        has_crane_beam: url.searchParams.has("has_crane_beam") ? url.searchParams.get("has_crane_beam") === "true" : undefined,
        page: url.searchParams.has("page") ? Number(url.searchParams.get("page")) : 1,
        page_size: url.searchParams.has("page_size") ? Math.min(Number(url.searchParams.get("page_size")), 100) : 20,
      };

      const matched = filterUnits(cache.units, cache.buildings, cache.parks, f);
      const page = f.page!;
      const pageSize = f.page_size!;
      const total = matched.length;
      const paged = matched.slice((page - 1) * pageSize, page * pageSize);

      // join with building/park data
      const results = paged.map(u => {
        const b = cache!.buildings[u.building_id] || {} as any;
        const park = cache!.parks[b.park_id] || {} as any;
        return {
          unit_id: u.unit_id,
          building_id: u.building_id,
          park_id: b.park_id || "",
          unit_no: u.unit_no,
          floor: u.floor,
          area_total: u.area_total,
          area_vacant: u.area_vacant,
          price: u.price,
          floor_height: u.floor_height,
          load: u.load,
          building_name: b.name || "",
          building_industry: b.industry || "",
          building_lat: b.lat ?? null,
          building_lng: b.lng ?? null,
          park_name: park.name || "",
          district: park.district || "",
          industry: b.industry || "",
          remark: u.remark,
        };
      });

      return json({ total, page, page_size: pageSize, results });
    }

    // /api/building-detail?building_id=X — 楼栋详情（含所有单元）
    if (path === "/api/building-detail" && request.method === "GET") {
      const buildingId = url.searchParams.get("building_id");
      if (!buildingId) return json({ error: "building_id required" }, 400);
      let cache = await getPropertyCache(env);
      if (!cache) {
        cache = await refreshPropertyCache(env);
        await env.CACHE.put(PROPERTY_CACHE_KEY, JSON.stringify(cache), { expirationTtl: CACHE_TTL_SEC + 60 }).catch(() => {});
      }
      const b = cache.buildings[buildingId];
      if (!b) return json({ error: "Building not found" }, 404);
      const park = cache.parks[b.park_id];
      const units = cache.units.filter(u => u.building_id === buildingId);
      return json({
        building: {
          building_id: b.building_id,
          name: b.name,
          industry: b.industry,
          has_crane_beam: b.has_crane_beam,
          lat: b.lat,
          lng: b.lng,
          park_id: b.park_id,
          park_name: park?.name || "",
          district: park?.district || "",
        },
        units: units.map(u => ({
          unit_id: u.unit_id,
          unit_no: u.unit_no,
          floor: u.floor,
          area_total: u.area_total,
          area_vacant: u.area_vacant,
          price: u.price,
          floor_height: u.floor_height,
          load: u.load,
          remark: u.remark,
        })),
      });
    }

    // /api/feedback — 提交反馈（飞书表格 + Server酱推送）
    if (path === "/api/feedback" && request.method === "POST") {
      let body: { type?: string; content?: string; contact?: string; source?: string; screenshot?: string };
      try {
        body = await request.json();
      } catch {
        return json({ success: false, error: "Invalid JSON" }, 400);
      }
      const { type = "建议", content = "", contact = "", source = "", screenshot = "" } = body;
      if (!content.trim()) {
        return json({ success: false, error: "问题描述不能为空" }, 400);
      }

      // 1. 写入飞书多维表格（永久留存）
      const bitableToken = env.FEEDBACK_BITABLE_TOKEN || "";
      const tableId = env.FEEDBACK_TABLE_ID || "";
      if (bitableToken && tableId) {
        const nowMs = Date.now();
        const remark = [contact.trim(), source.trim()].filter(Boolean).join(" | ");
        const token = await getToken(env);

        // 截图：上传到飞书获得 file_token，再写入附件字段
        const fields: Record<string, unknown> = {
          "问题描述": content.trim(),
          "类型": type,
          "反馈时间": nowMs,
          "当前状态": ["新增"],
        };
        if (remark) fields["备注说明"] = remark;

        if (screenshot && screenshot.startsWith("data:image/")) {
          try {
            const mime = screenshot.match(/data:([^;]+);/)?.[1] || "image/png";
            const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "png";
            const base64 = screenshot.replace(/^data:image\/\w+;base64,/, "");
            const binary = atob(base64);
            const arr = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
            const blob = new Blob([arr], { type: mime });
            const formData = new FormData();
            formData.append("file", blob, `screenshot.${ext}`);
            formData.append("file_name", `screenshot.${ext}`);
            formData.append("size", String(blob.size));
            const uploadRes = await fetch(
              "https://open.feishu.cn/open-apis/drive/v1/medias/upload_all",
              {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
              }
            );
            const uploadData = await uploadRes.json() as { code?: number; data?: { file_token?: string } };
            if (uploadData.code === 0 && uploadData.data?.file_token) {
              fields["截图"] = [uploadData.data.file_token];
            }
          } catch {
            // 截图上传失败不影响主流程
          }
        }

        const bitableRes = await fetch(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${bitableToken}/tables/${tableId}/records`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ fields }),
          }
        );
        const bitableData = await bitableRes.json() as { code?: number; msg?: string };
        if (bitableData.code !== 0) {
          console.log("Bitable write failed:", JSON.stringify(bitableData));
          return json({ success: false, error: `飞书写入失败: ${bitableData.msg}` }, 500);
        }
      }

      // 2. Server酱推送（可选，免费版每天10条）
      const sckey = env.SERVERCHAN_KEY;
      if (sckey) {
        const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
        const text = `💬 招商平台反馈 [${type}]\n${content.trim()}\n联系方式：${contact.trim() || "未填写"}\n来源：${source.trim() || "未知"}\n时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`;
        fetch(`https://sc.ftqq.com/${sckey}.send?text=${encodeURIComponent(text)}`).catch(() => {});
      }

      return json({ success: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err: unknown) {
    return json({ error: (err as Error).message }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    return handleFetch(request, env);
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const start = Date.now();
    try {
      const data = await refreshFeishuData(env);
      await setCachedData(env, data);
      const propCache = await refreshPropertyCache(env);
      await env.CACHE.put(PROPERTY_CACHE_KEY, JSON.stringify(propCache), { expirationTtl: CACHE_TTL_SEC + 60 }).catch(() => {});
      console.log(`[CRON] 缓存刷新: ${data.policies.length}条政策 ${data.properties.length}条物业 | 物业精细缓存:${propCache.units.length}条`);
    } catch (err) {
      console.error("[CRON] 缓存刷新失败:", err);
    }

    // 每 6 小时或 KV 向量为空时，触发 embedding 生成
    const lastGen = await env.CACHE.get("embeddings_generated_at").catch(() => null);
    const stale = !lastGen || (Date.now() - Number(lastGen) > 6 * 60 * 60 * 1000);
    if (stale) {
      console.log(`[CRON] 向量${lastGen ? "过期" : "未生成"}，开始生成…`);
      await generatePolicyEmbeddings(env);
    }
    console.log(`[CRON] 总耗时 ${Date.now() - start}ms`);
  },
};

async function generatePolicyEmbeddings(env: Env): Promise<void> {
  try {
    const policyRows = await fetchSheet(env, env.POLICY_SHEET, env.POLICY_SHEET_ID, "A1:T600");
      if (policyRows.length < 2) return;
      const hdr = (policyRows[0] as unknown[]).map((v) => String(v ?? ""));
      const iId = hdr.indexOf("id"); const iName = hdr.indexOf("policyName");
      const iCond = hdr.indexOf("policyCondition"); const iCont = hdr.indexOf("policyContent");
      const policyTexts: { id: string; text: string }[] = [];
      for (let r = 1; r < policyRows.length; r++) {
        const row = policyRows[r] as unknown[];
        if (!Array.isArray(row) || row[iId] == null) continue;
        const id = String(row[iId]);
        const text = [str(row[iName]), str(row[iCond]), str(row[iCont])]
          .filter(Boolean).join(" ").slice(0, 2000);
        if (text) policyTexts.push({ id, text });
      }
      if (policyTexts.length === 0) return;
      const BATCH_SIZE = 50;
      const embeddings: Record<string, number[]> = {};
      for (let i = 0; i < policyTexts.length; i += BATCH_SIZE) {
        const batch = policyTexts.slice(i, i + BATCH_SIZE);
        let retries = 0, vecs: number[][] | null = null;
        while (retries < 3) {
          try {
            const res = await fetch(EMBEDDING_URL, {
              method: "POST",
              headers: { "Authorization": `Bearer ${env.HF_ACCESS_TOKEN}`, "Content-Type": "application/json" },
              body: JSON.stringify({ inputs: batch.map(p => p.text), options: { wait_for_model: true } }),
            });
            if (!res.ok) throw new Error(`HF ${res.status}: ${await res.text()}`);
            vecs = await res.json() as number[][];
            break;
          } catch (e) {
            retries++;
            await new Promise(r => setTimeout(r, retries * 2000));
          }
        }
        if (vecs) {
          for (let j = 0; j < batch.length; j++) embeddings[batch[j].id] = vecs[j];
          await env.CACHE.put("policy_embeddings", JSON.stringify(embeddings));
          console.log(`[EMBEDDINGS] ${Object.keys(embeddings).length}/${policyTexts.length}`);
        }
        await new Promise(r => setTimeout(r, 1000));
      }
      await env.CACHE.put("embeddings_generated_at", String(Date.now()));
      console.log(`[EMBEDDINGS] 完成: ${Object.keys(embeddings).length} 条`);
    } catch (e) {
      console.error("[EMBEDDINGS] 生成失败:", e);
    }
  }