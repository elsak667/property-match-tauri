/**
 * 物业载体匹配页面
 */
import { useState, useEffect, useCallback } from "react";
import { INDUSTRY_PROFILES, filterProperties } from "./mockData";
import { useProperties } from "../../lib/useFeishu";
import type { Property, IndustryCategory } from "./types";
import PropertyMap from "../../components/PropertyMap";

function PropertyCard({ item, active, onClick }: { item: Property; active: boolean; onClick: () => void }) {
  return (
    <div
      className={`result-item${active ? " expanded" : ""}`}
      style={{ cursor: "pointer", borderLeft: active ? "3px solid #3b6db5" : undefined }}
      onClick={onClick}
    >
      <div className="result-top">
        <div className="result-name">{item.name}</div>
        <span className="hot-badge">🏢 {item.type}</span>
      </div>
      <div className="result-meta compact">
        <span className="meta-main">📍 {item.park}</span>
        {item.load && <span>⚖️ 荷载 {item.load}kg/㎡</span>}
        {item.height && <span>📏 层高 {item.height}m</span>}
        {item.areaMin && item.areaMax && (
          <span>📐 面积 {item.areaMin}–{item.areaMax}㎡</span>
        )}
        {item.priceMin && item.priceMax && (
          <span>💰 {item.priceMin}–{item.priceMax}元/㎡/天</span>
        )}
      </div>
      {item.industry && (
        <div className="result-match-reason">🏭 {item.industry}</div>
      )}
      {item.remark && (
        <div className="result-details">
          <div className="detail-section">
            <div className="detail-title">基本信息</div>
            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">配电</span><span className="detail-value">{item.powerKV ? `${item.powerKV}KVA` : "—"}</span></div>
              <div className="detail-item"><span className="detail-label">土地性质</span><span className="detail-value">{item.landNature || "—"}</span></div>
              <div className="detail-item"><span className="detail-label">104地块</span><span className="detail-value">{item.is104Block || "—"}</span></div>
              <div className="detail-item"><span className="detail-label">停车位</span><span className="detail-value">{item.parkingTotal || "—"}</span></div>
            </div>
          </div>
          {item.remark && (
            <div className="detail-section">
              <div className="detail-title">备注</div>
              <div className="detail-text">{item.remark}</div>
            </div>
          )}
          {item.contact && (
            <div className="detail-section">
              <div className="detail-title">联系方式</div>
              <div className="detail-text">{item.contact}</div>
            </div>
          )}
          {(item.canteen || item.dormitory) && (
            <div className="detail-section">
              <div className="detail-title">🏪 园区配套</div>
              <div className="detail-grid">
                {item.canteen && <div className="detail-item"><span className="detail-label">食堂</span><span className="detail-value">{item.canteen}</span></div>}
                {item.dormitory && <div className="detail-item"><span className="detail-label">宿舍</span><span className="detail-value">{item.dormitory}</span></div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PropertyPage() {
  const { properties, loading, fromFeishu } = useProperties();
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [areaMax, setAreaMax] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [loadMin, setLoadMin] = useState("");
  const [heightMin, setHeightMin] = useState("");
  const [powerKVMin, setPowerKVMin] = useState("");
  const [selectedPark, setSelectedPark] = useState("");
  const [is104, setIs104] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [activeProfile, setActiveProfile] = useState<IndustryCategory["industries"][0] | null>(null);
  const [results, setResults] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(true);

  // 同步 properties → results
  useEffect(() => {
    setResults(properties);
  }, [properties]);

  const types = [...new Set(properties.map(p => p.type).filter(Boolean))].sort();
  const currentCategory = INDUSTRY_PROFILES.categories.find(c => c.code === selectedCategory);
  const currentIndustries = currentCategory?.industries || [];

  const doSearch = useCallback(() => {
    const filtered = filterProperties(properties, {
      query: query || undefined,
      type: selectedType || undefined,
      areaMin: areaMin ? parseFloat(areaMin) : undefined,
      areaMax: areaMax ? parseFloat(areaMax) : undefined,
      priceMax: priceMax ? parseFloat(priceMax) : undefined,
      loadMin: loadMin ? parseFloat(loadMin) : undefined,
      heightMin: heightMin ? parseFloat(heightMin) : undefined,
      powerKVMin: powerKVMin ? parseFloat(powerKVMin) : undefined,
      park: selectedPark || undefined,
      is104: is104 || undefined,
    });
    setResults(filtered);
  }, [properties, query, selectedType, areaMin, areaMax, priceMax, loadMin, heightMin, powerKVMin, selectedPark, is104]);

  useEffect(() => {
    const t = setTimeout(doSearch, 300);
    return () => clearTimeout(t);
  }, [doSearch]);

  useEffect(() => {
    if (!results.find(r => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [results, selectedId]);

  function applyProfile(profile: IndustryCategory["industries"][0]) {
    setActiveProfile(profile);
    if (profile.loadMin != null) setLoadMin(profile.loadMin.toString());
    if (profile.heightMin != null) setHeightMin(profile.heightMin.toString());
    if (profile.priceMax != null) setPriceMax(profile.priceMax.toString());
  }

  function resetAll() {
    setQuery(""); setSelectedType(""); setAreaMin(""); setAreaMax("");
    setPriceMax(""); setLoadMin(""); setHeightMin("");
    setPowerKVMin(""); setSelectedPark(""); setIs104("");
    setSelectedCategory(""); setSelectedIndustry(""); setActiveProfile(null);
    setSelectedId(null);
  }

  const activeFiltersCount = [selectedType, areaMin, areaMax, priceMax, loadMin, heightMin, powerKVMin, selectedPark, is104, query].filter(Boolean).length;

  const parks = [...new Set(properties.map(p => p.park).filter(Boolean))].sort();

  return (
    <div className="container">
      <div className="main-layout">
        <aside className="sidebar">
          <div className="filter-section">
            <div className="filter-label">🏭 产业推荐</div>
            <select
              className="filter-select"
              value={selectedCategory}
              onChange={e => { setSelectedCategory(e.target.value); setSelectedIndustry(""); setActiveProfile(null); }}
            >
              <option value="">— 选择大类 —</option>
              {INDUSTRY_PROFILES.categories.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          {currentCategory && (
            <div className="filter-section">
              <select
                className="filter-select"
                value={selectedIndustry}
                onChange={e => {
                  setSelectedIndustry(e.target.value);
                  const ind = currentIndustries.find(i => i.code === e.target.value);
                  if (ind) applyProfile(ind);
                }}
              >
                <option value="">— 选择细分行业 —</option>
                {currentIndustries.map(i => (
                  <option key={i.code} value={i.code}>{i.name}</option>
                ))}
              </select>
            </div>
          )}
          {activeProfile && (
            <div className="profile-panel">
              <div className="profile-name">{activeProfile.name}</div>
              <div className="profile-tags">
                {activeProfile.loadMin && <span>⚖️ 荷载≥{activeProfile.loadMin}</span>}
                {activeProfile.heightMin && <span>📏 层高≥{activeProfile.heightMin}m</span>}
                {activeProfile.dualPower && <span>🔌 双回路</span>}
                {activeProfile.powerKV && <span>⚡ {activeProfile.powerKV}KVA</span>}
              </div>
              <button className="btn-primary btn-sm" onClick={() => applyProfile(activeProfile!)}>
                填入条件 →
              </button>
            </div>
          )}

          <div className="divider" />

          <div className="filter-section">
            <div className="filter-label">🔍 关键词搜索</div>
            <input
              id="prop-query"
              type="text"
              aria-label="关键词搜索"
              placeholder="物业名称、园区..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-section">
            <div className="filter-label">🏢 物业类型</div>
            <select
              className="filter-select"
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
            >
              <option value="">— 全部 —</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="filter-section">
            <div className="filter-label">📐 面积需求（㎡）</div>
            <div className="range-inputs">
              <input type="number" placeholder="最小" value={areaMin} onChange={e => setAreaMin(e.target.value)} />
              <span>—</span>
              <input type="number" placeholder="最大" value={areaMax} onChange={e => setAreaMax(e.target.value)} />
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-label">💰 租金上限（元/㎡/天）</div>
            <input type="number" step="0.1" placeholder="如 6.0" value={priceMax} onChange={e => setPriceMax(e.target.value)} />
          </div>

          <div className="filter-section">
            <div className="filter-label">⚖️ 最低荷载（kg/㎡）</div>
            <input type="number" placeholder="如 500" value={loadMin} onChange={e => setLoadMin(e.target.value)} />
          </div>

          <div className="filter-section">
            <div className="filter-label">📏 最低层高（m）</div>
            <input type="number" step="0.1" placeholder="如 4.5" value={heightMin} onChange={e => setHeightMin(e.target.value)} />
          </div>

          <div className="filter-section">
            <div className="filter-label">⚡ 最低配电容量（KVA）</div>
            <input type="number" placeholder="如 315" value={powerKVMin} onChange={e => setPowerKVMin(e.target.value)} />
          </div>

          {parks.length > 0 && (
            <div className="filter-section">
              <div className="filter-label">🏗️ 园区</div>
              <select
                className="filter-select"
                value={selectedPark}
                onChange={e => setSelectedPark(e.target.value)}
              >
                <option value="">— 全部园区 —</option>
                {parks.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          <div className="filter-section">
            <div className="filter-label">📍 104地块</div>
            <select
              className="filter-select"
              value={is104}
              onChange={e => setIs104(e.target.value)}
            >
              <option value="">— 全部 —</option>
              <option value="是">是</option>
              <option value="否">否</option>
            </select>
          </div>

          <div className="form-actions">
            <button className="btn-secondary" onClick={resetAll}>重置</button>
            <button className="btn-primary" onClick={doSearch}>🔍 搜索</button>
          </div>
          {activeFiltersCount > 0 && (
            <div className="filter-count">已选 {activeFiltersCount} 个筛选条件</div>
          )}
        </aside>

        <main className="content">
          <div className="toolbar">
            <div className="count">
              {loading ? (
                <>加载中...</>
              ) : (
                <>共找到 <strong>{results.length}</strong> 处物业</>
              )}
            </div>
            <div className="legend">
              <span className="legend-item">
                {fromFeishu ? "📡 飞书数据" : "📋 Mock数据"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              className={`btn-${showMap ? "secondary" : "primary"}`}
              onClick={() => setShowMap(v => !v)}
            >
              {showMap ? "📍 收起地图" : "🗺️ 显示地图"}
            </button>
          </div>

          {showMap && (
            <PropertyMap
              buildings={results}
              selectedId={selectedId}
              onSelect={id => setSelectedId(prev => prev === id ? null : id)}
            />
          )}

          <div className="result-list" style={{ marginTop: 14 }}>
            {loading ? (
              <div className="loading-state">
                <div className="spinner" aria-label="加载中"></div>
                <p>正在加载物业数据...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏢</div>
                <p>未找到匹配物业</p>
                <small>试试调整筛选条件</small>
              </div>
            ) : (
              results.map(item => (
                <PropertyCard
                  key={item.id}
                  item={item}
                  active={selectedId === item.id}
                  onClick={() => setSelectedId(prev => prev === item.id ? null : item.id)}
                />
              ))
            )}
          </div>
        </main>
      </div>

      <div className="footer-banner">
        <div className="footer-warning">⚠️ 本系统为内部测试工具，物业信息来源于飞书表格，匹配结果仅供参考。</div>
        <div className="footer-credit">浦发集团招商中心 · 仅供内部使用 · 技术支持：Els.J</div>
      </div>
    </div>
  );
}
