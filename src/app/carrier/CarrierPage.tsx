/**
 * 载体地图页 — 双模式设计
 * - 非专业用户：AI 搜索 + 推荐卡片 + 地图
 * - 专业招商人员：可展开多维筛选面板 + 批量对比
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { loadPropertyData } from "../../lib/property";
import { filterProperties, type BuildingSummary } from "../../lib/workers";
import BuildingDetailPanel from "../../components/BuildingDetailPanel";
import { Icon } from "../../components/Icons";
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
  const [compareMode, setCompareMode] = useState(false);
  const [recommendation, setRecommendation] = useState("");

  function exportCompareReport() {
    const fields: [string, (u: PropertyFilterResult["results"][number]) => string][] = [
      ["园区", u => u.park_name || "—"],
      ["产业方向", u => u.industry || "—"],
      ["楼层", u => u.floor != null ? `第${u.floor}层` : "—"],
      ["总面积", u => `${u.area_total?.toLocaleString() ?? "—"}㎡`],
      ["空置面积", u => `${u.area_vacant?.toLocaleString() ?? "—"}㎡`],
      ["层高", u => u.floor_height != null ? `${u.floor_height}m` : "—"],
      ["荷载", u => u.load != null ? `${u.load}kN/㎡` : "—"],
      ["配电", u => u.load != null ? `${u.load}kVA` : "—"],
      ["租金", u => u.price != null ? `${u.price}元/㎡·天` : "—"],
    ];
    const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

    const rows = fields.map(([label, fn]) => {
      const cells = compareUnits.map(u => `<td>${fn(u)}</td>`).join("");
      return `<tr><td class="label">${label}</td>${cells}</tr>`;
    }).join("");

    const bldThs = compareUnits.map(u =>
      `<th>${u.building_name || u.building_id}</th>`
    ).join("");

    const recSection = recommendation
      ? `<div class="rec-section"><div class="rec-title">推荐结论</div><div class="rec-content">${recommendation.replace(/\n/g, "<br>")}</div></div>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: #f5f2ed; padding: 32px; }
  .page { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); position: relative; }

  /* 品牌头 */
  .header { background: linear-gradient(135deg, #2d6a4f 0%, #1e5c3a 100%); padding: 24px 32px; display: flex; align-items: center; gap: 16px; position: relative; overflow: hidden; }
  .header::after { content: ''; position: absolute; right: -20px; top: -20px; width: 160px; height: 160px; background: rgba(255,255,255,.05); border-radius: 50%; }
  .brand { display: flex; flex-direction: column; }
  .brand-main { font-size: 18px; font-weight: 800; color: #fff; letter-spacing: 2px; }
  .brand-sub { font-size: 10px; color: rgba(255,255,255,.6); letter-spacing: 1px; text-transform: uppercase; }
  .header-divider { width: 2px; height: 36px; background: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,.1)); }
  .header-meta { flex: 1; }
  .report-title { font-size: 20px; font-weight: 700; color: #fff; }
  .report-date { font-size: 11px; color: rgba(255,255,255,.65); margin-top: 2px; }

  /* 表格 */
  .table-wrap { padding: 24px 32px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: linear-gradient(135deg, #2d6a4f, #3d9970); color: #fff; font-weight: 600; padding: 10px 12px; text-align: center; }
  th:first-child { background: #1e5c3a; text-align: left; width: 100px; }
  td { padding: 9px 12px; text-align: center; border-bottom: 1px solid #e8e4dc; color: #333; }
  td:first-child { text-align: left; font-weight: 600; color: #2d6a4f; background: #f9f7f3; }
  tr:last-child td { border-bottom: none; }

  /* 推荐结论 */
  .rec-section { margin: 0 32px 24px; background: #f9f7f3; border: 1.5px solid #2d6a4f; border-radius: 10px; padding: 16px 20px; }
  .rec-title { font-size: 12px; font-weight: 700; color: #2d6a4f; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .rec-content { font-size: 13px; color: #444; line-height: 1.8; }

  /* 页脚 */
  .footer { background: #f5f2ed; padding: 16px 32px; border-top: 1px solid #e8e4dc; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 11px; color: #999; }
  .footer-watermark { font-size: 11px; color: #2d6a4f; font-weight: 600; letter-spacing: 1px; }

  /* 装饰线 */
  .header::before { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #ff8c00, transparent); }

  @media print {
    body { background: white; padding: 0; }
    .page { box-shadow: none; border-radius: 0; }
    @page { margin: 16px; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="brand">
      <span class="brand-main">浦发集团招商平台</span>
      <span class="brand-sub">Investment Platform</span>
    </div>
    <div class="header-divider"></div>
    <div class="header-meta">
      <div class="report-title">楼栋对比报告</div>
      <div class="report-date">${today} · 浦发集团招商中心</div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead><tr><th>指标</th>${bldThs}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  ${recSection}

  <div class="footer">
    <span class="footer-left">本报告由浦发集团招商平台生成 · 仅供内部使用</span>
    <span class="footer-watermark">浦发集团招商中心</span>
  </div>
</div>
</body>
</html>`;

    openPrintHtmlRaw(html);
  }

  // 园区折叠
  const [collapsedParks, setCollapsedParks] = useState<Set<string>>(new Set());

  // 加载全量楼栋（用于楼栋列表和地图坐标）
  useEffect(() => {
    loadPropertyData()
      .then(({ buildings, units }) => {
        // Build area_total per building from units
        const areaMap: Record<string, number> = {};
        for (const u of units) {
          if (!u.building_id) continue;
          areaMap[u.building_id] = (areaMap[u.building_id] ?? 0) + (u.area_total ?? 0);
        }
        const summaries: BuildingSummary[] = buildings.map(b => ({
          building_id: b.building_id ?? "",
          name: b.name ?? "",
          industry: b.industry ?? "",
          lat: b.lat ?? null,
          lng: b.lng ?? null,
          park_id: b.park_id ?? "",
          park_name: "",
          district: (b.district ?? "") || "",
          floors: b.floors ?? 0,
          area_total: areaMap[b.building_id ?? ""] ?? 0,
          area_vacant: b.area_vacant ?? 0,
          price: b.price ?? null,
        }));
        setAllBuildings(summaries);
        setLoading(false);
      })
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
        <Icon.alertWhite /> 数据加载失败<br />{error}
      </div>
    );
  }

  return (
    <div className="cp-root" style={{ display: 'flex', height: 'var(--cp-root-height, calc(100vh - 120px))', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* ── 品牌 Hero 横条 ── */}
      <div className="cp-hero-banner">
        <div className="cp-hero-brand">
          <span className="cp-hero-title">物业载体匹配</span>
          <span className="cp-hero-sub">Property Intelligence</span>
        </div>
        <div className="cp-hero-divider" />
        <div className="cp-hero-tagline">金桥园区载体可视化 · 智能筛选推荐</div>
        <div className="cp-hero-divider" />
        <div className="cp-hero-stats">
          <span className="cp-hero-stat"><strong>{totalBldCount}</strong> 楼栋</span>
          <span className="cp-hero-stat-sep">·</span>
          <span className="cp-hero-stat"><strong>{parkCount}</strong> 园区</span>
        </div>
      </div>
      {/* 左侧 */}
      <div className="cp-sidebar">
        {/* 搜索栏 */}
        <div className="cp-search-bar">
          <div className="cp-search-input-wrap">
            <span className="cp-search-icon"><Icon.search /></span>
            <input
              className="cp-search-input"
              type="text"
              placeholder="搜索楼栋、产业、园区..."
              value={nameQuery}
              onChange={e => setNameQuery(e.target.value)}
            />
            {nameQuery && (
              <button className="cp-search-clear" onClick={() => setNameQuery("")}><Icon.closeSm /></button>
            )}
          </div>
          <button
            className={"cp-filter-btn" + (showFilter ? " active" : "")}
            onClick={() => setShowFilter(v => !v)}
            title="更多筛选条件"
          >
            <Icon.settingsAccent />
            {activeFilterCount > 0 && <span className="cp-filter-count">{activeFilterCount}</span>}
          </button>
        </div>

        {/* AI 推荐区 */}
        {aiTop5.length > 0 && (
          <div className="cp-ai-section">
            <div className="cp-section-label">
              <Icon.sparklesAccent />
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
                    <span className="cp-score">{Math.round(p.score * 100)}%</span>
                  </div>
                  <div className="cp-ai-card-meta">{p.park && <><Icon.mapPinAccent /> {p.park}</>}</div>
                  <div className="cp-ai-card-reason"><span className="cp-reason-tag">匹配原因</span>{p.match_reason}</div>
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
                  <div className="cp-params-remark"><Icon.lightbulb /> {industryParams.remark}</div>
                )}
                <button className="cp-btn-apply" onClick={applyIndustryParams}>
                  <Icon.zap /> 一键填入筛选条件
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 专业筛选面板 */}
        {showFilter && (
          <div className="cp-filter-panel">
            <div className="cp-filter-panel-title"><Icon.buildingAccent /> 筛选条件</div>
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
            <button
              className={"cp-btn-compare" + (compareMode ? " active" : "")}
              onClick={() => setCompareMode(v => !v)}
              title="勾选楼栋后可对比"
            >
              <Icon.chart /> {compareMode ? "退出对比" : "对比模式"}
            </button>
            {compareIds.size >= 2 && (
              <button className="cp-btn-compare" onClick={() => setShowCompare(true)}>
                <Icon.chart /> 对比 {compareIds.size}
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
                    <span><Icon.mapPinAccent /> {parkName} <span className="cp-park-count">({items.length}栋)</span></span>
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
                            {(compareMode || isCompare) && (
                              <div className="cp-building-check" onClick={e => { e.stopPropagation(); toggleCompare(b.building_id); }}>
                                {isCompare ? "☑" : "☐"}
                              </div>
                            )}
                            <div className="cp-building-info" onClick={() => handleBuildingSelect(b.building_id)}>
                              <div className="cp-building-name">
                                {b.name}
                                {isAi && <span className="cp-ai-badge"><Icon.sparklesAccent /></span>}
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

      {/* 对比浮动条 */}
      {compareMode && (
        <div className="cp-compare-float">
          <span className="cp-compare-float-text">
            已选 <strong>{compareIds.size}</strong> 个楼栋 {compareIds.size < 2 ? "（再选1个即可对比）" : "，开始对比"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => { setCompareIds(new Set()); }}>清空</button>
            {compareIds.size >= 2 && (
              <button className="btn-primary" style={{ fontSize: 12, padding: "6px 16px" }} onClick={() => setShowCompare(true)}>
                <Icon.chart /> 开始对比
              </button>
            )}
          </div>
        </div>
      )}
      {selectedBuildingId && (
        <BuildingDetailPanel buildingId={selectedBuildingId} onClose={() => setSelectedBuildingId(null)} />
      )}

      {/* 对比面板 */}
      {showCompare && compareUnits.length >= 2 && (
        <div className="cp-compare-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCompare(false); }}>
          <div className="cp-compare-panel">
            <div className="cp-compare-header">
              <span><Icon.chartAccent /> 楼栋对比</span>
              <div className="cp-compare-actions">
                <button className="cp-btn-export" onClick={exportCompareReport}><Icon.downloadWhite /> 导出报告</button>
                <button className="cp-close-btn" onClick={() => { setShowCompare(false); setRecommendation(""); }}><Icon.closeSm /> 关闭</button>
              </div>
            </div>
            <div className="cp-compare-body">
              <div className="cp-compare-recommend">
                <label className="cp-recommend-label"><Icon.lightbulb /> 推荐结论</label>
                <textarea
                  className="cp-recommend-input"
                  placeholder="填写推荐结论，如：综合以上楼栋条件，推荐优先考虑XX楼，空置面积最大，租金性价比最高，适合XX产业..."
                  value={recommendation}
                  onChange={e => setRecommendation(e.target.value)}
                  rows={3}
                />
              </div>
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