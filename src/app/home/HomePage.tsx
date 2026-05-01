/**
 * 首页 — 指挥台入口
 * 去掉 Banner，AI 搜索优先，政策/载体各占半宽不对称布局
 */
import { Icon } from "../../components/Icons";

declare global {
  interface Window {
    __setPage__?: (page: string) => void;
  }
}

interface Props {
  policyCount: number;
  carrierCount: number;
  news: { time: string; category: string; title: string; link: string; summary: string }[];
}

const CATEGORY_COLORS: Record<string, string> = {
  IPO:       "#c9842a",
  投融资:    "#2d6a4f",
  人事:      "#7c5cbf",
  新增企业:  "#2d6a4f",
  政策:      "#c9842a",
  收并购:    "#8b3a3a",
  产业项目:  "#2d6a4f",
  其他动态:  "#94a3b8",
};

export default function HomePage({ policyCount, carrierCount, news }: Props) {
  const recent = news.slice(0, 20);

  return (
    <div className="container">
      {/* ── 品牌 Hero 横条 ── */}
      <div className="home-hero-banner">
        <div className="hero-brand">
          <span className="hero-brand-main">浦发集团招商平台</span>
          <span className="hero-brand-sub">Investment Platform</span>
        </div>
        <div className="hero-divider" />
        <div className="hero-tagline">政策智能匹配 · 物业载体可视化 · AI 驱动招商</div>
        <div className="hero-divider" />
        <div className="hero-stats">
          <span className="hero-stat"><strong>{policyCount || 0}</strong> 政策</span>
          <span className="hero-stat-sep">·</span>
          <span className="hero-stat"><strong>{carrierCount || 0}</strong> 载体</span>
        </div>
      </div>

      {/* ── 主模块区：政策 + 载体 各占半宽 ── */}
      <div className="home-main-modules">
        {/* 政策模块 — 左半 */}
        <div
          className="home-module-block block-policy"
          onClick={() => window.__setPage__?.("policy")}
        >
          <div className="block-header">
            <div className="block-icon"><Icon.scrollTextAccent /></div>
            <div className="block-titles">
              <div className="block-name">政策智能匹配</div>
              <div className="block-sub">Policy Intelligence</div>
            </div>
          </div>
          <div className="block-desc">
            基于飞书数据的多维政策检索，支持关键词、区域、行业、部门多维筛选，智能推荐最匹配政策，支持详情展开与 PDF 导出。
          </div>
          <div className="block-tags">
            <span className="block-tag">关键词检索</span>
            <span className="block-tag">多维筛选</span>
            <span className="block-tag">PDF导出</span>
            <span className="block-tag">智能推荐</span>
          </div>
          <div className="block-cta">
            进入政策匹配 <Icon.arrowRightAccent />
          </div>
        </div>

        {/* 载体模块 — 右半 */}
        <div
          className="home-module-block block-property"
          onClick={() => window.__setPage__?.("property")}
        >
          <div className="block-header">
            <div className="block-icon"><Icon.buildingAccent /></div>
            <div className="block-titles">
              <div className="block-name">物业载体匹配</div>
              <div className="block-sub">Property Intelligence</div>
            </div>
          </div>
          <div className="block-desc">
            金桥南北园区物业载体可视化地图，支持面积、荷载、层高、配电多维筛选，产业参数智能推荐，双回路供电一键匹配。
          </div>
          <div className="block-tags">
            <span className="block-tag">Leaflet地图</span>
            <span className="block-tag">多维筛选</span>
            <span className="block-tag">产业参数</span>
            <span className="block-tag">双回路供电</span>
          </div>
          <div className="block-cta">
            进入物业载体 <Icon.arrowRightAccent />
          </div>
        </div>
      </div>

      {/* ── 次级模块：招商管理 + 产业图谱 ── */}
      <div className="home-sub-modules">
        <div
          className="home-module-block block-sub-side block-placeholder"
          onClick={() => window.__setPage__?.("placeholder-invest")}
        >
          <div className="block-header">
            <div className="block-icon"><Icon.chartAccent /></div>
            <div className="block-titles">
              <div className="block-name">招商管理</div>
              <div className="block-sub">Investment Mgmt</div>
            </div>
            <div className="block-status">规划中</div>
          </div>
          <div className="block-desc">
            客户跟进记录、企业档案管理、招商进度追踪、数据分析报表。
          </div>
          <div className="block-tags">
            <span className="block-tag block-tag-warn">客户管理</span>
            <span className="block-tag block-tag-warn">跟进记录</span>
            <span className="block-tag block-tag-warn">企业档案</span>
          </div>
        </div>

        <div
          className="home-module-block block-sub-side block-placeholder"
          onClick={() => window.__setPage__?.("placeholder-industry")}
        >
          <div className="block-header">
            <div className="block-icon"><Icon.industry /></div>
            <div className="block-titles">
              <div className="block-name">产业图谱</div>
              <div className="block-sub">Industry Map</div>
            </div>
            <div className="block-status">规划中</div>
          </div>
          <div className="block-desc">
            浦东新区产业赛道分析、重点行业分布、产业集群可视化。
          </div>
          <div className="block-tags">
            <span className="block-tag block-tag-warn">产业赛道</span>
            <span className="block-tag block-tag-warn">行业分布</span>
            <span className="block-tag block-tag-warn">集群可视化</span>
          </div>
        </div>
      </div>

      {/* ── 产业快讯 — 底部横向滚动 strip ── */}
      <div className="home-news-strip anim-ticker">
        <div className="news-strip-header">
          <span><Icon.newspaper /></span>
          <span className="news-strip-label">产业快讯</span>
          <span className="news-strip-count">近{recent.length}条</span>
        </div>
        <div className="news-strip-track">
          {recent.map((item, i) => (
            <div key={i} className="news-strip-item">
              <span
                className="news-strip-cat"
                style={{ background: CATEGORY_COLORS[item.category] || "#94a3b8" }}
              >
                {item.category}
              </span>
              <span className="news-strip-time">{item.time.split(" ")[0]}</span>
              <span className="news-strip-title">{item.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 底部说明 ── */}
      <div className="footer-banner anim-footer">
        <div className="footer-warning">
          <Icon.alertWhite /> 本系统为内部测试工具，载体及政策信息仅供参考，不构成正式租赁建议或政策承诺。
        </div>
        <div className="footer-credit">
          浦发集团招商中心 · 仅供内部使用 · 技术支持：Els.J
        </div>
      </div>
    </div>
  );
}