// 物业数据加载（静态 JSON 模式）

import type { Park, Building, Unit } from "./types";
import { getCached, setCache, cacheOrRefresh } from "../policy/cache";

// 静态 JSON 文件映射
const PROPERTY_FILE_URLS: Record<string, string> = {
  "园区": "/data/properties-parks.json",
  "楼宇": "/data/properties-buildings.json",
  "单元": "/data/properties-units.json",
};

// ── 静态 JSON 加载 ─────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

// ── 物业数据加载 ───────────────────────────────────────────────────────────

export async function loadPropertyData(): Promise<{ parks: Park[]; buildings: Building[]; units: Unit[] }> {
  return cacheOrRefresh<{ parks: Park[]; buildings: Building[]; units: Unit[] }>("property_data_v2", async () => {
    const [parks, buildings, units] = await Promise.all([
      fetchJSON<Park[]>(PROPERTY_FILE_URLS["园区"]),
      fetchJSON<Building[]>(PROPERTY_FILE_URLS["楼宇"]),
      fetchJSON<Unit[]>(PROPERTY_FILE_URLS["单元"]),
    ]);
    const result = { parks, buildings, units };
    // 写入 localStorage 缓存
    setCache("property_data_v2", result);
    return result;
  });
}

// 静态 JSON 也用缓存层的 getCached/setCache（已兼容）
export { getCached, setCache };
