/**
 * 飞书数据 Hook — 优先飞书 API，失败时降级到缓存/mock
 */
import { useState, useEffect, useCallback } from "react";
import { loadPolicies, loadIndustries, type Policy } from "./policy";

export function usePolicies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromFeishu, setFromFeishu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadPolicies();
      if (data.length > 0) {
        setPolicies(data);
        setFromFeishu(true);
      }
    } catch (e: any) {
      setError(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { policies, loading, fromFeishu, error, reload: load };
}

export function useIndustries() {
  const [industries, setIndustries] = useState<{ categories: any[] }>({ categories: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadIndustries();
      setIndustries(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { industries, loading };
}
