import { useState, useEffect, useCallback } from "react";
import { openPrintHtml } from "../../lib/pdfgen_new";
import { filterPolicies } from "./mockData";
import { usePolicies } from "../../lib/useFeishu";
import { Icon } from "../../components/Icons";
import type { PolicyResult } from "./types";
import { trackExport, trackClick, trackSearch, trackDetail, trackCopy } from "../../lib/track";

const API_BASE = import.meta.env.VITE_API_BASE || "";

function stripHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function PolicyCard({
  item,
  expanded,
  selected,
  onToggleExpand,
  onToggleSelect,
}: {
  item: PolicyResult;
  expanded: Set<string>;
  selected: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string) => void;
}) {
  const name = item.name || "";
  const isExpanded = expanded.has(name);
  const isSelected = selected.has(name);
  const daysLeft = item.days_left;
  const isUrgent = daysLeft > 0 && daysLeft <= 30;

  async function handleCopy() {
    const summary = `${item.name || ""}
最高补贴：${item.amount_s || "—"}
申报截止：${item.end_date ? item.end_date.substring(0, 10) : "长期有效"}
发布单位：${item.dept || "—"}
适用区域：${item.area || "浦东新区"}`;
    try {
      await navigator.clipboard.writeText(summary);
      trackCopy(name);
    } catch { /* ignore */ }
  }

  return (
    <div
      className={`result-item${isExpanded ? " expanded" : ""}${isSelected ? " selected" : ""}`}
      style={{ opacity: item.expired ? ".6" : "1" }}
    >
      <div className="result-top">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", flex: 1 }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => { onToggleSelect(name); trackClick(name); }}
            style={{ marginTop: "3px", cursor: "pointer" }}
            aria-label={name}
          />
          <div className="result-name">{item.stars} {name}</div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
          {isUrgent && <span className="hot-badge"><Icon.zapAccent /> 即将截止</span>}
          {item.expired && <span className="expired-badge"><Icon.xCircle /> 已过期</span>}
          <button className="expand-hint" onClick={() => onToggleExpand(name)} aria-expanded={isExpanded}>
            {isExpanded ? "收起 ▲" : "展开 ▼"}
          </button>
        </div>
      </div>
      <div className="result-meta compact">
        <span className="meta-main">
          {item.amount_s ? item.amount_s === "待定" ? <><Icon.lightbulb /> 待定</> : /万|元/.test(item.amount_s) ? <><Icon.lightbulb /> {item.amount_s}</> : <><Icon.lightbulb /> {item.amount_s}万元</> : "—"}
        </span>
        {item.industry && <span><Icon.industry /> {item.industry}</span>}
        {item.subject && <span><Icon.users /> {item.subject}</span>}
        {item.cap && <span><Icon.lightbulb /> {item.cap}</span>}
        <span className={`meta-date${isUrgent ? " urgent" : ""}`}>
          {item.end_date ? <><Icon.calendarDays /> {item.end_date.substring(0, 10)}</> : <><Icon.calendarDays /> 长期有效</>}
          {daysLeft > 0 && daysLeft < 365 && !item.expired && ` (${daysLeft}天)`}
        </span>
      </div>
      {item._reasons && item._reasons.length > 0 && (
        <div className="result-match-reason">{item._reasons.join(" · ")}</div>
      )}
      {isExpanded && (
        <div className="result-details">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: "2px 10px" }}
              onClick={handleCopy}
            >
              📋 复制摘要
            </button>
          </div>
          <div className="detail-section">
            <div className="detail-title">基本信息</div>
            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">最高补贴</span><span className="detail-value">{item.amount_s || "—"}</span></div>
              <div className="detail-item"><span className="detail-label">申报截止</span><span className="detail-value">{item.end_date ? item.end_date.substring(0, 10) : "长期有效"}</span></div>
              {item.zcReleaseTime && <div className="detail-item"><span className="detail-label">发布时间</span><span className="detail-value">{item.zcReleaseTime?.substring(0, 10) || "—"}</span></div>}
              <div className="detail-item"><span className="detail-label">适用区域</span><span className="detail-value">{item.area || "浦东新区"}</span></div>
              <div className="detail-item"><span className="detail-label">发布单位</span><span className="detail-value">{item.dept || "—"}</span></div>
              <div className="detail-item"><span className="detail-label">兑现方式</span><span className="detail-value">{item.method || "—"}</span></div>
            </div>
          </div>
          {item.policyObject && (
            <div className="detail-section">
              <div className="detail-title">政策对象</div>
              <div className="detail-text">{stripHtml(item.policyObject)}</div>
            </div>
          )}
          {item.policyCondition && (
            <div className="detail-section">
              <div className="detail-title">申报条件</div>
              <div className="detail-text">{stripHtml(item.policyCondition)}</div>
            </div>
          )}
          {item.paymentStandard && (
            <div className="detail-section">
              <div className="detail-title">扶持标准</div>
              <div className="detail-text">{stripHtml(item.paymentStandard)}</div>
            </div>
          )}
          {item.content && (
            <div className="detail-section">
              <div className="detail-title">政策内容</div>
              <div className="detail-content">{stripHtml(item.content)}</div>
            </div>
          )}
          {item.contactInfo && (
            <div className="detail-section">
              <div className="detail-title">联系方式</div>
              <div className="detail-text">{stripHtml(item.contactInfo)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ToastType = "idle" | "success" | "error" | "info";

interface Toast {
  type: ToastType;
  message: string;
}

export default function PolicyPage() {
  const { policies, options, loading: dataLoading, fromFeishu } = usePolicies();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [dept, setDept] = useState("");
  const [results, setResults] = useState<PolicyResult[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [companyName, setCompanyName] = useState("");
  const [matchLoading, setMatchLoading] = useState(false);
  const [toast, setToast] = useState<Toast>({ type: "idle", message: "" });
  const [showAll, setShowAll] = useState(false);
  const [stats, setStats] = useState<{local数据库:number; 官方总数:number; 匹配率:string; 差异:number; 数据来源:string; 官方链接:string} | null>(null);

  // 加载浦易达官网统计
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`${API_BASE}/api/property-stats`);
        const s = await res.json();
        const localCount = policies.length;
        const officialCount = s.official_count > 0 ? s.official_count : 0;
        setStats({
          local数据库: localCount,
          官方总数: officialCount,
          匹配率: officialCount > 0 ? `${Math.round(localCount / officialCount * 100)}%` : "—",
          差异: officialCount > 0 ? localCount - officialCount : 0,
          数据来源: s.source || "浦易达官网",
          官方链接: s.official_link || "https://pyd.pudong.gov.cn/website/pud/policyretrieval",
        });
      } catch { /* ignore */ }
    }
    fetchStats();
  }, [policies.length]);

  // 同步 policies → results（按发布时间倒序）
  useEffect(() => {
    const sorted = [...policies].sort((a, b) => {
      const ta = a.zcReleaseTime ? new Date(a.zcReleaseTime).getTime() : 0;
      const tb = b.zcReleaseTime ? new Date(b.zcReleaseTime).getTime() : 0;
      return tb - ta; // 最新的在前
    });
    setResults(sorted);
  }, [policies]);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast({ type: "idle", message: "" }), 3500);
  }, []);

  const doMatch = useCallback(() => {
    trackSearch(query);
    setMatchLoading(true);
    const filtered = filterPolicies(policies, {
      query,
      industry: industries[0] || "",
      location,
      dept,
      caps,
    });
    const sorted = [...filtered].sort((a, b) => {
      const ta = a.zcReleaseTime ? new Date(a.zcReleaseTime).getTime() : 0;
      const tb = b.zcReleaseTime ? new Date(b.zcReleaseTime).getTime() : 0;
      return tb - ta;
    });
    setResults(sorted);
    setMatchLoading(false);
  }, [policies, query, industries, location, dept, caps]);

  const handleToggleExpand = useCallback((name: string) => {
    trackDetail(name);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(doMatch, 300);
    return () => clearTimeout(t);
  }, [doMatch]);

  function toggleTag(arr: string[], setArr: (v: string[]) => void, k: string) {
    setArr(arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k]);
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(results.map(r => r.name).filter(Boolean) as string[]));
  }

  function clearSelection() { setSelected(new Set()); }

  function resetAll() {
    setQuery("");
    setLocation("");
    setIndustries([]);
    setCaps([]);
    setDept("");
    setExpanded(new Set());
    setSelected(new Set());
  }

  async function exportPdf() {
    if (selected.size === 0) { showToast("error", "请先选择要导出的政策"); return; }
    const selectedItems = results.filter(r => selected.has(r.name || ""));
    if (selectedItems.length === 0) { showToast("error", "请先选择要导出的政策"); return; }
    trackExport(selectedItems.map(i => i.name || ""));
    await openPrintHtml(selectedItems, companyName || "某企业");
    showToast("info", "浏览器已打开，请在浏览器中打印保存为 PDF");
  }

  const activeFiltersCount = [industries.length > 0, caps.length > 0, !!location, !!dept, !!query.trim()].filter(Boolean).length;
  const hasFilters = activeFiltersCount > 0;
  const isLoading = dataLoading || matchLoading;

  return (
    <div className="container">
      {toast.type !== "idle" && (
        <div className={`toast toast-${toast.type}`} role="alert">
          {toast.type === "success" && <Icon.checkCircle />}
          {toast.type === "error" && <Icon.xCircle />}
          {toast.type === "info" && <Icon.info />}
          {toast.message}
        </div>
      )}

      {/* Hero Banner */}
      <div className="policy-hero-banner">
        <div className="policy-hero-brand">
          <span className="policy-hero-title">政策匹配</span>
          <span className="policy-hero-sub">Policy Intelligence</span>
          <div className="policy-hero-divider" />
          <div className="policy-hero-tagline">数据来源：{stats?.数据来源 || "加载中..."}</div>
        </div>
        <div className="policy-hero-stats">
          <span className="policy-hero-stat">
            <strong>{policies.length}</strong>
            <span>本地政策</span>
          </span>
          <span className="policy-hero-stat-sep">·</span>
          <span className="policy-hero-stat">
            <strong>{stats && stats.官方总数 > 0 ? stats.官方总数 : "—"}</strong>
            <span>官网总数</span>
          </span>
          <span className="policy-hero-stat-sep">·</span>
          <span className="policy-hero-stat">
            <strong style={{ color: "#4ade80" }}>{stats?.匹配率 || "—"}</strong>
            <span>覆盖率</span>
          </span>
          <span className="policy-hero-stat-sep">·</span>
          <span className="policy-hero-stat">
            <strong style={{ color: stats && (stats.差异 as number) >= 0 ? "#4ade80" : "#f87171" }}>
              {stats ? ((stats.差异 as number) >= 0 ? "+" : "") + stats.差异 : "—"}
            </strong>
            <span>差异</span>
          </span>
        </div>
      </div>

      {/* 快速筛选 Chips */}
      <div className="quick-chips">
        <span className="quick-chips-label"><Icon.zapAccent /> 快速筛选</span>
        <div className="chips-row">
          {/* 全部重置 */}
          {hasFilters && (
            <button className="chip-btn chip-reset" onClick={resetAll}>
              <Icon.xCircle /> 重置
            </button>
          )}
          {/* 即将截止 */}
          <button
            className={`chip-btn${query === "即将截止" ? " active" : ""}`}
            onClick={() => setQuery(query === "即将截止" ? "" : "即将截止")}
          >
            <Icon.zapAccent /> 即将截止
          </button>
          {/* 补贴金额高 */}
          <button
            className={`chip-btn${caps.includes("high") ? " active" : ""}`}
            onClick={() => toggleTag(caps, setCaps, "high")}
          >
            <Icon.lightbulb /> 高额补贴
          </button>
          {/* 产业方向 chips */}
          {options.industries.slice(0, 4).map(ind => (
            <button
              key={ind.k}
              className={`chip-btn${industries.includes(ind.k) ? " active" : ""}`}
              onClick={() => toggleTag(industries, setIndustries, ind.k)}
            >
              <Icon.industry /> {ind.l}
            </button>
          ))}
          {/* 区域 chips */}
          {options.locations.slice(0, 3).map(loc => (
            <button
              key={loc.k}
              className={`chip-btn${location === loc.k ? " active" : ""}`}
              onClick={() => setLocation(location === loc.k ? "" : loc.k)}
            >
              <Icon.mapPinAccent /> {loc.l}
            </button>
          ))}
        </div>
      </div>


      <div className="main-layout">
        <aside className="sidebar">
          <div className="filter-section">
            <div className="filter-label"><Icon.searchMuted /> 关键词搜索</div>
            <input
              id="query-input"
              type="text"
              aria-label="关键词搜索"
              placeholder="政策名称，行业关键词..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="search-input"
            />
            <div className="filter-hint">
              共 {policies.length} 条政策
              {fromFeishu && <span style={{ color: "#059669" }}> · 飞书数据</span>}
            </div>
          </div>

          {options.locations.length > 0 && (
            <div className="filter-section">
              <div className="filter-label"><Icon.mapPinAccent /> 适用区域</div>
              <div className="tag-grid">
                {options.locations.map(loc => (
                  <button
                    key={loc.k}
                    className={`tag-btn${location === loc.k ? " active" : ""}`}
                    onClick={() => setLocation(location === loc.k ? "" : loc.k)}
                  >
                    {loc.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {options.industries.length > 0 && (
            <div className="filter-section">
              <div className="filter-label"><Icon.industry /> 产业方向</div>
              <div className="tag-grid">
                {options.industries.map(ind => (
                  <button
                    key={ind.k}
                    className={`tag-btn${industries.includes(ind.k) ? " active" : ""}`}
                    onClick={() => toggleTag(industries, setIndustries, ind.k)}
                  >
                    {ind.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {options.depts.length > 0 && (
            <div className="filter-section">
              <div className="filter-label"><Icon.buildingMuted /> 发布单位</div>
              <select
                className="filter-select"
                value={dept}
                onChange={e => setDept(e.target.value)}
                aria-label="发布单位筛选"
              >
                <option value="">全部</option>
                {options.depts.map(d => <option key={d.k} value={d.k}>{d.l}</option>)}
              </select>
            </div>
          )}

          {options.caps.length > 0 && (
            <div className="filter-section">
              <div className="filter-label"><Icon.zap /> 政策能力</div>
              <div className="tag-grid">
                {options.caps.map(c => (
                  <button
                    key={c.k}
                    className={`tag-btn${caps.includes(c.k) ? " active" : ""}`}
                    onClick={() => toggleTag(caps, setCaps, c.k)}
                  >
                    {c.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          
          <div className="form-actions">
            <button className="btn-secondary" onClick={resetAll}>重置全部</button>
          </div>
          {activeFiltersCount > 0 && (
            <div className="filter-count">已选 {activeFiltersCount} 个筛选条件</div>
          )}
        </aside>

        <main className="content">
          <div className="toolbar">
            <div className="count">
              {isLoading
                ? <>加载中...</>
                : <>共找到 <strong>{results.length}</strong> 条政策，已选 <strong>{selected.size}</strong> 条</>
              }
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              共 {policies.length} 条 · {fromFeishu ? "飞书数据" : "Mock数据"}
            </div>
            <div className="legend">
              {results.length > 5 && (
                <button
                  style={{ fontSize: 12, padding: "2px 10px", cursor: "pointer", background: showAll ? "#e2e8f0" : "#3b6db5", color: showAll ? "#333" : "#fff", border: "none", borderRadius: 4 }}
                  onClick={() => setShowAll(v => !v)}
                >
                  {showAll ? "收起 ▲" : `展开全部 ${results.length} 条 ▼`}
                </button>
              )}
            </div>
          </div>

          {results.length > 0 && selected.size > 0 && (
            <div className="content-footer">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  id="company-input"
                  type="text"
                  aria-label="企业名称"
                  placeholder="输入企业名称（可选）"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  maxLength={50}
                  style={{ maxWidth: "180px", padding: "6px 10px", border: "1.5px solid var(--border-hi)", borderRadius: 8, fontSize: 12 }}
                />
                <button className="btn-primary" onClick={exportPdf}>
                  📥 导出 {selected.size} 条政策
                </button>
                <button className="btn-secondary" onClick={selectAll}>全选</button>
                <button className="btn-secondary" onClick={clearSelection}>清空</button>
              </div>
              <button className="btn-secondary" onClick={doMatch}><Icon.refreshAccent /> 刷新结果</button>
            </div>
          )}

          {/* 即将到期政策高亮区 */}
          {(() => {
            const urgent = policies.filter(p => p.days_left > 0 && p.days_left <= 30 && !p.expired);
            if (urgent.length === 0) return null;
            return (
              <div className="urgent-section">
                <div className="urgent-header">
                  <Icon.zapAccent /> <span>本月即将截止</span>
                  <span className="urgent-count">{urgent.length} 条</span>
                </div>
                <div className="urgent-cards">
                  {urgent.slice(0, 3).map(p => (
                    <div key={p.name} className="urgent-card" onClick={() => handleToggleExpand(p.name || "")}>
                      <div className="urgent-card-name">{p.name}</div>
                      <div className="urgent-card-meta">
                        <span>{p.amount_s || "—"}</span>
                        <span className="urgent-days">{p.days_left} 天后截止</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="result-list">
            {isLoading ? (
              <div className="loading-state">
                <div className="spinner" aria-label="加载中"></div>
                <p>正在加载政策数据...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Icon.file /></div>
                <p>未找到匹配政策</p>
                {hasFilters ? (
                  <>
                    <small>试试调整筛选条件，或缩短关键词</small>
                    <button className="btn-secondary" onClick={resetAll} style={{ marginTop: "12px" }}>
                      重置筛选
                    </button>
                  </>
                ) : query.trim() ? (
                  <small>试试缩短关键词，如只保留核心行业词</small>
                ) : (
                  <small>选择筛选条件后再试</small>
                )}
              </div>
            ) : (
              (showAll ? results : results.slice(0, 5)).map(item => (
                <PolicyCard
                  key={item.name ?? ""}
                  item={item}
                  expanded={expanded}
                  selected={selected}
                  onToggleExpand={handleToggleExpand}
                  onToggleSelect={toggleSelect}
                />
              ))
            )}
          </div>

          {results.length > 0 && selected.size === 0 && (
            <div className="content-footer">
              <button className="btn-primary" onClick={doMatch}><Icon.refreshAccent /> 刷新结果</button>
            </div>
          )}
        </main>
      </div>

      <div className="footer-banner">
        <div className="footer-warning"><Icon.alertWhite /> 本系统为内部测试工具，政策数据来源于政府公开信息，匹配结果仅供参考。</div>
        <div className="footer-credit">浦发集团招商中心 · 仅供内部使用 · 技术支持：Els.J</div>
      </div>
    </div>
  );
}
