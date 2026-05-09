/**
 * 静态数据层 - 替代 Tauri/Rust 后端
 * 数据来源: public/data/*.json
 */
export interface FeishuConfig {
  has_app_id: string;
  has_credentials: string;
  property_sheet: string;
  policy_sheet: string;
}

export interface SheetData {
  headers: string[];
  data: Record<string, unknown>[];
}

export interface NewsItem {
  time: string;
  category: string;
  title: string;
  link: string;
  summary: string;
}

export interface PolicyStats {
  local_count: number;
  official_count: number;
  coverage: string;
  diff: number;
  source: string;
  official_link: string;
}

// ── 静态 JSON 加载 ─────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

// 飞书配置（静态，凭证相关改为空）
export function getFeishuConfig(): FeishuConfig {
  return {
    has_app_id: "false",
    has_credentials: "false",
    property_sheet: "X1jRs1PhLhR8WetSwktcM9Fgnhg",
    policy_sheet: "DwqqsS6TShlGhAteDf3cHRwvnHe",
  };
}

export function feishuDebug(): Record<string, string> {
  return {
    mode: "static_json",
    source: "public/data/",
  };
}

// ── 政策数据（已预处理为静态 JSON）───────────────────────────────
export async function fetchPoliciesFromFeishu(): Promise<SheetData> {
  return fetchJSON<SheetData>("/data/policies.json");
}

// ── 新闻数据 ──────────────────────────────────────────────────────────────
export async function fetchNewsFromFeishu(): Promise<NewsItem[]> {
  return fetchJSON<NewsItem[]>("/data/news.json");
}

// 打开外部 URL（浏览器直接跳转）
export function openInBrowser(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

// 本地缓存（改用 localStorage）
export async function feishuCacheRead(key: string): Promise<unknown> {
  try {
    const raw = localStorage.getItem("pm_cache_" + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > 12 * 60 * 60 * 1000) {
      localStorage.removeItem("pm_cache_" + key);
      return null;
    }
    return entry.data;
  } catch { return null; }
}

export async function feishuCacheWrite(key: string, data: unknown): Promise<void> {
  try {
    localStorage.setItem("pm_cache_" + key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* storage full */ }
}

// ── 统计 ──────────────────────────────────────────────────────────────────
export async function getPolicyStats(): Promise<PolicyStats> {
  try {
    const stats = await fetchJSON<{ official_count: number; local_count: number }>("/data/stats.json");
    const policies = await fetchPoliciesFromFeishu();
    const local_count = policies.data.length;
    const official_count = stats.official_count || local_count;
    const coverage = official_count > 0 ? `${Math.round((local_count / official_count) * 100)}%` : "100%";
    return {
      local_count,
      official_count,
      coverage,
      diff: official_count - local_count,
      source: "static_json",
      official_link: "",
    };
  } catch {
    return {
      local_count: 0,
      official_count: 0,
      coverage: "0%",
      diff: 0,
      source: "static_json",
      official_link: "",
    };
  }
}

// ── PDF 保存（浏览器下载）─────────────────────────────────────────────────────
export async function savePdf(data: Uint8Array, filename: string): Promise<{
  success: boolean;
  path?: string;
  error?: string;
}> {
  try {
    const blob = new Blob([data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: String(err) };
  }
}
