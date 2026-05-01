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

// 楼栋筛选条件
interface FilterOpts {
  nameQuery: string;
  areaMin?: number;
  areaMax?: number;
  parkId?: string;
  industry?: string;
}

function filterBuildings(buildings: BuildingSummary[], opts: FilterOpts): BuildingSummary[] {
  const { nameQuery, areaMin, areaMax, parkId, industry } = opts;
  return buildings.filter(b => {
    if (nameQuery) {
      const q = nameQuery.toLowerCase();
      const match = !b.name?.toLowerCase().includes(q) &&
        !b.park_name?.toLowerCase().includes(q) &&
        !b.industry?.toLowerCase().includes(q);
      if (match) return false;
    }
    if (areaMin && b.area_vacant < areaMin) return false;
    if (areaMax && b.area_total && b.area_total > areaMax) return false;
    if (parkId && b.park_id !== parkId) return false;
    if (industry && !b.industry?.includes(industry)) return false;
    return true;
  });
}

const INDUSTRIES = ["新能源", "人工智能", "芯片半导体", "生物医药", "智能制造", "金融科技", "新材料"];
const PARKS: Record<string, string> = { PARK001: "金桥北区", PARK002: "金桥南区" };

export default function CarrierPage({ aiResult, aiActiveBuildingId, onAiBuildingClick }: Props) {
  const [buildings, setBuildings] = useState<BuildingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedPark, setSelectedPark] = useState<string>("");

  // 筛选
  const [filters, setFilters] = useState<FilterOpts>({ nameQuery: "" });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterCount, setFilterCount] = useState(0);

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
  // AI 推荐 Top5
  const aiTop5 = (aiResult?.properties ?? []).slice(0, 5);

  // 计算筛选后的楼栋
  const filteredBuildings = filterBuildings(buildings, { ...filters, parkId: selectedPark || undefined });

  // 统计激活筛选条件数
  useEffect(() => {
    let count = 0;
    if (filters.nameQuery) count++;
    if (filters.areaMin || filters.areaMax) count++;
    if (filters.industry) count++;
    if (selectedPark) count++;
    setFilterCount(count);
  }, [filters, selectedPark]);

  // 同步 AI 高亮到详情面板
  useEffect(() => {
    if (aiActiveBuildingId) setSelectedBuildingId(aiActiveBuildingId);
  }, [aiActiveBuildingId]);

  const handleBuildingSelect = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    onAiBuildingClick?.(buildingId);
  };

  const handleNameSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(f => ({ ...f, nameQuery: e.target.value }));
  };

  function toggleFilterField<K extends keyof FilterOpts>(key: K, value: FilterOpts[K]) {
    setFilters(f => ({ ...f, [key]: value }));
  }

  function resetFilters() {
    setFilters({ nameQuery: "" });
    setSelectedPark("");
    setFilterCount(0);
  }

  function toggleCompare(bldId: string) {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(bldId)) next.delete(bldId); else {
        if (next.size >= 4) return prev; // 最多4个
        next.add(bldId);
      }
      return next;
    });
  }

  // 按园区分组
  const grouped = filteredBuildings.reduce<Record<string, BuildingSummary[]>>((acc, b) => {
    const key = b.park_name || b.park_id || "";
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  // 对比面板数据
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
      {/* 左侧：搜索 + 筛选 + 列表 */}
      <div className="cp-sidebar">
        {/* 搜索栏 */}
        <div className="cp-search-bar">
          <div className="cp-search-input-wrap">
            <span className="cp-search-icon">🔍</span>
            <input
              className="cp-search-input"
              type="text"
              placeholder="搜索楼栋名称、产业方向、园区..."
              value={filters.nameQuery}
              onChange={handleNameSearch}
            />
            {filters.nameQuery && (
              <button className="cp-search-clear" onClick={() => setFilters(f => ({ ...f, nameQuery: "" }))}>✕</button>
            )}
          </div>
          <button
            className={"cp-filter-btn" + (showFilterPanel ? " active" : "")}
            onClick={() => setShowFilterPanel(v => !v)}
            title="更多筛选条件"
          >
            ⚙️
            {filterCount > 0 && <span className="cp-filter-count">{filterCount}</span>}
          </button>
        </div>

        {/* AI 推荐区（仅 AI 搜索后显示） */}
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
                    {p.building || p.name}
                    <span className="cp-score">{p.score}</span>
                  </div>
                  <div className="cp-ai-card-meta">
                    {p.park && <span>📍 {p.park}</span>}
                  </div>
                  <div className="cp-ai-card-reason">{p.match_reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 专业筛选面板（可折叠） */}
        {showFilterPanel && (
          <div className="cp-filter-panel">
            <div className="cp-filter-row">
              <label className="cp-filter-label">园区</label>
              <select
                className="cp-filter-select"
                value={selectedPark}
                onChange={e => setSelectedPark(e.target.value)}
              >
                <option value="">全部园区</option>
                {Object.entries(PARKS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">产业方向</label>
              <select
                className="cp-filter-select"
                value={filters.industry ?? ""}
                onChange={e => toggleFilterField("industry", e.target.value || undefined)}
              >
                <option value="">全部</option>
                {INDUSTRIES.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
            <div className="cp-filter-row">
              <label className="cp-filter-label">空置面积 ≥</label>
              <input
                className="cp-filter-input"
                type="number"
                placeholder="最小面积(㎡)"
                onChange={e => toggleFilterField("areaMin", e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div className="cp-filter-actions">
              <button className="cp-btn-secondary" onClick={resetFilters}>重置</button>
              <button className="cp-btn-primary" onClick={() => setShowFilterPanel(false)}>应用</button>
            </div>
          </div>
        )}

        {/* 工具栏 */}
        <div className="cp-toolbar">
          <span className="cp-count">
            {aiResult ? `AI 匹配 ${filteredBuildings.length} 栋` : `共 ${filteredBuildings.length} 栋楼`}
          </span>
          <div className="cp-toolbar-right">
            {compareIds.size >= 2 && (
              <button className="cp-btn-compare" onClick={() => setShowCompare(true)}>
                📊 对比 ({compareIds.size})
              </button>
            )}
          </div>
        </div>

        {/* 楼栋列表（按园区分组） */}
        <div className="cp-list">
          {Object.entries(grouped).length === 0 ? (
            <div className="cp-empty">未找到匹配的楼栋</div>
          ) : (
            Object.entries(grouped).map(([parkName, parkBlds]) => {
              const isCollapsed = collapsedParks.has(parkName);
              return (
                <div key={parkName} className="cp-park-group">
                  <div
                    className="cp-park-header"
                    onClick={() => setCollapsedParks(prev => {
                      const next = new Set(prev);
                      if (next.has(parkName)) next.delete(parkName); else next.add(parkName);
                      return next;
                    })}
                  >
                    <span>📍 {parkName}（{parkBlds.length} 栋）</span>
                    <span className="cp-collapse-icon">{isCollapsed ? "▶" : "▼"}</span>
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
                              {isCompare ? "☑️" : "☐"}
                            </div>
                            <div className="cp-building-info" onClick={() => handleBuildingSelect(b.building_id)}>
                              <div className="cp-building-name">
                                <span>🏢 {b.name}</span>
                                {isAiMatched && <span className="cp-ai-badge">🤖 AI</span>}
                              </div>
                              <div className="cp-building-tags">
                                {b.industry && <span className="cp-tag">{b.industry}</span>}
                              </div>
                              <div className="cp-building-stats">
                                <span>空置 <strong>{b.area_vacant.toLocaleString()}㎡</strong></span>
                                <span>{b.floors}层</span>
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

      {/* 右侧：地图 */}
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
          onSelect={(id) => id && handleBuildingSelect(id)}
          aiBuildingIds={aiBuildingIds}
          aiActiveBuildingId={aiActiveBuildingId}
        />
      </div>

      {/* 楼栋详情面板（侧边滑出） */}
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
                  const rows = compareBuildings.map(b => `<tr>
                    <td style="padding:8px;border:1px solid #ddd;font-weight:bold">${b.name}</td>
                    <td style="padding:8px;border:1px solid #ddd">${b.park_name || b.park_id}</td>
                    <td style="padding:8px;border:1px solid #ddd">${b.industry || "—"}</td>
                    <td style="padding:8px;border:1px solid #ddd;text-align:right">${b.area_total?.toLocaleString() ?? "—"}(㎡)</td>
                    <td style="padding:8px;border:1px solid #ddd;text-align:right">${b.area_vacant.toLocaleString()}(㎡)</td>
                    <td style="padding:8px;border:1px solid #ddd;text-align:right">${b.floors}层</td>
                  </tr>`).join("");
                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>楼栋对比</title><style>body{padding:24px}table{border-collapse:collapse;width:100%}th{background:#eef2ff;padding:8px;border:1px solid #ddd;text-align:left}</style></head><body>
                    <h1 style="color:#3b6db5">楼栋对比</h1>
                    <table><thead><tr><th>楼栋</th><th>园区</th><th>产业</th><th>总面积</th><th>空置面积</th><th>层数</th></tr></thead><tbody>${rows}</tbody></table>
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
                  <tr><td className="cp-compare-row-label">园区</td>{compareBuildings.map(b => <td key={b.building_id}>{b.park_name || b.park_id}</td>)}</tr>
                  <tr><td className="cp-compare-row-label">产业</td>{compareBuildings.map(b => <td key={b.building_id}>{b.industry || "—"}</td>)}</tr>
                  <tr><td className="cp-compare-row-label">层数</td>{compareBuildings.map(b => <td key={b.building_id}>{b.floors}层</td>)}</tr>
                  <tr><td className="cp-compare-row-label">总面积</td>{compareBuildings.map(b => <td key={b.building_id}>{b.area_total?.toLocaleString() ?? "—"}(㎡)</td>)}</tr>
                  <tr><td className="cp-compare-row-label">空置面积</td>{compareBuildings.map(b => <td key={b.building_id} style={{ color: "#059669", fontWeight: 600 }}>{b.area_vacant.toLocaleString()}(㎡)</td>)}</tr>
                  <tr><td className="cp-compare-row-label">单价</td>{compareBuildings.map(b => <td key={b.building_id}>{b.price ? `${b.price}元/㎡·天` : "—"}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}