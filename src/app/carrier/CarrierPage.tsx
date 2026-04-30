"use client";

import { useState, useEffect, useCallback } from "react";
import { loadIndustries, loadPropertyData } from "../../lib/policy";
import { filterProperties, type PropertyFilterUnit } from "../../lib/workers";
import PropertyMap from "../../components/PropertyMap";

export default function CarrierPage() {
  const [query, setQuery] = useState({
    areaMin: "", areaMax: "", priceMax: "",
    heightMin: "",
    building: "", district: "", industry: "",
  });

  const [allUnits, setAllUnits] = useState<Property[]>([]);
  const [allBuildings, setAllBuildings] = useState<any[]>([]);
  const [allParks, setAllParks] = useState<any[]>([]);
  const [buildingTypes, setBuildingTypes] = useState<string[]>([]);
  const [industryCategories, setIndustryCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [results, setResults] = useState<PropertyMatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState<"map" | "guide" | "hot" | "profile">("map");

  // Leaflet refs removed — use PropertyMap component instead

  const loadData = useCallback(async () => {
    try {
      const [indData, propData, propMeta] = await Promise.all([
        loadIndustries(),
        matchProperties({}),
        loadPropertyData(),
      ]);
      const units = (propData || []).map((r: PropertyMatchResult) => r.property);
      if (units.length === 0) {
        setLoadError("载体数据为空");
        return;
      }
      setAllUnits(units);
      setAllParks(propMeta.parks);

      // 聚合每个楼栋的空置面积（从单元汇总）
      const vacantByBld: Record<string, number> = {};
      units.forEach(u => {
        if (u.area_vacant) vacantByBld[u.building_id] = (vacantByBld[u.building_id] || 0) + u.area_vacant;
      });
      const buildingsWithVacant = propMeta.buildings.map(b => ({
        ...b,
        area_vacant: vacantByBld[b.building_id] || 0,
      }));
      setAllBuildings(buildingsWithVacant);
      const types = [...new Set(units.map(u => u.building_type).filter(Boolean))].sort() as string[];
      setIndustryCategories(indData?.categories || []);
      setBuildingTypes(types);

    } catch (e: any) {
      setLoadError(e?.message || "数据加载失败");
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    setExpanded(new Set());
    try {
      const q: any = {};
      if (query.areaMin) q.areaMin = parseFloat(query.areaMin);
      if (query.areaMax) q.areaMax = parseFloat(query.areaMax);
      if (query.priceMax) q.priceMax = parseFloat(query.priceMax);
      if (query.loadMin) q.loadMin = parseFloat(query.loadMin);
      if (query.heightMin) q.heightMin = parseFloat(query.heightMin);
      if (query.powerKVMin) q.powerKVMin = parseFloat(query.powerKVMin);
      if (query.buildingType) q.buildingType = query.buildingType;
      if (query.is104Block !== "不限") q.is104Block = query.is104Block;
      if (query.industry) q.industry = query.industry;
      q.tolerance = query.tolerance;
      const data = await matchProperties(q);
      setResults(data || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  const handleReset = () => {
    setQuery({ areaMin: "", areaMax: "", priceMax: "", loadMin: "", heightMin: "", powerKVMin: "", buildingType: "", is104Block: "不限", industry: "", tolerance: 60 });
    setResults([]); setSearched(false);
    setExpanded(new Set());
  };

  const applyProfile = (profile: any) => {
    setActiveProfile(profile);
    if (profile.loadMin != null) setQuery(q => ({ ...q, loadMin: profile.loadMin.toString() }));
    if (profile.heightMin != null) setQuery(q => ({ ...q, heightMin: profile.heightMin.toString() }));
    if (profile.powerKV != null) setQuery(q => ({ ...q, powerKVMin: profile.powerKV.toString() }));
    if (profile.priceMax != null) setQuery(q => ({ ...q, priceMax: profile.priceMax.toString() }));
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const activeFiltersCount = [query.areaMin, query.areaMax, query.priceMax, query.loadMin, query.heightMin, query.powerKVMin, query.buildingType, query.is104Block !== "不限", query.industry].filter(Boolean).length;

  const grouped = new Map<string, PropertyMatchResult[]>();
  results.forEach(r => {
    const bid = r.property.building_id;
    if (!grouped.has(bid)) grouped.set(bid, []);
    grouped.get(bid)!.push(r);
  });

  const displayGroups = showAll ? Array.from(grouped.entries()) : Array.from(grouped.entries()).slice(0, 5);
  const remaining = grouped.size - 5;

  return (
    <div className="carrier-root">
      {loadError && (
        <div className="load-error" style={{ marginBottom: 12 }}>
          <strong>⚠️ 数据加载失败</strong><br/>{loadError}
          <small>请检查飞书 API 配置或联系管理员</small>
        </div>
      )}

      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="filter-section">
            <div className="filter-label">🏢 物业类型</div>
            <select className="filter-select" value={query.buildingType} onChange={e => setQuery(q => ({ ...q, buildingType: e.target.value }))}>
              <option value="">— 全部 —</option>
              {buildingTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="filter-section">
            <div className="filter-label">📐 面积需求（㎡）</div>
            <div className="range-inputs">
              <input type="number" placeholder="最小" value={query.areaMin} onChange={e => setQuery(q => ({ ...q, areaMin: e.target.value }))} />
              <span>—</span>
              <input type="number" placeholder="最大" value={query.areaMax} onChange={e => setQuery(q => ({ ...q, areaMax: e.target.value }))} />
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-label">💰 租金上限（元/㎡/天）</div>
            <input type="number" step="0.1" placeholder="如 4.0" value={query.priceMax} onChange={e => setQuery(q => ({ ...q, priceMax: e.target.value }))} />
          </div>

          <div className="filter-section">
            <div className="filter-label">⚖️ 最低荷载（kg/㎡）</div>
            <input type="number" placeholder="如 500" value={query.loadMin} onChange={e => setQuery(q => ({ ...q, loadMin: e.target.value }))} />
          </div>

          <div className="filter-section">
            <div className="filter-label">📏 最低层高（m）</div>
            <input type="number" step="0.1" placeholder="如 4.5" value={query.heightMin} onChange={e => setQuery(q => ({ ...q, heightMin: e.target.value }))} />
          </div>

          <div className="filter-section">
            <div className="filter-label">⚡ 最低配电容量（KVA）</div>
            <input type="number" placeholder="如 315" value={query.powerKVMin} onChange={e => setQuery(q => ({ ...q, powerKVMin: e.target.value }))} />
          </div>

          <div className="filter-section">
            <div className="filter-label">📍 104地块</div>
            <select className="filter-select" value={query.is104Block} onChange={e => setQuery(q => ({ ...q, is104Block: e.target.value }))}>
              {YES_NO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="filter-section">
            <div className="filter-label">⚖️ 容错率</div>
            <div className="tolerance-row">
              <input type="range" min="30" max="95" step="5" value={query.tolerance} onChange={e => setQuery(q => ({ ...q, tolerance: parseInt(e.target.value) }))} />
              <span className="tolerance-val" style={{ color: "#059669" }}>{query.tolerance}%</span>
            </div>
            <div className="tolerance-hint">只显示匹配度 ≥ {query.tolerance}% 的结果</div>
          </div>

          <div className="form-actions">
            <button className="btn-primary" onClick={handleSearch} disabled={loading}>
              {loading ? "匹配中..." : "🔍 开始匹配"}
            </button>
            <button className="btn-secondary" onClick={handleReset}>重置</button>
          </div>
          {activeFiltersCount > 0 && <div className="filter-count">{activeFiltersCount} 个筛选条件</div>}
        </aside>

        {/* Content */}
        <main className="content">
          {!searched && (
            <>
              <div className="demo-tabs" style={{ marginTop: 16 }}>
                <button className={demoMode === "map" ? "active" : ""} onClick={() => setDemoMode("map")}>📍 载体地图</button>
                <button className={demoMode === "guide" ? "active" : ""} onClick={() => setDemoMode("guide")}>💡 使用引导</button>
                <button className={demoMode === "hot" ? "active" : ""} onClick={() => setDemoMode("hot")}>🔥 优质载体</button>
                <button className={demoMode === "profile" ? "active" : ""} onClick={() => setDemoMode("profile")}>⚙️ 参数推荐</button>
              </div>

              {demoMode === "guide" && (
                <div className="overview-panel">
                  <div className="overview-title">💡 如何使用载体匹配</div>
                  <div className="guide-steps">
                    <div className="guide-step">
                      <span className="guide-num" style={{ background: "#059669" }}>1</span>
                      <div><strong>选择物业条件</strong><p>设定面积、租金、荷载、层高等需求</p></div>
                    </div>
                    <div className="guide-step">
                      <span className="guide-num" style={{ background: "#059669" }}>2</span>
                      <div><strong>调整容错率</strong><p>容错率越高匹配范围越宽，建议 60-80%</p></div>
                    </div>
                    <div className="guide-step">
                      <span className="guide-num" style={{ background: "#059669" }}>3</span>
                      <div><strong>查看结果并展开</strong><p>按匹配度排序，点击卡片展开查看楼层详情</p></div>
                    </div>
                  </div>
                </div>
              )}

              {demoMode === "hot" && (() => {
                const areaByBld: Record<string, number> = {};
                const priceByBld: Record<string, number[]> = {};
                const nameByBld: Record<string, string> = {};
                const typeByBld: Record<string, string> = {};
                allUnits.forEach(u => {
                  if (!u.building_id) return;
                  areaByBld[u.building_id] = (areaByBld[u.building_id] || 0) + (u.area_vacant || 0);
                  if (u.price != null) (priceByBld[u.building_id] = priceByBld[u.building_id] || []).push(u.price);
                  if (!nameByBld[u.building_id]) nameByBld[u.building_id] = u.building_name || u.building_id;
                  if (!typeByBld[u.building_id]) typeByBld[u.building_id] = u.building_type || "研发办公";
                });
                const top3 = Object.entries(areaByBld).sort((a, b) => b[1] - a[1]).slice(0, 3);
                const badges = ["⭐ 推荐", "新上", "🔥 热门"];
                return (
                  <div className="overview-panel">
                    <div className="overview-title">🔥 优质载体推荐</div>
                    <div className="hot-list">
                      {top3.map(([bid, area], i) => (
                        <div key={bid} className="hot-item">
                          <span className="hot-badge">{badges[i]}</span>
                          <strong>{nameByBld[bid]}</strong>
                          <span>{typeByBld[bid]} · {area.toLocaleString()}㎡ · {priceByBld[bid]?.length ? Math.min(...priceByBld[bid]) + "元/㎡/天" : "-"}</span>
                        </div>
                      ))}
                    </div>
                    <div className="overview-hint">← 填写条件查看真实匹配结果</div>
                  </div>
                );
              })()}

              {demoMode === "map" && (
                <div className="overview-panel">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <PropertyMap
                    {...({
                      buildings: searched
                        ? results.map((r: PropertyMatchResult) => {
                            const b = allBuildings.find(b => b.building_id === r.property.building_id);
                            return { ...b, building_id: r.property.building_id, name: b?.name || r.property.building_name || b?.building_id, floors: b?.floors ?? null, area_vacant: r.property.area_vacant ?? 0, park_id: r.property.park_id };
                          })
                        : allBuildings.map(b => ({ ...b, name: b.name || b.building_id })),
                      parks: allParks,
                    }) as any}
                  />
                </div>
              )}

              {demoMode === "profile" && (
                <div className="overview-panel">
                  <div className="overview-title">⚙️ 产业参数推荐</div>
                  <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
                    选择产业方向，自动获得对应的物业参数推荐（荷载、层高、配电等）
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#888", marginBottom: 4, fontWeight: 600 }}>第一步：选择大类</div>
                      <select
                        value={selectedCategory}
                        onChange={(e) => { setSelectedCategory(e.target.value); setSelectedIndustry(""); setActiveProfile(null); }}
                        className="profile-select"
                      >
                        <option value="">— 选择产业大类 —</option>
                        {industryCategories.map((cat: any) => (
                          <option key={cat.code} value={cat.code}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    {selectedCategory && (() => {
                      const cat = industryCategories.find((c: any) => c.code === selectedCategory);
                      const industries = cat?.industries || [];
                      return (
                        <div>
                          <div style={{ fontSize: 12, color: "#888", marginBottom: 4, fontWeight: 600 }}>第二步：选择细分方向</div>
                          <select
                            value={selectedIndustry}
                            onChange={(e) => {
                              setSelectedIndustry(e.target.value);
                              const ind = industries.find((i: any) => i.code === e.target.value);
                              setActiveProfile(ind || null);
                            }}
                            className="profile-select"
                          >
                            <option value="">— 选择细分行业 —</option>
                            {industries.map((ind: any) => (
                              <option key={ind.code} value={ind.code}>{ind.name}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })()}
                    {activeProfile && (
                      <div style={{ background: "linear-gradient(135deg, #f8f4ff 0%, #f0f8ff 100%)", borderRadius: 10, padding: "14px 16px", border: "1px solid #e0d0ff" }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{activeProfile.name}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {activeProfile.loadMin != null && (
                            <span style={{ background: "#e8f4ff", color: "#1a5fb4", padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>⚖️ 荷载 ≥{activeProfile.loadMin}kg/㎡</span>
                          )}
                          {activeProfile.heightMin != null && (
                            <span style={{ background: "#fff3e0", color: "#e65100", padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>📏 层高 ≥{activeProfile.heightMin}m</span>
                          )}
                          {activeProfile.powerKV != null && (
                            <span style={{ background: "#e8f5e9", color: "#2e7d32", padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>⚡ 配电 {activeProfile.powerKV}KVA</span>
                          )}
                          {activeProfile.dualPower && (
                            <span style={{ background: "#fff8e1", color: "#f57f17", padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>🔌 双回路供电</span>
                          )}
                          {activeProfile.cleanliness && (
                            <span style={{ background: "#f3e5f5", color: "#6a1b9a", padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>🏭 {activeProfile.cleanliness}</span>
                          )}
                          {activeProfile.fireRating && (
                            <span style={{ background: "#fce4ec", color: "#c62828", padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>🔥 {activeProfile.fireRating}</span>
                          )}
                        </div>
                        {activeProfile.special && activeProfile.special.length > 0 && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                            <span style={{ fontWeight: 600 }}>特殊要求：</span>{activeProfile.special.join(" · ")}
                          </div>
                        )}
                        {activeProfile.remark && (
                          <div style={{ marginTop: 6, fontSize: 12, color: "#888", fontStyle: "italic" }}>💡 {activeProfile.remark}</div>
                        )}
                        <button
                          onClick={() => applyProfile(activeProfile)}
                          style={{ marginTop: 10, background: "#3b6db5", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
                        >
                          填入左侧条件 →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>正在匹配载体数据...</p>
            </div>
          )}

          {searched && !loading && results.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>未找到匹配结果<br /><small>尝试降低容错率或调整筛选条件</small></p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="toolbar">
                <span className="count">找到 <strong>{(() => {
                  const bids = new Set(results.map(r => r.property.building_id));
                  return `${bids.size} 栋楼，${results.length} 层`;
                })()}</strong></span>
                <div className="legend">
                  <span className="legend-item" style={{ color: "#8a5a00" }}>🏆 90%+</span>
                  <span className="legend-item" style={{ color: "#666" }}>🥈 75-89%</span>
                  <span className="legend-item" style={{ color: "#7a4520" }}>🥉 60-74%</span>
                </div>
              </div>

              <div className="result-list">
                {displayGroups.map(([buildingId, unitResults]) => {
                  const best = unitResults.reduce((a, b) => a.totalScore > b.totalScore ? a : b);
                  const p = best.property;
                  const isExpanded = expanded.has(buildingId);
                  const floors = unitResults.sort((a, b) => (a.property.floor || 0) - (b.property.floor || 0));
                  const totalLeasable = floors.reduce((s, r) => s + (r.property.area_total || 0), 0);
                  const totalVacant = floors.reduce((s, r) => s + (r.property.area_vacant || 0), 0);
                  const priceRange = floors.length === 1
                    ? `${floors[0].property.price}元/㎡/天`
                    : `${Math.min(...floors.map(f => f.property.price || 0))}-${Math.max(...floors.map(f => f.property.price || 0))}元/㎡/天`;

                  return (
                    <div key={buildingId} className={`result-item ${isExpanded ? "expanded" : ""}`}>
                      <div className="result-top" onClick={() => toggleExpand(buildingId)}>
                        {/* 匹配度徽章 — 左侧固定突出 */}
                        <div className={`score-badge ${best.totalScore >= 90 ? "gold" : best.totalScore >= 75 ? "silver" : "bronze"}`}>
                          <span className="score-num">{best.totalScore}</span>
                          <span className="score-pct">%</span>
                        </div>

                        {/* 载体信息 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="result-name" style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", lineHeight: 1.4 }}>
                            {p.park_name}
                            <span style={{ color: "#94a3b8", fontWeight: 400, margin: "0 4px" }}>·</span>
                            {p.building_name}
                          </div>
                          {p.building_type && (
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{p.building_type}</div>
                          )}
                        </div>

                        <div className="expand-hint">{isExpanded ? "▲ 收起" : "▼ 展开"}</div>
                      </div>

                      <div className="result-meta compact">
                        <span className="meta-main">🏗️ 可租 {Math.round(totalLeasable).toLocaleString()}㎡</span>
                        <span className="meta-main">📋 空置 {Math.round(totalVacant).toLocaleString()}㎡</span>
                        <span className="meta-main">💰 {priceRange}</span>
                        <span className="meta-main">🏢 {floors.length}层</span>
                      </div>

                      {best.matchReason && best.matchReason !== "基础匹配" && (
                        <div className="result-match-reason">✓ {best.matchReason}</div>
                      )}

                      {isExpanded && (
                        <div className="result-details">
                          <div className="detail-section">
                            <div className="detail-title">🚪 楼层详情（共{floors.length}层）</div>
                            <div className="floor-table">
                              <div className="floor-table-header">
                                <span>楼层</span><span>可租面积（㎡）</span><span>空置面积（㎡）</span><span>层高（m）</span><span>租金</span>
                              </div>
                              {floors.map(r => (
                                <div key={r.property.unit_id} className="floor-table-row">
                                  <span>{r.property.unit_no || `第${r.property.floor}层`}</span>
                                  <span>{r.property.area_total?.toLocaleString() || "-"}</span>
                                  <span>{r.property.area_vacant?.toLocaleString() || "-"}</span>
                                  <span>{r.property.floor_height ?? "-"}</span>
                                  <span>{r.property.price != null ? `${r.property.price}元/㎡/天` : "-"}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="detail-section">
                            <div className="detail-title">🏢 楼宇信息</div>
                            <div className="detail-grid">
                              <div className="detail-item"><span className="detail-label">类型</span><span className="detail-value">{p.building_type || "-"}</span></div>
                              <div className="detail-item"><span className="detail-label">楼层</span><span className="detail-value">{p.floors ? `共${p.floors}层` : "-"}</span></div>
                              <div className="detail-item"><span className="detail-label">物业费</span><span className="detail-value">{p.property_fee ? `${p.property_fee}元/㎡/月` : "-"}</span></div>
                              <div className="detail-item"><span className="detail-label">空调</span><span className="detail-value">{p.ac_type || "-"}</span></div>
                              <div className="detail-item"><span className="detail-label">配电</span><span className="detail-value">{p.power_kv ? `${p.power_kv}KVA` : "-"}</span></div>
                              <div className="detail-item"><span className="detail-label">土地性质</span><span className="detail-value">{p.land_nature || "-"}</span></div>
                              <div className="detail-item"><span className="detail-label">104地块</span><span className="detail-value">{p.is_104_block || "-"}</span></div>
                              <div className="detail-item"><span className="detail-label">产业方向</span><span className="detail-value">{p.industry || "-"}</span></div>
                            </div>
                          </div>

                          <div className="detail-section">
                            <div className="detail-title">🏪 园区配套</div>
                            <div className="detail-grid">
                              <div className="detail-item"><span className="detail-label">食堂</span><span className="detail-value">{p.canteen || "-"}</span></div>
                              <div className="detail-item"><span className="detail-label">人才公寓</span><span className="detail-value">{p.dormitory || "-"}</span></div>
                              <div className="detail-item"><span className="detail-label">停车位</span><span className="detail-value">{p.parking_total || "-"}</span></div>
                              <div className="detail-item"><span className="detail-label">会议室</span><span className="detail-value">{p.meeting_rooms || "-"}</span></div>
                            </div>
                          </div>

                          <div className="result-footer">
                            <span>📍 {p.address}</span>
                            {p.contact && <span>👤 {p.contact}</span>}
                            {p.phone && <span>📞 {p.phone}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!showAll && remaining > 0 && (
                <div className="show-all-btn">
                  <button className="btn-secondary" onClick={() => setShowAll(true)} style={{ fontSize: 13, padding: "9px 28px" }}>🏢 展示全部 {grouped.size} 栋楼（还有 {remaining} 栋）</button>
                </div>
              )}
              {showAll && remaining > 0 && (
                <div className="show-all-btn">
                  <button className="btn-secondary" onClick={() => setShowAll(false)} style={{ fontSize: 13, padding: "9px 28px" }}>🔼 收起</button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <div className="footer-bar">
        <div className="disclaimer">⚠️ 本系统为内部测试工具，载体信息仅供参考，不构成正式租赁建议。</div>
        <div className="author">Author: Els.J · 仅供内部使用</div>
      </div>
    </div>
  );
}