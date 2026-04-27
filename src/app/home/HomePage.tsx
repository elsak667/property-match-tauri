/**
 * 首页 — 平台介绍 + 模块入口
 */
import NewsTicker from "../../components/NewsTicker";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

interface NewsItem {
  time: string;
  category: string;
  title: string;
  link: string;
  summary: string;
}

interface Props {
  policyCount: number;
  carrierCount: number;
  news: NewsItem[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.0",
    date: "2026-03",
    changes: [
      "上线政策智能匹配模块",
      "支持关键词/区域/行业/部门多维筛选",
      "支持政策详情展开查看",
      "支持选中政策导出 PDF",
    ],
  },
  {
    version: "v2.0",
    date: "2026-04",
    changes: [
      "上线物业载体匹配模块",
      "Leaflet 地图可视化园区楼栋分布",
      "支持面积/荷载/层高/配电/租金多维筛选",
      "产业参数推荐（荷载/层高/双回路供电）",
    ],
  },
  {
    version: "v2.1",
    date: "2026-04",
    changes: [
      "上线产业快讯滚动播报",
      "支持飞书表格维护新闻内容",
      "类别颜色标签 + 链接跳转",
    ],
  },
];

export default function HomePage({ policyCount, carrierCount, news }: Props) {
  return (
    <div className="container">
      {/* 产业快讯滚动条 */}
      <NewsTicker news={news} />

      {/* Banner */}
      <div className="home-banner">
        <div className="banner-left">
          <div className="banner-badge">🚫 内部使用</div>
          <h1 className="banner-title">浦发集团招商平台</h1>
          <p className="banner-subtitle">
            整合物业载体资源与政策信息，赋能一线招商团队
          </p>
          <div className="banner-meta">
            <span>v2.1 · Tauri v2 · React 18</span>
          </div>
        </div>
        <div className="banner-right">
          <div className="stat-card">
            <div className="stat-num">{policyCount || "—"}</div>
            <div className="stat-label">政策条目</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{carrierCount || "—"}</div>
            <div className="stat-label">物业载体</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{news.length || 0}</div>
            <div className="stat-label">产业快讯</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">2</div>
            <div className="stat-label">待开发模块</div>
          </div>
        </div>
      </div>

      {/* 模块卡片区 */}
      <div className="home-modules">
        {/* 四个模块卡片 */}
        <div className="module-card module-active" onClick={() => (window as any).__setPage__?.("policy")}>
          <div className="module-icon">📋</div>
          <div className="module-info">
            <div className="module-name">政策智能匹配</div>
            <div className="module-version">v1.0 已上线</div>
            <div className="module-desc">基于飞书数据的多维政策检索，关键词搜索、区域/行业/部门筛选，支持政策详情展开查看和 PDF 导出。</div>
          </div>
          <div className="module-tags">
            <span className="module-tag">关键词检索</span>
            <span className="module-tag">多维筛选</span>
            <span className="module-tag">PDF导出</span>
          </div>
          <div className="module-enter">进入 →</div>
        </div>

        <div className="module-card module-active" onClick={() => (window as any).__setPage__?.("property")}>
          <div className="module-icon">🏢</div>
          <div className="module-info">
            <div className="module-name">物业载体匹配</div>
            <div className="module-version">v2.0 已上线</div>
            <div className="module-desc">金桥南北园区物业载体可视化地图，支持面积/荷载/层高/配电多维筛选，产业参数智能推荐。</div>
          </div>
          <div className="module-tags">
            <span className="module-tag">Leaflet地图</span>
            <span className="module-tag">多维筛选</span>
            <span className="module-tag">参数推荐</span>
          </div>
          <div className="module-enter">进入 →</div>
        </div>

        <div className="module-card module-placeholder" onClick={() => (window as any).__setPage__?.("placeholder-invest")}>
          <div className="module-icon">📊</div>
          <div className="module-info">
            <div className="module-name">招商管理</div>
            <div className="module-version">待开发</div>
            <div className="module-desc">客户跟进记录、企业档案管理、招商进度追踪等功能模块（规划中）。</div>
          </div>
          <div className="module-tags">
            <span className="module-tag">客户管理</span>
            <span className="module-tag">跟进记录</span>
            <span className="module-tag">企业档案</span>
          </div>
          <div className="module-enter placeholder">敬请期待</div>
        </div>

        <div className="module-card module-placeholder" onClick={() => (window as any).__setPage__?.("placeholder-industry")}>
          <div className="module-icon">🗺️</div>
          <div className="module-info">
            <div className="module-name">产业图谱</div>
            <div className="module-version">待开发</div>
            <div className="module-desc">浦东新区产业赛道分析、重点行业分布、产业集群可视化（规划中）。</div>
          </div>
          <div className="module-tags">
            <span className="module-tag">产业赛道</span>
            <span className="module-tag">行业分析</span>
            <span className="module-tag">集群可视化</span>
          </div>
          <div className="module-enter placeholder">敬请期待</div>
        </div>
      </div>

      {/* 平台介绍 */}
      <div className="home-section">
        <h2 className="section-title">关于本平台</h2>
        <div className="about-grid">
          <div className="about-card">
            <div className="about-icon">🎯</div>
            <div className="about-title">定位</div>
            <div className="about-text">面向浦发集团招商部门一线团队内部使用的信息检索与匹配工具，整合物业载体与政策信息，提升招商对接效率。</div>
          </div>
          <div className="about-card">
            <div className="about-icon">⚙️</div>
            <div className="about-title">技术架构</div>
            <div className="about-text">基于 Tauri v2 桌面框架构建，前端 React 18 + TypeScript，后端 Rust，支持 Windows/macOS 双平台。</div>
          </div>
          <div className="about-card">
            <div className="about-icon">📡</div>
            <div className="about-title">数据来源</div>
            <div className="about-text">政策数据来源于政府公开信息，物业数据来源于飞书表格，匹配结果仅供参考，不构成正式建议。</div>
          </div>
        </div>
      </div>

      {/* 更新日志 */}
      <div className="home-section">
        <h2 className="section-title">更新日志</h2>
        <div className="changelog-list">
          {CHANGELOG.map(entry => (
            <div key={entry.version} className="changelog-item">
              <div className="changelog-header">
                <span className="changelog-version">{entry.version}</span>
                <span className="changelog-date">{entry.date}</span>
              </div>
              <ul className="changelog-changes">
                {entry.changes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* 底部说明 */}
      <div className="footer-banner">
        <div className="footer-warning">⚠️ 本系统为内部测试工具，载体及政策信息仅供参考，不构成正式租赁建议或政策承诺。</div>
        <div className="footer-credit">浦发集团招商中心 · 仅供内部使用 · 技术支持：Els.J</div>
      </div>
    </div>
  );
}