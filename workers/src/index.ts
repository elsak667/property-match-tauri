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
  VISIT_SHEET: string;
  VISIT_SHEET_ID: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  NVIDIA_API_KEY: string;
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


// ── Enterprise Profile type (matches frontend) ──────────────
interface EnterpriseProfileInput {
  name?: string;
  registeredCapital?: number;
  establishmentDate?: string;
  province?: string;
  city?: string;
  district?: string;
  employeeCount?: number;
  industry?: string[];
  annualRevenue?: number;
  taxLocation?: string;
  qualifications?: string[];
  creditRating?: string;
  patents?: number;
  softwareCopyright?: number;
  hasEIA?: boolean;
  hasDischargePermit?: boolean;
  hasProductionLicense?: boolean;
  hasImportExportRights?: boolean;
  enterpriseType?: string[];
  listedStatus?: string;
}

// ── Precision match types ────────────────────────────────────
interface PrecisionMatch {
  matched: boolean;
  matchedConditions: string[];
  unmatchedConditions: string[];
  overallReason: string;
}

interface PolicyCondition {
  registerCapital?: { min?: number; max?: number };
  industry?: { required?: string[] };
  region?: { district?: string; taxLocation?: string };
  establishmentYear?: { min?: number; max?: number };
  employeeCount?: { min?: number };
  qualifications?: { required?: string[] };
  creditRecord?: { required?: boolean };
  intellectualProperty?: { patents?: { min?: number }; softwareCopyright?: { min?: number } };
  environmental?: { hasEIA?: boolean; hasDischargePermit?: boolean };
  enterpriseType?: { required?: string[] };
}

interface MatchResult {
  policy_id: string;
  policy_name: string;
  matched: boolean;
  matchedConditions: string[];
  unmatchedConditions: string[];
  overallReason: string;
}

