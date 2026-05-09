// 政策数据解析工具函数

import {
  IND_LABEL_MAP,
  CAPS_K_MAP,
  THRESHOLD_K_MAP,
  INDUSTRY_ORDER,
} from "./constants";
import type { Policy, FilterOptions } from "./types";

// ── 解析函数 ────────────────────────────────────────────────────────────────

export function industryToKs(raw: string): string[] {
  if (!raw) return [];
  const result: string[] = [];
  for (const part of raw.split(/\s*\/\s*/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const k = IND_LABEL_MAP[trimmed];
    if (k) result.push(k);
  }
  return result;
}

export function classifySubject(raw: string): string[] {
  if (!raw) return ["enterprise"];
  if (raw.includes("社会组织") && !raw.includes("企业") && !raw.includes("个人")) return ["social_org"];
  if (raw.includes("企业")) {
    if (raw.includes("个人")) return ["enterprise", "individual"];
    return ["enterprise"];
  }
  if (raw.includes("个人") || raw.includes("居民") || raw.includes("自然人")) return ["individual"];
  return ["enterprise"];
}

export function capsToKs(capRaw: string): string[] {
  if (!capRaw) return [];
  const result: string[] = [];
  for (const part of capRaw.split(/\s*\/\s*|\s*■\s*/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const k = CAPS_K_MAP[trimmed];
    if (k) result.push(k);
  }
  return result;
}

export function thresholdToKs(thresholdRaw: string): string[] {
  if (!thresholdRaw || thresholdRaw === "[待复核]") return [];
  const result: string[] = [];
  for (const part of thresholdRaw.split(/\s*\/\s*/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const k = THRESHOLD_K_MAP[trimmed];
    if (k && k !== "unlimited") result.push(k);
  }
  return result;
}

export function parseDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  try {
    if (v instanceof Date) return v;
    if (typeof v === "string" && v.length >= 10) {
      return new Date(v.substring(0, 10) + "T00:00:00");
    }
  } catch { /* ignore */ }
  return null;
}

export function stripHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export function getField(row: unknown[], headers: string[], key: string): string {
  const idx = headers.findIndex(h => h.toLowerCase() === key.toLowerCase());
  if (idx < 0 || idx >= row.length) return "";
  const val = row[idx];
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val)) {
    const parts: string[] = [];
    for (const item of val) {
      if (typeof item === "object" && item !== null && "text" in item) {
        parts.push(String((item as {text: unknown}).text || ""));
      } else {
        parts.push(String(item));
      }
    }
    return parts.join("");
  }
  return String(val);
}

export function parseFeishuRichText(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") {
    try {
      const outer = JSON.parse(val);
      if (Array.isArray(outer) && outer.length > 0) {
        const first = outer[0];
        if (typeof first === "object" && first !== null && "text" in first) {
          const innerText = String((first as {text: unknown}).text || "");
          try {
            const inner = JSON.parse(innerText);
            if (Array.isArray(inner)) {
              return inner.map(item =>
                typeof item === "object" && item !== null ? String((item as {text: unknown}).text || "") : String(item)
              ).join("");
            }
          } catch { /* not JSON */ }
          return innerText;
        }
        return String(first);
      }
      return String(outer);
    } catch { return val; }
  }
  if (Array.isArray(val)) {
    const parts: string[] = [];
    for (const item of val) {
      if (typeof item === "object" && item !== null && "text" in item) {
        parts.push(String((item as {text: unknown}).text || ""));
      }
    }
    return parts.join("");
  }
  return String(val);
}

// ── 过滤器构建 ──────────────────────────────────────────────────────────────

export function buildFilterOptions(policies: Policy[]): FilterOptions {
  const industrySet = new Set<string>();
  const capSet = new Set<string>();
  const thresholdSet = new Set<string>();
  const deptMap = new Map<string, number>();
  const catMap = new Map<string, number>();

  for (const p of policies) {
    if (p.industry && !["X", "[待复核]", "[已下架]"].includes(p.industry)) {
      for (const part of p.industry.split(/\s*\/\s*/)) {
        const trimmed = part.trim();
        if (trimmed && !["[待复核]"].includes(trimmed)) industrySet.add(trimmed);
      }
    }
    if (p.cap && !["X", "[待复核]"].includes(p.cap)) {
      for (const part of p.cap.split(/\s*\/\s*/)) {
        const trimmed = part.trim();
        if (trimmed && !["[待复核]"].includes(trimmed)) capSet.add(trimmed);
      }
    }
    if (p.threshold && !["X", "无限定", "[待复核]"].includes(p.threshold)) {
      for (const part of p.threshold.split(/\s*\/\s*/)) {
        const trimmed = part.trim();
        if (trimmed) thresholdSet.add(trimmed);
      }
    }
    if (p.dept) {
      deptMap.set(p.dept, (deptMap.get(p.dept) || 0) + 1);
    }
    if (p.specialCat) {
      catMap.set(p.specialCat, (catMap.get(p.specialCat) || 0) + 1);
    }
  }

  const sortedIndustries = Array.from(industrySet).sort(
    (a, b) => {
      const ai = INDUSTRY_ORDER.indexOf(a);
      const bi = INDUSTRY_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }
  );

  return {
    industries: sortedIndustries.filter(l => l !== "质量标杆").map(l => ({ k: IND_LABEL_MAP[l] || l, l })),
    caps: Array.from(capSet).sort().map(l => ({ k: CAPS_K_MAP[l] || l, l })),
    thresholds: Array.from(thresholdSet).filter(l => l !== "人才").sort().map(l => ({
      k: THRESHOLD_K_MAP[l] || l, l
    })),
    depts: Array.from(deptMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([l, cnt]) => ({ k: l, l, cnt })),
    cats: Array.from(catMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([l, cnt]) => ({ k: l, l, cnt })),
  };
}

export function fmtDate(d: Date | null): string {
  if (!d) return "长期有效";
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, "0")}月${String(d.getDate()).padStart(2, "0")}日`;
}
