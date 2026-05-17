import { useState } from "react";
import PolicyPage from "./app/policy/PolicyPage";
import CarrierPage from "./app/carrier/CarrierPage";
import HomePage from "./app/home/HomePage";
import PlaceholderPage from "./app/placeholder/PlaceholderPage";
import CustomerPage from "./app/invest/CustomerPage";
import ClueFormPage from "./app/clue/ClueFormPage";
import Launcher from "./components/Launcher";
import { Icon } from "./components/Icons";
import { usePolicies, useProperties, useNews } from "./lib/useFeishu";
import "./index.css";

type Page = "home" | "policy" | "property" | "customer" | "placeholder-industry" | "clue";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const { policies } = usePolicies();
  const { properties } = useProperties();
  const { news } = useNews();
  const policyCount = policies.length;
  const carrierCount = properties.length;

  return (
    <div className="app-wrapper">
      <div className="app-main anim-navbar">
        <NavBar currentPage={currentPage} onNavigate={(p) => setCurrentPage(p)} />
        <div>
          {currentPage === "home" && <HomePage policyCount={policyCount} carrierCount={carrierCount} news={news} />}
          {currentPage === "policy" && <PolicyPage />}
          {currentPage === "property" && <CarrierPage />}
          {currentPage === "customer" && <CustomerPage />}
          {currentPage === "placeholder-industry" && (
            <PlaceholderPage
              title="产业图谱"
              description="浦东新区产业赛道分析、重点行业分布、产业集群可视化等功能模块正在规划与开发中。"
              features={["产业赛道分析", "重点行业分布", "产业集群可视化", "招商热力图", "行业趋势监测"]}
            />
          )}
          {currentPage === "clue" && <ClueFormPage />}
        </div>
      </div>
      <MobileTabBar currentPage={currentPage} onNavigate={(p) => setCurrentPage(p)} />
      <Launcher />
    </div>
  );
}

const NAV_ITEMS = [
  { key: "home" as const, label: "首页", IconComp: Icon.home },
  { key: "policy" as const, label: "政策匹配", IconComp: Icon.policy },
  { key: "property" as const, label: "物业载体", IconComp: Icon.property },
  { key: "customer" as const, label: "招商管理", IconComp: Icon.chart },
  { key: "placeholder-industry" as const, label: "产业图谱", IconComp: Icon.industry },
] as const;

interface NavBarProps {
  currentPage: string;
  onNavigate: (page: Page) => void;
}

function NavBar({ currentPage, onNavigate }: NavBarProps) {
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
        <FontSizeToggle />
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

function FontSizeToggle() {
  const [isEnlarged, setIsEnlarged] = useState(false);

  const toggle = () => {
    const target = document.querySelector(".app-main > div:nth-child(2)") as HTMLElement | null;
    if (!target) return;

    if (!isEnlarged) {
      target.style.transform = "scale(1.15)";
      target.style.transformOrigin = "top left";
      target.style.width = "calc(100% / 1.15)";
      localStorage.setItem("app-font-size", "lg");
    } else {
      target.style.transform = "";
      target.style.transformOrigin = "";
      target.style.width = "";
      localStorage.setItem("app-font-size", "md");
    }
    setIsEnlarged(!isEnlarged);
  };

  return (
    <button
      className="font-size-btn"
      onClick={toggle}
      aria-pressed={isEnlarged}
      title={isEnlarged ? "恢复正常字号" : "放大字号"}
    >
      <span style={{ fontSize: isEnlarged ? "10px" : "13px", fontWeight: 700, lineHeight: 1 }}>Aa</span>
    </button>
  );
}