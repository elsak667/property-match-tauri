/**
 * 问题反馈 — 浮窗气泡模式（钉钉推送）
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { Icon } from "./Icons";

const BASE = "https://api.elsak.eu.org/api";

async function submitFeedback(data: { type: string; content: string; contact: string; screenshot?: string }) {
  const res = await fetch(`${BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, source: window.location.href }),
  });
  const json = await res.json() as { success?: boolean; error?: string };
  if (!json.success) throw new Error(json.error || "提交失败");
}

const TYPES = ["建议", "优化", "新需求", "BUG"];

export default function Feedback() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState("建议");
  const [screenshot, setScreenshot] = useState<string>("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("图片大小不能超过 5MB");
      return;
    }
    setUploadingImg(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setScreenshot(ev.target?.result as string);
      setUploadingImg(false);
    };
    reader.onerror = () => { setError("图片读取失败"); setUploadingImg(false); };
    reader.readAsDataURL(file);
  }, []);

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
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    try {
      await submitFeedback({ type, content: content.trim(), contact: contact.trim(), screenshot });
      setSuccess(true);
      setType("建议"); setContent(""); setContact(""); setScreenshot("");
      setTimeout(() => { setSuccess(false); setOpen(false); }, 2000);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [type, content, contact, screenshot]);

  return (
    <>
      <button className="ai-fab ai-fab-feedback" onClick={() => setOpen(!open)} aria-label="意见反馈">
        <span className="ai-fab-icon">{open ? <Icon.close /> : <Icon.messageAccent />}</span>
      </button>

      {open && (
        <div className="ai-panel ai-panel-feedback" ref={panelRef}>
          <div className="ai-panel-header">
            <span>💬</span>
            <span className="ai-panel-title">意见反馈</span>
            <button className="ai-panel-close" onClick={() => setOpen(false)}><Icon.closeSm /></button>
          </div>

          {success ? (
            <div className="ai-panel-body" style={{ textAlign: "center", padding: "24px" }}>
              <div style={{ fontSize: 40 }}>{Icon.checkCircleGreen()}</div>
              <p style={{ margin: "12px 0 0", color: "#3b6db5", fontWeight: 600 }}>已收到，感谢反馈！</p>
            </div>
          ) : (
            <>
              <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <div className="feedback-field-label">问题类型</div>
                  <div className="feedback-type-row">
                    {TYPES.map((t) => (
                      <button
                        key={t}
                        className={`feedback-type-btn${type === t ? " active" : ""}`}
                        onClick={() => setType(t)}
                      >{t}</button>
                    ))}
                  </div>
                </div>

                <div className="feedback-field-label">问题描述 <span className="feedback-required">*</span></div>
                <textarea
                  className="ai-panel-input"
                  placeholder="请详细描述遇到的问题或改进建议..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={loading}
                  rows={4}
                  style={{ resize: "vertical", lineHeight: 1.6 }}
                />

                <div className="feedback-field-label">截图（选填）</div>
                <div className="feedback-image-row">
                  {screenshot ? (
                    <div className="feedback-image-preview">
                      <img src={screenshot} alt="截图预览" />
                      <button
                        className="feedback-image-remove"
                        onClick={() => setScreenshot("")}
                        disabled={loading}
                      ><Icon.closeSm /></button>
                    </div>
                  ) : null}
                  <label className={`feedback-image-upload${uploadingImg ? " disabled" : ""}`}>
                    {uploadingImg ? "读取中..." : "+ 添加截图"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageChange}
                      disabled={loading || uploadingImg}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>

                <div className="feedback-field-label" style={{ marginTop: "4px" }}>联系方式（选填）</div>
                <input
                  className="ai-panel-input"
                  placeholder="手机号 / 邮箱 / 姓名..."
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  disabled={loading}
                />
              </div>

              {error && <div className="ai-panel-error"><Icon.alertAccent /> {error}</div>}

              <div style={{ padding: "0 16px 16px" }}>
                <button
                  className="ai-panel-btn"
                  style={{ width: "100%", fontSize: "14px", padding: "10px" }}
                  onClick={handleSubmit}
                  disabled={loading || !content.trim()}
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
