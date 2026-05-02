/**
 * AI 智能助手 — 追问式交互 + 行为追踪
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { openPrintHtmlRaw } from "../lib/pdfgen_new";
import BuildingDetailPanel from "./BuildingDetailPanel";
import { Icon } from "./Icons";
import { trackEvent, trackExport, trackClick } from "../lib/track";

// ── 类型 ─────────────────────────────────────────────────────────────────────
interface AiPolicyMatch {
  id: number;
  name: string;
  match_reason: string;
  score: number;
}
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
  policies: AiPolicyMatch[];
  properties: AiPropertyMatch[];
  summary: string;
}

type AiState = "greeting" | "collecting" | "searching" | "result" | "rating";

interface Prefs {
  area?: string;
  district?: string;
  budget?: string;
  industry?: string;
  amount?: string;
}

interface ConversationLog {
  ts: number;
  from: "user" | "ai";
  text: string;
}

// ── 常量 ────────────────────────────────────────────────────────────────────────
const BASE = "https://api.elsak.eu.org/api";

const QUERY_SUGGESTIONS = [
  "张江 AI 企业 100 万补贴",
  "浦东芯片半导体载体",
  "人工智能企业租金优惠",
  "新能源物业载体",
];

// 结构化追问问题（按顺序）
const PREF_QUESTIONS = [
  {
    key: "area",
    q: "载体面积需求？",
    placeholder: "如：500㎡",
    extract: (t: string) => /(\d+[\-~～]?\d*㎡?|约?\d+平方)/.test(t) ? t.match(/(\d+[\-~～]?\d*㎡?|约?\d+平方)/)?.[0] : null,
  },
  {
    key: "district",
    q: "区域偏好？",
    placeholder: "如：张江/金桥/临港",
    extract: (t: string) => /张江|金桥|临港|浦东|陆家嘴|外高桥|川沙|唐镇|康桥/.test(t) ? t.match(/张江|金桥|临港|浦东|陆家嘴|外高桥|川沙|唐镇|康桥/g)?.[0] : null,
  },
  {
    key: "budget",
    q: "租金预算？",
    placeholder: "如：2元/㎡/天",
    extract: (t: string) => /(\d+[\-~～]?\d*元|每?\s*平米.*?\d+)/.test(t) ? t.match(/(\d+[\-~～]?\d*元|每?\s*平米.*?\d+)/)?.[0] : null,
  },
  {
    key: "industry",
    q: "产业方向？",
    placeholder: "如：人工智能/集成电路",
    extract: (t: string) => /人工智能|AI|芯片|半导体|集成电路|新能源|智能制造|生物医药|金融|软件|大数据|云计算|机器人/.test(t) ? t : null,
  },
  {
    key: "amount",
    q: "希望获得多少补贴？",
    placeholder: "如：100万元以上",
    extract: (t: string) => /(\d+万|以上|以下)/.test(t) ? t.match(/(\d+万|以上|以下)/)?.[0] : null,
  },
];

// ── 辅助函数 ────────────────────────────────────────────────────────────────
async function aiSearch(q: string): Promise<AiSearchResult> {
  const res = await fetch(`${BASE}/ai/search?q=${encodeURIComponent(q)}`);
  const data = await res.json() as { success?: boolean; data?: AiSearchResult; error?: string };
  if (!data?.success) throw new Error(data?.error || "AI 解析失败");
  return data.data ?? { policies: [], properties: [], summary: "" };
}

function extractPrefs(query: string, filled: Prefs): { missing: string[]; prefs: Prefs } {
  const missing: string[] = [];
  const prefs: Prefs = { ...filled };
  for (const pq of PREF_QUESTIONS) {
    if (prefs[pq.key as keyof Prefs]) continue; // 已填
    const extracted = pq.extract(query);
    if (extracted) {
      prefs[pq.key as keyof Prefs] = extracted;
    } else {
      missing.push(pq.key);
    }
  }
  return { missing, prefs };
}

function buildQuery(baseQuery: string, prefs: Prefs): string {
  const parts = [baseQuery];
  if (prefs.area) parts.push(`面积${prefs.area}`);
  if (prefs.district) parts.push(`区域${prefs.district}`);
  if (prefs.budget) parts.push(`预算${prefs.budget}`);
  if (prefs.industry) parts.push(`行业${prefs.industry}`);
  if (prefs.amount) parts.push(`补贴${prefs.amount}`);
  return parts.join(" ");
}

function getSessionId(): string {
  let id = sessionStorage.getItem("ai_session");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("ai_session", id);
  }
  return id;
}

// ── 组件 ─────────────────────────────────────────────────────────────────────
interface Props {
  aiActiveBuildingId?: string | null;
  onAiResultChange?: (result: AiSearchResult | null) => void;
  onAiBuildingClick?: (buildingId: string) => void;
}

export default function AIAssistant({ aiActiveBuildingId, onAiResultChange, onAiBuildingClick }: Props) {
  const [state, setState] = useState<AiState>("greeting");
  const [baseQuery, setBaseQuery] = useState("");           // 原始需求
  const [prefs, setPrefs] = useState<Prefs>({});            // 收集的偏好
  const [currentPrefKey, setCurrentPrefKey] = useState<string | null>(null); // 当前追问的问题 key
  const [inputValue, setInputValue] = useState("");         // 用户当前输入
  const [query, setQuery] = useState("");                   // 传给 AI 的 query
  const [, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AiSearchResult | null>(null);
  const [history, setHistory] = useState<ConversationLog[]>([]);
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [ratingReason, setRatingReason] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const activeBuildingId = aiActiveBuildingId ?? null;
  const sessionId = getSessionId();

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 开始对话（用户输入初始需求）
  const handleStart = useCallback((text: string) => {
    if (!text.trim()) return;
    setBaseQuery(text.trim());
    trackEvent({ action: "ai_search_start", search_query: text.trim(), session_id: sessionId });

    const { missing } = extractPrefs(text.trim(), {});
    if (missing.length === 0) {
      // 快速路径：query 已经够完整，直接搜
      const fullQuery = text.trim();
      doSearch(fullQuery, {});
    } else {
      // 进入追问流程
      setState("collecting");
      setPrefs({});
      setHistory([{ ts: Date.now(), from: "user", text: text.trim() }]);
      setCurrentPrefKey(missing[0]);
      const firstQ = PREF_QUESTIONS.find(q => q.key === missing[0]);
      setHistory(h => [...h, { ts: Date.now(), from: "ai", text: firstQ ? firstQ.q : "" }]);
    }
  }, [sessionId]);

  // 用户回复追问
  const handlePrefAnswer = useCallback((answer: string) => {
    if (!currentPrefKey) return;
    const newPrefs = { ...prefs, [currentPrefKey]: answer };

    // 提取用户回答中可能的额外信息
    const { missing } = extractPrefs(answer, newPrefs);
    setPrefs(newPrefs);

    if (missing.length > 0) {
      // 继续追问下一个
      setCurrentPrefKey(missing[0]);
      const nextQ = PREF_QUESTIONS.find(q => q.key === missing[0]);
      setHistory(h => [...h, { ts: Date.now(), from: "ai", text: nextQ ? nextQ.q : "" }]);
      setInputValue("");
    } else {
      // 偏好收集完毕，开始搜索
      const fullQuery = buildQuery(baseQuery, newPrefs);
      doSearch(fullQuery, newPrefs);
    }
  }, [currentPrefKey, prefs, baseQuery]);

  // 执行搜索
  const doSearch = async (fullQuery: string, collectedPrefs: Prefs) => {
    setQuery(fullQuery);
    setState("searching");
    setLoading(true);
    setError("");
    try {
      const res = await aiSearch(fullQuery);
      setResult(res);
      setState("result");
      onAiResultChange?.(res);
      trackEvent({
        action: "ai_results",
        search_query: fullQuery,
        extra: {
          base_query: baseQuery,
          prefs: collectedPrefs,
          policy_count: res.policies.length,
          property_count: res.properties.length,
          session_id: sessionId,
        },
      });
    } catch (e: unknown) {
      setError((e as Error).message);
      setState("greeting");
    } finally {
      setLoading(false);
    }
  };

  // 跳过当前追问，直接搜索
  const handleSkip = useCallback(() => {
    if (!currentPrefKey) return;
    const newPrefs = { ...prefs, [currentPrefKey]: "" };
    const { missing } = extractPrefs("", newPrefs);
    setPrefs(newPrefs);
    if (missing.length > 0) {
      setCurrentPrefKey(missing[0]);
      const nextQ = PREF_QUESTIONS.find(q => q.key === missing[0]);
      setHistory(h => [...h, { ts: Date.now(), from: "ai", text: `好的，跳过。${nextQ ? nextQ.q : ""}` }]);
    } else {
      const fullQuery = buildQuery(baseQuery, newPrefs);
      doSearch(fullQuery, newPrefs);
    }
    setInputValue("");
  }, [currentPrefKey, prefs, baseQuery]);

  // 提交评分
  const handleRating = (r: "up" | "down") => {
    setRating(r);
    trackEvent({
      action: r === "up" ? "ai_thumb_up" : "ai_thumb_down",
      extra: {
        reason: ratingReason,
        query,
        base_query: baseQuery,
        prefs,
        policy_count: result?.policies.length ?? 0,
        property_count: result?.properties.length ?? 0,
        session_id: sessionId,
      },
    });
  };

  // 导出
  const handleExport = () => {
    if (!result) return;
    const policyRows = result.policies.map((p) => `<tr>
      <td style="padding:8px;border:1px solid #ddd"><strong>${"⭐".repeat(Math.round(p.score / 20))} ${p.name}</strong></td>
      <td style="padding:8px;border:1px solid #ddd">${p.match_reason}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${p.score}</td>
    </tr>`).join("");
    const propRows = result.properties.map((p) => `<tr>
      <td style="padding:8px;border:1px solid #ddd"><strong>${p.name}</strong></td>
      <td style="padding:8px;border:1px solid #ddd">${p.park || "—"}</td>
      <td style="padding:8px;border:1px solid #ddd">${p.match_reason}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center">${p.score}</td>
    </tr>`).join("");
    const propTable = result.properties.length ? `<h2 style="color:#3b6db5;margin-top:20px">物业载体（${result.properties.length} 条）</h2>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <thead><tr style="background:#f0f4ff"><th style="padding:8px;border:1px solid #ddd;text-align:left">名称</th><th style="padding:8px;border:1px solid #ddd">园区</th><th style="padding:8px;border:1px solid #ddd">匹配理由</th><th style="padding:8px;border:1px solid #ddd">评分</th></tr></thead><tbody>${propRows}</tbody></table>` : "";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI匹配结果</title>
<style>body{padding:24px}h2{color:#3b6db5;margin-top:20px}th{background:#f0f4ff}</style></head><body>
<h1 style="color:#3b6db5">AI 智能匹配结果</h1>
<p><strong>查询：</strong>${query}</p>
${result.summary ? `<p style="background:#f0f4ff;padding:10px;border-radius:6px"><strong>💡 建议：</strong>${result.summary}</p>` : ""}
<h2>政策匹配（${result.policies.length} 条）</h2>
<table style="border-collapse:collapse;width:100%;font-size:13px">
  <thead><tr style="background:#f0f4ff"><th style="padding:8px;border:1px solid #ddd;text-align:left">政策名称</th><th style="padding:8px;border:1px solid #ddd">匹配理由</th><th style="padding:8px;border:1px solid #ddd">评分</th></tr></thead><tbody>${policyRows}</tbody></table>
${propTable}
<p style="margin-top:20px;color:#999;font-size:12px">${new Date().toLocaleString("zh-CN")} · 浦发集团招商平台</p>
</body></html>`;
    openPrintHtmlRaw(html);
    trackExport(result.policies.map(p => p.name));
  };

  // 关闭重置
  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setState("greeting");
      setBaseQuery("");
      setPrefs({});
      setQuery("");
      setResult(null);
      setHistory([]);
      setRating(null);
      setRatingReason("");
      setCurrentPrefKey(null);
      setInputValue("");
    }, 300);
  };

  const total = (result?.policies.length ?? 0) + (result?.properties.length ?? 0);
  const currentQ = PREF_QUESTIONS.find(q => q.key === currentPrefKey);

  return (
    <>
      {/* 浮窗气泡按钮 */}
      <button className="ai-fab ai-fab-ai" onClick={() => setOpen(!open)} aria-label="AI助手">
        <span className="ai-fab-icon">{open ? <Icon.close /> : <Icon.botAccent />}</span>
        {total > 0 && !open && <span className="ai-fab-dot" />}
      </button>

      {/* 浮窗面板 */}
      {open && (
        <div className="ai-panel ai-panel-ai" ref={panelRef}>
          <div className="ai-panel-header">
            <span><Icon.botAccent /></span>
            <span className="ai-panel-title">AI 智能匹配</span>
            <button className="ai-panel-close" onClick={handleClose}><Icon.closeSm /></button>
          </div>

          {/* 对话历史 */}
          {history.length > 0 && (
            <div className="ai-panel-history">
              {history.map((h, i) => (
                <div key={i} className={`ai-msg ai-msg-${h.from}`}>{h.text}</div>
              ))}
            </div>
          )}

          {/* 追问输入 */}
          {state === "collecting" && currentQ && (
            <div className="ai-panel-search">
              <input
                className="ai-panel-input"
                type="text"
                placeholder={currentQ.placeholder}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && inputValue.trim()) {
                    handlePrefAnswer(inputValue.trim());
                  } else if (e.key === "Enter" && !inputValue.trim()) {
                    handleSkip();
                  }
                }}
                autoFocus
              />
              <button className="ai-panel-btn" onClick={() => inputValue.trim() ? handlePrefAnswer(inputValue.trim()) : handleSkip()} disabled={!inputValue.trim()}>
                <Icon.send />
              </button>
            </div>
          )}
          {!currentQ && state === "collecting" && (
            <div className="ai-panel-hint">正在整理需求…</div>
          )}

          {/* 跳过按钮（追问时显示） */}
          {state === "collecting" && (
            <button className="ai-panel-skip" onClick={handleSkip}>跳过这个问题</button>
          )}

          {/* 初始输入 */}
          {(state === "greeting") && (
            <>
              <div className="ai-panel-search">
                <input
                  className="ai-panel-input"
                  type="text"
                  placeholder="描述您的需求，如：张江AI企业100万补贴"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && query.trim() && handleStart(query.trim())}
                />
                <button className="ai-panel-btn" onClick={() => query.trim() && handleStart(query.trim())} disabled={!query.trim()}>
                  <Icon.search />
                </button>
              </div>
              <div className="ai-panel-hints">
                {QUERY_SUGGESTIONS.map(s => (
                  <button key={s} className="ai-panel-hint-chip" onClick={() => { setQuery(s); handleStart(s); }}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Loading */}
          {state === "searching" && (
            <div className="ai-panel-loading">
              <Icon.loader /> 正在匹配政策与物业载体…
            </div>
          )}

          {/* 错误 */}
          {error && <div className="ai-panel-error"><Icon.alertAccent /> {error}</div>}

          {/* 结果 */}
          {result && state === "result" && (
            <div className="ai-panel-body">
              {result.summary && <div className="ai-panel-summary">{result.summary}</div>}
              <div className="ai-panel-stat">
                <span>政策 <strong>{result.policies.length}</strong></span>
                <span>载体 <strong>{result.properties.length}</strong></span>
                {total > 0 && <button className="ai-panel-export" onClick={handleExport}><Icon.download /> 导出</button>}
              </div>
              {result.policies.map((p, i) => (
                <div key={i} className="ai-panel-item" onClick={() => { trackClick(p.name); }}>
                  <div className="ai-panel-item-name"><span className="ai-score">{p.score}</span>{p.name}</div>
                  <div className="ai-panel-item-meta">{p.match_reason}</div>
                </div>
              ))}
              {result.properties.length > 0 && (
                <>
                  <div className="ai-panel-divider" />
                  <div className="ai-panel-section-label"><Icon.buildingAccent /> 物业载体</div>
                  {result.properties.map((p, i) => (
                    <div key={i} className="ai-panel-item ai-panel-item-prop" style={{ cursor: "pointer" }} onClick={() => { trackClick(p.building || p.name); p.building_id && onAiBuildingClick?.(p.building_id); }}>
                      <div className="ai-panel-item-name"><span className="ai-score">{p.score}</span>{p.building || p.name}</div>
                      <div className="ai-panel-item-meta">{p.park && <span><Icon.mapPin /> {p.park}</span>}{p.match_reason}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* 评分 */}
          {result && (state === "result" || state === "rating") && (
            <div className="ai-panel-rating">
              {rating ? (
                <div className="ai-rating-done">
                  <span>{rating === "up" ? "👍 感谢反馈！" : "👎 感谢反馈，我们会改进！"}</span>
                  {rating === "down" && !ratingReason && (
                    <input
                      className="ai-rating-reason"
                      type="text"
                      placeholder="（可选）哪里不够准确？"
                      value={ratingReason}
                      onChange={e => setRatingReason(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleRating("down")}
                    />
                  )}
                </div>
              ) : (
                <div className="ai-rating-btns">
                  <button className="ai-rating-btn" onClick={() => handleRating("up")} title="匹配准确">👍</button>
                  <button className="ai-rating-btn" onClick={() => handleRating("down")} title="答非所问">👎</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {activeBuildingId && (
        <BuildingDetailPanel buildingId={activeBuildingId} onClose={() => onAiBuildingClick?.("")} />
      )}
    </>
  );
}
