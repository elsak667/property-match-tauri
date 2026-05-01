/**
 * 首页 — 指挥台入口 V4
 * Hero + 左侧快讯（垂直列表）+ 右侧模块堆叠
 */
import { useEffect, useRef } from "react";
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

const NEWS_COLORS: Record<string, string> = {
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
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let timer: ReturnType<typeof setTimeout>;
    let scrollPos = 0;
    let paused = false;

    const total = list.scrollHeight;
    const client = list.clientHeight;

    const doScroll = () => {
      if (paused || total <= client) return;
      scrollPos += 1;
      if (scrollPos >= total - client) scrollPos = 0;
      list.scrollTop = scrollPos;
      timer = setTimeout(doScroll, 40);
    };

    timer = setTimeout(doScroll, 2000);

    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    list.addEventListener("mouseenter", onEnter);
    list.addEventListener("mouseleave", onLeave);

    return () => {
      clearTimeout(timer);
      list.removeEventListener("mouseenter", onEnter);
      list.removeEventListener("mouseleave", onLeave);
    };
  }, []);

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

      {/* ── 主体：左侧快讯 + 右侧模块 ── */}
      <div className="home-body">
        {/* 左侧：产业快讯（垂直列表） */}
        <div className="home-news-panel">
          <div className="news-panel-header">
            <span className="news-panel-icon"><Icon.newspaper /></span>
            <span className="news-panel-label">产业快讯</span>
            <span className="news-panel-count">近{recent.length}条</span>
          </div>
          <div className="news-panel-list" ref={listRef}>
            {recent.map((item, i) => (
              <div key={i} className="news-panel-item" title={item.summary}>
                <span
                  className="news-panel-cat"
                  style={{ background: NEWS_COLORS[item.category] || "#94a3b8" }}
                >
                  {item.category}
                </span>
                <span className="news-panel-time">{item.time.split(" ")[0]}</span>
                <div className="news-panel-title-wrap">
                  <span className="news-panel-title">{item.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：所有模块堆叠 */}
        <div className="home-right-modules">
          {/* ── 主模块区：政策 + 载体 ── */}
          <div className="home-main-modules">
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
              <button className="block-cta-btn">
                进入政策匹配 <Icon.arrowRightAccent />
              </button>
            </div>

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
              <button className="block-cta-btn">
                进入物业载体 <Icon.arrowRightAccent />
              </button>
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
                <div className="block-building">
                  <div className="building-dot" />
                  <div className="building-label">开发中</div>
                </div>
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
                <div className="block-building">
                  <div className="building-dot" />
                  <div className="building-label">开发中</div>
                </div>
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
        </div>
      </div>

      {/* ── 底部说明 ── */}
      <div className="footer-row">
        <span className="footer-disclaimer">本系统为内部测试工具，载体及政策信息仅供参考，不构成正式租赁建议或政策承诺</span>
      </div>
      <div className="footer-row">
        <span>浦发集团招商中心</span>
        <span className="footer-sep">·</span>
        <span>技术支持：Els.J</span>
      </div>
    </div>
  );
}