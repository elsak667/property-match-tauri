/**
 * Workers API 调用层
 * 开发时：Vite proxy 代理到 localhost:8787（本地 wrangler dev）
 * 生产时：直接请求 Cloudflare Workers
 */

const BASE = "https://api.elsak.eu.org/api";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as T;
}

export interface FeishuConfig {
  has_app_id: boolean | string;
  has_credentials: boolean | string;
  property_sheet: string;
  policy_sheet: string;
}

export interface NewsItem {
  time: string;
  category: string;
  title: string;
  link: string;
  summary: string;
}

export interface SheetData {
  headers: string[];
  data: Record<string, unknown>[];
}

export interface PolicyStats {
  local_count: number;
  official_count: number;
  coverage: string;
  diff: number;
  source: string;
  official_link: string;
}

export const getWorkersConfig = () => request<FeishuConfig>("/config");
export const fetchNewsFromWorkers = () => request<NewsItem[]>("/news");
export const fetchPoliciesFromWorkers = () => request<SheetData>("/policies");
export const getWorkersPolicyStats = () => request<PolicyStats>("/property-stats");
export const fetchPropertySheet = (type: string) =>
  request<Record<string, unknown>[]>(`/properties?type=${encodeURIComponent(type)}`);