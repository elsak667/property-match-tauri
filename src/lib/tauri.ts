import { invoke } from "@tauri-apps/api/core";

/**
 * 打开打印窗口（浏览器原生打印对话框，用户自行另存为 PDF）
 */
export async function openPrintWindow(html: string): Promise<{ success: boolean; error?: string }> {
  try {
    await invoke("open_print_window", { html });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 获取政策统计信息
 */
export async function getPolicyStats(): Promise<{
  local数据库: number;
  官方总数: number;
  匹配率: string;
  差异: number;
  数据来源: string;
  官方链接: string;
}> {
  return invoke("get_policy_stats");
}

/**
 * 获取政策筛选选项
 */
export async function getPolicyOptions(): Promise<unknown> {
  return invoke("get_policy_options");
}

/**
 * 政策匹配
 */
export async function matchPolicies(query: unknown): Promise<unknown> {
  return invoke("match_policies", { queryJson: JSON.stringify(query) });
}

/**
 * 获取产业字典
 */
export async function getIndustries(): Promise<unknown> {
  return invoke("get_industries");
}

/**
 * 物业载体匹配
 */
export async function matchProperties(query: unknown): Promise<unknown> {
  return invoke("match_properties", { queryJson: JSON.stringify(query) });
}