// ── Supabase query ───────────────────────────────────────────
async function queryPolicyConditions(env: Env): Promise<Array<{
  policy_id: string;
  conditions: PolicyCondition;
}>> {
  const url = `${env.SUPABASE_URL}/rest/v1/policy_conditions?select=policy_id,conditions&extraction_status=eq.completed`;
  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
      "apikey": env.SUPABASE_ANON_KEY,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase query failed: ${resp.status} ${text}`);
  }
  return resp.json() as Promise<Array<{ policy_id: string; conditions: PolicyCondition }>>;
}

async function queryPolicies(ids: string[], env: Env): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const filter = ids.map(id => `id=eq.${encodeURIComponent(id)}`).join(',');
  const url = `${env.SUPABASE_URL}/rest/v1/policies?select=id,name&${filter}`;
  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
      "apikey": env.SUPABASE_ANON_KEY,
    },
  });
  if (!resp.ok) return {};
  const rows = await resp.json() as Array<{ id: string; name: string }>;
  return Object.fromEntries(rows.map(r => [r.id, r.name]));
}

// ── Match engine (mirrors frontend matcher.ts) ───────────────
function matchEnterpriseToPolicy(
  enterprise: EnterpriseProfileInput,
  condition: PolicyCondition
): PrecisionMatch {
  const matched: string[] = [];
  const unmatched: string[] = [];

  // 1. 注册资金
  if (condition.registerCapital) {
    const { min, max } = condition.registerCapital;
    const capital = enterprise.registeredCapital ?? 0;
    if (min !== undefined && capital < min) {
      unmatched.push(`注册资金 ${capital}万 < ${min}万（要求）`);
    } else if (max !== undefined && capital > max) {
      unmatched.push(`注册资金 ${capital}万 > ${max}万（要求）`);
    } else {
      const label = min !== undefined ? `≥ ${min}万` : "";
      matched.push(`注册资金 ${capital}万 ${label}`);
    }
  }

  // 2. 行业
  if (condition.industry?.required?.length) {
    const entIndustries = enterprise.industry ?? [];
    const hasRequired = condition.industry.required.some(i =>
      entIndustries.some(ei =>
        ei.includes(i) || i.includes(ei) || ei.toLowerCase().includes(i.toLowerCase())
      )
    );
    if (!hasRequired) {
      unmatched.push(`行业不匹配：要求 ${condition.industry.required.join("/")}，实际 ${entIndustries.join("/")}`);
    } else {
      matched.push(`行业匹配：${entIndustries.join("/")}`);
    }
  }

  // 3. 区域
  if (condition.region?.district) {
    if (!enterprise.district?.includes(condition.region.district)) {
      unmatched.push(`区域不匹配：要求 ${condition.region.district}，实际 ${enterprise.district ?? ""}`);
    } else {
      matched.push(`区域匹配：${enterprise.district}`);
    }
  }
  if (condition.region?.taxLocation) {
    if (enterprise.taxLocation !== condition.region.taxLocation) {
      unmatched.push(`纳税地要求：${condition.region.taxLocation}，实际 ${enterprise.taxLocation ?? ""}`);
    }
  }

  // 4. 成立年限
  if (condition.establishmentYear && enterprise.establishmentDate) {
    const years = Math.floor(
      (Date.now() - new Date(enterprise.establishmentDate).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
    );
    if (condition.establishmentYear.min && years < condition.establishmentYear.min) {
      unmatched.push(`成立年限不足：${years}年 < ${condition.establishmentYear.min}年（要求）`);
    }
    if (condition.establishmentYear.max && years > condition.establishmentYear.max) {
      unmatched.push(`成立年限超标：${years}年 > ${condition.establishmentYear.max}年（要求）`);
    }
    if (!unmatched.some(u => u.includes("成立年限"))) {
      matched.push(`成立年限：${years}年`);
    }
  }

  // 5. 员工人数
  if (condition.employeeCount?.min !== undefined) {
    if ((enterprise.employeeCount ?? 0) < condition.employeeCount.min) {
      unmatched.push(`员工人数不足：${enterprise.employeeCount}人 < ${condition.employeeCount.min}人（要求）`);
    } else {
      matched.push(`员工人数：${enterprise.employeeCount}人`);
    }
  }

  // 6. 资质认证
  if (condition.qualifications?.required?.length) {
    const entQuals = enterprise.qualifications ?? [];
    const hasAll = condition.qualifications.required.every(q =>
      entQuals.some(eq => eq.includes(q))
    );
    if (!hasAll) {
      const missing = condition.qualifications.required.filter(q =>
        !entQuals.some(eq => eq.includes(q))
      );
      unmatched.push(`缺少必备资质：${missing.join(", ")}`);
    } else {
      matched.push(`具备必备资质：${condition.qualifications.required.join(", ")}`);
    }
  }

  // 7. 信用记录
  if (condition.creditRecord?.required) {
    if (enterprise.creditRating === "不良") {
      unmatched.push(`信用记录不良`);
    } else {
      matched.push(`信用记录：${enterprise.creditRating ?? "未评级"}`);
    }
  }

  // 8. 知识产权
  if (condition.intellectualProperty?.patents?.min) {
    if ((enterprise.patents ?? 0) < condition.intellectualProperty.patents.min) {
      unmatched.push(`专利数量不足：${enterprise.patents ?? 0}个 < ${condition.intellectualProperty.patents.min}个（要求）`);
    } else {
      matched.push(`专利数量：${enterprise.patents}个达标`);
    }
  }
  if (condition.intellectualProperty?.softwareCopyright?.min) {
    if ((enterprise.softwareCopyright ?? 0) < condition.intellectualProperty.softwareCopyright.min) {
      unmatched.push(`软件著作权不足：${enterprise.softwareCopyright ?? 0}个 < ${condition.intellectualProperty.softwareCopyright.min}个（要求）`);
    } else {
      matched.push(`软件著作权：${enterprise.softwareCopyright}个达标`);
    }
  }

  // 9. 环保要求
  if (condition.environmental?.hasEIA) {
    if (!enterprise.hasEIA) {
      unmatched.push(`缺少环评批复`);
    } else {
      matched.push(`已完成环评`);
    }
  }
  if (condition.environmental?.hasDischargePermit) {
    if (!enterprise.hasDischargePermit) {
      unmatched.push(`缺少排污许可证`);
    } else {
      matched.push(`已取得排污许可证`);
    }
  }

  // 10. 企业类型
  if (condition.enterpriseType?.required?.length) {
    const entTypes = enterprise.enterpriseType ?? [];
    const hasAll = condition.enterpriseType.required.every(t =>
      entTypes.some(et => et.includes(t))
    );
    if (!hasAll) {
      const missing = condition.enterpriseType.required.filter(t =>
        !entTypes.some(et => et.includes(t))
      );
      unmatched.push(`缺少企业类型：${missing.join(", ")}`);
    } else {
      matched.push(`具备要求的企业类型：${condition.enterpriseType.required.join(", ")}`);
    }
  }

  return {
    matched: unmatched.length === 0,
    matchedConditions: matched,
    unmatchedConditions: unmatched,
    overallReason: unmatched.length === 0
      ? "符合所有申报条件"
      : `不符合 ${unmatched.length} 项条件`,
  };
}

// ── Handle match-precise ──────────────────────────────────────
async function handleMatchPrecise(
  enterprise: EnterpriseProfileInput,
  env: Env
): Promise<{ matches: MatchResult[] }> {
  const rows = await queryPolicyConditions(env);
  const policyIds = rows.map(r => r.policy_id);
  const nameMap = await queryPolicies(policyIds, env);
  const rawTextMap = await queryPolicyRawTexts(policyIds, env);

  // First pass: rule matching only
  const ruleResults = rows.map((row) => {
    const name = nameMap[row.policy_id] ?? row.policy_id;
    const ruleResult = matchEnterpriseToPolicy(enterprise, row.conditions);
    return {
      policy_id: row.policy_id,
      policy_name: name,
      matched: ruleResult.matched,
      matchedConditions: ruleResult.matchedConditions,
      unmatchedConditions: ruleResult.unmatchedConditions,
      overallReason: ruleResult.overallReason,
      needsLLM: ruleResult.unmatchedConditions.length > 0 && !!env.NVIDIA_API_KEY,
      rawText: rawTextMap[row.policy_id] ?? "",
      ruleResult,
    };
  });

  // Separate into groups
  const noUnmatched = ruleResults.filter(r => !r.needsLLM);
  const needsLLM = ruleResults.filter(r => r.needsLLM);

  // Parallel LLM calls for needsLLM group
  if (needsLLM.length > 0) {
    const llmPromises = needsLLM.map(async (item) => {
      try {
        const llmResult = await judgeWithDeepSeek(enterprise, item.policy_name, item.rawText, item.ruleResult, env);
        return { ...item, matched: llmResult.worthRecommending, overallReason: llmResult.reason };
      } catch {
        // LLM failed, use rule result
        return { ...item, matched: item.ruleResult.matched, overallReason: item.ruleResult.overallReason };
      }
    });

    const settled = await Promise.allSettled(llmPromises);
    settled.forEach((result, i) => {
      if (result.status === "fulfilled") {
        needsLLM[i] = result.value as typeof needsLLM[0];
      }
    });
  }

  // Combine and sort
  const results: MatchResult[] = [...noUnmatched, ...needsLLM].map(r => ({
    policy_id: r.policy_id,
    policy_name: r.policy_name,
    matched: r.matched,
    matchedConditions: r.matchedConditions,
    unmatchedConditions: r.unmatchedConditions,
    overallReason: r.overallReason,
  }));

  results.sort((a, b) => {
    if (a.matched !== b.matched) return a.matched ? -1 : 1;
    return a.unmatchedConditions.length - b.unmatchedConditions.length;
  });

  return { matches: results };
}

async function judgeWithDeepSeek(
  enterprise: EnterpriseProfileInput,
  policyName: string,
  rawText: string,
  ruleResult: PrecisionMatch,
  env: Env
): Promise<{ worthRecommending: boolean; reason: string }> {
  const enterpriseInfo = `
企业名称：${enterprise.name ?? "未知"}
注册资金：${enterprise.registeredCapital ?? "未知"}万元
成立年份：${enterprise.establishmentDate ? new Date(enterprise.establishmentDate).getFullYear() : "未知"}
员工人数：${enterprise.employeeCount ?? "未知"}
所在区域：${enterprise.province ?? ""}${enterprise.city ?? ""}${enterprise.district ?? ""}
所属行业：${(enterprise.industry ?? []).join("/") || "未知"}
年营收：${enterprise.annualRevenue ? `${enterprise.annualRevenue}元` : "未知"}
企业类型：${(enterprise.enterpriseType ?? []).join("/") || "未知"}
已获资质：${(enterprise.qualifications ?? []).join("/") || "无"}
专利数量：${enterprise.patents ?? 0}个
信用记录：${enterprise.creditRating ?? "未知"}
补充说明：无`;

  const unmetConditions = ruleResult.unmatchedConditions.join("\n");

  const prompt = `你是政策申报顾问。判断企业是否值得申报该政策。

【企业信息】
${enterpriseInfo}

【政策名称】
${policyName}

【政策申报条件原文】
${rawText.substring(0, 1500)}

【规则引擎已判定不满足的条件】
${unmetConditions}

判断逻辑：
- 如果不满足的是"区域/行业/成立年限/员工数/注册资金"等硬性门槛，且政策明确要求 → 不推荐
- 如果不满足的是"资质/信用/专利"等可通过努力获取的条件，且企业有潜力 → 值得推荐
- 如果不满足的条件政策本意是"鼓励"而非"强制" → 值得推荐

请判断：企业是否值得尝试申报该政策？

输出JSON格式：
{"worthRecommending": true/false, "reason": "判断理由，30字以内"}`;

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-ai/deepseek-v4-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.3,
    }),
    // Add 5s timeout via signal
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`NVIDIA API error: ${response.status}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error("无法解析LLM输出");
  }
  return JSON.parse(jsonMatch[0]) as { worthRecommending: boolean; reason: string };
}

