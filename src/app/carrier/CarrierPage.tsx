/**
 * 载体地图页 — 双模式设计
 * - 非专业用户：AI 搜索 + 推荐卡片 + 地图
 * - 专业招商人员：可展开多维筛选面板 + 批量对比
 */
import { useState, useEffect } from "react";
import { fetchBuildings, type BuildingSummary } from "../../lib/workers";
import BuildingDetailPanel from "../../components/BuildingDetailPanel";
import PropertyMap from "../../components/PropertyMap";
import { openPrintHtmlRaw } from "../../lib/pdfgen_new";
import { INDUSTRY_PROFILES } from "../property/mockData";

// AI 搜索结果类型
interface AiPropertyMatch {
  id: number;
  name: string;
  building: string;
  building_id: string;
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

// 楼栋筛选条件（与原 mockData.filterProperties 一致）
interface FilterOpts {
  nameQuery: string;
  type?: string;
  areaMin?: number;
  areaMax?: number;
  priceMax?: number;
  loadMin?: number;
  heightMin?: number;
  powerKVMin?: number;
  parkId?: string;
  is104?: string;
}

const PARKS: Record<string, string> = { PARK001: "金桥北区", PARK002: "金桥南区" };

// 收集所有产业选项
const ALL_INDUSTRIES: { category: string; name: string }[] = [];
INDUSTRY_PROFILES.categories.forEach((cat: { name: string; industries: { name: string }[] }) => {
  cat.industries.forEach((ind: { name: string }) => {
    ALL_INDUSTRIES.push({ category: cat.name, name: ind.name });
  });
});

function matchIndustryParams(industryName: string): { name: string; loadMin: number | null; heightMin: number | null; powerKV: number | null; dualPower: boolean | null; special: string[]; remark: string } | null {
  for (const cat of INDUSTRY_PROFILES.categories) {
    const found = cat.industries.find((ind: { name: string; alias?: string[] }) =>
      ind.name === industryName ||
      ind.alias?.some((a: string) => industryName.includes(a))
    );
    if (found) return found;
  }
  return null;
}

export default function CarrierPage({ aiResult, aiActiveBuildingId, onAiBuildingClick }: Props) {
  const [buildings, setBuildings] = useState<BuildingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  // 筛选
  const [filters, setFilters] = useState<FilterOpts>({ nameQuery: "" });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterCount, setFilterCount] = useState(0);

  // 产业参数建议
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [matchedParams, setMatchedParams] = useState<{
    name: string;
    loadMin: number | null;
    heightMin: number | null;
    powerKV: number | null;
    dualPower: boolean | null;
    special: string[];
    remark: string;
  } | null>(null);

  // 对比模式
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

