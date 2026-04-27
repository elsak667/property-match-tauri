/**
 * Tauri / Rust 后端 API 调用层
 */
import { invoke } from "@tauri-apps/api/core";

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

// ── 飞书配置 ─────────────────────────────────────────────────────────────────
export async function getFeishuConfig(): Promise<FeishuConfig> {
  return invoke<FeishuConfig>("feishu_config");
}

export async function feishuDebug(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("feishu_debug");
}

// ── 新闻数据 ─────────────────────────────────────────────────────────────────
export interface NewsItem {
  time: string;
  category: string;
  title: string;
  link: string;
  summary: string;
}

export async function fetchNewsFromFeishu(): Promise<NewsItem[]> {
  return invoke<NewsItem[]>("feishu_fetch_news");
}

// ── 政策数据 ─────────────────────────────────────────────────────────────────
export async function fetchPoliciesFromFeishu(): Promise<SheetData> {
  return invoke<SheetData>("feishu_fetch_policies");
}

// ── 打开外部 URL ─────────────────────────────────────────────────────────────────
export async function openInBrowser(url: string): Promise<void> {
  await invoke("open_in_browser", { url });
}

// ── 本地缓存 ─────────────────────────────────────────────────────────────────
export async function feishuCacheRead(key: string): Promise<unknown> {
  return invoke("feishu_cache_read", { key });
}

export async function feishuCacheWrite(key: string, data: unknown): Promise<void> {
  return invoke("feishu_cache_write", { key, data });
}

export interface PolicyStats {
  local_count: number;
  official_count: number;
  coverage: string;
  diff: number;
  source: string;
  official_link: string;
}

export async function getPolicyStats(): Promise<PolicyStats> {
  return invoke<PolicyStats>("get_policy_stats");
}

// ── 保存 PDF ─────────────────────────────────────────────────────────────────
export async function savePdf(data: Uint8Array, filename: string): Promise<{
  success: boolean;
  path?: string;
  error?: string;
}> {
  try {
    const path = await invoke<string>("save_pdf_file", {
      data: Array.from(data),
      filename,
    });
    return { success: true, path };
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes("用户取消") || msg === "用户取消") {
      return { success: false, error: "用户取消" };
    }
    return { success: false, error: msg };
  }
}
