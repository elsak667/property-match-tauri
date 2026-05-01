/**
 * 载体地图页 — 双模式设计
 * - 非专业用户：AI 搜索 + 推荐卡片 + 地图
 * - 专业招商人员：可展开多维筛选面板 + 批量对比
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchBuildings, filterProperties, type BuildingSummary } from "../../lib/workers";
import BuildingDetailPanel from "../../components/BuildingDetailPanel";
import PropertyMap from "../../components/PropertyMap";
import { openPrintHtmlRaw } from "../../lib/pdfgen_new";
import { INDUSTRY_PROFILES } from "../property/mockData";
import type { PropertyFilterResult } from "../../lib/workers";

// AI 搜索结果类型
interface AiPropertyMatch {
  id: number;
  building_id: string;
  name: string;
  building: string;
  park: string;
  match_reason: string;
  score: number;
}
interface AiSearchResult {
  policies: unknown[];
  properties: AiPropertyMatch[];
  summary: string;
}

interface Props {
  aiResult?: AiSearchResult | null;
  aiActiveBuildingId?: string | null;
  onAiBuildingClick?: (buildingId: string) => void;
}

const PARKS: { value: string; label: string }[] = [
  { value: "", label: "全部园区" },
  { value: "PARK001", label: "金桥北区" },
  { value: "PARK002", label: "金桥南区" },
];

const IS104_OPTIONS = [
  { value: "", label: "不限" },
  { value: "是", label: "是" },
  { value: "否", label: "否" },
];

// 产业参数匹配
function matchIndustryParams(name: string) {
  for (const cat of INDUSTRY_PROFILES.categories) {
    const found = cat.industries.find(ind =>
      ind.name === name || ind.alias?.some((a: string) => name.includes(a))
    );
    if (found) return { category: cat.name, ...found };
  }
  return null;
}

export default function CarrierPage({ aiResult, aiActiveBuildingId, onAiBuildingClick }: Props) {
  const [allBuildings, setAllBuildings] = useState<BuildingSummary[]>([]);
  const [filtered, setFiltered] = useState<PropertyFilterResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [error, setError] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  // 筛选
  const [fPark, setFPark] = useState("");
  const [fAreaMin, setFAreaMin] = useState("");
  const [fAreaMax, setFAreaMax] = useState("");
  const [fPriceMax, setFPriceMax] = useState("");
  const [fLoadMin, setFLoadMin] = useState("");
  const [fHeightMin, setFHeightMin] = useState("");
  const [fPowerKVMin, setFPowerKVMin] = useState("");
  const [fIs104, setFIs104] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // 产业参数建议
  const [fIndustryCat, setFIndustryCat] = useState("");
  const [fIndustry, setFIndustry] = useState("");
  const [industryParams, setIndustryParams] = useState<{
    name: string; loadMin: number | null; heightMin: number | null;
    powerKV: number | null; dualPower: boolean | null; special: string[]; remark: string
  } | null>(null);

  // 对比
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

  // 园区折叠
  const [collapsedParks, setCollapsedParks] = useState<Set<string>>(new Set());

  // 加载全量楼栋（用于楼栋列表和地图坐标）
  useEffect(() => {
    fetchBuildings()
      .then(data => { setAllBuildings(data ?? []); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  // 计数激活筛选条件
  useEffect(() => {
    let c = 0;
    if (fPark) c++;
    if (fAreaMin) c++;
    if (fAreaMax) c++;
    if (fPriceMax) c++;
    if (fLoadMin) c++;
    if (fHeightMin) c++;
    if (fPowerKVMin) c++;
    if (fIs104) c++;
    setActiveFilterCount(c);
  }, [fPark, fAreaMin, fAreaMax, fPriceMax, fLoadMin, fHeightMin, fPowerKVMin, fIs104]);

  // 执行筛选（调用 API，获得面积/租金/产业数据）
  const doFilter = useCallback(async () => {
    setFiltering(true);
    try {
      const result = await filterProperties({
        park: fPark || undefined,
        area_min: fAreaMin ? Number(fAreaMin) : undefined,
        area_max: fAreaMax ? Number(fAreaMax) : undefined,
        price_max: fPriceMax ? Number(fPriceMax) : undefined,
        load_min: fLoadMin ? Number(fLoadMin) : undefined,
        height_min: fHeightMin ? Number(fHeightMin) : undefined,
        power_kv_min: fPowerKVMin ? Number(fPowerKVMin) : undefined,
        is104: fIs104 || undefined,
        page: 1,
        page_size: 500,
      });
      setFiltered(result);
    } catch {
      setFiltered(null);
    } finally {
      setFiltering(false);
    }
  }, [fPark, fAreaMin, fAreaMax, fPriceMax, fLoadMin, fHeightMin, fPowerKVMin, fIs104]);

  // 自动触发筛选（防抖）
  useEffect(() => {
    const t = setTimeout(doFilter, 400);
    return () => clearTimeout(t);
  }, [doFilter]);

  // 从 filter 结果中按 building_id 聚合面积（取最大值）和租金/产业
  const filterMeta = useMemo(() => {
    const map = new Map<string, { area_vacant: number; price: number | null; industry: string }>();
    (filtered?.results ?? []).forEach(u => {
      if (!map.has(u.building_id)) {
        map.set(u.building_id, { area_vacant: u.area_vacant ?? 0, price: u.price ?? null, industry: u.industry ?? "" });
      } else {
        const prev = map.get(u.building_id)!;
        prev.area_vacant = Math.max(prev.area_vacant, u.area_vacant ?? 0);
        if (u.price != null && prev.price == null) prev.price = u.price;
        if (!prev.industry && u.industry) prev.industry = u.industry;
      }
    });
    return map;
  }, [filtered]);

  // 楼栋搜索
  const [nameQuery, setNameQuery] = useState("");

  // 以 fetchBuildings 为基准，合并 filter 数据
  let displayBuildings = allBuildings.filter(b => !fPark || b.park_id === fPark);
  if (nameQuery.trim()) {
    const q = nameQuery.trim().toLowerCase();
    displayBuildings = displayBuildings.filter(b =>
      (b.name || "").toLowerCase().includes(q) ||
      (b.industry || "").toLowerCase().includes(q) ||
      (b.park_name || "").toLowerCase().includes(q)
    );
  }

  // 园区分组
  const grouped = displayBuildings.reduce<Record<string, typeof displayBuildings>>((acc, b) => {
    const key = b.park_name || "其他";
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  // 园区数量和楼栋数量
  const parkCount = Object.keys(grouped).length;
  const totalBldCount = displayBuildings.length;
  const uniqueBuildingCount = totalBldCount;

  // AI 匹配楼栋
  const aiBuildingIds = new Set((aiResult?.properties ?? []).map(p => p.building_id).filter(Boolean));
  const aiTop5 = (aiResult?.properties ?? []).slice(0, 5);

  // 同步 AI 高亮
  useEffect(() => {
    if (aiActiveBuildingId) setSelectedBuildingId(aiActiveBuildingId);
  }, [aiActiveBuildingId]);

  const handleBuildingSelect = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    onAiBuildingClick?.(buildingId);
  };

  function toggleCompare(bldId: string) {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(bldId)) next.delete(bldId);
      else { if (next.size >= 4) return prev; next.add(bldId); }
      return next;
    });
  }

  function resetAll() {
    setFPark(""); setFAreaMin(""); setFAreaMax(""); setFPriceMax("");
    setFLoadMin(""); setFHeightMin(""); setFPowerKVMin(""); setFIs104("");
  }

  function handleIndustryCatChange(cat: string) {
    setFIndustryCat(cat);
    setFIndustry("");
    setIndustryParams(null);
  }

  function handleIndustryChange(name: string) {
    setFIndustry(name);
    if (name) setIndustryParams(matchIndustryParams(name));
    else setIndustryParams(null);
  }

  function applyIndustryParams() {
    if (!industryParams) return;
    if (industryParams.loadMin) setFLoadMin(String(industryParams.loadMin));
    if (industryParams.heightMin) setFHeightMin(String(industryParams.heightMin));
    if (industryParams.powerKV) setFPowerKVMin(String(industryParams.powerKV));
    setShowFilter(true);
  }

  // 对比数据（基于 filter 结果）
  const resultUnits = filtered?.results ?? [];
  const compareUnits = resultUnits.filter(u => compareIds.has(u.building_id));

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="load-error" style={{ margin: "24px auto", maxWidth: 480, textAlign: "center" }}>
        <strong>⚠️ 数据加载失败</strong><br />{error}
      </div>
    );
  }

  return (
    <div className="cp-root" style={{ display: 'flex', height: 'calc(100vh - 120px)', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* 左侧 */}
      <div className="cp-sidebar">
        {/* 搜索栏 */}
        <div className="cp-search-bar">
          <div className="cp-search-input-wrap">
            <span className="cp-search-icon">🔍</span>
            <input
              className="cp-search-input"
              type="text"
              placeholder="搜索楼栋、产业、园区..."
              value={nameQuery}
              onChange={e => setNameQuery(e.target.value)}
            />
            {nameQuery && (
              <button className="cp-search-clear" onClick={() => setNameQuery("")}>✕</button>
            )}
          </div>
          <button
            className={"cp-filter-btn" + (showFilter ? " active" : "")}
            onClick={() => setShowFilter(v => !v)}
            title="更多筛选条件"
          >
            <span>⚙️</span>
            {activeFilterCount > 0 && <span className="cp-filter-count">{activeFilterCount}</span>}
          </button>
        </div>

        {/* AI 推荐区 */}
        {aiTop5.length > 0 && (
          <div className="cp-ai-section">
            <div className="cp-section-label">
              <span>🤖</span>
              <span>AI 推荐</span>
              <span className="cp-badge">{aiTop5.length}</span>
            </div>
            <div className="cp-ai-cards">
              {aiTop5.map(p => (
                <div
                  key={p.building_id}
                  className={"cp-ai-card" + (selectedBuildingId === p.building_id ? " active" : "")}
                  onClick={() => handleBuildingSelect(p.building_id)}
                >
                  <div className="cp-ai-card-name">
                    <span>{p.building || p.name}</span>
                    <span className="cp-score">{p.score}</span>
                  </div>
                  <div className="cp-ai-card-meta">{p.park && `📍 ${p.park}`}</div>
                  <div className="cp-ai-card-reason">{p.match_reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 产业参数建议 */}
        <div className="cp-section">
          <div className="cp-section-label">
            <span>📐</span>
            <span>产业参数建议</span>
          </div>
          <div className="cp-params-wrap">
            <div className="cp-params-row">
              <select
                className="cp-params-select"
                value={fIndustryCat}
                onChange={e => handleIndustryCatChange(e.target.value)}
              >
                <option value="">— 选择产业大类 —</option>
                {INDUSTRY_PROFILES.categories.map(cat => (
                  <option key={cat.code} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            {fIndustryCat && (
              <div className="cp-params-row">
                <select
                  className="cp-params-select"
                  value={fIndustry}
                  onChange={e => handleIndustryChange(e.target.value)}
                >
                  <option value="">— 选择具体产业 —</option>
                  {INDUSTRY_PROFILES.categories
                    .find(c => c.name === fIndustryCat)
                    ?.industries.map(ind => (
                      <option key={ind.code} value={ind.name}>{ind.name}</option>
                    ))}
                </select>
              </div>
            )}
            {industryParams && (
              <div className="cp-params-card">
                <div className="cp-params-title">{industryParams.name}</div>
                <div className="cp-params-specs">
                  {industryParams.loadMin && <span className="cp-spec-item">荷载≥{industryParams.loadMin}kN/㎡</span>}
                  {industryParams.heightMin && <span className="cp-spec-item">层高≥{industryParams.heightMin}m</span>}
                  {industryParams.powerKV && <span className="cp-spec-item">配电≥{industryParams.powerKV}kVA</span>}
                  {industryParams.dualPower && <span className="cp-spec-item cp-spec-warn">⚡双回路</span>}
                </div>
                {industryParams.special?.length > 0 && (
                  <div className="cp-params-tags">
                    {industryParams.special.map((s: string, i: number) => (
                      <span key={i} className="cp-tag-orange">{s}</span>
                    ))}
                  </div>
                )}
                {industryParams.remark && (
                  <div className="cp-params-remark">💡 {industryParams.remark}</div>
                )}
                <button className="cp-btn-apply" onClick={applyIndustryParams}>
                  ⭐ 一键填入筛选条件
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 专业筛选面板 */}
        {showFilter && (
          <div className="cp-filter-panel">
            <div className="cp-filter-panel-title">🏢 筛选条件</div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">园区</label>
              <select className="cp-filter-select" value={fPark} onChange={e => setFPark(e.target.value)}>
                {PARKS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">面积需求</label>
              <div className="cp-filter-range">
                <input className="cp-filter-input" type="number" placeholder="最小㎡"
                  value={fAreaMin} onChange={e => setFAreaMin(e.target.value)} />
                <span>~</span>
                <input className="cp-filter-input" type="number" placeholder="最大㎡"
                  value={fAreaMax} onChange={e => setFAreaMax(e.target.value)} />
              </div>
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">租金上限</label>
              <input className="cp-filter-input" type="number" placeholder="元/㎡/天"
                value={fPriceMax} onChange={e => setFPriceMax(e.target.value)} />
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">最低荷载</label>
              <input className="cp-filter-input" type="number" placeholder="kN/㎡"
                value={fLoadMin} onChange={e => setFLoadMin(e.target.value)} />
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">最低层高</label>
              <input className="cp-filter-input" type="number" placeholder="米(m)"
                value={fHeightMin} onChange={e => setFHeightMin(e.target.value)} />
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">最低配电</label>
              <input className="cp-filter-input" type="number" placeholder="kVA"
                value={fPowerKVMin} onChange={e => setFPowerKVMin(e.target.value)} />
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">104地块</label>
              <select className="cp-filter-select" value={fIs104} onChange={e => setFIs104(e.target.value)}>
                {IS104_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="cp-filter-actions">
              <button className="cp-btn-ghost" onClick={resetAll}>重置</button>
              <button className="cp-btn-primary" onClick={() => setShowFilter(false)}>完成</button>
            </div>
          </div>
        )}
      </div>

      {/* 右侧：地图在上，楼栋列表在下 */}
      <div className="cp-right-panel">
        {/* 地图 */}
        <div className="cp-map-area">
          <PropertyMap
          buildings={displayBuildings.map(b => ({
            building_id: b.building_id,
            name: b.name || b.building_id,
            industry: b.industry,
            park_id: b.park_id,
            park_name: b.park_name,
            area_vacant: filterMeta.get(b.building_id)?.area_vacant ?? b.area_vacant,
            floors: b.floors,
            "纬度(lat)": b.lat,
            "经度(lng)": b.lng,
          }))}
          parks={[]}
          onSelect={id => id && handleBuildingSelect(id)}
          aiBuildingIds={aiBuildingIds}
          aiActiveBuildingId={aiActiveBuildingId}
        />
      </div>

      {/* 楼栋列表（可滚动） */}
      <div className="cp-list-area">
        {/* 工具栏 */}
        <div className="cp-toolbar">
          <span className="cp-count">
            {filtering ? "筛选中..." : <><strong>{parkCount}</strong>个园区 <strong>{uniqueBuildingCount}</strong>栋楼</>}
          </span>
          <div className="cp-toolbar-right">
            {compareIds.size >= 2 && (
              <button className="cp-btn-compare" onClick={() => setShowCompare(true)}>
                📊 对比 {compareIds.size}
              </button>
            )}
          </div>
        </div>

        {/* 楼栋列表 */}
        <div className="cp-list">
          {filtering ? (
            <div className="cp-loading">
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            </div>
          ) : displayBuildings.length === 0 && activeFilterCount > 0 ? (
            <div className="cp-empty">未找到匹配楼栋</div>
          ) : (
            Object.entries(grouped).map(([parkName, items]) => {
              const isCollapsed = collapsedParks.has(parkName);
              return (
                <div key={parkName} className="cp-park-group">
                  <div className="cp-park-header" onClick={() => setCollapsedParks(p => {
                    const n = new Set(p); isCollapsed ? n.delete(parkName) : n.add(parkName); return n;
                  })}>
                    <span>📍 {parkName} <span className="cp-park-count">({items.length}栋)</span></span>
                    <span className="cp-collapse-icon">{isCollapsed ? "▶" : "▼"}</span>
                  </div>
                  {!isCollapsed && (
                    <div className="cp-park-buildings">
                      {items.map(b => {
                        const isAi = aiBuildingIds.has(b.building_id);
                        const isActive = aiActiveBuildingId === b.building_id;
                        const isCompare = compareIds.has(b.building_id);
                        const meta = filterMeta.get(b.building_id);
                        const areaVacant = meta?.area_vacant ?? b.area_vacant;
                        const price = meta?.price ?? b.price;
                        const industry = meta?.industry || b.industry;
                        return (
                          <div
                            key={b.building_id}
                            className={["cp-building-card", isAi ? "ai-matched" : "", isActive ? "active" : "", isCompare ? "compare-selected" : ""].filter(Boolean).join(" ")}
                          >
                            <div className="cp-building-check" onClick={e => { e.stopPropagation(); toggleCompare(b.building_id); }}>
                              {isCompare ? "☑" : "☐"}
                            </div>
                            <div className="cp-building-info" onClick={() => handleBuildingSelect(b.building_id)}>
                              <div className="cp-building-name">
                                {b.name}
                                {isAi && <span className="cp-ai-badge">🤖</span>}
                              </div>
                              <div className="cp-building-tags">
                                {industry && <span className="cp-tag">{industry}</span>}
                              </div>
                              <div className="cp-building-stats">
                                <span>空置 <strong>{areaVacant > 0 ? `${areaVacant.toLocaleString()}㎡` : "—"}</strong></span>
                                <span>{b.floors}层</span>
                                {price != null && <span>{price}元/㎡</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      </div>

      {/* 详情面板 */}
      {selectedBuildingId && (
        <BuildingDetailPanel buildingId={selectedBuildingId} onClose={() => setSelectedBuildingId(null)} />
      )}

      {/* 对比面板 */}
      {showCompare && compareUnits.length >= 2 && (
        <div className="cp-compare-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCompare(false); }}>
          <div className="cp-compare-panel">
            <div className="cp-compare-header">
              <span>📊 楼栋对比</span>
              <div className="cp-compare-actions">
                <button className="cp-btn-export" onClick={() => {
                  const fields: [string, (u: PropertyFilterResult["results"][number]) => string][] = [
                    ["园区", u => u.park_name || "—"],
                    ["产业", u => u.industry || "—"],
                    ["楼层", u => u.floor != null ? `第${u.floor}层` : "—"],
                    ["总面积", u => `${u.area_total?.toLocaleString() ?? "—"}㎡`],
                    ["空置面积", u => `${u.area_vacant?.toLocaleString() ?? "—"}㎡`],
                    ["层高", u => u.floor_height != null ? `${u.floor_height}m` : "—"],
                    ["荷载", u => u.load != null ? `${u.load}kN/㎡` : "—"],
                    ["配电", u => u.load != null ? `${u.load}kVA` : "—"],
                    ["租金", u => u.price != null ? `${u.price}元/㎡·天` : "—"],
                  ];
                  const rows = compareUnits.map(u =>
                    `<tr>${fields.map(([, fn]) => `<td style="padding:8px;border:1px solid #ddd">${fn(u)}</td>`).join("")}</tr>`
                  ).join("");
                  const bldNames = compareUnits.map(u => `<th style="padding:8px;border:1px solid #ddd;background:#3b6db5;color:white;font-weight:700">${u.building_name}</th>`).join("");
                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{padding:24px}table{border-collapse:collapse;width:100%}th,td{padding:8px;border:1px solid #ddd;font-size:13px}</style></head><body>
                    <h1 style="color:#3b6db5">楼栋对比</h1>
                    <table><thead><tr><th style="padding:8px;border:1px solid #ddd;background:#eef2ff">指标</th>${bldNames}</tr></thead><tbody>${rows}</tbody></table>
                    <p style="margin-top:20px;color:#999;font-size:12px">${new Date().toLocaleString("zh-CN")} · 浦发集团招商平台</p>
                  </body></html>`;
                  openPrintHtmlRaw(html);
                }}>📄 导出</button>
                <button className="cp-close-btn" onClick={() => setShowCompare(false)}>✕</button>
              </div>
            </div>
            <div className="cp-compare-body">
              <table className="cp-compare-table">
                <thead>
                  <tr><th>指标</th>{compareUnits.map(u => <th key={u.building_id}>{u.building_name}</th>)}</tr>
                </thead>
                <tbody>
                  {([
                    ["园区", (u: PropertyFilterResult["results"][number]) => u.park_name || "—"],
                    ["产业方向", (u: PropertyFilterResult["results"][number]) => u.industry || "—"],
                    ["楼层", (u: PropertyFilterResult["results"][number]) => u.floor != null ? `第${u.floor}层` : "—"],
                    ["总面积", (u: PropertyFilterResult["results"][number]) => `${u.area_total?.toLocaleString() ?? "—"}㎡`],
                    ["空置面积", (u: PropertyFilterResult["results"][number]) => ({ v: `${u.area_vacant?.toLocaleString() ?? "—"}㎡`, hl: true })],
                    ["层高", (u: PropertyFilterResult["results"][number]) => u.floor_height != null ? `${u.floor_height}m` : "—"],
                    ["荷载", (u: PropertyFilterResult["results"][number]) => u.load != null ? `${u.load}kN/㎡` : "—"],
                    ["配电", (u: PropertyFilterResult["results"][number]) => u.load != null ? `${u.load}kVA` : "—"],
                    ["租金", (u: PropertyFilterResult["results"][number]) => u.price != null ? `${u.price}元/㎡·天` : "—"],
                  ] as [string, (u: PropertyFilterResult["results"][number]) => { v: string; hl?: boolean } | string][]).map(([label, fn]) => (
                    <tr key={label}>
                      <td className="cp-compare-row-label">{label}</td>
                      {compareUnits.map(u => {
                        const val = fn(u);
                        const v = typeof val === "object" ? val.v : val;
                        const hl = typeof val === "object" ? val.hl : false;
                        return <td key={u.building_id} style={hl ? { color: "#059669", fontWeight: 600 } : {}}>{v}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}