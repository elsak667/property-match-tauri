// 物业数据加载（静态 JSON 模式）

import type { Park, Building, Unit } from "./types";
import { getCached, setCache, cacheOrRefresh } from "../policy/cache";

const PROPERTY_FILE_URLS: Record<string, string> = {
  "园区": "/data/properties-parks.json",
  "楼宇": "/data/properties-buildings.json",
  "单元": "/data/properties-units.json",
};

// ── 静态 JSON 字段映射 ───────────────────────────────────────────────────

const PARK_FIELDS: Record<string, keyof Park> = {
  "park_id": "park_id",
  "name": "name",
  "district": "district",
  "address": "address",
  "industry_direction": "industry_direction",
  "built_year": "built_year",
  "canteen": "canteen",
  "dormitory": "dormitory",
  "parking_total": "parking_total",
  "exhibition_hall": "exhibition_hall",
  "meeting_rooms": "meeting_rooms",
  "fire_rating": "fire_rating",
  "security_level": "security_level",
  "经度(lng)": "lng",
};

const BUILDING_FIELDS: Record<string, string> = {
  "building_id": "building_id",
  "park_id": "park_id",
  "name": "name",
  "type": "type",
  "floors": "floors",
  "floor_thickness": "floor_thickness",
  "has_crane_beam": "has_crane_beam",
  "fire_sprinkler": "fire_sprinkler",
  "fire_extinguisher": "fire_extinguisher",
  "hydrant": "hydrant",
  "independent_access": "independent_access",
  "industry": "industry",
  "contact": "contact",
  "ac_type": "ac_type",
  "ac_hours": "ac_hours",
  "is_104_block": "is_104_block",
  "latitude": "lat",
  "longitude": "lng",
  "经度(lng)": "lng",
};

const UNIT_FIELDS: Record<string, keyof Unit> = {
  "unit_id": "unit_id",
  "building_id": "building_id",
  "floor": "floor",
  "unit_no": "unit_no",
  "area_total": "area_total",
  "area_rented": "area_rented",
  "area_vacant": "area_vacant",
  "area_min_split": "area_min_split",
  "support_split": "support_split",
  "floor_height": "floor_height",
  "load": "load",
  "price": "price",
  "deposit_ratio": "deposit_ratio",
  "min_lease_year": "min_lease_year",
  "wc_count": "wc_count",
  "pantry": "pantry",
  "allow_catering": "allow_catering",
  "allow_hazardous": "allow_hazardous",
  "remark": "remark",
};

function normalizeRecord<T>(record: Record<string, unknown>, fieldMap: Record<string, string>): T {
  const result: Record<string, unknown> = {};
  for (const [cnKey, enKey] of Object.entries(fieldMap)) {
    if (cnKey in record) {
      result[enKey] = record[cnKey];
    }
  }
  return result as T;
}

function isHeaderRow(record: Record<string, unknown>): boolean {
  const v = Object.values(record)[0];
  return typeof v === "string" && /^[a-z_]+$/.test(v);
}

function normalizeArray<T>(arr: Record<string, unknown>[], fieldMap: Record<string, string>): T[] {
  return arr
    .filter(item => !isHeaderRow(item))
    .map(item => normalizeRecord<T>(item, fieldMap));
}

// ── 静态 JSON 加载 ─────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

// ── 物业数据加载 ───────────────────────────────────────────────────────────

export async function loadPropertyData(): Promise<{ parks: Park[]; buildings: Building[]; units: Unit[] }> {
  return cacheOrRefresh<{ parks: Park[]; buildings: Building[]; units: Unit[] }>("property_data_v3", async () => {
    const [rawParks, rawBuildings, rawUnits] = await Promise.all([
      fetchJSON<Record<string, unknown>[]>(PROPERTY_FILE_URLS["园区"]),
      fetchJSON<Record<string, unknown>[]>(PROPERTY_FILE_URLS["楼宇"]),
      fetchJSON<Record<string, unknown>[]>(PROPERTY_FILE_URLS["单元"]),
    ]);
    const parks = normalizeArray<Park>(rawParks, PARK_FIELDS);
    const buildings = normalizeArray<Building>(rawBuildings, BUILDING_FIELDS);
    const units = normalizeArray<Unit>(rawUnits, UNIT_FIELDS);
    const result = { parks, buildings, units };
    setCache("property_data_v2", result);
    return result;
  });
}

export { getCached, setCache };
