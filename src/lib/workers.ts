/**
 * 数据获取层 — 优先静态 JSON（CDN），Workers 作为 fallback
 * VITE_USE_WORKERS=true 时走 Workers API（兼容旧逻辑）
 * VITE_USE_WORKERS=false 时走静态 JSON（同源 /data/）
 */

const USE_WORKERS = import.meta.env.VITE_USE_WORKERS === "true";
const WORKERS_BASE = "https://api.elsak.eu.org/api";
const STATIC_BASE = "/data";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${WORKERS_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as T;
}

// ── 静态 JSON 读取（优先）───────────────────────────────────────────────────
async function fetchStatic<T>(filename: string): Promise<T> {
  const res = await fetch(`${STATIC_BASE}/${filename}`);
  if (!res.ok) throw new Error(`Static fetch failed: ${res.status} ${filename}`);
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

export interface PropertyFilterResult {
  total: number;
  page: number;
  page_size: number;
  results: PropertyFilterUnit[];
}

export interface PropertyFilterUnit {
  unit_id: string;
  building_id: string;
  park_id: string;
  unit_no: string;
  floor: number | null;
  area_total: number | null;
  area_vacant: number | null;
  price: number | null;
  floor_height: number | null;
  load: number | null;
  building_name: string;
  building_industry: string;
  building_lat: number | null;
  building_lng: number | null;
  park_name: string;
  district: string;
  industry: string;
  remark: string;
}

export const filterProperties = (params: Record<string, string | number | undefined>) => {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return request<PropertyFilterResult>(`/property-filter${qs ? "?" + qs : ""}`);
};

export interface BuildingDetail {
  building: {
    building_id: string;
    name: string;
    industry: string;
    has_crane_beam: boolean;
    lat: number | null;
    lng: number | null;
    park_id: string;
    park_name: string;
    district: string;
  };
  units: {
    unit_id: string;
    unit_no: string;
    floor: number | null;
    area_total: number | null;
    area_vacant: number | null;
    price: number | null;
    floor_height: number | null;
    load: number | null;
    remark: string;
  }[];
}

export const fetchBuildingDetail = (buildingId: string) =>
  request<BuildingDetail>(`/building-detail?building_id=${encodeURIComponent(buildingId)}`);

export interface BuildingSummary {
  building_id: string;
  name: string;
  industry: string;
  lat: number | null;
  lng: number | null;
  park_id: string;
  park_name: string;
  district: string;
  floors: number;
  area_total: number;
  area_vacant: number;
  price: number | null;
}

export const fetchBuildings = () => request<BuildingSummary[]>("/buildings");

// ── 静态 JSON fallback（优先）────────────────────────────────────────────────
export async function fetchNewsFromFeishu(): Promise<NewsItem[]> {
  if (USE_WORKERS) return request<NewsItem[]>("/news");
  try {
    return await fetchStatic<NewsItem[]>("news.json");
  } catch {
    return request<NewsItem[]>("/news");
  }
}

export async function fetchPoliciesFromFeishu(): Promise<SheetData> {
  if (USE_WORKERS) return request<SheetData>("/policies");
  try {
    const data = await fetchStatic<{ headers: string[]; data: Record<string, unknown>[] }>("policies.json");
    return { headers: data.headers, data: data.data };
  } catch {
    return request<SheetData>("/policies");
  }
}

export async function getWorkersPolicyStatsFromStatic(): Promise<PolicyStats> {
  try {
    return await fetchStatic<PolicyStats>("stats.json");
  } catch {
    return request<PolicyStats>("/property-stats");
  }
}