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

export function buildExtractionPrompt(
  policyName: string,
  conditionText: string
): string {
  return EXTRACTION_PROMPT
    .replace('{policyName}', policyName)
    .replace('{conditionText}', conditionText);
}

export function parseExtractedConditions(raw: string): Record<string, unknown> {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('无法解析 LLM 输出');
  return JSON.parse(jsonMatch[0]);
}