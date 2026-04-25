import { useState, useEffect, useCallback } from "react";
import { generatePdfBytes } from "../../lib/pdfgen_new";
import { savePdf } from "../../lib/tauri";
import { MOCK_POLICIES, MOCK_OPTIONS, filterPolicies } from "./mockData";
import type { PolicyResult, FilterOptions } from "./types";

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
            onChange={() => onToggleSelect(name)}
            style={{ marginTop: "3px", cursor: "pointer" }}
            aria-label={name}
          />
          <div className="result-name">{item.stars} {name}</div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
          {isUrgent && <span className="hot-badge">🔥 即将截止</span>}
          {item.expired && <span className="expired-badge">已过期</span>}
          <button className="expand-hint" onClick={() => onToggleExpand(name)} aria-expanded={isExpanded}>
            {isExpanded ? "收起 ▲" : "展开 ▼"}
          </button>
        </div>
      </div>
      <div className="result-meta compact">
        <span className="meta-main">
          {item.amount_s ? item.amount_s === "待定" ? "💰 待定" : /万|元/.test(item.amount_s) ? `💰 ${item.amount_s}` : `💰 ${item.amount_s}万元` : "—"}
        </span>
        {item.industry && <span>🏭 {item.industry}</span>}
        {item.subject && <span>👥 {item.subject}</span>}
        {item.cap && <span>💡 {item.cap}</span>}
        <span className={`meta-date${isUrgent ? " urgent" : ""}`}>
          {item.end_date ? `📅 ${item.end_date.substring(0, 10)}` : "📅 长期有效"}
          {daysLeft > 0 && daysLeft < 365 && !item.expired && ` (${daysLeft}天)`}
        </span>
      </div>
      {item._reasons.length > 0 && (
        <div className="result-match-reason">{item._reasons.join(" · ")}</div>
      )}
      {isExpanded && (
        <div className="result-details">
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
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [dept, setDept] = useState("");
  const [options] = useState<FilterOptions>(MOCK_OPTIONS);
  const [results, setResults] = useState<PolicyResult[]>(MOCK_POLICIES);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [companyName, setCompanyName] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>({ type: "idle", message: "" });

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast({ type: "idle", message: "" }), 3500);
  }, []);

  const doMatch = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const filtered = filterPolicies(MOCK_POLICIES, query, industries[0] || "", location, dept);
      setResults(filtered);
      setLoading(false);
    }, 300);
  }, [query, industries, location, dept]);

  useEffect(() => {
    const t = setTimeout(doMatch, 300);
    return () => clearTimeout(t);
  }, [doMatch]);

  function toggleTag(arr: string[], setArr: (v: string[]) => void, k: string) {
    setArr(arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k]);
  }

  function toggleExpand(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  }

  function toggleSelect(id: string) {
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
    setDept("");
    setExpanded(new Set());
    setSelected(new Set());
  }

  async function exportPdf() {
    if (selected.size === 0) { showToast("error", "请先选择要导出的政策"); return; }
    const selectedItems = results.filter(r => selected.has(r.name || ""));
    if (selectedItems.length === 0) { showToast("error", "请先选择要导出的政策"); return; }

    try {
      const result = await generatePdfBytes(selectedItems, companyName || "某企业");
      if (!result.success) {
        showToast("error", "PDF 生成失败: " + (result.error || "未知错误"));
        return;
      }
      if (!result.data || !result.filename) {
        showToast("error", "PDF 生成失败：无数据");
        return;
      }
      const saveResult = await savePdf(result.data, result.filename);
      if (!saveResult.success && saveResult.error && saveResult.error !== "用户取消") {
        showToast("error", "保存失败: " + saveResult.error);
      } else if (saveResult.success && saveResult.path) {
        showToast("success", "PDF 已保存至：" + saveResult.path);
      }
    } catch (err: unknown) {
      showToast("error", "导出失败: " + String(err));
    }
  }

  const activeFiltersCount = [industries.length > 0, !!location, !!dept, !!query.trim()].filter(Boolean).length;
  const hasFilters = activeFiltersCount > 0;

  return (
    <div className="container">

      {toast.type !== "idle" && (
        <div className={`toast toast-${toast.type}`} role="alert">
          {toast.type === "success" && "✅ "}
          {toast.type === "error" && "❌ "}
          {toast.type === "info" && "ℹ️ "}
          {toast.message}
        </div>
      )}

      <div className="main-layout">
        <aside className="sidebar">
          <div className="filter-section">
            <div className="filter-label">🔍 关键词搜索</div>
            <input
              id="query-input"
              type="text"
              aria-label="关键词搜索"
              placeholder="政策名称、行业关键词..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="search-input"
            />
            <div className="filter-hint">共 {MOCK_OPTIONS.total} 条政策</div>
          </div>

          {options.locations.length > 0 && (
            <div className="filter-section">
              <div className="filter-label">📍 适用区域</div>
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
              <div className="filter-label">🏭 产业方向</div>
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
              <div className="filter-label">🏛️ 发布单位</div>
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

          <div className="form-actions">
            <button className="btn-secondary" onClick={resetAll}>重置全部</button>
            <button className="btn-primary" onClick={doMatch}>开始匹配</button>
          </div>
          {activeFiltersCount > 0 && (
            <div className="filter-count">已选 {activeFiltersCount} 个筛选条件</div>
          )}
        </aside>

        <main className="content">
          <div className="toolbar">
            <div className="count">共找到 <strong>{results.length}</strong> 条政策，已选 <strong>{selected.size}</strong> 条</div>
            <div className="legend">
              <span className="legend-item">★★★ Top 3</span>
              <span className="legend-item">★★☆ Top 8</span>
              <span className="legend-item">★☆☆ 其他</span>
            </div>
          </div>

          {showExport && (
            <div className="export-panel">
              <div className="export-title">导出政策清单 PDF</div>
              <div className="export-row">
                <input
                  id="company-input"
                  type="text"
                  aria-label="企业名称"
                  placeholder="输入企业名称（可选）"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  maxLength={50}
                  style={{ maxWidth: "200px" }}
                />
                <button className="btn-primary" onClick={exportPdf} disabled={selected.size === 0}>
                  生成 PDF ({selected.size} 条)
                </button>
                <button className="btn-secondary" onClick={selectAll}>全选</button>
                <button className="btn-secondary" onClick={clearSelection}>清空</button>
                <button className="btn-secondary" onClick={() => setShowExport(false)}>收起</button>
              </div>
            </div>
          )}

          <div className="result-list">
            {loading ? (
              <div className="loading-state">
                <div className="spinner" aria-label="加载中"></div>
                <p>正在匹配政策...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>未找到匹配政策</p>
                <small>试试调整筛选条件</small>
                {hasFilters && (
                  <button className="btn-secondary" onClick={resetAll} style={{ marginTop: "12px" }}>
                    重置筛选
                  </button>
                )}
              </div>
            ) : (
              results.map(item => (
                <PolicyCard
                  key={item.name ?? ""}
                  item={item}
                  expanded={expanded}
                  selected={selected}
                  onToggleExpand={toggleExpand}
                  onToggleSelect={toggleSelect}
                />
              ))
            )}
          </div>

          {results.length > 0 && (
            <div className="content-footer">
              {!showExport && (
                <button className="btn-primary" onClick={() => setShowExport(true)}>📥 导出政策清单</button>
              )}
              <button className="btn-secondary" onClick={doMatch}>🔄 重新匹配</button>
            </div>
          )}
        </main>
      </div>

      <div className="footer-banner">
        <div className="footer-warning">⚠️ 本系统为内部测试工具，政策数据来源于政府公开信息，匹配结果仅供参考。</div>
        <div className="footer-credit">Author: Els.J · Tauri v2 · 仅供内部使用</div>
      </div>
    </div>
  );
}