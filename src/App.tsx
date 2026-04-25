import { useState, useEffect } from "react";
import HomePage from "./app/home/HomePage";
import PolicyPage from "./app/policy/PolicyPage";
import PropertyPage from "./app/property/PropertyPage";
import PlaceholderPage from "./app/placeholder/PlaceholderPage";

type Page = "home" | "policy" | "property" | "placeholder-invest" | "placeholder-industry";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");

  // Expose setPage globally so HomePage cards can navigate
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__setPage__ = (page: string) => {
      if (page === "policy" || page === "property" || page === "home" ||
          page === "placeholder-invest" || page === "placeholder-industry") {
        setCurrentPage(page as Page);
      }
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__setPage__;
    };
  }, []);

  return (
    <>
      <NavBar currentPage={currentPage} onNavigate={p => setCurrentPage(p)} />
      {currentPage === "home" && <HomePage />}
      {currentPage === "policy" && <PolicyPage />}
      {currentPage === "property" && <PropertyPage />}
      {(currentPage === "placeholder-invest") && (
        <PlaceholderPage
          title="招商管理"
          description="客户跟进记录、企业档案管理、招商进度追踪等功能模块正在规划与开发中。"
          features={["客户信息管理", "招商进度追踪", "企业档案库", "拜访记录", "数据分析报表"]}
        />
      )}
      {(currentPage === "placeholder-industry") && (
        <PlaceholderPage
          title="产业图谱"
          description="浦东新区产业赛道分析、重点行业分布、产业集群可视化等功能模块正在规划与开发中。"
          features={["产业赛道分析", "重点行业分布", "产业集群可视化", "招商热力图", "行业趋势监测"]}
        />
      )}
    </>
  );
}

interface NavBarProps {
  currentPage: string;
  onNavigate: (page: Page) => void;
}

const NAV_ITEMS = [
  { key: "home", label: "首页", icon: "🏠" },
  { key: "policy", label: "政策匹配", icon: "📋" },
  { key: "property", label: "物业载体", icon: "🏢" },
  { key: "placeholder-invest", label: "招商管理", icon: "📊" },
  { key: "placeholder-industry", label: "产业图谱", icon: "🗺️" },
] as const;

function NavBar({ currentPage, onNavigate }: NavBarProps) {
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
            className={`navbar-tab${currentPage === item.key ? " active" : ""}`}
            onClick={() => onNavigate(item.key)}
          >
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="navbar-right">
        <span className="navbar-badge">🚫 内部使用</span>
      </div>
    </div>
  );
}
