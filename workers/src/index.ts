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
  AI_ACCOUNT_ID: string;
}

const TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
const SHEET_URL = "https://open.feishu.cn/open-apis/sheets/v2/spreadsheets";

const CACHE: Map<string, { token: string; expires: number }> = new Map();

// ── Feishu 数据缓存（5分钟 TTL）───────────────────────────────────────────────
interface DataCache {
  policies: PolicySummary[];
  properties: PropertySummary[];
  ts: number;
}
let dataCache: DataCache | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

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
  area_total: string;
  area_vacant: string;
  price: string;
  industry: string;
  floor_height: string;
  load: string;
  power_kv: string;
}

async function getToken(env: Env): Promise<string> {
  const now = Date.now();
  const cached = CACHE.get("token");
  if (cached && cached.expires > now + 300_000) return cached.token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
  });
  const data = await res.json() as { code: number; msg?: string; tenant_access_token?: string };
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Token error ${data.code}: ${data.msg}`);
  }
  CACHE.set("token", { token: data.tenant_access_token, expires: now + 7200_000 });
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
  const now = Date.now();
  if (dataCache && dataCache.ts + CACHE_TTL > now) return dataCache;

  // 并行拉取政策和物业
  const [policyRows, unitRows] = await Promise.all([
    fetchSheet(env, env.POLICY_SHEET, env.POLICY_SHEET_ID, "A1:U600").catch(() => []),
    fetchSheet(env, env.PROPERTY_SHEET, env.PROPERTY_UNIT_SHEET_ID || "4hdJSi", "A1:ZZ500").catch(() => []),
  ]);

  const policies: PolicySummary[] = [];
  if (policyRows.length >= 2) {
    const headers: string[] = (policyRows[0] as unknown[]).map((v) => String(v ?? ""));
    const idx = (key: string) => headers.findIndex(h =>
      h.includes(key) || key.includes(h)
    );
    const iName = idx("政策名称"); const iInd = idx("行业"); const iAmt = idx("金额");
    const iArea = idx("区域"); const iSubj = idx("申报主体"); const iEnd = idx("截止");
    const iCont = idx("政策内容");

    for (let r = 1; r < policyRows.length; r++) {
      const row = policyRows[r] as unknown[];
      if (!Array.isArray(row) || row.length === 0 || row[0] == null) continue;
      const name = str(row[iName]); if (!name) continue;
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
      if (policies.length >= 200) break; // 限制上下文长度
    }
  }

  const properties: PropertySummary[] = [];
  if (unitRows.length >= 3) {
    const headers = (unitRows[1] as unknown[]).map((v) => String(v ?? ""));
    const idx = (key: string) => headers.findIndex(h =>
      h.includes(key) || key.includes(h)
    );
    const iName = idx("单元名称"); const iPark = idx("园区"); const iArea = idx("总面积");
    const iVac = idx("空置面积"); const iPrice = idx("租金"); const iInd = idx("行业");
    const iFH = idx("层高"); const iLoad = idx("荷载"); const iPwr = idx("配电");

    for (let r = 2; r < unitRows.length; r++) {
      const row = unitRows[r] as unknown[];
      if (!Array.isArray(row) || row.length === 0 || row[0] == null) continue;
      const name = str(row[iName]); if (!name) continue;
      properties.push({
        name, park: str(row[iPark]),
        area_total: str(row[iArea]) || str(row[iVac]),
        area_vacant: str(row[iVac]),
        price: str(row[iPrice]),
        industry: str(row[iInd]),
        floor_height: str(row[iFH]),
        load: str(row[iLoad]),
        power_kv: str(row[iPwr]),
      });
      if (properties.length >= 100) break;
    }
  }

  dataCache = { policies, properties, ts: now };
  return dataCache;
}

function buildContextSummary(data: DataCache): string {
  const polLines = data.policies.map((p, i) =>
    `${i + 1}. ${p.name} | 行业:${p.industry || "不限"} | 补贴:${p.amount_s} | 区域:${p.area || "不限"} | 主体:${p.subject || "不限"} | 截止:${p.end_date || "长期"}`
  ).join("\n");

  const propLines = data.properties.map((p, i) =>
    `${i + 1}. ${p.name} | 园区:${p.park || "—"} | 面积:${p.area_total || p.area_vacant || "—"}㎡ | 租金:${p.price || "—"}元/㎡·天 | 行业:${p.industry || "不限"} | 层高:${p.floor_height || "—"}m | 荷载:${p.load || "—"}kg/㎡ | 配电:${p.power_kv || "—"}kVA`
  ).join("\n");

  return `【政策库】（共 ${data.policies.length} 条）\n${polLines}\n\n【物业载体库】（共 ${data.properties.length} 条）\n${propLines}`;
}

const AI_SYSTEM_PROMPT_RAG = `你是一个专业的浦发集团招商政策顾问。

当用户描述招商需求时，你需要：
1. 从【政策库】中找出最匹配的 3~5 条政策，说明推荐理由
2. 从【物业载体库】中找出最匹配的 2~3 个物业，说明推荐理由
3. 用 JSON 格式返回结果

返回格式（严格遵循）：
{
  "policies": [
    {"id": 1, "name": "政策名称", "match_reason": "为什么推荐这条政策", "score": 95}
  ],
  "properties": [
    {"id": 1, "name": "载体名称", "park": "园区", "match_reason": "为什么推荐这个载体", "score": 90}
  ],
  "summary": "对用户的整体建议（1-2句话）"
}

注意：
- 只推荐确实相关的，不相关的不返回
- score 是 0-100 的匹配度分数
- match_reason 要具体说明为什么适合用户需求
- 如果找不到匹配的，明确说明
`;

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

    // 2. 调用 LLM（带政策/物业上下文）
    const accountId = env.AI_ACCOUNT_ID || "c877368347bac6d2c962171be40048e9";
    const body = JSON.stringify({
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT_RAG },
        { role: "user", content: `【政策库】（共 ${data.policies.length} 条）\n${data.policies.map((p, i) => `${i + 1}. ${p.name} | 行业:${p.industry || "不限"} | 补贴:${p.amount_s} | 区域:${p.area || "不限"} | 主体:${p.subject || "不限"} | 截止:${p.end_date || "长期"}`).join("\n")}\n\n【物业载体库】（共 ${data.properties.length} 条）\n${data.properties.map((p, i) => `${i + 1}. ${p.name} | 园区:${p.park || "—"} | 面积:${p.area_total || p.area_vacant || "—"}㎡ | 租金:${p.price || "—"}元/㎡·天 | 行业:${p.industry || "不限"} | 层高:${p.floor_height || "—"}m | 荷载:${p.load || "—"}kg/㎡ | 配电:${p.power_kv || "—"}kVA`).join("\n")}\n\n用户需求：${query}` },
      ],
      max_tokens: 1024,
      stream: false,
    });

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.AI_ACCOUNT_ID || ""}`,
          "Content-Type": "application/json",
        },
        body,
      },
    );
    const aiData = await res.json() as { result?: { response?: string }; errors?: unknown[] };
    const text: string = aiData?.result?.response ?? "";

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
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    return handleFetch(request, env);
  },
};