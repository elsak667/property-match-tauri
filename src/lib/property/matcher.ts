// 物业匹配引擎

import type { Property, PropertyMatchQuery, PropertyMatchResult } from "./types";
import { PROPERTY_WEIGHTS } from "./types";
import { loadPropertyData } from "./loader";

function scoreExactMatch(userVals: string[], propVal: string): number {
  if (!userVals?.length || !userVals[0]) return 100;
  if (!propVal) return 50;
  const pv = propVal.toLowerCase();
  const hit = userVals.some((uv) => uv && (pv.includes(uv.toLowerCase()) || uv.toLowerCase().includes(pv)));
  return hit ? 100 : 0;
}

function scoreRangeMatch(userVals: string[], propVal: string): number {
  if (!userVals?.length || !userVals[0]) return 100;
  if (!propVal) return 50;
  const pv = propVal.toLowerCase();
  const matched = userVals.filter((uv) => uv && (pv.includes(uv.toLowerCase()) || uv.toLowerCase().includes(pv))).length;
  if (matched === userVals.length) return 100;
  if (matched > 0) return Math.round((matched / userVals.length) * 80 + 20);
  return 0;
}

function scoreArea(uMin: number | undefined, uMax: number | undefined, pMin: number | null, pMax: number | null): number {
  if (pMax == null) return 50;
  if (uMin == null && uMax == null) return 100;
  const pMinSafe = pMin ?? 0;

  if (uMin != null && uMax != null) {
    if (pMinSafe <= uMin && pMax >= uMax) return 100;
    const overlapMin = Math.max(pMinSafe, uMin);
    const overlapMax = Math.min(pMax, uMax);
    if (overlapMin <= overlapMax) {
      const overlap = overlapMax - overlapMin;
      const userRange = uMax - uMin;
      const iou = overlap / userRange;
      return Math.round(Math.min(iou * 100, 100));
    } else {
      const gap = Math.min(Math.abs(pMinSafe - uMax), Math.abs(pMax - uMin));
      const penalty = Math.min((gap / uMax) * 80, 80);
      return Math.max(0, Math.round(70 - penalty));
    }
  } else if (uMin != null) {
    if (pMinSafe <= uMin && uMin <= pMax) return 100;
    if (uMin > pMax) {
      const gap = uMin - pMax;
      return Math.max(0, Math.round(70 - Math.min(gap / uMin * 70, 70)));
    }
    return Math.max(0, Math.round(80 - ((pMinSafe - uMin) / pMinSafe) * 20));
  } else if (uMax != null) {
    if (pMinSafe <= uMax) return pMax >= uMax ? 100 : Math.round((pMax / uMax) * 100);
    return 0;
  }
  return 100;
}

function scorePrice(uMax: number | undefined, pPrice: number | null): number {
  if (pPrice == null) return 50;
  if (uMax == null) return 100;
  if (pPrice <= uMax) {
    const ratio = pPrice / uMax;
    return Math.round(Math.min(100, 80 + (1 - ratio) * 20));
  } else {
    const over = (pPrice - uMax) / uMax;
    return Math.max(0, Math.round(80 - over * 80));
  }
}

function scoreNumericHard(uMin: number | undefined, pVal: number | null): number {
  if (uMin == null) return 100;
  if (pVal == null) return 0;
  return pVal >= uMin ? 100 : 0;
}

function scoreIs104(userVal: string | undefined, propVal: string | null): number {
  if (!userVal || userVal === "不限") return 100;
  if (!propVal) return 0;
  if (userVal === "是") return propVal === "是" ? 100 : 0;
  if (userVal === "否") return propVal === "否" ? 100 : 0;
  return 100;
}

function buildReason(s: Record<string, number>): string {
  const parts: string[] = [];
  if ((s.area ?? 0) >= 80) parts.push("面积");
  if ((s.price ?? 0) >= 80) parts.push("价格");
  if ((s.type ?? 0) >= 80) parts.push("类型");
  if ((s.industry ?? 0) >= 80) parts.push("产业");
  return parts.join(" | ") || "基础匹配";
}

function getStar(score: number): string {
  if (score >= 90) return "⭐⭐⭐";
  if (score >= 75) return "⭐⭐";
  return "⭐";
}

