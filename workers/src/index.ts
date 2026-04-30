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
  FEEDBACK_SHEET: string;
  FEEDBACK_SHEET_ID: string;
  SERVERCHAN_KEY: string;
  NVIDIA_API_KEY: string;
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
  name: string;
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

interface DataCache {
  policies: PolicySummary[];
  properties: PropertySummary[];
  updated_at: number;
}

const TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
const SHEET_URL = "https://open.feishu.cn/open-apis/sheets/v2/spreadsheets";

// ── KV 缓存层（30分钟 TTL）────────────────────────────────────────────────────
const CACHE_KEY = "feishu_data";
const CACHE_TTL_SEC = 30 * 60; // 30 分钟

interface DataCache {
  policies: PolicySummary[];
  properties: PropertySummary[];
  updated_at: number;
}

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
        name, industry: str(row[iInd]), amount_s: amountRaw || "待定",
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
        name, park: pname, district: pdist,
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

const AI_SYSTEM_PROMPT_RAG = "你是一个专业的浦发集团招商政策顾问。根据用户需求，从政策库和物业载体库中推荐最相关的选项。\n\n重要：你必须只输出纯JSON，不能输出任何其他文字、代码或解释。输出格式如下，直接以{开头：\n\n{\"policies\":[{\"name\":\"政策名称\",\"match_reason\":\"推荐理由\",\"score\":95}],\"properties\":[{\"name\":\"载体名称\",\"park\":\"园区名称\",\"match_reason\":\"推荐理由\",\"score\":90}],\"summary\":\"整体建议一句话\"}\n\n字段说明：\n- policies: 推荐的政策列表，最多5条，score为0-100的匹配度\n- properties: 推荐的物业载体，最多3条\n- summary: 1-2句话的整体建议\n- 如果没有匹配的，policies和properties数组为空，summary说明原因\n- 不要输出代码，不要输出任何标记，直接输出JSON对象";

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

async function handleAiQuery(query: string, env: Env): Promise<Response> {
  try {
    // 1. 获取飞书数据（带缓存）
    const data = await getFeishuData(env);

    // 2. 调用 NVIDIA LLM（带政策/物业上下文）
    const nvidiaKey = env.NVIDIA_API_KEY || "";
    const body = JSON.stringify({
      model: "meta/llama-3.1-8b-instruct",
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT_RAG },
        { role: "user", content: `【政策库】（共 ${data.policies.length} 条）\n${data.policies.map((p, i) => `${i + 1}. ${p.name} | 行业:${p.industry || "不限"} | 补贴:${p.amount_s} | 区域:${p.area || "不限"} | 主体:${p.subject || "不限"} | 截止:${p.end_date || "长期"}`).join("\n")}\n\n【物业载体库】（共 ${data.properties.length} 条）\n${data.properties.map((p, i) => `${i + 1}. ${p.name} | 园区:${p.park || "—"} | 面积:${p.area_total || p.area_vacant || "—"}㎡ | 租金:${p.price || "—"}元/㎡·天 | 行业:${p.industry || "不限"} | 层高:${p.floor_height || "—"}m | 荷载:${p.load || "—"}kg/㎡ | 配电:${p.power_kv || "—"}kVA`).join("\n")}\n\n用户需求：${query}` },
      ],
      max_tokens: 1024,
      stream: false,
    });

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${nvidiaKey}`,
        "Content-Type": "application/json",
      },
      body,
    });
    const aiData = await res.json() as { choices?: { message?: { content?: string } }[]; error?: unknown };
    const text: string = aiData?.choices?.[0]?.message?.content ?? "";
    if (!text && aiData?.error) {
      return json({ success: false, error: JSON.stringify(aiData.error) }, 500);
    }

    // 3. 解析 JSON 返回
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return json({ success: true, data: parsed, query });
      } catch {
        return json({ success: true, raw: text, query });
      }
    }
    return json({ success: true, raw: text, query });
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

    // /api/feedback — 提交反馈（飞书表格 + Server酱推送）
    if (path === "/api/feedback" && request.method === "POST") {
      let body: { title?: string; content?: string; contact?: string };
      try {
        body = await request.json();
      } catch {
        return json({ success: false, error: "Invalid JSON" }, 400);
      }
      const { title = "", content = "", contact = "", source = "" } = body;
      if (!title.trim() || !content.trim()) {
        return json({ success: false, error: "标题和内容不能为空" }, 400);
      }

      // 1. 写入飞书表格（永久留存）
      const FEEDBACK_SHEET = env.FEEDBACK_SHEET || "";
      const FEEDBACK_SHEET_ID = env.FEEDBACK_SHEET_ID || "";
      if (FEEDBACK_SHEET && FEEDBACK_SHEET_ID) {
        const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
        const values = [[now, title.trim(), content.trim(), contact.trim(), source.trim()]];
        const token = await getToken(env);
        await fetch(
          `${SHEET_URL}/${FEEDBACK_SHEET}/values/${FEEDBACK_SHEET_ID}!A1:ZZ1:append`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ valueRange: { values } }),
          }
        );
      }

      // 2. Server酱推送（可选，免费版每天10条）
      const sckey = env.SERVERCHAN_KEY;
      if (sckey) {
        const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
        const text = `💬 招商平台反馈\n【${title.trim()}】\n${content.trim()}\n联系方式：${contact.trim() || "未填写"}\n来源：${source.trim() || "未知"}\n时间：${now}`;
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
    try {
      const data = await refreshFeishuData(env);
      await setCachedData(env, data);
      console.log(`[CRON] 缓存刷新: ${data.policies.length}条政策 ${data.properties.length}条物业`);
    } catch (err) {
      console.error("[CRON] 缓存刷新失败:", err);
    }
  },
};