import { useState, useEffect } from "react";
import PolicyPage from "./app/policy/PolicyPage";
import CarrierPage from "./app/carrier/CarrierPage";
import HomePage from "./app/home/HomePage";
import PlaceholderPage from "./app/placeholder/PlaceholderPage";
import { usePolicies, useProperties, useNews } from "./lib/useFeishu";
import "./index.css";

type Page = "home" | "property" | "policy" | "placeholder-invest" | "placeholder-industry";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [fontLarge, setFontLarge] = useState(() => localStorage.getItem("font-scale") === "large");
  const { policies } = usePolicies();
  const { properties } = useProperties();
  const { news } = useNews();
  const policyCount = policies.length;
  const carrierCount = properties.length;

  useEffect(() => {
    if (fontLarge) {
      document.body.classList.add("font-large");
    } else {
      document.body.classList.remove("font-large");
    }
  }, [fontLarge]);

  useEffect(() => {
    let styleEl = document.getElementById("font-size-override");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "font-size-override";
      document.head.appendChild(styleEl);
    }
    if (fontLarge) {
      styleEl.textContent = `
      body.font-large .result-name { font-size: 20px !important; font-weight: 800 !important; }
      body.font-large .result-park { font-size: 16px !important; }
      body.font-large .stats-item-num { font-size: 26px !important; }
      body.font-large .search-input { font-size: 16px !important; }
      body.font-large .count { font-size: 16px !important; }
      body.font-large .tag-btn { font-size: 15px !important; }
      body.font-large .filter-label { font-size: 14px !important; }
      body.font-large .meta-date { font-size: 14px !important; }
      body.font-large .urgent-card-name { font-size: 16px !important; }
      body.font-large .result-meta { font-size: 15px !important; }
    `;
    } else {
      styleEl.textContent = "";
    }
  }, [fontLarge]);

  const toggleFontSize = () => {
    const next = !fontLarge;
    setFontLarge(next);
    localStorage.setItem("font-scale", next ? "large" : "normal");
  };

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__setPage__ = (page: string) => {
      if (["home", "property", "policy", "placeholder-invest", "placeholder-industry"].includes(page)) {
        setCurrentPage(page as Page);
      }
    };
    return () => { delete (window as unknown as Record<string, unknown>).__setPage__; };
  }, []);

  return (
    <div className="app-wrapper">
      <div className="app-main">
        <NavBar currentPage={currentPage} onNavigate={(p) => setCurrentPage(p)} onToggleFont={toggleFontSize} />
        <div className="container">
          {currentPage === "home" && <HomePage policyCount={policyCount} carrierCount={carrierCount} news={news} />}
          {currentPage === "policy" && <PolicyPage />}
          {currentPage === "property" && <CarrierPage />}
          {currentPage === "placeholder-invest" && (
            <PlaceholderPage
              title="招商管理"
              description="客户跟进记录、企业档案管理、招商进度追踪等功能模块正在规划与开发中。"
              features={["客户信息管理", "招商进度追踪", "企业档案库", "拜访记录", "数据分析报表"]}
            />
          )}
          {currentPage === "placeholder-industry" && (
            <PlaceholderPage
              title="产业图谱"
              description="浦东新区产业赛道分析、重点行业分布、产业集群可视化等功能模块正在规划与开发中。"
              features={["产业赛道分析", "重点行业分布", "产业集群可视化", "招商热力图", "行业趋势监测"]}
            />
          )}
        </div>
      </div>
      <MobileTabBar currentPage={currentPage} onNavigate={(p) => setCurrentPage(p)} />
    </div>
  );
}

const NAV_ITEMS = [
  { key: "home" as const, label: "首页", icon: "🏠" },
  { key: "policy" as const, label: "政策匹配", icon: "📋" },
  { key: "property" as const, label: "物业载体", icon: "🏢" },
  { key: "placeholder-invest" as const, label: "招商管理", icon: "📊" },
  { key: "placeholder-industry" as const, label: "产业图谱", icon: "🗺️" },
] as const;

interface NavBarProps {
  currentPage: string;
  onNavigate: (page: Page) => void;
  onToggleFont?: () => void;
}

function NavBar({ currentPage, onNavigate, onToggleFont }: NavBarProps) {
  return (
    <div className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">🚀</span>
        <span className="navbar-title">浦发集团招商平台</span>
      </div>
      <nav className="navbar-tabs" role="tablist" aria-label="主导航">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            role="tab"
            aria-selected={currentPage === item.key}
            className={"navbar-tab" + (currentPage === item.key ? " active" : "")}
            onClick={() => onNavigate(item.key)}
          >
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="navbar-right">
        <button className="font-toggle-btn" onClick={onToggleFont} title="切换字号">
          <span className="font-toggle-icon">A</span>
          <span className="font-toggle-icon large">A</span>
        </button>
        <span className="navbar-badge">🚫 内部使用</span>
      </div>
    </div>
  );
}

function MobileTabBar({ currentPage, onNavigate }: NavBarProps) {
  return (
    <nav className="mobile-tabbar" aria-label="移动端导航">
      {NAV_ITEMS.map(item => (
        <button
          key={item.key}
          className={"mobile-tab" + (currentPage === item.key ? " active" : "")}
          onClick={() => onNavigate(item.key)}
          aria-label={item.label}
        >
          <span className="mobile-tab-icon">{item.icon}</span>
          <span className="mobile-tab-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
