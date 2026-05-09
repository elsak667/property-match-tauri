import { useState, useEffect } from "react";
import PolicyPage from "./app/policy/PolicyPage";
import CarrierPage from "./app/carrier/CarrierPage";
import HomePage from "./app/home/HomePage";
import PlaceholderPage from "./app/placeholder/PlaceholderPage";
import Feedback from "./components/Feedback";
import AIAssistant from "./components/AIAssistant";
import { Icon } from "./components/Icons";
import { usePolicies, useProperties, useNews } from "./lib/useFeishu";
import "./index.css";

type Page = "home" | "policy" | "property" | "placeholder-invest" | "placeholder-industry";

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

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [aiResult, setAiResult] = useState<AiSearchResult | null>(null);
  const [aiActiveBuildingId, setAiActiveBuildingId] = useState<string | null>(null);
  const [fontLarge, setFontLarge] = useState(() => localStorage.getItem("font-scale") === "large");
  const { policies } = usePolicies();
  const { properties } = useProperties();
  const { news } = useNews();
  const policyCount = policies.length;
  const carrierCount = properties.length;

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
      if (["home", "policy", "property", "placeholder-invest", "placeholder-industry"].includes(page)) {
        setCurrentPage(page as Page);
      }
    };
    return () => { delete (window as unknown as Record<string, unknown>).__setPage__; };
  }, []);

  return (
    <div className="app-wrapper">
      <div className="app-main anim-navbar">
        <NavBar currentPage={currentPage} onNavigate={(p) => setCurrentPage(p)} onToggleFont={toggleFontSize} />
        <div>
          {currentPage === "home" && <HomePage policyCount={policyCount} carrierCount={carrierCount} news={news} />}
          {currentPage === "policy" && <PolicyPage />}
          {currentPage === "property" && (
            <CarrierPage
              aiResult={aiResult}
              onAiBuildingClick={(buildingId: string) => {
                setAiActiveBuildingId(buildingId);
                setCurrentPage("property");
              }}
              aiActiveBuildingId={aiActiveBuildingId}
            />
          )}
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
      <AIAssistant
        aiActiveBuildingId={aiActiveBuildingId}
        onAiResultChange={setAiResult}
        onAiBuildingClick={(buildingId: string) => {
          if (buildingId === "") {
            setAiActiveBuildingId(null);
          } else {
            setAiActiveBuildingId(buildingId);
            if (currentPage !== "property") setCurrentPage("property");
          }
        }}
      />
      <Feedback />
    </div>
  );
}

const NAV_ITEMS = [
  { key: "home" as const, label: "首页", IconComp: Icon.home },
  { key: "policy" as const, label: "政策匹配", IconComp: Icon.policy },
  { key: "property" as const, label: "物业载体", IconComp: Icon.property },
  { key: "placeholder-invest" as const, label: "招商管理", IconComp: Icon.chart },
  { key: "placeholder-industry" as const, label: "产业图谱", IconComp: Icon.industry },
] as const;

interface NavBarProps {
  currentPage: string;
  onNavigate: (page: Page) => void;
  onToggleFont?: () => void;
}

function NavBar({ currentPage, onNavigate, onToggleFont }: NavBarProps) {
  return (
    <div className="navbar">
      <nav className="navbar-tabs" role="tablist" aria-label="主导航">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            role="tab"
            aria-selected={currentPage === item.key}
            className={"navbar-tab" + (currentPage === item.key ? " active" : "")}
            onClick={() => onNavigate(item.key)}
          >
            <span className="tab-icon">{item.IconComp()}</span>
            <span className="tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="navbar-right">
        <button className="font-toggle-btn" onClick={onToggleFont} title="切换字号">
          <span className="font-toggle-icon">A</span>
          <span className="font-toggle-icon large">A</span>
        </button>
        <span className="navbar-badge"><Icon.zapAccent /> 内部使用</span>
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
          <span className="mobile-tab-icon">{item.IconComp()}</span>
          <span className="mobile-tab-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
