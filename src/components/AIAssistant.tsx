/**
 * AI 智能助手 — 浮窗气泡模式（RAG 版）
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { openPrintHtmlRaw } from "../lib/pdfgen_new";

// RAG API 返回类型
interface AiPolicyMatch {
  id: number;
  name: string;
  match_reason: string;
  score: number;
}
interface AiPropertyMatch {
  id: number;
  name: string;
  park: string;
  match_reason: string;
  score: number;
}
interface AiSearchResult {
  policies: AiPolicyMatch[];
  properties: AiPropertyMatch[];
  summary: string;
}

const BASE = "https://api.elsak.eu.org/api";

async function aiSearch(q: string): Promise<AiSearchResult> {
  const res = await fetch(`${BASE}/ai/search?q=${encodeURIComponent(q)}`);
  const data = await res.json() as { success?: boolean; data?: AiSearchResult; error?: string };
  if (!data?.success) throw new Error(data?.error || "AI 解析失败");
  return data.data ?? { policies: [], properties: [], summary: "" };
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AiSearchResult | null>(null);
  const [filters, setFilters] = useState<string>("");
  const panelRef = useRef<HTMLDivElement>(null);

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

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await aiSearch(query.trim());
      setFilters(query.trim());
      setResult(res);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);

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

    const propTable = result.properties.length
      ? `<h2 style="color:#3b6db5;margin-top:20px">物业载体（${result.properties.length} 条）</h2>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <thead><tr style="background:#f0f4ff"><th style="padding:8px;border:1px solid #ddd;text-align:left">名称</th><th style="padding:8px;border:1px solid #ddd">园区</th><th style="padding:8px;border:1px solid #ddd">匹配理由</th><th style="padding:8px;border:1px solid #ddd">评分</th></tr></thead><tbody>${propRows}</tbody></table>`
      : "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI匹配结果</title>
<style>body{padding:24px}h2{color:#3b6db5;margin-top:20px}th{background:#f0f4ff}</style></head><body>
<h1 style="color:#3b6db5">AI 智能匹配结果</h1>
<p><strong>查询：</strong>${filters}</p>
${result.summary ? `<p style="background:#f0f4ff;padding:10px;border-radius:6px"><strong>💡 建议：</strong>${result.summary}</p>` : ""}
<h2>政策匹配（${result.policies.length} 条）</h2>
<table style="border-collapse:collapse;width:100%;font-size:13px">
  <thead><tr style="background:#f0f4ff"><th style="padding:8px;border:1px solid #ddd;text-align:left">政策名称</th><th style="padding:8px;border:1px solid #ddd">匹配理由</th><th style="padding:8px;border:1px solid #ddd">评分</th></tr></thead><tbody>${policyRows}</tbody></table>
${propTable}
<p style="margin-top:20px;color:#999;font-size:12px">${new Date().toLocaleString("zh-CN")} · 浦发集团招商平台</p>
</body></html>`;
    openPrintHtmlRaw(html);
  };

  const total = (result?.policies.length ?? 0) + (result?.properties.length ?? 0);

  return (
    <>
      {/* 浮窗气泡按钮 */}
      <button className="ai-fab ai-fab-ai" onClick={() => setOpen(!open)} aria-label="AI助手">
        <span className="ai-fab-icon">{open ? "✕" : "🤖"}</span>
        {total > 0 && !open && <span className="ai-fab-dot" />}
      </button>

      {/* 浮窗面板 */}
      {open && (
        <div className="ai-panel ai-panel-ai" ref={panelRef}>
          <div className="ai-panel-header">
            <span>🤖</span>
            <span className="ai-panel-title">AI 智能匹配</span>
            <button className="ai-panel-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="ai-panel-search">
            <input
              className="ai-panel-input"
              type="text"
              placeholder="描述您的需求，如：张江AI企业100万补贴"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={loading}
            />
            <button className="ai-panel-btn" onClick={handleSearch} disabled={loading || !query.trim()}>
              {loading ? "..." : "🔍"}
            </button>
          </div>

          {error && <div className="ai-panel-error">⚠️ {error}</div>}

          {result && (
            <div className="ai-panel-body">
              {/* AI 建议 */}
              {result.summary && (
                <div className="ai-panel-summary">{result.summary}</div>
              )}

              <div className="ai-panel-stat">
                <span>政策 <strong>{result.policies.length}</strong></span>
                <span>载体 <strong>{result.properties.length}</strong></span>
                {total > 0 && (
                  <button className="ai-panel-export" onClick={handleExport}>📄 导出</button>
                )}
              </div>

              {/* 政策列表 */}
              {result.policies.map((p, i) => (
                <div key={i} className="ai-panel-item">
                  <div className="ai-panel-item-name">
                    <span className="ai-score">{p.score}</span>
                    {p.name}
                  </div>
                  <div className="ai-panel-item-meta">{p.match_reason}</div>
                </div>
              ))}

              {/* 物业列表 */}
              {result.properties.length > 0 && (
                <>
                  <div className="ai-panel-divider" />
                  <div className="ai-panel-section-label">🏢 物业载体</div>
                  {result.properties.map((p, i) => (
                    <div key={i} className="ai-panel-item ai-panel-item-prop">
                      <div className="ai-panel-item-name">
                        <span className="ai-score">{p.score}</span>
                        {p.name}
                      </div>
                      <div className="ai-panel-item-meta">
                        {p.park && <span>📍 {p.park}</span>}
                        {p.match_reason}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {!loading && !result && !error && (
            <div className="ai-panel-hint">
              用自然语言描述您的招商需求，AI 基于飞书实时数据为您推荐
            </div>
          )}
        </div>
      )}
    </>
  );
}