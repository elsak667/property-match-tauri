#!/usr/bin/env node
/**
 * 将 properties-parks.json / buildings.json / units.json
 * 聚合成扁平的 properties-filterable.json
 * 每条记录 = 一个单元，展开 building 和 park 字段
 *
 * Usage:
 *   node scripts/build-filterable.js
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "public", "data");
const outFile = resolve(root, "properties-filterable.json");

// 字段映射
const PARK_FIELDS = {
  "园区ID": "park_id",
  "园区名称": "park_name",
  "所属区域": "district",
};

const BUILDING_FIELDS = {
  "楼宇ID": "building_id",
  "楼宇名称": "building_name",
  "归属园区ID": "park_id",
  "总层数": "floors",
  "产业方向": "industry",
  "104地块": "is_104_block",
  "纬度": "lat",
  "经度": "lng",
};

const UNIT_FIELDS = {
  "单元ID": "unit_id",
  "归属楼宇ID": "building_id",
  "楼层号": "floor",
  "单元号": "unit_no",
  "建筑面积（㎡）": "area_total",
  "已出租面积（㎡）": "area_rented",
  "空置面积（㎡）": "area_vacant",
  "层高（m）": "floor_height",
  "荷载（kg/㎡）": "load",
  "报价（元/㎡/天）": "price",
  "茶水间": "pantry",
  "是否允许餐饮": "allow_catering",
  "是否允许危险品": "allow_hazardous",
  "备注": "remark",
};

function loadJson(name) {
  const raw = JSON.parse(readFileSync(resolve(root, name), "utf-8"));
  // 跳过第一行 header（值为英文 key 的行）
  if (raw.length > 0 && typeof raw[0] === "object" && "园区ID" in raw[0]) return raw.slice(1);
  if (raw.length > 0 && typeof raw[0] === "object" && "楼宇ID" in raw[0]) return raw.slice(1);
  if (raw.length > 0 && typeof raw[0] === "object" && "单元ID" in raw[0]) return raw.slice(1);
  return raw;
}

function normalizeRecord(record, fieldMap) {
  const out = {};
  for (const [cn, en] of Object.entries(fieldMap)) {
    if (cn in record && record[cn] != null) out[en] = record[cn];
  }
  return out;
}

// 加载并映射
const rawParks = loadJson("properties-parks.json");
const rawBuildings = loadJson("properties-buildings.json");
const rawUnits = loadJson("properties-units.json");

const parkMap = {};
for (const p of rawParks) {
  const mapped = normalizeRecord(p, PARK_FIELDS);
  if (mapped.park_id) parkMap[mapped.park_id] = mapped;
}

const buildingMap = {};
for (const b of rawBuildings) {
  const mapped = normalizeRecord(b, BUILDING_FIELDS);
  if (mapped.building_id) buildingMap[mapped.building_id] = mapped;
}

// 聚合
const results = [];
for (const u of rawUnits) {
  const unit = normalizeRecord(u, UNIT_FIELDS);
  if (!unit.building_id) continue;
  const bld = buildingMap[unit.building_id] || {};
  const park = parkMap[bld.park_id] || {};
  results.push({
    unit_id: unit.unit_id || "",
    building_id: unit.building_id || "",
    building_name: bld.building_name || "",
    park_id: bld.park_id || "",
    park_name: park.park_name || "",
    district: park.district || "",
    floor: unit.floor ?? null,
    unit_no: unit.unit_no || "",
    area_total: typeof unit.area_total === "number" ? unit.area_total : null,
    area_vacant: typeof unit.area_vacant === "number" ? unit.area_vacant : null,
    floor_height: typeof unit.floor_height === "number" ? unit.floor_height : null,
    load: typeof unit.load === "number" ? unit.load : null,
    price: typeof unit.price === "number" ? unit.price : null,
    industry: bld.industry || "",
    is_104_block: bld.is_104_block || "",
    remark: unit.remark || "",
  });
}

writeFileSync(outFile, JSON.stringify(results, null, 2), "utf-8");
console.log(`✓ ${results.length} units → ${outFile}`);