async function queryPolicyRawTexts(
  ids: string[],
  env: Env
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const filter = ids.map(id => `id=eq.${encodeURIComponent(id)}`).join(',');
  const url = `${env.SUPABASE_URL}/rest/v1/policies?select=id,policy_condition&${filter}`;
  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
      "apikey": env.SUPABASE_ANON_KEY,
    },
  });
  if (!resp.ok) return {};
  const rows = await resp.json() as Array<{ id: string; policy_condition: string }>;
  return Object.fromEntries(
    rows
      .filter(r => r.policy_condition)
      .map(r => [r.id, r.policy_condition])
  );
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

    // Health check: test Supabase connectivity
    if (path === "/api/health" && request.method === "GET") {
      try {
        const url = `${env.SUPABASE_URL}/rest/v1/policy_conditions?select=policy_id&limit=1`;
        const resp = await fetch(url, {
          headers: {
            "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
            "apikey": env.SUPABASE_ANON_KEY,
          },
        });
        const data = await resp.json();
        return json({ status: "ok", supabase: "reachable", data });
      } catch (err: unknown) {
        return json({ status: "error", supabase: "unreachable", error: (err as Error).message });
      }
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
      try {
        const body = await request.json() as {
          enterprise?: EnterpriseProfileInput;
        };
        if (!body.enterprise) {
          return json({ error: "Missing required field: enterprise" }, 400);
        }
        const results = await handleMatchPrecise(body.enterprise, env);
        return json(results);
      } catch (err: unknown) {
        return json({ error: (err as Error).message }, 500);
      }
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
    } else if (path.match(/^\/api\/invest-api\/clues\/([^/]+)\/convert$/) && request.method === "POST") {
      // 线索转客户
      const clueIdMatch = path.match(/^\/api\/invest-api\/clues\/([^/]+)\/convert$/);
      if (!clueIdMatch || !clueAppToken || !clueTableId) return json({ error: "Not found" }, 404);
      const clueRecordId = clueIdMatch[1];

      // Fetch clue record
      const allClues = await bitableGetRecords(env, clueAppToken, clueTableId, 500);
      const clue = allClues.items.find((r: Record<string, unknown>) => String(r.record_id) === clueRecordId);
      if (!clue) return json({ error: "Clue not found" }, 404);

      // Validate status is "跟进中" before converting
      const currentStatus = String(clue.status ?? "");
      if (currentStatus !== "跟进中") {
        return json({ error: `只能转化"跟进中"状态的线索，当前状态：${currentStatus}` }, 400);
      }

      // Build customer fields from clue (filter empty values)
      const customerFields: Record<string, unknown> = {};
      const fieldMap: Record<string, string> = {
        company_name: "name",
        contact_name: "contact_name",
        contact_phone: "contact_phone",
        required_area: "required_area",
        preferred_district: "preferred_district",
        investment_staff: "investment_staff",
      };
      for (const [src, dst] of Object.entries(fieldMap)) {
        const val = clue[src];
        if (val !== "" && val != null) customerFields[dst] = val;
      }
      customerFields.source = "载体转化";
      customerFields.stage = "初步接触";

      // Create customer record
      if (!env.CUSTOMER_SHEET || !env.CUSTOMER_SHEET_ID) {
        return json({ error: "Customer sheet not configured" }, 500);
      }
      const customerResult = await bitableCreateRecord(
        env,
        env.CUSTOMER_SHEET,
        env.CUSTOMER_SHEET_ID,
        customerFields,
      );

      // Update clue status to "已转化"
      await bitableUpdateRecord(env, clueAppToken, clueTableId, clueRecordId, { status: "已转化" });

      return json({ success: true, customer_id: customerResult.record_id });
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

    // ===== 跟进记录 API (Bitable) =====
    const visitAppToken = env.VISIT_SHEET;
    const visitTableId = env.VISIT_SHEET_ID;
    if (visitAppToken && visitTableId) {
      const visitMatch = path.match(/^\/api\/invest-api\/customers\/([^/]+)\/visits$/);
      if (visitMatch) {
        const customerId = visitMatch[1];
        if (request.method === "GET") {
          const result = await bitableGetRecords(env, visitAppToken, visitTableId, 100);
          // Filter to this customer, newest first
          const items = result.items
            .filter((r) => String(r.customer_id) === customerId)
            .sort((a, b) => {
              const da = new Date(a.visit_date || 0).getTime();
              const db = new Date(b.visit_date || 0).getTime();
              return db - da;
            });
          return json({ data: items, hasMore: result.hasMore, pageToken: result.pageToken });
        }
        if (request.method === "POST") {
          const body = await request.json() as Record<string, unknown>;
          const { record_id, fields } = await bitableCreateRecord(env, visitAppToken, visitTableId, body as Record<string, unknown>);
          return json({ record_id, fields }, 201);
        }
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
