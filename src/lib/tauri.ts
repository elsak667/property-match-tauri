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

// ── 物业载体数据 ──────────────────────────────────────────────────────────────
export async function fetchPropertiesFromFeishu(): Promise<SheetData> {
  return invoke<SheetData>("feishu_fetch_properties");
}

// ── 政策数据 ─────────────────────────────────────────────────────────────────
export async function fetchPoliciesFromFeishu(): Promise<SheetData> {
  return invoke<SheetData>("feishu_fetch_policies");
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
