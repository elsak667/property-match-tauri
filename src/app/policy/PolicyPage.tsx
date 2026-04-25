"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { openPrintWindow } from "../../lib/tauri";
import { loadPolicies, matchPolicies, buildFilterOptions, LOCATIONS } from "../../lib/policy";

interface FilterOption { k: string; l: string; cnt?: number; }
interface PolicyResult {
  _group: boolean; group_name?: string; group_count?: number; children?: PolicyResult[];
  name?: string; amount: number | null; amount_s: string; zcReleaseTime: string;
  end_date?: string | null; days_left: number; expired: boolean; method: string; dept: string;
  area: string; industry: string; subject: string; threshold: string; cap: string;
  content: string; contentHtml: string; policyObject: string; policyCondition: string;
  paymentStandard: string; contactInfo: string; _reasons: string[]; stars?: string;
}
interface FilterOptions { industries: FilterOption[]; caps: FilterOption[]; thresholds: FilterOption[]; depts: FilterOption[]; cats: FilterOption[]; }
interface FullFilterOptions extends FilterOptions { locations: FilterOption[]; subjects: FilterOption[]; total: number; }

export default function PolicyPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [thresholds, setThresholds] = useState<string[]>([]);
  const [dept, setDept] = useState("");
  const [cat, setCat] = useState("");
  const [options, setOptions] = useState<FullFilterOptions | null>(null);
  const [results, setResults] = useState<PolicyResult[]>([]);
  const [total, setTotal] = useState(0);
  const [showing, setShowing] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [companyName, setCompanyName] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<{local数据库:number; 官方总数:number; 匹配率:string; 差异:number; 数据来源:string; 官方链接:string} | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { getPolicyStats } = await import("../../lib/tauri");
        const s = await getPolicyStats();
        setStats(s);
      } catch { /* ignore */ }
    }
    fetchStats();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      try {
        const policies = await loadPolicies();
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 0));
        const opts = await buildFilterOptions(policies);
        if (cancelled) return;
        setOptions({
          locations: LOCATIONS, subjects: [],
          industries: opts.industries, caps: opts.caps, thresholds: opts.thresholds,
          depts: opts.depts, cats: opts.cats, total: policies.length,
        });
        if (policies.length === 0) {  setLoadError("政策数据为空"); }
        setStats(prev => {
          const local = policies.length;
          const official = prev?.官方总数 ?? -1;
          const diff = official > 0 ? local - official : 0;
          const 匹配率 = official > 0 ? `${Math.round(local / official * 100)}%` : "—";
          return { local数据库: local, 官方总数: official, 匹配率, 差异: diff, 数据来源: "飞书数据", 官方链接: "https://pyd.pudong.gov.cn/website/pud/policyretrieval" };
        });
      } catch (e: any) {
        if (cancelled) return;
        
        setLoadError(e?.message || String(e));
      }
    }
    loadOptions();
    return () => { cancelled = true; };
  }, []);

  const doMatch = useCallback(async () => {
    setLoading(true);
    try {
      const allPolicies = await loadPolicies();
      const matchResults = matchPolicies(allPolicies, { query, industries, location, subjects, caps, thresholds, dept, cat });
      const out: PolicyResult[] = matchResults.map(p => ({
        _group: false,
        name: p.name, amount: p.amount, amount_s: p.amount_s,
        end_date: p.end ? p.end.toISOString().split("T")[0] : null,
        zcReleaseTime: p.zcReleaseTime, days_left: p.days_left, expired: p.expired,
        method: p.method, dept: p.dept, area: p.area, industry: p.industry,
        subject: p.subject, threshold: p.threshold, cap: p.cap,
        content: p.content, contentHtml: p.contentHtml,
        policyObject: p.policyObject, policyCondition: p.policyCondition,
        paymentStandard: p.paymentStandard, contactInfo: p.contactInfo,
        _reasons: p._reasons,
        stars: p._rank <= 3 ? "★★★" : p._rank <= 8 ? "★★☆" : "★☆☆",
      }));
      setResults(out);
      setTotal(out.length);
      setShowing(out.length);
      setShowAll(true);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [query, location, industries, subjects, caps, thresholds, dept, cat]);

  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    const t = setTimeout(doMatch, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doMatch]);

  const previewPending = useRef(false);
  useEffect(() => {
    async function loadPreview() {
      previewPending.current = true;
      try {
        const allPolicies = await loadPolicies();
        const previewResults = matchPolicies(allPolicies, {}, 5, true);
        const out: PolicyResult[] = previewResults.map(p => ({
          _group: false,
          name: p.name, amount: p.amount, amount_s: p.amount_s,
          end_date: p.end ? p.end.toISOString().split("T")[0] : null,
          zcReleaseTime: p.zcReleaseTime, days_left: p.days_left, expired: p.expired,
          method: p.method, dept: p.dept, area: p.area, industry: p.industry,
          subject: p.subject, threshold: p.threshold, cap: p.cap,
          content: p.content, contentHtml: p.contentHtml,
          policyObject: p.policyObject, policyCondition: p.policyCondition,
          paymentStandard: p.paymentStandard, contactInfo: p.contactInfo,
          _reasons: p._reasons,
          stars: p._rank <= 3 ? "★★★" : p._rank <= 8 ? "★★☆" : "★☆☆",
        }));
        setResults(out);
        setTotal(allPolicies.length);
        setShowing(out.length);
      } catch (e) {  }
      finally { previewPending.current = false; }
    }
    loadPreview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const ids: string[] = [];
    for (const item of results) {
      if (item._group && item.children) { for (const child of item.children) { if (child.name) ids.push(child.name); } }
      else if (item.name) { ids.push(item.name); }
    }
    setSelected(new Set(ids));
  }
  function clearSelection() { setSelected(new Set()); }

  async function exportPdf() {
    const selectedItems: PolicyResult[] = [];
    for (const item of results) {
      if (item._group && item.children) { for (const child of item.children) { if (child.name && selected.has(child.name)) selectedItems.push(child); } }
      else if (item.name && selected.has(item.name!)) { selectedItems.push(item); }
    }
    if (selectedItems.length === 0) { alert("请先选择要导出的政策"); return; }

    const coName = companyName || "某企业";
    const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    const totalItems = selectedItems.length;

    const fmtDate = (d: string): string => { if (!d) return "长期有效"; try { return d.slice(0, 10); } catch { return d; } };
    const cleanHtml = (s: string): string => String(s).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    const esc = (s: string): string => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const coverPage = `<div style="width:210mm;height:297mm;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;box-sizing:border-box;">
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#3b6db5,transparent);"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#3b6db5,transparent);"></div>
  <div style="position:relative;z-index:1;text-align:center;">
    <div style="font-size:11px;color:#3b6db5;letter-spacing:4px;margin-bottom:20px;font-weight:500;">浦发集团招商中心</div>
    <div style="font-size:42px;font-weight:700;color:#1e293b;line-height:1.35;margin-bottom:28px;letter-spacing:3px;">政策匹配清单</div>
    <div style="width:64px;height:2px;background:#3b6db5;margin:0 auto 28px;"></div>
    <div style="font-size:14px;color:#64748b;margin-bottom:48px;line-height:1.8;">生成日期：${today} &nbsp;|&nbsp; 共 ${totalItems} 条政策</div>
    <div style="background:#ffffff;border:2px solid #3b6db5;border-radius:16px;padding:28px 56px;display:inline-block;box-shadow:0 4px 16px rgba(59,109,181,0.14);">
      <div style="font-size:30px;font-weight:700;color:#1e293b;margin-bottom:8px;line-height:1.4;">${esc(coName)}</div>
      <div style="font-size:13px;color:#3b6db5;letter-spacing:5px;font-weight:600;">专&nbsp;&nbsp;用</div>
    </div>
  </div>
  <div style="position:absolute;bottom:28px;font-size:10px;color:#94a3b8;letter-spacing:3px;">浦发集团招商中心</div>
</div>`;

    const policyPages: string[] = [];
    for (let i = 0; i < totalItems; i++) {
      const p = selectedItems[i];
      const daysLeft = p.days_left;
      const isUrgent = daysLeft !== undefined && daysLeft > 0 && daysLeft <= 30;
      const isExpired = p.expired || (daysLeft !== undefined && daysLeft <= 0);
      const metaItems: string[] = [];
      const amountDisplay = p.amount != null && (p.amount as number) > 0 ? `${p.amount}万元` : (p.amount_s && p.amount_s !== "待定" && p.amount_s !== "—" ? p.amount_s : null);
      if (amountDisplay) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">金额</span><strong style="color:#dc2626;font-size:12px;">${esc(amountDisplay)}</strong></span>`);
      if (p.end_date) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">申报截止</span><strong style="color:#374151;font-size:12px;">${fmtDate(p.end_date)}</strong></span>`);
      if (daysLeft !== undefined) {
        const tc = isExpired ? "#94a3b8" : isUrgent ? "#dc2626" : "#374151";
        metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">剩余时间</span><strong style="color:${tc};font-size:12px;">${isExpired ? "已截止" : "剩余 " + daysLeft + " 天"}</strong></span>`);
      }
      if (p.industry) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">适用行业</span><strong style="color:#374151;font-size:12px;">${esc(p.industry)}</strong></span>`);
      if (p.subject) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">申报主体</span><strong style="color:#374151;font-size:12px;">${esc(p.subject)}</strong></span>`);
      if (p.cap) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">政策力度</span><strong style="color:#374151;font-size:12px;">${esc(p.cap)}</strong></span>`);
      if (p.area) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">适用区域</span><strong style="color:#374151;font-size:12px;">${esc(p.area)}</strong></span>`);
      if (p.method) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">兑现方式</span><strong style="color:#374151;font-size:12px;">${esc(p.method)}</strong></span>`);
      if (p.dept) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">发布单位</span><strong style="color:#374151;font-size:12px;">${esc(p.dept)}</strong></span>`);
      const reasonsHtml = (p._reasons && p._reasons.length > 0) ? `<div style="background:#fff7ed;border-left:3px solid #f97316;padding:10px 14px;border-radius:0 8px 8px 0;margin:10px 0;"><div style="color:#c2410c;font-size:11px;font-weight:700;margin-bottom:4px;">匹配理由</div><div style="color:#7c2d12;font-size:12px;line-height:1.9;">${esc(p._reasons.slice(0, 3).join("；"))}</div></div>` : "";
      const fieldBlock = (label: string, value: string): string => { if (!value || !value.trim()) return ""; return `<div style="display:flex;gap:8px;margin:3px 0;align-items:baseline;padding:3px 0;"><span style="min-width:84px;color:#374151;font-size:12px;font-weight:600;flex-shrink:0;">${label}</span><span style="color:#475569;font-size:12px;line-height:1.8;word-break:break-all;">${cleanHtml(value)}</span></div>`; };
      const detailsHtml = [fieldBlock("政策对象", p.policyObject), fieldBlock("申报条件", p.policyCondition), fieldBlock("补贴标准", p.paymentStandard), fieldBlock("联系信息", p.contactInfo)].filter(Boolean).join("");
      const contentHtmlText = p.content ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-top:10px;"><div style="color:#1e3a8a;font-size:11px;font-weight:700;margin-bottom:6px;">政策内容</div><div style="color:#475569;font-size:12px;line-height:2;white-space:pre-wrap;word-break:break-all;">${cleanHtml(p.content)}</div></div>` : "";
      const pageNum = i + 1;
      policyPages.push(`<div style="width:210mm;min-height:297mm;background:#ffffff;position:relative;box-sizing:border-box;page-break-after:always;">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:80px;font-weight:700;color:rgba(25,65,130,0.055);white-space:nowrap;pointer-events:none;z-index:9998;user-select:none;line-height:1.4;letter-spacing:8px;">浦发集团招商中心 内部资料</div>
  <div style="width:100%;padding:16px 24px 12px;box-sizing:border-box;background:#ffffff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;">
    <div style="font-size:13px;color:#194182;font-weight:700;">${esc(p.name || "")}</div><div style="font-size:11px;color:#94a3b8;">${pageNum} / ${totalItems}</div>
  </div>
  <div style="padding:12px 24px 36px;box-sizing:border-box;position:relative;z-index:1;">
    <div style="background:#f0f4ff;border-radius:6px;padding:10px 14px;margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px 20px;font-size:11.5px;line-height:1.7;">${metaItems.join("")}</div>
    ${reasonsHtml}
    <div style="border-top:1px solid #e2e8f0;padding-top:10px;margin-top:6px;">${detailsHtml}</div>
    ${contentHtmlText}
  </div>
  <div style="position:absolute;bottom:10px;left:0;right:0;text-align:center;font-size:10px;color:#cbd5e1;letter-spacing:1px;">浦发集团招商中心 &nbsp;|&nbsp; ${today} &nbsp;|&nbsp; 第 ${pageNum} / ${totalItems} 页</div>
</div>`);
    }

    const fullHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>* { box-sizing: border-box; margin: 0; padding: 0; } @page { size: A4; margin: 0; } body { width: 210mm; margin: 0; font-family: 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif; background: #fff; }</style></head><body>${coverPage}${policyPages.join("\n")}<div id="print-area" style="position:fixed;top:12px;right:16px;z-index:9999;background:#1e3a6e;color:#fff;padding:12px 18px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.35);display:block;" onclick="window.print()">🖨️ 打印 / 另存为 PDF</div><style>@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }</style></body></html>`;
    try {
      const result = await openPrintWindow(fullHtml);
      if (!result.success) alert("打印窗口打开失败: " + (result.error || "未知错误"));
    } catch (err: any) { alert("导出失败: " + (err?.message || String(err))); }
  }

  const activeFiltersCount = [industries.length > 0, !!location, subjects.length > 0, caps.length > 0, thresholds.length > 0, !!dept, !!cat, !!query.trim()].filter(Boolean).length;

  return (
    <>
      {/* ── 数据对比条 ── */}
      {stats && (
        <div className="stats-bar">
          <span className="stats-bar-label">📊 数据对比</span>
          <div className="stats-items">
            <div className="stats-item"><span className="stats-item-num">{stats.local数据库}</span><span className="stats-item-label">本地政策</span></div>
            <div className="stats-divider" />
            <div className="stats-item"><span className="stats-item-num">{stats.官方总数 > 0 ? stats.官方总数 : "—"}</span><span className="stats-item-label">官网总数</span></div>
            <div className="stats-divider" />
            <div className="stats-item"><span className="stats-item-num" style={{ color: "#059669" }}>{stats.匹配率}</span><span className="stats-item-label">覆盖率</span></div>
            <div className="stats-divider" />
            <div className="stats-item"><span className="stats-item-num" style={{ color: stats.差异 >= 0 ? "#1a3a6e" : "#dc2626" }}>{stats.差异 >= 0 ? "+" : ""}{stats.差异}</span><span className="stats-item-label">差异</span></div>
          </div>
          <div className="stats-source">
            {stats.数据来源 === "cache" ? "📦 缓存" : "🌐 实时"}
            {stats.官方链接 && <a href={stats.官方链接} target="_blank" rel="noopener noreferrer">浦易达官网 →</a>}
          </div>
        </div>
      )}

      {/* ── 主内容区 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: "14px" }}>
        <aside className="sidebar" style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
          {loadError && (
            <div className="load-error">
              <strong>⚠️ 数据加载失败</strong><br/>{loadError}
              <small>请检查飞书 API 配置或联系管理员</small>
            </div>
          )}
          <div className="filter-section">
            <div className="filter-label">🔍 关键词搜索</div>
            <input type="text" placeholder="政策名称、行业关键词..." value={query} onChange={e => setQuery(e.target.value)} style={{ width: "100%", padding: "7px 12px", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontSize: "13px", outline: "none", boxSizing: "border-box", marginBottom: "6px" }} />
            {options && <div style={{ fontSize: "11px", color: "#94a3b8" }}>共 {options.total} 条政策</div>}
          </div>
          {options && options.locations.length > 0 && (
            <div className="filter-section"><div className="filter-label">📍 适用区域</div><div className="tag-grid">{options.locations.map(loc => (<button key={loc.k} className={`tag-btn ${location === loc.k ? "active" : ""}`} onClick={() => setLocation(location === loc.k ? "" : loc.k)}>{loc.l}</button>))}</div></div>
          )}
          {options && options.industries.length > 0 && (
            <div className="filter-section"><div className="filter-label">🏭 产业方向</div><div className="tag-grid">{options.industries.map(ind => (<button key={ind.k} className={`tag-btn ${industries.includes(ind.k) ? "active" : ""}`} onClick={() => toggleTag(industries, setIndustries, ind.k)}>{ind.l}</button>))}</div></div>
          )}
          {options && options.caps.length > 0 && (
            <div className="filter-section"><div className="filter-label">💡 政策能力</div><div className="tag-grid">{options.caps.map(c => (<button key={c.k} className={`tag-btn ${caps.includes(c.k) ? "active" : ""}`} onClick={() => toggleTag(caps, setCaps, c.k)}>{c.l}</button>))}</div></div>
          )}
          {options && options.thresholds.length > 0 && (
            <div className="filter-section"><div className="filter-label">🏅 企业资质</div><div className="tag-grid">{options.thresholds.map(t => (<button key={t.k} className={`tag-btn ${thresholds.includes(t.k) ? "active" : ""}`} onClick={() => toggleTag(thresholds, setThresholds, t.k)}>{t.l}</button>))}</div></div>
          )}
          {options && options.depts.length > 0 && (
            <div className="filter-section"><div className="filter-label">🏛️ 发布单位</div><select className="filter-select" value={dept} onChange={e => setDept(e.target.value)}><option value="">全部</option>{options.depts.map(d => <option key={d.k} value={d.k}>{d.l} ({d.cnt})</option>)}</select></div>
          )}
          {options && options.cats.length > 0 && (
            <div className="filter-section"><div className="filter-label">📂 专项分类</div><select className="filter-select" value={cat} onChange={e => setCat(e.target.value)}><option value="">全部</option>{options.cats.map(c => <option key={c.k} value={c.k}>{c.l} ({c.cnt})</option>)}</select></div>
          )}
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => { setQuery(""); setLocation(""); setIndustries([]); setSubjects([]); setCaps([]); setThresholds([]); setDept(""); setCat(""); }}>重置全部</button>
            <button className="btn-primary" onClick={doMatch} disabled={loading}>{loading ? "匹配中..." : "开始匹配"}</button>
          </div>
          {activeFiltersCount > 0 && <div style={{ fontSize: "11px", color: "#3b6db5", marginTop: "8px", textAlign: "center" }}>已选 {activeFiltersCount} 个筛选条件</div>}
        </aside>

        <main className="content">
          <div className="toolbar">
            <div className="count">共找到 <strong>{total}</strong> 条政策，显示 <strong>{showAll ? showing : Math.min(5, total)}</strong> 条 {!showAll && total > 5 && <span style={{ color: "#94a3b8", fontSize: "12px" }}>（预览）</span>}{selected.size > 0 && <span style={{ color: "#059669" }}>，已选 {selected.size} 条</span>}</div>
            <div className="legend"><span className="legend-item">★★★ Top 3</span><span className="legend-item">★★☆ Top 8</span><span className="legend-item">★☆☆ 其他</span></div>
          </div>
          {showExport && (
            <div className="export-panel">
              <div className="export-panel-title">📄 导出政策清单 PDF</div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input type="text" placeholder="输入企业名称（可选）" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                <button className="btn-primary" onClick={exportPdf} disabled={selected.size === 0} style={{ flex: "none" }}>生成 PDF ({selected.size} 条)</button>
                <button className="btn-secondary" onClick={selectAll}>全选</button>
                <button className="btn-secondary" onClick={clearSelection}>清空</button>
                <button className="btn-secondary" onClick={() => setShowExport(false)}>收起</button>
              </div>
            </div>
          )}
          {loading ? (<div className="empty-state"><div style={{ fontSize: "40px" }}>⏳</div><p>政策匹配中...</p></div>) : results.length === 0 ? (<div className="empty-state"><div className="empty-icon">📋</div><p>未找到匹配政策</p><small>试试调整筛选条件</small></div>) : (() => {
            const flat: PolicyResult[] = [];
            for (const item of results) { if (item._group && item.children) flat.push(...item.children); else flat.push(item); }
            const PREVIEW = 5;
            const displayItems = showAll ? flat : flat.slice(0, PREVIEW);
            const remaining = total - PREVIEW;
            return (
              <div className="result-list">
                {displayItems.map((item, idx) => (<PolicyCard key={`item-${idx}`} item={item} expanded={expanded} selected={selected} onToggleExpand={toggleExpand} onToggleSelect={toggleSelect} />))}
                {!showAll && remaining > 0 && (
                  <div className="show-all-btn">
                    <button className="btn-secondary" onClick={() => setShowAll(true)} style={{ fontSize: "13px", padding: "9px 28px" }}>📋 展示全部 {total} 条政策（还有 {remaining} 条）</button>
                  </div>
                )}
                {showAll && remaining > 0 && (
                  <div className="show-all-btn">
                    <button className="btn-secondary" onClick={() => setShowAll(false)} style={{ fontSize: "13px", padding: "9px 28px" }}>🔼 收起</button>
                  </div>
                )}
              </div>
            );
          })()}
          {results.length > 0 && (
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(59,109,181,.1)" }}>
              {!showExport && <button className="btn-primary" onClick={() => setShowExport(true)}>📥 导出政策清单</button>}
              <button className="btn-secondary" onClick={doMatch} disabled={loading}>🔄 重新匹配</button>
            </div>
          )}
        </main>
      </div>
      <div style={{ marginTop: "16px", padding: "12px 16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", textAlign: "center" }}>
        <div style={{ fontSize: "12px", color: "#f59e0b", marginBottom: "4px" }}>⚠️ 本系统为内部测试工具，政策数据来源于政府公开信息，匹配结果仅供参考，不构成正式申报建议。</div>
        <div style={{ fontSize: "11px", color: "#94a3b8" }}>Author: Els.J · 仅供内部使用</div>
      </div>
    </>
  );
}

function stripHtml(text: string): string { return text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim(); }

function PolicyCard({ item, expanded, selected, onToggleExpand, onToggleSelect }: { item: PolicyResult; expanded: Set<string>; selected: Set<string>; onToggleExpand: (id: string) => void; onToggleSelect: (id: string) => void; }) {
  const name = item.name || "";
  const isExpanded = expanded.has(name);
  const isSelected = selected.has(name);
  const daysLeft = item.days_left;
  const isUrgent = daysLeft > 0 && daysLeft <= 30;
  return (
    <div className={`result-item ${isExpanded ? "expanded" : ""}`} style={{ opacity: item.expired ? ".6" : "1", borderLeft: isSelected ? "3px solid #3b6db5" : undefined }}>
      <div className="result-card-body">
      <div className="result-top">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", flex: 1 }}>
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(name)} style={{ marginTop: "3px", cursor: "pointer", accentColor: "#1a3a6e" }} />
          <div className="result-name">{item.stars} {name}</div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
          {isUrgent && <span className="hot-badge">🔥 即将截止</span>}
          {item.expired && <span style={{ fontSize: "11px", color: "#94a3b8", background: "#f1f5f9", padding: "2px 8px", borderRadius: "10px" }}>已过期</span>}
          <span className="expand-hint" onClick={() => onToggleExpand(name)}>{isExpanded ? "收起 ▲" : "展开 ▼"}</span>
        </div>
      </div>
      <div className="result-meta compact">
        <span className="meta-main">{item.amount_s ? item.amount_s === "待定" ? "💰 待定" : /万|元/.test(item.amount_s) ? `💰 ${item.amount_s}` : `💰 ${item.amount_s}万元` : "—"}</span>
        {item.industry && <span>🏭 {item.industry}</span>}
        {item.subject && <span>👥 {item.subject}</span>}
        {item.cap && <span>💡 {item.cap}</span>}
        <span style={{ color: isUrgent ? "#dc2626" : "#64748b", fontSize: "12px" }}>
          {item.end_date ? `📅 ${item.end_date.substring(0, 10)}` : "📅 长期有效"}
          {daysLeft > 0 && daysLeft < 365 && !item.expired && ` (${daysLeft}天)`}
        </span>
      </div>
      {item._reasons.length > 0 && <div className="result-match-reason">{item._reasons.join(" · ")}</div>}
      {isExpanded && (
        <div className="result-details">
          <div className="detail-section">
            <div className="detail-title">基本信息</div>
            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">💰 最高补贴</span><span className="detail-value">{item.amount_s && item.amount_s !== "待定" ? (/万|元/.test(item.amount_s) ? item.amount_s : `${item.amount_s}万元`) : "—"}</span></div>
              <div className="detail-item"><span className="detail-label">📅 申报截止</span><span className="detail-value">{item.end_date ? item.end_date.substring(0, 10) : "长期有效"}</span></div>
              {item.zcReleaseTime && <div className="detail-item"><span className="detail-label">🗓️ 发布时间</span><span className="detail-value">{item.zcReleaseTime?.substring(0, 10) || "—"}</span></div>}
              <div className="detail-item"><span className="detail-label">📍 适用区域</span><span className="detail-value">{item.area || "浦东新区"}</span></div>
              <div className="detail-item"><span className="detail-label">发布单位</span><span className="detail-value">{item.dept || "—"}</span></div>
              <div className="detail-item"><span className="detail-label">兑现方式</span><span className="detail-value">{item.method || "—"}</span></div>
              <div className="detail-item"><span className="detail-label">申报主体</span><span className="detail-value">{item.subject || "企业"}</span></div>
            </div>
          </div>
          {item.threshold && <div className="detail-section"><div className="detail-title">门槛要求</div><div style={{ fontSize: "12.5px", color: "#374151", lineHeight: "1.6" }}>{stripHtml(item.threshold)}</div></div>}
          {item.policyObject && <div className="detail-section"><div className="detail-title">政策对象</div><div style={{ fontSize: "12.5px", color: "#374151", lineHeight: "1.6" }}>{stripHtml(item.policyObject)}</div></div>}
          {item.policyCondition && <div className="detail-section"><div className="detail-title">申报条件</div><div style={{ fontSize: "12.5px", color: "#374151", lineHeight: "1.6" }}>{stripHtml(item.policyCondition)}</div></div>}
          {item.paymentStandard && <div className="detail-section"><div className="detail-title">扶持标准</div><div style={{ fontSize: "12.5px", color: "#374151", lineHeight: "1.6" }}>{stripHtml(item.paymentStandard)}</div></div>}
          {item.content && <div className="detail-section"><div className="detail-title">政策内容</div><div style={{ fontSize: "12.5px", color: "#64748b", lineHeight: "1.7", background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", maxHeight: "200px", overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.content}</div></div>}
          {item.contactInfo && <div className="detail-section"><div className="detail-title">联系方式</div><div style={{ fontSize: "12.5px", color: "#374151" }}>{stripHtml(item.contactInfo)}</div></div>}
        </div>
      )}
      </div>
    </div>
  );
}
