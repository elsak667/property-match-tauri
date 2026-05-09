// 飞书 API 集成层

const POLICY_SPREADSHEET = "DwqqsS6TShlGhAteDf3cHRwvnHe";
const POLICY_SHEET_ID = "0aad30";

interface TenantToken { token: string; expiresAt: number; }
let cachedToken: TenantToken | null = null;

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
  if (import.meta.env.VITE_USE_WORKERS) {
    const { fetchPoliciesFromWorkers } = await import("../workers");
    const result = await fetchPoliciesFromWorkers();
    return [result.headers, ...result.data.map(row =>
      result.headers.map(h => row[h] ?? null)
    )];
  }
  return getSheetData(POLICY_SPREADSHEET, POLICY_SHEET_ID, "A1:U600");
}

export { getSheetData };

// 通用：将飞书表格转换为对象数组
export async function getSheetAsObjects<T = Record<string, unknown>>(
  spreadsheet: string,
  sheetId: string,
  startRow = 3
): Promise<T[]> {
  if (import.meta.env.VITE_USE_WORKERS) {
    const { fetchPropertySheet } = await import("../workers");
    try {
      return await fetchPropertySheet(sheetId) as T[];
    } catch (e) {
      console.warn(`[getSheetAsObjects] Workers failed for sheet ${sheetId}:`, e);
      return [];
    }
  }

  const data = await getSheetData(spreadsheet, sheetId);
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
