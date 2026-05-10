import type { Property, IndustryProfiles } from "./types";
import propertiesData from "./properties.json";
import industryData from "./industry_profiles.json";

export const PROPERTIES: Property[] = propertiesData as Property[];
export const INDUSTRY_PROFILES: IndustryProfiles = industryData as IndustryProfiles;

export function filterProperties(
  items: Property[],
  opts: {
    query?: string;
    type?: string;
    areaMin?: number;
    areaMax?: number;
    priceMax?: number;
    loadMin?: number;
    heightMin?: number;
    powerKVMin?: number;
    park?: string;
    is104?: string;
  }
): Property[] {
  const { query, type, areaMin, areaMax, priceMax, loadMin, heightMin, powerKVMin, park, is104 } = opts;
  return items.filter(p => {
    if (query) {
      const q = query.toLowerCase();
      const nameOk = !p.name || p.name.toLowerCase().includes(q);
      const parkOk = !p.park || p.park.toLowerCase().includes(q);
      const typeOk = !p.type || p.type.toLowerCase().includes(q);
      const indOk = !p.industry || p.industry.toLowerCase().includes(q);
      if (!nameOk || !parkOk || !typeOk || !indOk) return false;
    }
    if (type && p.type !== type) return false;
    if (areaMin && p.areaMax != null && p.areaMax < areaMin) return false;
    if (areaMax && p.areaMin != null && p.areaMin > areaMax) return false;
    if (priceMax && p.priceMin != null && p.priceMin > priceMax) return false;
    if (loadMin && p.load != null && p.load < loadMin) return false;
    if (heightMin && p.height != null && p.height < heightMin) return false;
    if (powerKVMin && p.powerKV != null && p.powerKV < powerKVMin) return false;
    if (park && p.park !== park) return false;
    if (is104 && p.is104Block !== is104) return false;
    return true;
  });
}
