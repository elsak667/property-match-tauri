// 飞书 API 集成层（静态 JSON 模式）

export class FeishuCredentialsMissing extends Error {
  constructor() {
    super("FEISHU_CREDENTIALS_MISSING");
    this.name = "FeishuCredentialsMissing";
  }
}

// ── 静态 JSON 加载 ─────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

// 政策 sheet 行数据（用于 loadPolicies）
export async function getPolicySheetRows(): Promise<unknown[][]> {
  type SheetData = { headers: string[]; data: Record<string, unknown>[] };
  const sheet = await fetchJSON<SheetData>("/data/policies.json");
  const { headers, data } = sheet;
  // 转换为 rows 格式: [[headers], [row1], [row2], ...]
  const rows: unknown[][] = [headers, ...data.map(row => headers.map(h => row[h] ?? null))];
  return rows;
}

// 通用：读取静态属性 JSON（物业数据）
export async function getSheetAsObjects<T = Record<string, unknown>>(
  _spreadsheet: string, // 已废弃，保留参数兼容性
  sheetId: string,
  _startRow = 3         // 已废弃，静态数据已预处理
): Promise<T[]> {
  // sheetId 对应文件名: 4hdJSg → properties-parks, 4hdJSh → properties-buildings, 4hdJSi → properties-units
  const fileMap: Record<string, string> = {
    "4hdJSg": "/data/properties-parks.json",
    "4hdJSh": "/data/properties-buildings.json",
    "4hdJSi": "/data/properties-units.json",
  };
  const url = fileMap[sheetId];
  if (!url) {
    console.warn(`[getSheetAsObjects] Unknown sheetId: ${sheetId}`);
    return [];
  }
  return fetchJSON<T[]>(url);
}

// 导出（已在上面声明）
