/**
 * AI 智能助手 — 浮窗气泡模式
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { openPrintHtmlRaw } from "../lib/pdfgen_new";

interface AiFilters {
  area?: string;
  industry?: string;
  cap?: string;
  keywords?: string;
}

interface PolicyItem {
  name?: string;
  amount_s?: string;
  industry?: string;
  subject?: string;
  cap?: string;
  end_date?: string;
  _reasons?: string[];
  expired?: boolean;
  stars?: number;
}

interface PropertyItem {
  name?: string;
  park?: string;
  area?: string;
  price?: string;
  industry?: string;
}

const BASE = "https://api.elsak.eu.org/api";

async function aiSearch(q: string): Promise<AiFilters> {
  const res = await fetch(`${BASE}/ai/search?q=${encodeURIComponent(q)}`);
  const data = await res.json() as { success?: boolean; filters?: AiFilters; error?: string };
  if (!data?.success) throw new Error(data?.error || "AI 解析失败");
  return data.filters ?? {};
}

async function fetchPolicies(filters: AiFilters): Promise<PolicyItem[]> {
  const params = new URLSearchParams();
  if (filters.area) params.set("area", filters.area);
  if (filters.industry) params.set("industry", filters.industry);
  if (filters.cap) params.set("cap", filters.cap);
  if (filters.keywords) params.set("keywords", filters.keywords);
  const res = await fetch(`${BASE}/policies?${params}`);
  const result = await res.json() as { data?: PolicyItem[] };
  return result.data ?? [];
}

async function fetchProperties(filters: AiFilters): Promise<PropertyItem[]> {
  const res = await fetch(`${BASE}/properties?type=单元`);
  const data = await res.json() as PropertyItem[];
  let items = Array.isArray(data) ? data : [];
  if (filters.area) {
    const a = filters.area.toLowerCase();
    items = items.filter((p) =>
      (p.park || "").toLowerCase().includes(a) ||
      (p.name || "").toLowerCase().includes(a)
    );
  }
  if (filters.industry) {
    const i = filters.industry.toLowerCase();
    items = items.filter((p) => (p.industry || "").toLowerCase().includes(i));
  }
  if (filters.keywords) {
    const k = filters.keywords.toLowerCase();
    items = items.filter((p) =>
      (p.name || "").toLowerCase().includes(k) ||
      (p.park || "").toLowerCase().includes(k) ||
      (p.industry || "").toLowerCase().includes(k)
    );
  }
  return items.slice(0, 20);
}

function matchScore(item: PolicyItem, filters: AiFilters): number {
  let score = 0;
  if (filters.area) {
    const a = filters.area.toLowerCase();
    if ((item.name || "").toLowerCase().includes(a)) score += 2;
    if ((item.industry || "").toLowerCase().includes(a)) score += 1;
  }
  if (filters.industry) {
    const i = filters.industry.toLowerCase();
    if ((item.industry || "").toLowerCase().includes(i)) score += 3;
    if ((item.subject || "").toLowerCase().includes(i)) score += 2;
    if ((item.name || "").toLowerCase().includes(i)) score += 1;
  }
  if (filters.cap) {
    const capNum = parseFloat(filters.cap);
    if (!isNaN(capNum) && item.amount_s) {
      const amountNum = parseFloat(item.amount_s);
      if (!isNaN(amountNum) && amountNum >= capNum) score += 2;
    }
  }
  return score;
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [filters, setFilters] = useState<AiFilters | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const f = await aiSearch(query.trim());
      setFilters(f);
      const [pols, props] = await Promise.all([fetchPolicies(f), fetchProperties(f)]);
      pols.sort((a, b) => matchScore(b, f) - matchScore(a, f));
      pols.forEach((p) => {
        const reasons: string[] = [];
        if (f.area && (p.name || "").includes(f.area)) reasons.push(`区域:${f.area}`);
        if (f.industry && (p.industry || "").includes(f.industry)) reasons.push(`行业:${f.industry}`);
        if (f.cap) reasons.push(`补贴≥${f.cap}`);
        p._reasons = reasons;
        p.stars = Math.min(matchScore(p, f), 5);
      });
      setPolicies(pols);
      setProperties(props);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleExport = () => {
    const policyRows = policies.map((p) => {
      const amount = p.amount_s
        ? p.amount_s === "待定" ? "待定" : /万|元/.test(p.amount_s) ? p.amount_s : `${p.amount_s}万元`
        : "—";
      const end = p.end_date ? p.end_date.substring(0, 10) : "长期有效";
      return `<tr>
        <td style="padding:8px;border:1px solid #ddd"><strong>${p.stars ? "⭐".repeat(p.stars) + " " : ""}${p.name || "—"}</strong>${p.expired ? "<br><em style='color:#999'>已过期</em>" : ""}</td>
        <td style="padding:8px;border:1px solid #ddd">${amount}</td>
        <td style="padding:8px;border:1px solid #ddd">${p.industry || "—"}</td>
        <td style="padding:8px;border:1px solid #ddd">${p.cap || "—"}</td>
        <td style="padding:8px;border:1px solid #ddd">📅 ${end}</td>
      </tr>`;
    }).join("");

    const propRows = properties.map((p) => `<tr>
      <td style="padding:8px;border:1px solid #ddd">${p.name || "—"}</td>
      <td style="padding:8px;border:1px solid #ddd">${p.park || "—"}</td>
      <td style="padding:8px;border:1px solid #ddd">${p.area || "—"}</td>
      <td style="padding:8px;border:1px solid #ddd">${p.price || "—"}</td>
    </tr>`).join("");

    const propTable = properties.length
      ? `<h2 style="color:#3b6db5;margin-top:20px">物业载体（${properties.length} 条）</h2>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <thead><tr style="background:#f0f4ff"><th style="padding:8px;border:1px solid #ddd;text-align:left">名称</th><th style="padding:8px;border:1px solid #ddd">园区</th><th style="padding:8px;border:1px solid #ddd">面积</th><th style="padding:8px;border:1px solid #ddd">价格</th></tr></thead><tbody>${propRows}</tbody></table>`
      : "";

    const filterLine = filters ? Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" | ") : "";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI匹配结果</title>
<style>body{padding:24px}h2{color:#3b6db5;margin-top:20px}th{background:#f0f4ff}</style></head><body>
<h1 style="color:#3b6db5">AI 智能匹配结果</h1><p><strong>查询：</strong>${query}</p>
${filterLine ? `<p style="color:#888">解析条件：${filterLine}</p>` : ""}
<h2>政策匹配（${policies.length} 条）</h2>
<table style="border-collapse:collapse;width:100%;font-size:13px">
  <thead><tr style="background:#f0f4ff"><th style="padding:8px;border:1px solid #ddd;text-align:left">政策名称</th><th style="padding:8px;border:1px solid #ddd">补贴</th><th style="padding:8px;border:1px solid #ddd">行业</th><th style="padding:8px;border:1px solid #ddd">条件</th><th style="padding:8px;border:1px solid #ddd">截止</th></tr></thead><tbody>${policyRows}</tbody></table>
${propTable}
<p style="margin-top:20px;color:#999;font-size:12px">${new Date().toLocaleString("zh-CN")} · 浦发集团招商平台</p>
</body></html>`;
    openPrintHtmlRaw(html);
  };

  return (
    <>
      {/* 浮窗气泡按钮 */}
      <button className="ai-fab" onClick={() => setOpen(!open)} aria-label="AI助手">
        <span className="ai-fab-icon">{open ? "✕" : "🤖"}</span>
        {policies.length > 0 && !open && <span className="ai-fab-dot" />}
      </button>

      {/* 浮窗面板 */}
      {open && (
        <div className="ai-panel" ref={panelRef}>
          <div className="ai-panel-header">
            <span>🤖</span>
            <span className="ai-panel-title">AI 智能匹配</span>
            <button className="ai-panel-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="ai-panel-search">
            <input
              className="ai-panel-input"
              type="text"
              placeholder="描述您的需求，如：张江AI企业100万补贴"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={loading}
            />
            <button className="ai-panel-btn" onClick={handleSearch} disabled={loading || !query.trim()}>
              {loading ? "..." : "🔍"}
            </button>
          </div>

          {error && <div className="ai-panel-error">⚠️ {error}</div>}

          {(policies.length > 0 || properties.length > 0) && (
            <div className="ai-panel-body">
              <div className="ai-panel-summary">
                <span>政策 <strong>{policies.length}</strong></span>
                <span>载体 <strong>{properties.length}</strong></span>
                {policies.length > 0 && (
                  <button className="ai-panel-export" onClick={handleExport}>📄 PDF</button>
                )}
              </div>

              {policies.slice(0, 5).map((p, i) => (
                <div key={i} className={`ai-panel-item${p.expired ? " expired" : ""}`}>
                  <div className="ai-panel-item-name">
                    {p.stars ? <span className="ai-star">{"★".repeat(p.stars)}</span> : null}
                    {p.name || "—"}
                    {p.expired && <span className="ai-expired-tag">已过期</span>}
                  </div>
                  <div className="ai-panel-item-meta">
                    {p.amount_s && <span>💰 {p.amount_s === "待定" ? "待定" : /万|元/.test(p.amount_s) ? p.amount_s : `${p.amount_s}万元`}</span>}
                    {p.industry && <span>🏭 {p.industry}</span>}
                    {p.end_date && <span>📅 {p.end_date.substring(0, 10)}</span>}
                  </div>
                  {p._reasons && p._reasons.length > 0 && (
                    <div className="ai-panel-reason">{p._reasons.join(" · ")}</div>
                  )}
                </div>
              ))}

              {policies.length > 5 && (
                <div className="ai-panel-more">还有 {policies.length - 5} 条，点击 PDF 导出查看</div>
              )}

              {properties.length > 0 && (
                <>
                  <div className="ai-panel-divider" />
                  <div className="ai-panel-section-label">🏢 物业载体</div>
                  {properties.slice(0, 3).map((p, i) => (
                    <div key={i} className="ai-panel-item ai-panel-item-prop">
                      <div className="ai-panel-item-name">{p.name || "—"}</div>
                      <div className="ai-panel-item-meta">
                        {p.park && <span>📍 {p.park}</span>}
                        {p.area && <span>📐 {p.area}</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {!loading && policies.length === 0 && properties.length === 0 && !error && (
            <div className="ai-panel-hint">
              用自然语言描述您的招商需求，AI 自动匹配政策与物业载体
            </div>
          )}
        </div>
      )}
    </>
  );
}