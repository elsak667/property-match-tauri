/**
 * 物业载体匹配页面
 */
import { useState, useEffect, useCallback } from "react";
import { PROPERTIES, INDUSTRY_PROFILES, filterProperties } from "./mockData";
import type { Property, IndustryCategory } from "./types";

function PropertyCard({ item }: { item: Property }) {
  return (
    <div className="result-item">
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
            <div className="detail-title">备注</div>
            <div className="detail-text">{item.remark}</div>
          </div>
          {item.contact && (
            <div className="detail-section">
              <div className="detail-title">联系方式</div>
              <div className="detail-text">{item.contact}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PropertyPage() {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [areaMax, setAreaMax] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [loadMin, setLoadMin] = useState("");
  const [heightMin, setHeightMin] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [activeProfile, setActiveProfile] = useState<IndustryCategory["industries"][0] | null>(null);
  const [results, setResults] = useState<Property[]>(PROPERTIES);

  const types = [...new Set(PROPERTIES.map(p => p.type).filter(Boolean))].sort();

  const currentCategory = INDUSTRY_PROFILES.categories.find(c => c.code === selectedCategory);
  const currentIndustries = currentCategory?.industries || [];

  const doSearch = useCallback(() => {
    const filtered = filterProperties(PROPERTIES, {
      query: query || undefined,
      type: selectedType || undefined,
      areaMin: areaMin ? parseFloat(areaMin) : undefined,
      areaMax: areaMax ? parseFloat(areaMax) : undefined,
      priceMax: priceMax ? parseFloat(priceMax) : undefined,
      loadMin: loadMin ? parseFloat(loadMin) : undefined,
      heightMin: heightMin ? parseFloat(heightMin) : undefined,
    });
    setResults(filtered);
  }, [query, selectedType, areaMin, areaMax, priceMax, loadMin, heightMin]);

  useEffect(() => {
    const t = setTimeout(doSearch, 300);
    return () => clearTimeout(t);
  }, [doSearch]);

  function applyProfile(profile: IndustryCategory["industries"][0]) {
    setActiveProfile(profile);
    if (profile.loadMin != null) setLoadMin(profile.loadMin.toString());
    if (profile.heightMin != null) setHeightMin(profile.heightMin.toString());
    if (profile.priceMax != null) setPriceMax(profile.priceMax.toString());
  }

  function resetAll() {
    setQuery(""); setSelectedType(""); setAreaMin(""); setAreaMax("");
    setPriceMax(""); setLoadMin(""); setHeightMin("");
    setSelectedCategory(""); setSelectedIndustry(""); setActiveProfile(null);
  }

  const activeFiltersCount = [selectedType, areaMin, areaMax, priceMax, loadMin, heightMin, query].filter(Boolean).length;

  return (
    <div className="container">
      <div className="main-layout">
        <aside className="sidebar">
          {/* 产业推荐 */}
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

          {/* 基础筛选 */}
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
            <div className="count">共找到 <strong>{results.length}</strong> 处物业</div>
            <div className="legend">
              <span className="legend-item">数据来源：飞书表格</span>
            </div>
          </div>

          <div className="result-list">
            {results.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏢</div>
                <p>未找到匹配物业</p>
                <small>试试调整筛选条件</small>
              </div>
            ) : (
              results.map(item => <PropertyCard key={item.id} item={item} />)
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
