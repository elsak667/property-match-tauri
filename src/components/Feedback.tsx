/**
 * 问题反馈 — 浮窗气泡模式（钉钉推送）
 */
import { useState, useCallback, useEffect, useRef } from "react";

const BASE = "https://api.elsak.eu.org/api";

async function submitFeedback(data: { title: string; content: string; contact: string }) {
  const res = await fetch(`${BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json() as { success?: boolean; error?: string };
  if (!json.success) throw new Error(json.error || "提交失败");
}

export default function Feedback() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

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

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    setError("");
    try {
      await submitFeedback({ title: title.trim(), content: content.trim(), contact: contact.trim() });
      setSuccess(true);
      setTitle(""); setContent(""); setContact("");
      setTimeout(() => { setSuccess(false); setOpen(false); }, 2000);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [title, content, contact]);

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen(!open)} aria-label="意见反馈"
        style={{ bottom: "90px", background: "#3b6db5" }}>
        <span className="ai-fab-icon">{open ? "✕" : "💬"}</span>
      </button>

      {open && (
        <div className="ai-panel" ref={panelRef}>
          <div className="ai-panel-header">
            <span>💬</span>
            <span className="ai-panel-title">意见反馈</span>
            <button className="ai-panel-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          {success ? (
            <div className="ai-panel-body" style={{ textAlign: "center", padding: "24px" }}>
              <div style={{ fontSize: "40px" }}>✅</div>
              <p style={{ margin: "12px 0 0", color: "#3b6db5", fontWeight: 600 }}>已收到，感谢反馈！</p>
            </div>
          ) : (
            <>
              <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: "10px" }}>
                <input
                  className="ai-panel-input"
                  placeholder="标题（必填）"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                />
                <textarea
                  className="ai-panel-input"
                  placeholder="问题描述或改进建议（必填）"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={loading}
                  rows={4}
                  style={{ resize: "vertical", fontFamily: "inherit" }}
                />
                <input
                  className="ai-panel-input"
                  placeholder="联系方式（选填）"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  disabled={loading}
                />
              </div>

              {error && <div className="ai-panel-error">⚠️ {error}</div>}

              <div style={{ padding: "0 16px 16px" }}>
                <button
                  className="ai-panel-btn"
                  style={{ width: "100%", fontSize: "14px", padding: "10px" }}
                  onClick={handleSubmit}
                  disabled={loading || !title.trim() || !content.trim()}
                >
                  {loading ? "提交中..." : "提交反馈"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}