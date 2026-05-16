/**
 * 批量政策条件提取脚本
 *
 * 功能：
 * - 从 Supabase 或静态 JSON 加载政策
 * - 对每条政策调用 Cloudflare Workers AI (Llama) 提取结构化条件
 * - 存入 policy_conditions 表
 *
 * 用法：
 * DRY_RUN=true npx tsx scripts/batch-extract-conditions.ts  # 只打印不写入
 * npx tsx scripts/batch-extract-conditions.ts             # 正式执行
 *
 * 环境变量：
 * SUPABASE_URL - Supabase 项目 URL (默认: https://rgnncmgrumwjjgzyhmkt.supabase.co)
 * SUPABASE_SERVICE_KEY - Service Role Key
 * CF_ACCOUNT_ID - Cloudflare Account ID
 * CF_API_TOKEN - Cloudflare API Token
 * DRY_RUN - true = 只打印不写入
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rgnncmgrumwjjgzyhmkt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const MODEL = 'deepseek-ai/deepseek-v4-flash';
const DRY_RUN = process.env.DRY_RUN === 'true';
const RETRY_FAILED = process.env.RETRY_FAILED === 'true';

if (!SUPABASE_SERVICE_KEY) {
  console.error('请设置环境变量: SUPABASE_SERVICE_KEY');
  process.exit(1);
}

if (!NVIDIA_API_KEY) {
  console.error('请设置环境变量: NVIDIA_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const EXTRACTION_PROMPT = `任务：从政策申报条件文本中提取结构化条件。

政策名称={policyName}
申报条件原文={conditionText}

输出要求：输出一个 JSON 对象，包含以下字段（没有的字段不要输出）：
- registerCapital: {min, max, unit, currency}
- industry: {required: string[], preferred: string[], excluded: string[]}
- region: {province, city, district, taxLocation}
- establishmentYear: {min, max}
- employeeCount: {min, max}
- annualRevenue: {min, max, unit}
- taxAmount: {min, location}
- qualifications: {required: string[], preferred: string[]}
- creditRecord: {required: boolean}
- intellectualProperty: {patents: {min}, softwareCopyright: {min}}
- environmental: {hasEIA, hasDischargePermit}
- enterpriseType: {allowed: string[], excluded: string[], required: string[]}
- applicationMethod: string
- specialConditions: string[]

提取规则：
1. 金额中的"以上""不低于""不少于"对应 min，"以下""不超过""不多于"对应 max
2. 单位统一换算：万/亿
3. 行业名称标准化（如"集成电路"而非"IC"）
4. 只提取明确的条件，模糊表述不提取
5. 如果原文无某类条件，该字段不输出

输出格式：只输出 JSON，不要其他内容。`;

interface Policy {
  id: string;
  policy_name?: string;
  name?: string;
  policyCondition?: string;
  policy_condition?: string;
}

async function callLLM(policyName: string, conditionText: string): Promise<Record<string, unknown>> {
  const prompt = EXTRACTION_PROMPT
    .replace('{policyName}', policyName || '未知政策')
    .replace('{conditionText}', conditionText || '');

  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NVIDIA_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    throw new Error(`NVIDIA API error: ${response.status}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error) {
    throw new Error(`NVIDIA API error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content || '';

  // 提取 JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('无法从 LLM 输出中提取 JSON');
  }

  return JSON.parse(jsonMatch[0]);
}

async function extractConditions(policy: Policy): Promise<{
  conditions: Record<string, unknown>;
  rawText: string;
  status: 'completed' | 'failed';
  error?: string;
}> {
  const policyName = policy.policy_name || policy.name || '未知政策';
  const conditionText = policy.policy_condition || policy.policyCondition || '';

  if (!conditionText || conditionText.trim() === '') {
    return {
      conditions: {},
      rawText: '',
      status: 'completed'
    };
  }

  try {
    const conditions = await callLLM(policyName, conditionText);
    return {
      conditions,
      rawText: conditionText,
      status: 'completed'
    };
  } catch (error) {
    return {
      conditions: {},
      rawText: conditionText,
      status: 'failed',
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

async function saveToSupabase(
  policyId: string,
  conditions: Record<string, unknown>,
  rawText: string,
  status: 'completed' | 'failed',
  error?: string
): Promise<void> {
  if (DRY_RUN) {
    console.log(`[DRY_RUN] Would save: policy=${policyId}, status=${status}`);
    return;
  }

  const { error: dbError } = await supabase
    .from('policy_conditions')
    .upsert({
      policy_id: policyId,
      conditions,
      raw_text: rawText,
      extraction_status: status,
      extraction_error: error || null,
      extracted_at: new Date().toISOString()
    }, {
      onConflict: 'policy_id'
    });

  if (dbError) {
    throw new Error(`Supabase error: ${dbError.message}`);
  }
}

async function loadPolicies(): Promise<Policy[]> {
  // 先从 policy_conditions 表获取已有数据的 policy_id
  const { data: existing } = await supabase
    .from('policy_conditions')
    .select('policy_id, extraction_status');

  const alreadyExtracted = new Set(
    (existing || [])
      .filter(row => row.extraction_status === 'completed')
      .map(row => row.policy_id)
  );

  const failedIds = new Set(
    (existing || [])
      .filter(row => row.extraction_status === 'failed')
      .map(row => row.policy_id)
  );

  console.log(`已有 ${alreadyExtracted.size} 条政策完成提取, ${failedIds.size} 条失败`);

  // 获取所有政策
  const { data: policies, error } = await supabase
    .from('policies')
    .select('id, policy_name, policy_condition');

  if (error) {
    console.warn(`无法从 policies 表加载: ${error.message}`);
    return [];
  }

  // RETRY_FAILED 模式：只处理失败的
  if (RETRY_FAILED) {
    console.log(`重试模式：只处理 ${failedIds.size} 条失败的政策`);
    return (policies || []).filter(p => failedIds.has(p.id));
  }

  // 正常模式：跳过已完成的
  return (policies || []).filter(p => !alreadyExtracted.has(p.id));
}

async function main() {
  console.log('=== 政策条件批量提取 ===');
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('');

  const policies = await loadPolicies();
  console.log(`待处理: ${policies.length} 条政策`);
  console.log('');

  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const policy of policies) {
    const policyName = policy.policy_name || policy.name || policy.id;
    process.stdout.write(`[${completed + failed + skipped + 1}/${policies.length}] ${policyName.substring(0, 30)}... `);

    const conditionText = policy.policy_condition || policy.policyCondition || '';
    if (!conditionText || conditionText.trim() === '') {
      console.log('SKIP (无申报条件)');
      skipped++;
      continue;
    }

    const result = await extractConditions(policy);

    if (result.status === 'failed') {
      console.log(`FAILED: ${result.error}`);
      failed++;
    } else {
      console.log('OK');
      completed++;
    }

    await saveToSupabase(
      policy.id,
      result.conditions,
      result.rawText,
      result.status,
      result.error
    );

    // 避免 API 限流 (40 RPM，加安全余量到3秒)
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('');
  console.log('=== 完成 ===');
  console.log(`成功: ${completed}`);
  console.log(`失败: ${failed}`);
  console.log(`跳过: ${skipped}`);
}

main().catch(console.error);
