/**
 * AI 智能助手 — 自然语言筛选政策与载体
 */
import { useState, useCallback } from "react";
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

function policyToHtml(policies: PolicyItem[]): string {
  if (!policies.length) return "<p>暂无匹配政策</p>";
  const rows = policies.map((p) => {
    const amount = p.amount_s
      ? p.amount_s === "待定"
        ? "待定"
        : /万|元/.test(p.amount_s)
        ? `${p.amount_s}`
        : `${p.amount_s}万元`
      : "—";
    const end = p.end_date ? `📅 ${p.end_date.substring(0, 10)}` : "📅 长期有效";
    return `<tr>
      <td style="padding:8px;border:1px solid #ddd;max-width:260px">
        <strong>${p.stars ? "⭐".repeat(p.stars) + " " : ""}${p.name || "—"}</strong>
        ${p.expired ? "<br><em style='color:#999'>已过期</em>" : ""}
      </td>
      <td style="padding:8px;border:1px solid #ddd">${amount}</td>
      <td style="padding:8px;border:1px solid #ddd">${p.industry || "—"}</td>
      <td style="padding:8px;border:1px solid #ddd">${p.cap || "—"}</td>
      <td style="padding:8px;border:1px solid #ddd">${end}</td>
    </tr>`;
  }).join("");
  return `<table style="border-collapse:collapse;width:100%;font-size:13px">
  <thead><tr style="background:#f0f4ff">
    <th style="padding:8px;border:1px solid #ddd;text-align:left">政策名称</th>
    <th style="padding:8px;border:1px solid #ddd">补贴金额</th>
    <th style="padding:8px;border:1px solid #ddd">行业</th>
    <th style="padding:8px;border:1px solid #ddd">申报条件</th>
    <th style="padding:8px;border:1px solid #ddd">截止日期</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

export default function AIAssistant() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [filters, setFilters] = useState<AiFilters | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setExpanded(false);
    try {
      const f = await aiSearch(query.trim());
      setFilters(f);
      const [pols, props] = await Promise.all([
        fetchPolicies(f),
        fetchProperties(f),
      ]);
      pols.sort((a, b) => matchScore(b, f) - matchScore(a, f));
      pols.forEach((p) => {
        const reasons: string[] = [];
        if (f.area && (p.name || "").includes(f.area)) reasons.push(`区域:${f.area}`);
        if (f.industry && (p.industry || "").includes(f.industry)) reasons.push(`行业:${f.industry}`);
        if (f.cap) reasons.push(`补贴:${f.cap}+`);
        p._reasons = reasons;
        p.stars = Math.min(matchScore(p, f), 5);
      });
      setPolicies(pols);
      setProperties(props);
      setExpanded(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleExport = () => {
    const policyHtml = policyToHtml(policies);
    const propRows = properties.length
      ? properties.map((p) => `<tr>
    <td style="padding:8px;border:1px solid #ddd">${p.name || "—"}</td>
    <td style="padding:8px;border:1px solid #ddd">${p.park || "—"}</td>
    <td style="padding:8px;border:1px solid #ddd">${p.area || "—"}</td>
    <td style="padding:8px;border:1px solid #ddd">${p.industry || "—"}</td>
    <td style="padding:8px;border:1px solid #ddd">${p.price || "—"}</td>
  </tr>`).join("")
      : "";
    const propTable = properties.length
      ? `<table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:12px">
  <thead><tr style="background:#f0f4ff">
    <th style="padding:8px;border:1px solid #ddd;text-align:left">载体名称</th>
    <th style="padding:8px;border:1px solid #ddd">园区</th>
    <th style="padding:8px;border:1px solid #ddd">面积</th>
    <th style="padding:8px;border:1px solid #ddd">行业</th>
    <th style="padding:8px;border:1px solid #ddd">价格</th>
  </tr></thead>
  <tbody>${propRows}</tbody>
</table>`
      : "";
    const filterLine = filters
      ? Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" | ")
      : "";
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>AI匹配结果</title>
<style>body{padding:24px;font-family:sans-serif}h2{color:#3b6db5;margin-top:20px}th{background:#f0f4ff}</style>
</head><body>
<h1 style="color:#3b6db5">AI 智能匹配结果</h1>
<p><strong>查询：</strong>${query}</p>
${filterLine ? `<p style="color:#666">解析条件：${filterLine}</p>` : ""}
<h2>政策匹配（${policies.length} 条）</h2>
${policyHtml}
${propTable ? `<h2>物业载体（${properties.length} 条）</h2>${propTable}` : ""}
<p style="margin-top:24px;color:#999;font-size:12px">
  生成时间：${new Date().toLocaleString("zh-CN")} · 浦发集团招商平台
</p>
</body></html>`;
    openPrintHtmlRaw(html);
  };

  return (
    <div className="ai-assistant">
      <div className="ai-header">
        <div className="ai-title">
          <span>🤖</span>
          <span>AI 智能匹配</span>
        </div>
        <p className="ai-desc">
          用自然语言描述需求，AI 帮你筛选匹配的政策与载体
        </p>
      </div>

      <div className="ai-input-row">
        <input
          className="ai-input"
          type="text"
          placeholder="🔍 如：张江附近AI企业，补贴超过100万"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          disabled={loading}
        />
        <button
          className="ai-btn"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
        >
          {loading ? "分析中..." : "搜索"}
        </button>
      </div>

      {error && (
        <div className="ai-error">
          <span>⚠️ {error}</span>
        </div>
      )}

      {expanded && (
        <>
          {filters && Object.values(filters).some(Boolean) && (
            <div className="ai-filters">
              解析条件：
              {filters.area && <span className="ai-filter-tag">{filters.area}</span>}
              {filters.industry && <span className="ai-filter-tag">{filters.industry}</span>}
              {filters.cap && <span className="ai-filter-tag">≥{filters.cap}</span>}
              {filters.keywords && <span className="ai-filter-tag">{filters.keywords}</span>}
            </div>
          )}

          <div className="ai-results-count">
            <span>政策 <strong>{policies.length}</strong> 条</span>
            <span>载体 <strong>{properties.length}</strong> 条</span>
            {policies.length > 0 && (
              <button className="ai-export-btn" onClick={handleExport}>
                📄 导出 PDF
              </button>
            )}
          </div>

          <div className="ai-results">
            {policies.length === 0 && properties.length === 0 && (
              <div className="ai-empty">未找到匹配结果，试试换一种描述方式</div>
            )}

            {policies.length > 0 && (
              <div className="ai-section">
                <div className="ai-section-title">📋 政策匹配</div>
                {policies.slice(0, 10).map((p, i) => (
                  <div key={i} className="ai-policy-card">
                    <div className="ai-policy-name">
                      {p.stars ? (
                        <span className="ai-stars">{"★".repeat(p.stars)}</span>
                      ) : null}
                      {p.name || "—"}
                      {p.expired && <span className="ai-expired">已过期</span>}
                    </div>
                    <div className="ai-policy-meta">
                      {p.amount_s && (
                        <span>
                          💰{" "}
                          {p.amount_s === "待定"
                            ? "待定"
                            : /万|元/.test(p.amount_s)
                            ? p.amount_s
                            : `${p.amount_s}万元`}
                        </span>
                      )}
                      {p.industry && <span>🏭 {p.industry}</span>}
                      {p.cap && <span>💡 {p.cap}</span>}
                      {p.end_date && <span>📅 {p.end_date.substring(0, 10)}</span>}
                    </div>
                    {p._reasons && p._reasons.length > 0 && (
                      <div className="ai-policy-reasons">
                        {p._reasons.join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
                {policies.length > 10 && (
                  <div className="ai-more">还有 {policies.length - 10} 条结果</div>
                )}
              </div>
            )}

            {properties.length > 0 && (
              <div className="ai-section">
                <div className="ai-section-title">🏢 物业载体</div>
                {properties.slice(0, 10).map((p, i) => (
                  <div key={i} className="ai-policy-card">
                    <div className="ai-policy-name">{p.name || "—"}</div>
                    <div className="ai-policy-meta">
                      {p.park && <span>📍 {p.park}</span>}
                      {p.area && <span>📐 {p.area}</span>}
                      {p.price && <span>💵 {p.price}</span>}
                      {p.industry && <span>🏭 {p.industry}</span>}
                    </div>
                  </div>
                ))}
                {properties.length > 10 && (
                  <div className="ai-more">还有 {properties.length - 10} 条结果</div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
