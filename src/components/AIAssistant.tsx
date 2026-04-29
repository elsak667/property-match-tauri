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
  days_left?: number;
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

function Spinner() {
  return (
    <div className="ai-spinner">
      <div className="ai-spinner-ring" />
      <span>AI 分析中...</span>
    </div>
  );
}

export default function AIAssistant() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [filters, setFilters] = useState<AiFilters | null>(null);
  const [done, setDone] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setDone(false);
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
      setDone(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleExport = () => {
    const policyRows = policies.map((p) => {
      const amount = p.amount_s
        ? p.amount_s === "待定"
          ? "待定"
          : /万|元/.test(p.amount_s) ? p.amount_s : `${p.amount_s}万元`
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

    const filterLine = filters ? Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" | ") : "";
    const propTable = properties.length
      ? `<h2 style="color:#3b6db5;margin-top:24px">物业载体（${properties.length} 条）</h2>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <thead><tr style="background:#f0f4ff">
      <th style="padding:8px;border:1px solid #ddd;text-align:left">载体名称</th>
      <th style="padding:8px;border:1px solid #ddd">园区</th>
      <th style="padding:8px;border:1px solid #ddd">面积</th>
      <th style="padding:8px;border:1px solid #ddd">价格</th>
    </tr></thead><tbody>${propRows}</tbody></table>`
      : "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI匹配结果</title>
<style>body{padding:24px;font-family:sans-serif}h2{color:#3b6db5;margin-top:20px}th{background:#f0f4ff}</style>
</head><body>
<h1 style="color:#3b6db5">AI 智能匹配结果</h1>
<p><strong>查询：</strong>${query}</p>
${filterLine ? `<p style="color:#888">解析条件：${filterLine}</p>` : ""}
<h2>政策匹配（${policies.length} 条）</h2>
<table style="border-collapse:collapse;width:100%;font-size:13px">
  <thead><tr style="background:#f0f4ff">
    <th style="padding:8px;border:1px solid #ddd;text-align:left">政策名称</th>
    <th style="padding:8px;border:1px solid #ddd">补贴金额</th>
    <th style="padding:8px;border:1px solid #ddd">行业</th>
    <th style="padding:8px;border:1px solid #ddd">申报条件</th>
    <th style="padding:8px;border:1px solid #ddd">截止日期</th>
  </tr></thead><tbody>${policyRows}</tbody></table>
${propTable}
<p style="margin-top:24px;color:#999;font-size:12px">生成时间：${new Date().toLocaleString("zh-CN")} · 浦发集团招商平台</p>
</body></html>`;
    openPrintHtmlRaw(html);
  };

  const activeFilters = filters ? Object.entries(filters).filter(([, v]) => v) : [];

  return (
    <div className="ai-card">
      {/* 搜索区域 */}
      <div className="ai-search-wrap">
        <div className="ai-icon-badge">🤖</div>
        <h2 className="ai-heading">AI 智能匹配</h2>
        <p className="ai-subheading">用自然语言描述您的招商需求，AI 自动解析并匹配政策与物业载体</p>
        <div className="ai-search-box">
          <input
            className="ai-search-input"
            type="text"
            placeholder="例如：张江附近人工智能企业，补贴超过100万的政策"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            disabled={loading}
          />
          <button
            className="ai-search-btn"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
          >
            {loading ? (
              <span className="ai-btn-spinner" />
            ) : (
              <span>搜索</span>
            )}
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && <Spinner />}

      {/* 错误提示 */}
      {error && (
        <div className="ai-msg ai-msg-error">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* 结果区域 */}
      {done && (
        <div className="ai-result-wrap">
          {/* 统计栏 */}
          <div className="ai-stat-bar">
            <div className="ai-stat-item">
              <div className="ai-stat-num">{policies.length}</div>
              <div className="ai-stat-label">政策</div>
            </div>
            <div className="ai-stat-divider" />
            <div className="ai-stat-item">
              <div className="ai-stat-num">{properties.length}</div>
              <div className="ai-stat-label">载体</div>
            </div>
            {activeFilters.length > 0 && (
              <>
                <div className="ai-stat-divider" />
                <div className="ai-filter-chips">
                  {activeFilters.map(([k, v]) => (
                    <span key={k} className="ai-chip">{v}</span>
                  ))}
                </div>
              </>
            )}
            {policies.length > 0 && (
              <button className="ai-export-btn" onClick={handleExport}>
                📄 导出 PDF
              </button>
            )}
          </div>

          {/* 无结果 */}
          {policies.length === 0 && properties.length === 0 && (
            <div className="ai-empty-state">
              <div className="ai-empty-icon">🔍</div>
              <div className="ai-empty-text">未找到匹配结果</div>
              <div className="ai-empty-hint">试试换一种描述方式，或调整筛选条件</div>
            </div>
          )}

          {/* 政策列表 */}
          {policies.length > 0 && (
            <div className="ai-section">
              <div className="ai-section-head">
                <span className="ai-section-icon">📋</span>
                <span className="ai-section-label">匹配政策</span>
                <span className="ai-section-count">{policies.length} 条</span>
              </div>
              <div className="ai-list">
                {policies.slice(0, 8).map((p, i) => (
                  <div key={i} className={`ai-list-item${p.expired ? " expired" : ""}`}>
                    <div className="ai-item-top">
                      <div className="ai-item-title">
                        {p.stars ? (
                          <span className="ai-stars">{"★".repeat(p.stars)}</span>
                        ) : null}
                        {p.name || "—"}
                      </div>
                      {p.expired && <span className="ai-badge ai-badge-expired">已过期</span>}
                    </div>
                    <div className="ai-item-tags">
                      {p.amount_s && (
                        <span className="ai-tag ai-tag-money">
                          💰 {p.amount_s === "待定" ? "待定" : /万|元/.test(p.amount_s) ? p.amount_s : `${p.amount_s}万元`}
                        </span>
                      )}
                      {p.industry && <span className="ai-tag ai-tag-industry">🏭 {p.industry}</span>}
                      {p.cap && <span className="ai-tag ai-tag-cap">💡 {p.cap}</span>}
                      {p.end_date && (
                        <span className="ai-tag ai-tag-date">📅 {p.end_date.substring(0, 10)}</span>
                      )}
                    </div>
                    {p._reasons && p._reasons.length > 0 && (
                      <div className="ai-match-reason">{p._reasons.join(" · ")}</div>
                    )}
                  </div>
                ))}
                {policies.length > 8 && (
                  <div className="ai-list-more">还有 {policies.length - 8} 条政策，点击导出 PDF 查看全部</div>
                )}
              </div>
            </div>
          )}

          {/* 载体列表 */}
          {properties.length > 0 && (
            <div className="ai-section">
              <div className="ai-section-head">
                <span className="ai-section-icon">🏢</span>
                <span className="ai-section-label">物业载体</span>
                <span className="ai-section-count">{properties.length} 条</span>
              </div>
              <div className="ai-list">
                {properties.slice(0, 8).map((p, i) => (
                  <div key={i} className="ai-list-item ai-list-item-prop">
                    <div className="ai-item-top">
                      <div className="ai-item-title">{p.name || "—"}</div>
                    </div>
                    <div className="ai-item-tags">
                      {p.park && <span className="ai-tag ai-tag-area">📍 {p.park}</span>}
                      {p.area && <span className="ai-tag ai-tag-size">📐 {p.area}</span>}
                      {p.price && <span className="ai-tag ai-tag-money">💵 {p.price}</span>}
                      {p.industry && <span className="ai-tag ai-tag-industry">🏭 {p.industry}</span>}
                    </div>
                  </div>
                ))}
                {properties.length > 8 && (
                  <div className="ai-list-more">还有 {properties.length - 8} 条载体</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}