/**
 * Launcher — 悬浮工具台（圆形环绕菜单）
 * Hover 展开子按钮，点击后展开对应面板
 */
import { useState, useCallback, useRef, useEffect } from "react";
import AIAssistant from "./AIAssistant";
import Feedback from "./Feedback";
import ClueFormPage from "../app/clue/ClueFormPage";
import { Icon } from "./Icons";
import "./Launcher.css";
import "./Panel.css";
import { trackEvent } from "../lib/track";

type ActivePanel = "ai" | "clue" | "feedback" | null;

interface LauncherItem {
  id: "ai" | "clue" | "feedback";
  icon: React.ReactNode;
  label: string;
  color: string;
}

const ITEMS: LauncherItem[] = [
  { id: "ai", icon: <Icon.sparklesAccent />, label: "AI匹配", color: "#3b6db5" },
  { id: "clue", icon: <Icon.lightbulb />, label: "提交线索", color: "#059669" },
  { id: "feedback", icon: <Icon.messageAccent />, label: "意见反馈", color: "#c9842a" },
];

export default function Launcher() {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [aiResult, setAiResult] = useState<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleItemClick = useCallback((id: ActivePanel) => {
    setActivePanel(id);
    setHoverOpen(false);
    trackEvent({ action: "launcher_open", extra: { panel: id } });
  }, []);

  const handleClose = useCallback(() => {
    setActivePanel(null);
  }, []);

  const handleAiResultChange = useCallback((res: unknown) => {
    setAiResult(res);
  }, []);

  const handleAiBuildingClick = useCallback((buildingId: string) => {
    (window as unknown as Record<string, unknown>).__setPage__?.("property");
  }, []);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHoverOpen(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => setHoverOpen(false), 200);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <>
      <div
        className="launcher-wrap"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button className="launcher-main" aria-label="打开工具台">
          <span className="launcher-main-icon">
            {hoverOpen ? <Icon.close /> : <Icon.message />}
          </span>
        </button>

        <div className={`launcher-children ${hoverOpen ? "open" : ""}`}>
          {ITEMS.map((item, i) => (
            <button
              key={item.id}
              className="launcher-child"
              style={{ "--i": i, "--color": item.color } as React.CSSProperties}
              onClick={() => handleItemClick(item.id)}
              title={item.label}
            >
              <span className="launcher-child-icon">{item.icon}</span>
              <span className="launcher-child-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activePanel === "ai" && (
        <div className="launcher-panel-overlay" onClick={handleClose}>
          <div className="launcher-panel launcher-panel-ai" onClick={e => e.stopPropagation()}>
            <div className="launcher-panel-header ai">
              <span><Icon.sparklesAccent /></span>
              <span className="launcher-panel-title">AI 智能匹配</span>
              <button className="ai-panel-close" onClick={handleClose}><Icon.closeSm /></button>
            </div>
            <AIAssistant
              aiActiveBuildingId={null}
              onAiResultChange={handleAiResultChange}
              onAiBuildingClick={handleAiBuildingClick}
              autoOpen
              inLauncher
            />
          </div>
        </div>
      )}

      {activePanel === "clue" && (
        <div className="launcher-panel-overlay" onClick={handleClose}>
          <div className="launcher-panel launcher-panel-clue" onClick={e => e.stopPropagation()}>
            <div className="launcher-panel-header clue">
              <span><Icon.lightbulb /></span>
              <span className="launcher-panel-title">提交线索</span>
              <button className="ai-panel-close" onClick={handleClose}><Icon.closeSm /></button>
            </div>
            <ClueFormPage standalone />
          </div>
        </div>
      )}

      {activePanel === "feedback" && (
        <div className="launcher-panel-overlay" onClick={handleClose}>
          <div className="launcher-panel launcher-panel-feedback" onClick={e => e.stopPropagation()}>
            <div className="launcher-panel-header feedback">
              <span><Icon.messageAccent /></span>
              <span className="launcher-panel-title">意见反馈</span>
              <button className="ai-panel-close" onClick={handleClose}><Icon.closeSm /></button>
            </div>
            <Feedback autoOpen inLauncher />
          </div>
        </div>
      )}
    </>
  );
}