  // 园区折叠
  const [collapsedParks, setCollapsedParks] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchBuildings()
      .then(data => { setBuildings(data ?? []); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  // AI 匹配楼栋集合
  const aiBuildingIds = new Set((aiResult?.properties ?? []).map(p => p.building_id).filter(Boolean));
  const aiTop5 = (aiResult?.properties ?? []).slice(0, 5);

  // 筛选
  function applyFilters(opts: FilterOpts): BuildingSummary[] {
    return buildings.filter(b => {
      if (opts.nameQuery) {
        const q = opts.nameQuery.toLowerCase();
        const match = !b.name?.toLowerCase().includes(q) &&
          !b.park_name?.toLowerCase().includes(q) &&
          !b.industry?.toLowerCase().includes(q);
        if (match) return false;
      }
      if (opts.parkId && b.park_id !== opts.parkId) return false;
      return true;
    });
  }

  const filteredBuildings = applyFilters(filters);

  // 统计激活筛选条件数
  useEffect(() => {
    let count = 0;
    if (filters.nameQuery) count++;
    if (filters.type) count++;
    if (filters.areaMin || filters.areaMax) count++;
    if (filters.priceMax) count++;
    if (filters.loadMin) count++;
    if (filters.heightMin) count++;
    if (filters.powerKVMin) count++;
    if (filters.is104) count++;
    setFilterCount(count);
  }, [filters]);

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
      if (next.has(bldId)) next.delete(bldId); else {
        if (next.size >= 4) return prev;
        next.add(bldId);
      }
      return next;
    });
  }

  function handleIndustryChange(name: string) {
    setSelectedIndustry(name);
    if (name) {
      const params = matchIndustryParams(name);
      setMatchedParams(params);
    } else {
      setMatchedParams(null);
    }
  }

  function applyIndustryParams() {
    if (!matchedParams) return;
    const newFilters: FilterOpts = { ...filters };
    if (matchedParams.loadMin) newFilters.loadMin = matchedParams.loadMin;
    if (matchedParams.heightMin) newFilters.heightMin = matchedParams.heightMin;
    if (matchedParams.powerKV) newFilters.powerKVMin = matchedParams.powerKV;
    setFilters(newFilters);
    setShowFilterPanel(true);
  }

  function resetFilters() {
    setFilters({ nameQuery: "" });
    setFilterCount(0);
  }

  // 按园区分组
  const grouped = filteredBuildings.reduce<Record<string, BuildingSummary[]>>((acc, b) => {
    const key = b.park_name || b.park_id || "";
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  const compareBuildings = buildings.filter(b => compareIds.has(b.building_id));

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
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
    <div className="cp-root">
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
              value={filters.nameQuery}
              onChange={e => setFilters(f => ({ ...f, nameQuery: e.target.value }))}
            />
            {filters.nameQuery && (
              <button className="cp-search-clear" onClick={() => setFilters(f => ({ ...f, nameQuery: "" }))}>✕</button>
            )}
          </div>
          <button
            className={"cp-filter-btn" + (showFilterPanel ? " active" : "")}
            onClick={() => setShowFilterPanel(v => !v)}
            title="专业筛选"
          >
            <span style={{ fontSize: 13 }}>⚙️</span>
            {filterCount > 0 && <span className="cp-filter-count">{filterCount}</span>}
          </button>
        </div>

        {/* AI 推荐区 */}
        {aiTop5.length > 0 && (
          <div className="cp-ai-section">
            <div className="cp-section-label">
              <span>🤖</span>
              <span>AI 推荐</span>
              <span className="cp-badge">Top {aiTop5.length}</span>
            </div>
            <div className="cp-ai-cards">
              {aiTop5.map(p => (
                <div
                  key={p.building_id}
                  className={"cp-ai-card" + (selectedBuildingId === p.building_id ? " active" : "")}
                  onClick={() => handleBuildingSelect(p.building_id)}
                >
                  <div className="cp-ai-card-title">
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
          <div className="cp-industry-lookup">
            <select
              className="cp-filter-select"
              value={selectedIndustry}
              onChange={e => handleIndustryChange(e.target.value)}
            >
              <option value="">— 选择产业方向 —</option>
              {ALL_INDUSTRIES.map(ind => (
                <option key={ind.name} value={ind.name}>
                  {ind.name}
                </option>
              ))}
            </select>

            {matchedParams && (
              <div className="cp-params-card">
                <div className="cp-params-title">{matchedParams.name}</div>
                <div className="cp-params-grid">
                  {matchedParams.loadMin && (
                    <div className="cp-param-item">
                      <div className="cp-param-label">最低荷载</div>
                      <div className="cp-param-value">≥ {matchedParams.loadMin} kN/㎡</div>
                    </div>
                  )}
                  {matchedParams.heightMin && (
                    <div className="cp-param-item">
                      <div className="cp-param-label">最低层高</div>
                      <div className="cp-param-value">≥ {matchedParams.heightMin} m</div>
                    </div>
                  )}
                  {matchedParams.powerKV && (
                    <div className="cp-param-item">
                      <div className="cp-param-label">配电容量</div>
                      <div className="cp-param-value">≥ {matchedParams.powerKV} kVA</div>
                    </div>
                  )}
                  {matchedParams.dualPower && (
                    <div className="cp-param-item">
                      <div className="cp-param-label">供电要求</div>
                      <div className="cp-param-value cp-param-warn">⚡ 需双回路供电</div>
                    </div>
                  )}
                </div>
                {matchedParams.special && matchedParams.special.length > 0 && (
                  <div className="cp-params-special">
                    {matchedParams.special.map((s: string, i: number) => (
                      <span key={i} className="cp-special-tag">{s}</span>
                    ))}
                  </div>
                )}
                {matchedParams.remark && (
                  <div className="cp-params-remark">💡 {matchedParams.remark}</div>
                )}
                <button className="cp-btn-apply" onClick={applyIndustryParams}>
                  ⭐ 一键填入筛选条件
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 专业筛选面板 */}
        {showFilterPanel && (
          <div className="cp-filter-panel">
            <div className="cp-filter-section-title">🏢 筛选条件</div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">园区</label>
              <select
                className="cp-filter-select"
                value={filters.parkId ?? ""}
                onChange={e => setFilters(f => ({ ...f, parkId: e.target.value || undefined }))}
              >
                <option value="">全部园区</option>
                {Object.entries(PARKS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">面积需求</label>
              <div className="cp-filter-range">
                <input className="cp-filter-input" type="number" placeholder="最小(㎡)"
                  value={filters.areaMin ?? ""}
                  onChange={e => setFilters(f => ({ ...f, areaMin: e.target.value ? Number(e.target.value) : undefined }))}
                />
                <span style={{ color: "#94a3b8", fontSize: 12 }}>~</span>
                <input className="cp-filter-input" type="number" placeholder="最大(㎡)"
                  value={filters.areaMax ?? ""}
                  onChange={e => setFilters(f => ({ ...f, areaMax: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">租金上限</label>
              <input className="cp-filter-input" type="number" placeholder="元/㎡/天"
                value={filters.priceMax ?? ""}
                onChange={e => setFilters(f => ({ ...f, priceMax: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">最低荷载</label>
              <input className="cp-filter-input" type="number" placeholder="kN/㎡"
                value={filters.loadMin ?? ""}
                onChange={e => setFilters(f => ({ ...f, loadMin: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">最低层高</label>
              <input className="cp-filter-input" type="number" placeholder="米(m)"
                value={filters.heightMin ?? ""}
                onChange={e => setFilters(f => ({ ...f, heightMin: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">最低配电</label>
              <input className="cp-filter-input" type="number" placeholder="kVA"
                value={filters.powerKVMin ?? ""}
                onChange={e => setFilters(f => ({ ...f, powerKVMin: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">104地块</label>
              <select
                className="cp-filter-select"
                value={filters.is104 ?? ""}
                onChange={e => setFilters(f => ({ ...f, is104: e.target.value || undefined }))}
              >
                <option value="">不限</option>
                <option value="是">是</option>
                <option value="否">否</option>
              </select>
            </div>
            <div className="cp-filter-actions">
              <button className="cp-btn-secondary" onClick={resetFilters}>重置</button>
              <button className="cp-btn-primary" onClick={() => setShowFilterPanel(false)}>完成</button>
            </div>
          </div>
        )}

        {/* 工具栏 */}
        <div className="cp-toolbar">
          <span className="cp-count">
            {aiResult
              ? <><strong>{filteredBuildings.length}</strong> 栋匹配
              </>
              : <><strong>{filteredBuildings.length}</strong> / {buildings.length} 栋</>
            }
          </span>
          <div className="cp-toolbar-right">
            {compareIds.size >= 2 && (
              <button className="cp-btn-compare" onClick={() => setShowCompare(true)}>
                📊 对比 {compareIds.size}栋
              </button>
            )}
          </div>
        </div>

        {/* 楼栋列表 */}
        <div className="cp-list">
          {Object.entries(grouped).length === 0 ? (
            <div className="cp-empty">未找到匹配楼栋</div>
          ) : (
            Object.entries(grouped).map(([parkName, parkBlds]) => {
              const isCollapsed = collapsedParks.has(parkName);
              return (
                <div key={parkName} className="cp-park-group">
                  <div
                    className="cp-park-header"
                    onClick={() => setCollapsedParks(prev => {
                      const next = new Set(prev);
                      isCollapsed ? next.delete(parkName) : next.add(parkName);
                      return next;
                    })}
                  >
                    <span>📍 {parkName}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="cp-park-count">{parkBlds.length}栋</span>
                      <span className="cp-collapse-icon">{isCollapsed ? "▶" : "▼"}</span>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="cp-park-buildings">
                      {parkBlds.map(b => {
                        const isAiMatched = aiBuildingIds.has(b.building_id);
                        const isActive = aiActiveBuildingId === b.building_id;
                        const isCompare = compareIds.has(b.building_id);
                        return (
                          <div
                            key={b.building_id}
                            className={[
                              "cp-building-card",
                              isAiMatched ? "ai-matched" : "",
                              isActive ? "active" : "",
                              isCompare ? "compare-selected" : "",
                            ].filter(Boolean).join(" ")}
                          >
                            <div
                              className="cp-building-checkbox"
                              onClick={e => { e.stopPropagation(); toggleCompare(b.building_id); }}
                            >
                              <span style={{ fontSize: 13 }}>{isCompare ? "☑" : "☐"}</span>
                            </div>
                            <div className="cp-building-info" onClick={() => handleBuildingSelect(b.building_id)}>
                              <div className="cp-building-name">
                                <span>🏢 {b.name}</span>
                                {isAiMatched && <span className="cp-ai-badge">🤖</span>}
                              </div>
                              <div className="cp-building-tags">
                                {b.industry && <span className="cp-tag">{b.industry}</span>}
                              </div>
                              <div className="cp-building-stats">
                                <span>空置 <strong>{b.area_vacant.toLocaleString()}㎡</strong></span>
                                <span>{b.floors}F</span>
                                {b.price != null && <span>{b.price}元/㎡·天</span>}
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

      {/* 右侧地图 */}
      <div className="cp-map-area">
        <PropertyMap
          buildings={buildings.map(b => ({
            building_id: b.building_id,
            name: b.name || b.building_id,
            industry: b.industry,
            park_id: b.park_id,
            park_name: b.park_name,
            area_vacant: b.area_vacant,
            floors: b.floors,
          }))}
          parks={[]}
          onSelect={id => id && handleBuildingSelect(id)}
          aiBuildingIds={aiBuildingIds}
          aiActiveBuildingId={aiActiveBuildingId}
        />
      </div>

      {/* 详情面板 */}
      {selectedBuildingId && (
        <BuildingDetailPanel
          buildingId={selectedBuildingId}
          onClose={() => setSelectedBuildingId(null)}
        />
      )}

      {/* 对比面板 */}
      {showCompare && compareBuildings.length >= 2 && (
        <div className="cp-compare-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCompare(false); }}>
          <div className="cp-compare-panel">
            <div className="cp-compare-header">
              <span>📊 楼栋对比</span>
              <div className="cp-compare-actions">
                <button className="cp-btn-export" onClick={() => {
                  const exportFields: [string, (b: BuildingSummary) => string][] = [
                    ["园区", b => b.park_name || b.park_id || "—"],
                    ["产业方向", b => b.industry || "—"],
                    ["层数", b => `${b.floors}层`],
                    ["总面积", b => `${b.area_total?.toLocaleString() ?? "—"}㎡`],
                    ["空置面积", b => `${b.area_vacant.toLocaleString()}㎡`],
                    ["租金单价", b => b.price ? `${b.price}元/㎡·天` : "—"],
                  ];
                  const rows = compareBuildings.map(b =>
                    `<tr>${exportFields.map(([, fn]) => `<td style="padding:8px;border:1px solid #ddd">${fn(b)}</td>`).join("")}</tr>`
                  ).join("");
                  const bldNames = compareBuildings.map(b => `<th style="padding:8px;border:1px solid #ddd;background:#3b6db5;color:white;font-weight:700">${b.name}</th>`).join("");
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
                  <tr>
                    <th>指标</th>
                    {compareBuildings.map(b => <th key={b.building_id}>{b.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["园区", (b: BuildingSummary) => b.park_name || b.park_id || "—"],
                    ["产业方向", (b: BuildingSummary) => b.industry || "—"],
                    ["层数", (b: BuildingSummary) => `${b.floors}层`],
                    ["总面积", (b: BuildingSummary) => `${b.area_total?.toLocaleString() ?? "—"}㎡`],
                    ["空置面积", (b: BuildingSummary) => ({ v: `${b.area_vacant.toLocaleString()}㎡`, highlight: true })],
                    ["租金单价", (b: BuildingSummary) => b.price ? `${b.price}元/㎡·天` : "—"],
                  ] as [string, (b: BuildingSummary) => { v: string; highlight?: boolean } | string][]).map(([label, fn]) => (
                    <tr key={label}>
                      <td className="cp-compare-row-label">{label}</td>
                      {compareBuildings.map(b => {
                        const val = fn(b);
                        const v = typeof val === "object" ? val.v : val;
                        const hl = typeof val === "object" ? val.highlight : false;
                        return <td key={b.building_id} style={hl ? { color: "#059669", fontWeight: 600 } : {}}>{v}</td>;
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