export async function matchProperties(query: PropertyMatchQuery): Promise<PropertyMatchResult[]> {
  const tolerance = query.tolerance ?? 50;

  const { parks, buildings, units } = await loadPropertyData();

  const parkMap = new Map(parks.map(p => [p.park_id, p]));
  const buildingMap = new Map(buildings.map(b => [b.building_id, b]));

  const properties: Property[] = units
    .filter(unit => unit.area_vacant && unit.area_vacant > 0)
    .map(unit => {
      const building = buildingMap.get(unit.building_id);
      const park = building ? parkMap.get(building.park_id) : null;

      return {
        unit_id: unit.unit_id,
        floor: unit.floor,
        unit_no: unit.unit_no,
        area_total: unit.area_total,
        area_vacant: unit.area_vacant,
        area_min_split: unit.area_min_split,
        support_split: unit.support_split,
        floor_height: unit.floor_height,
        load: unit.load,
        price: unit.price,
        deposit_ratio: unit.deposit_ratio,
        min_lease_year: unit.min_lease_year,
        wc_count: unit.wc_count,
        pantry: unit.pantry,
        allow_catering: unit.allow_catering,
        allow_hazardous: unit.allow_hazardous,
        remark: unit.remark,
        building_id: building?.building_id ?? "",
        building_name: building?.name ?? "",
        building_type: building?.type ?? "",
        floors: building?.floors,
        elevator_p: building?.elevator_p,
        elevator_c: building?.elevator_c,
        occupancy_rate: building?.occupancy_rate,
        property_fee: building?.property_fee,
        ac_type: building?.ac_type,
        ac_hours: building?.ac_hours,
        network_mbps: building?.network_mbps,
        power_kv: building?.power_kv,
        has_gas: building?.has_gas,
        has_drainage: building?.has_drainage,
        waste_gas_facility: building?.waste_gas_facility,
        column_spacing: building?.column_spacing,
        fire_sprinkler: building?.fire_sprinkler,
        industry: building?.industry,
        contact: building?.contact,
        phone: building?.phone,
        park_id: park?.park_id ?? building?.park_id ?? "",
        park_name: park?.name ?? "",
        district: park?.district ?? "",
        address: park?.address ?? "",
        canteen: park?.canteen,
        dormitory: park?.dormitory,
        parking_total: park?.parking_total,
        exhibition_hall: park?.exhibition_hall,
        meeting_rooms: park?.meeting_rooms,
        land_nature: park?.land_nature,
        is_104_block: park?.is_104_block,
      } as Property;
    });

  const hasFilters = [
    query.areaMin, query.areaMax, query.priceMax,
    (query.types?.length ?? 0) > 0,
    (query.industries?.length ?? 0) > 0,
    query.loadMin, query.heightMin, query.powerKVMin,
    query.is104Block,
  ].some(Boolean);

  const results = properties
    .map((p) => {
      const sArea = scoreArea(query.areaMin, query.areaMax, p.area_min_split ?? null, p.area_vacant ?? null);
      const sPrice = scorePrice(query.priceMax ?? undefined, p.price ?? null);
      const sType = scoreExactMatch(query.types ?? [], p.building_type);
      const sIndustry = scoreRangeMatch(query.industries ?? [], p.industry ?? "");
      const sLoad = scoreNumericHard(query.loadMin ?? undefined, p.load);
      const sHeight = scoreNumericHard(query.heightMin ?? undefined, p.floor_height);
      const sPowerKV = scoreNumericHard(query.powerKVMin ?? undefined, p.power_kv);
      const s104 = scoreIs104(query.is104Block, p.is_104_block);

      const raw =
        sArea * PROPERTY_WEIGHTS.area +
        sPrice * PROPERTY_WEIGHTS.price +
        sType * PROPERTY_WEIGHTS.type +
        sIndustry * PROPERTY_WEIGHTS.industry +
        sLoad * PROPERTY_WEIGHTS.load +
        sHeight * PROPERTY_WEIGHTS.height +
        s104 * PROPERTY_WEIGHTS.is104 +
        sPowerKV * PROPERTY_WEIGHTS.powerKV;
      const total = Math.min(100, raw);

      const scores = { area: sArea, price: sPrice, type: sType, industry: sIndustry, load: sLoad, height: sHeight, is104: s104, powerKV: sPowerKV };

      return {
        property: p,
        totalScore: Math.round(total * 10) / 10,
        stars: getStar(total),
        scores,
        matchReason: hasFilters ? buildReason(scores) : "综合推荐",
      };
    })
    .filter((r) => !hasFilters || r.totalScore >= tolerance)
    .filter((r) => !query.is104Block || query.is104Block === "不限" || (r.scores.is104 ?? 100) > 0)
    .filter((r) => !query.loadMin || (r.scores.load ?? 100) > 0)
    .filter((r) => !query.heightMin || (r.scores.height ?? 100) > 0)
    .filter((r) => !query.powerKVMin || (r.scores.powerKV ?? 100) > 0)
    .sort((a, b) => b.totalScore - a.totalScore);

  return results;
}
