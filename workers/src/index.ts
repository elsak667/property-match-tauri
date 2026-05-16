/**
 * Cloudflare Workers — 飞书 API 代理
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
  CLUE_SHEET: string;
  CLUE_SHEET_ID: string;
  CUSTOMER_SHEET: string;
  CUSTOMER_SHEET_ID: string;
}

const TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
const SHEET_URL = "https://open.feishu.cn/open-apis/sheets/v2/spreadsheets";
const BITABLE_URL = "https://open.feishu.cn/open-apis/bitable/v1/apps";

const CACHE: Map<string, { token: string; expires: number }> = new Map();

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

// Bitable API helpers
async function bitableGetRecords(
  env: Env,
  appToken: string,
  tableId: string,
  pageSize = 100,
  pageToken?: string,
): Promise<{ items: Record<string, unknown>[]; hasMore: boolean; pageToken?: string }> {
  const token = await getToken(env);
  let url = `${BITABLE_URL}/${appToken}/tables/${tableId}/records?page_size=${pageSize}`;
  if (pageToken) url += `&page_token=${pageToken}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json() as {
    code: number; msg?: string;
    data?: { items?: Record<string, unknown>[]; has_more?: boolean; page_token?: string };
  };
  if (data.code !== 0) throw new Error(`Bitable get error ${data.code}: ${data.msg}`);
  return {
    items: data.data?.items ?? [],
    hasMore: data.data?.has_more ?? false,
    pageToken: data.data?.page_token,
  };
}

async function bitableCreateRecord(
  env: Env,
  appToken: string,
  tableId: string,
  fields: Record<string, unknown>,
): Promise<{ record_id: string; fields: Record<string, unknown> }> {
  const token = await getToken(env);
  const url = `${BITABLE_URL}/${appToken}/tables/${tableId}/records`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json() as {
    code: number; msg?: string;
    data?: { record?: { record_id: string; fields: Record<string, unknown> } };
  };
  if (data.code !== 0) throw new Error(`Bitable create error ${data.code}: ${data.msg}`);
  return { record_id: data.data?.record?.record_id ?? "", fields: data.data?.record?.fields ?? {} };
}

async function bitableUpdateRecord(
  env: Env,
  appToken: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const token = await getToken(env);
  const url = `${BITABLE_URL}/${appToken}/tables/${tableId}/records/${recordId}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json() as { code: number; msg?: string };
  if (data.code !== 0) throw new Error(`Bitable update error ${data.code}: ${data.msg}`);
}

async function bitableDeleteRecord(
  env: Env,
  appToken: string,
  tableId: string,
  recordId: string,
): Promise<void> {
  const token = await getToken(env);
  const url = `${BITABLE_URL}/${appToken}/tables/${tableId}/records/${recordId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json() as { code: number; msg?: string };
  if (data.code !== 0) throw new Error(`Bitable delete error ${data.code}: ${data.msg}`);
}

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


const AI_SYSTEM_PROMPT = `你是一个政策与物业载体匹配助手。用户输入自然语言查询，你需要提取出以下筛选条件：

可提取的字段（全部可选）：
- area: 区域/园区名称，如"张江"、"金桥"、"临港"等
- industry: 行业领域，如"人工智能"、"生物医药"、"新能源"等
- cap: 补贴力度，如"100万"、"500万"、"1000万"等（只要有具体数字）
- keywords: 其他关键词

请从用户输入中提取上述信息，返回JSON格式，不要返回其他内容。

示例：
用户输入："张江附近AI企业，补贴超过100万"
返回：{"area":"张江","industry":"人工智能","cap":"100万","keywords":"AI企业"}

用户输入："生物医药相关的载体，500平米"
返回：{"area":"","industry":"生物医药","cap":"","keywords":"500平米"}

用户输入："浦东新区有什么政策"
返回：{"area":"浦东","industry":"","cap":"","keywords":""}

用户输入："新能源载体现有那些"
返回：{"area":"","industry":"新能源","cap":"","keywords":"载体"}

请直接返回JSON，不要解释。`;

async function handleAiQuery(query: string, env: Env): Promise<Response> {
  try {
    const accountId = env.AI_ACCOUNT_ID || "c877368347bac6d2c962171be40048e9";
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`;
    const body = JSON.stringify({
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
      max_tokens: 256,
      stream: false,
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.FEISHU_APP_SECRET}`,
        "Content-Type": "application/json",
      },
      body,
    });
    const data = await res.json() as { result?: { response?: string }; errors?: unknown[] };
    const text: string = data?.result?.response ?? "";
    // 提取JSON
    const jsonMatch = text.match(/\{[^{}]*\}/s);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return json({ success: true, filters: parsed });
      } catch {
        return json({ success: true, filters: { keywords: query }, raw: text });
      }
    }
    return json({ success: true, filters: { keywords: query }, raw: text });
  } catch (err: unknown) {
    return json({ error: (err as Error).message }, 500);
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

    // /api/ai/search?q=自然语言查询
    if (path === "/api/ai/search" && request.method === "GET") {
      const q = url.searchParams.get("q") || "";
      return handleAiQuery(q, env);
    }

    // /api/enterprise/search?name=企业名称
    if (path === "/api/enterprise/search" && request.method === "GET") {
      const name = url.searchParams.get("name") || "";
      // TODO: 替换为天眼查 API，目前返回空（Mock 阶段）
      return json({ list: [], total: 0, mock: true });
    }

    // /api/policy/match-precise（待实现）
    if (path === "/api/policy/match-precise" && request.method === "POST") {
      return json({ error: "Not yet implemented" }, 501);
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

    // ===== 线索管理 API (Bitable) =====
    // CLUE_SHEET = app_token, CLUE_SHEET_ID = table_id
    const clueAppToken = env.CLUE_SHEET;
    const clueTableId = env.CLUE_SHEET_ID;
    if (!clueAppToken || !clueTableId) {
      // Don't block other APIs if clue not configured
    } else if (path === "/api/invest-api/clues" && request.method === "GET") {
      // 获取线索列表
      const result = await bitableGetRecords(env, clueAppToken, clueTableId, 100);
      return json({ data: result.items, hasMore: result.hasMore, pageToken: result.pageToken });
    } else if (path === "/api/invest-api/clues" && request.method === "POST") {
      // 提交新线索
      const body = await request.json() as Record<string, unknown>;
      const { record_id, fields } = await bitableCreateRecord(env, clueAppToken, clueTableId, body as Record<string, unknown>);
      return json({ record_id, fields }, 201);
    } else if (path.match(/^\/api\/invest-api\/clues\/([^/]+)\/convert$/)) {
      // 线索转客户（预留）
      return json({ error: "Not yet implemented: clue conversion" }, 501);
    } else {
      // GET/PUT /api/invest-api/clues/:id
      const clueIdMatch = path.match(/^\/api\/invest-api\/clues\/([^/]+)$/);
      if (clueIdMatch && clueAppToken && clueTableId) {
        const recordId = clueIdMatch[1];
        if (request.method === "GET") {
          // 获取线索详情 — 先拉列表找到 record
          const result = await bitableGetRecords(env, clueAppToken, clueTableId, 500);
          const item = result.items.find((r: Record<string, unknown>) => String(r.record_id) === recordId);
          if (!item) return json({ error: "Clue not found" }, 404);
          return json(item);
        }
        if (request.method === "PUT") {
          // 更新线索
          const body = await request.json() as Record<string, unknown>;
          await bitableUpdateRecord(env, clueAppToken, clueTableId, recordId, body as Record<string, unknown>);
          return json({ success: true });
        }
        if (request.method === "DELETE") {
          // 删除线索
          await bitableDeleteRecord(env, clueAppToken, clueTableId, recordId);
          return json({ success: true });
        }
      }
    }

    // ===== 客户管理 API (Bitable) =====
    const customerAppToken = env.CUSTOMER_SHEET;
    const customerTableId = env.CUSTOMER_SHEET_ID;
    if (!customerAppToken || !customerTableId) {
      // Don't block other APIs if customer not configured
    } else if (path === "/api/invest-api/customers" && request.method === "GET") {
      const result = await bitableGetRecords(env, customerAppToken, customerTableId, 100);
      return json({ data: result.items, hasMore: result.hasMore, pageToken: result.pageToken });
    } else if (path === "/api/invest-api/customers" && request.method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      const { record_id, fields } = await bitableCreateRecord(env, customerAppToken, customerTableId, body as Record<string, unknown>);
      return json({ record_id, fields }, 201);
    } else {
      const customerIdMatch = path.match(/^\/api\/invest-api\/customers\/([^/]+)$/);
      if (customerIdMatch && customerAppToken && customerTableId) {
        const recordId = customerIdMatch[1];
        if (request.method === "GET") {
          const result = await bitableGetRecords(env, customerAppToken, customerTableId, 500);
          const item = result.items.find((r: Record<string, unknown>) => String(r.record_id) === recordId);
          if (!item) return json({ error: "Customer not found" }, 404);
          return json(item);
        }
        if (request.method === "PUT") {
          const body = await request.json() as Record<string, unknown>;
          await bitableUpdateRecord(env, customerAppToken, customerTableId, recordId, body as Record<string, unknown>);
          return json({ success: true });
        }
        if (request.method === "DELETE") {
          await bitableDeleteRecord(env, customerAppToken, customerTableId, recordId);
          return json({ success: true });
        }
      } else if (path === "/api/invest-api/customers/batch" && request.method === "POST") {
        const { customers } = await request.json() as { customers: Record<string, unknown>[] };
        const result = { success: 0, failed: 0, errors: [] as string[] };
        for (const customer of customers) {
          try {
            await bitableCreateRecord(env, customerAppToken, customerTableId, customer);
            result.success++;
          } catch (err: unknown) {
            result.failed++;
            result.errors.push(`${(customer.name || "未知")}: ${(err as Error).message}`);
          }
        }
        return json(result);
      }
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
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    return handleFetch(request, env);
  },
};
