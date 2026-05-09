// 物业数据加载与缓存

import { feishuCacheRead, feishuCacheWrite } from "../tauri";
import type { Park, Building, Unit } from "./types";
import { FeishuCredentialsMissing, getSheetAsObjects } from "../policy/feishu";
import { getCached, setCache, cacheOrRefresh } from "../policy/cache";

// ── 飞书数据 ────────────────────────────────────────────────────────────────

const PROPERTY_SPREADSHEET = "X1jRs1PhLhR8WetSwktcM9Fgnhg";
const PROPERTY_SHEET_IDS: Record<string, string> = {
  "园区": "4hdJSg",
  "楼宇": "4hdJSh",
  "单元": "4hdJSi",
  "产业字典": "4hdJSj",
};

// ── 物业数据加载 ───────────────────────────────────────────────────────────

export async function loadPropertyData(): Promise<{ parks: Park[]; buildings: Building[]; units: Unit[] }> {
  return cacheOrRefresh<{ parks: Park[]; buildings: Building[]; units: Unit[] }>("property_data_v2", async () => {
    let parks: Park[], buildings: Building[], units: Unit[];
    try {
      [parks, buildings, units] = await Promise.all([
        getSheetAsObjects<Park>(PROPERTY_SPREADSHEET, PROPERTY_SHEET_IDS["园区"], 3),
        getSheetAsObjects<Building>(PROPERTY_SPREADSHEET, PROPERTY_SHEET_IDS["楼宇"], 3),
        getSheetAsObjects<Unit>(PROPERTY_SPREADSHEET, PROPERTY_SHEET_IDS["单元"], 3),
      ]);
      const result = { parks, buildings, units };
      if (import.meta.env.VITE_USE_WORKERS) {
        setCache("property_data_v2", result);
      } else {
        feishuCacheWrite("property_data_v2", result as unknown as Record<string, unknown>).catch(() => {});
      }
      return result;
    } catch (e) {
      if (e instanceof FeishuCredentialsMissing) {
        console.warn("[loadPropertyData] Feishu credentials missing, trying local cache...");
      }
      const cached = getCached<{ parks: Park[]; buildings: Building[]; units: Unit[] }>("property_data_v2");
      if (cached && (cached.parks?.length > 0 || cached.buildings?.length > 0 || cached.units?.length > 0)) {
        console.log(`[loadPropertyData] Loaded ${cached.units?.length ?? 0} units from local cache`);
        return cached;
      }
      if (!import.meta.env.VITE_USE_WORKERS) {
        try {
          const tauriCached = await feishuCacheRead("property_data_v2") as { parks: Park[]; buildings: Building[]; units: Unit[] } | null;
          if (tauriCached && (tauriCached.parks?.length > 0 || tauriCached.buildings?.length > 0 || tauriCached.units?.length > 0)) {
            console.log(`[loadPropertyData] Loaded ${tauriCached.units?.length ?? 0} units from Tauri cache`);
            return tauriCached;
          }
        } catch {}
      }
      console.warn("[loadPropertyData] No local cache, returning empty data");
      return { parks: [], buildings: [], units: [] };
    }
  });
}

// Re-export for convenience (uses shared getSheetAsObjects from feishu)
export { getSheetAsObjects };

export { FeishuCredentialsMissing } from "../policy/feishu";
