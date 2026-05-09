// 通用缓存工具

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_PREFIX = "pm_cache_";
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch { return null; }
}

export function setCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* storage full or unavailable */ }
}

export async function cacheOrRefresh<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) {
    console.log('[cacheOrRefresh] Using cached data for', key);
    fetcher().then(data => { console.log('[cacheOrRefresh] Background refresh OK for', key); setCache(key, data); }).catch(e => { console.warn('[cacheOrRefresh] Background refresh failed for', key, e); });
    return cached;
  }
  const data = await fetcher();
  setCache(key, data);
  return data;
}