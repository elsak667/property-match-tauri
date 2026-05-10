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
  "园区ID": "park_id",
  "园区名称": "name",
  "所属区域": "district",
  "详细地址": "address",
  "产业定位": "industry_direction",
  "建造年份": "built_year",
  "食堂（餐位数）": "canteen",
  "人才公寓（套数）": "dormitory",
  "停车位总数": "parking_total",
  "展厅面积（㎡）": "exhibition_hall",
  "共享会议室": "meeting_rooms",
  "消防等级": "fire_rating",
  "安保等级": "security_level",
  "土地性质": "land_nature",
  "104地块": "is_104_block",
  "纬度(lat)": "lat",
  "经度(lng)": "lng",
};

const BUILDING_FIELDS: Record<string, string> = {
  "楼宇ID": "building_id",
  "归属园区ID": "park_id",
  "楼宇名称": "name",
  "物业类型": "type",
  "总层数": "floors",
  "楼板厚度": "floor_thickness",
  "是否有行车梁": "has_crane_beam",
  "消防喷淋": "fire_sprinkler",
  "灭火器": "fire_extinguisher",
  "消防栓": "hydrant",
  "独立门禁": "independent_access",
  "产业方向": "industry",
  "联系人": "contact",
  "空调类型": "ac_type",
  "空调开放时间": "ac_hours",
  "104地块": "is_104_block",
  "纬度": "lat",
  "经度": "lng",
};

const UNIT_FIELDS: Record<string, keyof Unit> = {
  "单元ID": "unit_id",
  "归属楼宇ID": "building_id",
  "楼层号": "floor",
  "单元号": "unit_no",
  "建筑面积（㎡）": "area_total",
  "已出租面积（㎡）": "area_rented",
  "空置面积（㎡）": "area_vacant",
  "最小分割面积（㎡）": "area_min_split",
  "是否支持分割": "support_split",
  "层高（m）": "floor_height",
  "荷载（kg/㎡）": "load",
  "报价（元/㎡/天）": "price",
  "押金倍数": "deposit_ratio",
  "最短租期（年）": "min_lease_year",
  "卫生间数量": "wc_count",
  "茶水间": "pantry",
  "是否允许餐饮": "allow_catering",
  "是否允许危险品": "allow_hazardous",
  "备注": "remark",
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
  return record["楼宇ID"] === "楼宇ID" || record["园区ID"] === "园区ID" || record["单元ID"] === "单元ID";
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
  return cacheOrRefresh<{ parks: Park[]; buildings: Building[]; units: Unit[] }>("property_data_v2", async () => {
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
