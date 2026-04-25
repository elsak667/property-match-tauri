/**
 * PDF 生成：HTML 模板 + jsPDF 字节流（动态导入，按需加载）
 */
import type { PolicyResult } from "../app/policy/types";

function esc(s: string | undefined | null) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function cleanHtml(s: string | undefined | null) {
  return String(s ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "长期有效";
  try { return d.slice(0, 10); } catch { return d; }
}

const PAGE_W = 794;
const PAGE_H = 1123;

async function renderPage(doc: HTMLDivElement, html2canvas: (el: HTMLElement, opts: unknown) => Promise<HTMLCanvasElement>) {
  return html2canvas(doc, {
    scale: 2, useCORS: true, allowTaint: false, logging: false,
    backgroundColor: "#ffffff", windowWidth: PAGE_W, windowHeight: PAGE_H,
  });
}

async function addCoverPage(
  pdf: { addImage: (data: string, fmt: string, x: number, y: number, w: number, h: number) => void; addPage: () => void },
  coName: string,
  total: number,
  today: string,
  html2canvas: (el: HTMLElement, opts: unknown) => Promise<HTMLCanvasElement>,
) {
  const div = document.createElement("div");
  div.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;box-sizing:border-box;font-family:'PingFang SC','Microsoft YaHei',sans-serif';`;
  div.innerHTML = `
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,#ffffff 0%,#f1f5f9 100%);"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#3b6db5,transparent);"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#3b6db5,transparent);"></div>
    <div style="position:relative;z-index:1;text-align:center;">
      <div style="font-size:11px;color:#3b6db5;letter-spacing:3px;margin-bottom:16px;">浦发集团招商中心</div>
      <div style="font-size:38px;font-weight:700;color:#1e293b;line-height:1.3;margin-bottom:24px;letter-spacing:2px;">政策匹配清单</div>
      <div style="width:60px;height:2px;background:#3b6db5;margin:0 auto 24px;"></div>
      <div style="font-size:13px;color:#64748b;margin-bottom:40px;">生成日期：${esc(today)} &nbsp;|&nbsp; 共 ${total} 条政策</div>
      <div style="background:#ffffff;border:1.5px solid #3b6db5;border-radius:12px;padding:20px 48px;display:inline-block;box-shadow:0 2px 8px rgba(59,109,181,0.12);">
        <div style="font-size:28px;font-weight:700;color:#1e293b;margin-bottom:6px;">${esc(coName)}</div>
        <div style="font-size:13px;color:#3b6db5;letter-spacing:4px;">专&nbsp;&nbsp;用</div>
      </div>
    </div>
    <div style="position:absolute;bottom:24px;font-size:10px;color:#94a3b8;letter-spacing:2px;">浦发集团招商中心</div>`;
  document.body.appendChild(div);
  try {
    const canvas = await renderPage(div, html2canvas);
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const asp = canvas.width / canvas.height;
    pdf.addImage(imgData, "JPEG", 0, 0, PAGE_W, PAGE_W / asp);
  } finally {
    document.body.removeChild(div);
  }
}

async function addPolicyPage(
  pdf: { addImage: (data: string, fmt: string, x: number, y: number, w: number, h: number) => void; addPage: () => void },
  p: PolicyResult,
  i: number,
  total: number,
  today: string,
  html2canvas: (el: HTMLElement, opts: unknown) => Promise<HTMLCanvasElement>,
) {
  const daysLeft = p.days_left;
  const isUrgent = daysLeft > 0 && daysLeft <= 30;
  const isExpired = p.expired || daysLeft <= 0;
  const metaItems: string[] = [];
  if (p.amount != null && p.amount > 0) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">金额</span><strong style="color:#dc2626;font-size:12px;">${p.amount}万元</strong></span>`);
  if (p.end_date) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">申报截止</span><strong style="color:#374151;font-size:12px;">${fmtDate(p.end_date)}</strong></span>`);
  const timeColor = isExpired ? "#94a3b8" : isUrgent ? "#dc2626" : "#374151";
  const timeText = isExpired ? "已截止" : `剩余 ${daysLeft} 天`;
  metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">剩余时间</span><strong style="color:${timeColor};font-size:12px;">${timeText}</strong></span>`);
  if (p.industry) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">适用行业</span><strong style="color:#374151;font-size:12px;">${esc(p.industry)}</strong></span>`);
  if (p.subject) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">申报主体</span><strong style="color:#374151;font-size:12px;">${esc(p.subject)}</strong></span>`);
  if (p.cap) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">政策力度</span><strong style="color:#374151;font-size:12px;">${esc(p.cap)}</strong></span>`);
  if (p.area) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">适用区域</span><strong style="color:#374151;font-size:12px;">${esc(p.area)}</strong></span>`);
  if (p.method) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">兑现方式</span><strong style="color:#374151;font-size:12px;">${esc(p.method)}</strong></span>`);
  if (p.dept) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">发布单位</span><strong style="color:#374151;font-size:12px;">${esc(p.dept)}</strong></span>`);
  const reasonsHtml = (p._reasons && p._reasons.length > 0)
    ? `<div style="background:#fff7ed;border-left:3px solid #f97316;padding:7px 10px;border-radius:0 6px 6px 0;margin:8px 0;"><div style="color:#c2410c;font-size:11px;font-weight:700;margin-bottom:2px;">匹配理由</div><div style="color:#7c2d12;font-size:12px;line-height:1.6;">${esc(p._reasons.slice(0, 3).join("；"))}</div></div>` : "";
  const fieldBlock = (label: string, value: string) => {
    if (!value || value === "未知" || !value.trim()) return "";
    return `<div style="display:flex;gap:8px;margin:2px 0;align-items:baseline;"><span style="min-width:84px;color:#374151;font-size:12px;font-weight:600;flex-shrink:0;">${label}</span><span style="color:#475569;font-size:12px;line-height:1.5;word-break:break-all;">${cleanHtml(value)}</span></div>`;
  };
  const detailsHtml = [fieldBlock("政策对象", p.policyObject || ""), fieldBlock("申报条件", p.policyCondition || ""), fieldBlock("补贴标准", p.paymentStandard || ""), fieldBlock("联系信息", p.contactInfo || "")].filter(Boolean).join("");
  const contentHtml = p.content ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-top:8px;"><div style="color:#1e3a8a;font-size:11px;font-weight:700;margin-bottom:5px;">政策内容</div><div style="color:#475569;font-size:12px;line-height:1.75;white-space:pre-wrap;word-break:break-all;">${cleanHtml(p.content)}</div></div>` : "";
  const pageNum = i + 1;
  const div = document.createElement("div");
  div.style.cssText = `width:${PAGE_W}px;min-height:${PAGE_H}px;background:#ffffff;position:relative;box-sizing:border-box;font-family:'PingFang SC','Microsoft YaHei',sans-serif';`;
  div.innerHTML = `
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:72px;font-weight:700;color:rgba(25,65,130,0.06);white-space:nowrap;pointer-events:none;z-index:0;user-select:none;">浦发集团招商中心</div>
    <div style="width:100%;padding:14px 22px 10px;box-sizing:border-box;background:#ffffff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;">
      <div style="font-size:13px;color:#194182;font-weight:700;">${esc(p.name || "")}</div>
      <div style="font-size:11px;color:#94a3b8;">${pageNum} / ${total}</div>
    </div>
    <div style="padding:10px 22px 30px;box-sizing:border-box;position:relative;z-index:1;">
      <div style="background:#f0f4ff;border-radius:6px;padding:8px 12px;margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px 16px;font-size:11.5px;">${metaItems.join("")}</div>
      ${reasonsHtml}
      <div style="border-top:1px solid #e2e8f0;padding-top:8px;margin-top:4px;">${detailsHtml}</div>
      ${contentHtml}
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:1px;background:#e2e8f0;"></div>
    <div style="position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:10px;color:#cbd5e1;">浦发集团招商中心 &nbsp;|&nbsp; ${esc(today)} &nbsp;|&nbsp; 第 ${pageNum} / ${total} 页</div>`;
  document.body.appendChild(div);
  try {
    const canvas = await renderPage(div, html2canvas);
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const asp = canvas.width / canvas.height;
    pdf.addImage(imgData, "JPEG", 0, 0, PAGE_W, PAGE_W / asp);
    if (i < total - 1) pdf.addPage();
  } finally {
    document.body.removeChild(div);
  }
}

/** 生成 PDF，返回原始字节数组（供 Tauri 保存） */
export async function generatePdfBytes(
  items: PolicyResult[],
  coName: string,
): Promise<{ success: boolean; data?: Uint8Array; filename?: string; error?: string }> {
  if (items.length === 0) return { success: false, error: "没有选中的政策" };
  try {
    // 动态导入，按需加载，减小首屏 bundle
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);
    type JsPDFType = { new(opts: { orientation: string; unit: string; format: [number, number] }): { addImage: (data: string, fmt: string, x: number, y: number, w: number, h: number) => void; addPage: () => void; output: (type: string) => ArrayBuffer } };
    const JsPDF = jsPDF as unknown as JsPDFType;
    const total = items.length;
    const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    const pdf = new JsPDF({ orientation: "portrait", unit: "px", format: [PAGE_W, PAGE_H] });
    await addCoverPage(pdf, coName || "某企业", total, today, html2canvas as (el: HTMLElement, opts: unknown) => Promise<HTMLCanvasElement>);
    for (let i = 0; i < total; i++) {
      await addPolicyPage(pdf, items[i], i, total, today, html2canvas as (el: HTMLElement, opts: unknown) => Promise<HTMLCanvasElement>);
    }
    const data = pdf.output("arraybuffer");
    const filename = coName ? `浦发政策清单_${coName}.pdf` : "浦发政策清单.pdf";
    return { success: true, data: new Uint8Array(data), filename };
  } catch (err: unknown) {
    return { success: false, error: String(err) };
  }
}

/** 生成 HTML（打印窗口模式） */
export function buildPdfHtml(
  items: PolicyResult[],
  coName: string,
): { html: string; total: number } {
  const total = items.length;
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  const coverPage = `<div style="width:210mm;height:297mm;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;box-sizing:border-box;">
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,#ffffff 0%,#f1f5f9 100%);"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#3b6db5,transparent);"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#3b6db5,transparent);"></div>
    <div style="position:relative;z-index:1;text-align:center;">
      <div style="font-size:11px;color:#3b6db5;letter-spacing:3px;margin-bottom:16px;">浦发集团招商中心</div>
      <div style="font-size:38px;font-weight:700;color:#1e293b;line-height:1.3;margin-bottom:24px;letter-spacing:2px;">政策匹配清单</div>
      <div style="width:60px;height:2px;background:#3b6db5;margin:0 auto 24px;"></div>
      <div style="font-size:13px;color:#64748b;margin-bottom:40px;">生成日期：${esc(today)} &nbsp;|&nbsp; 共 ${total} 条政策</div>
      <div style="background:#ffffff;border:1.5px solid #3b6db5;border-radius:12px;padding:20px 48px;display:inline-block;box-shadow:0 2px 8px rgba(59,109,181,0.12);">
        <div style="font-size:28px;font-weight:700;color:#1e293b;margin-bottom:6px;">${esc(coName)}</div>
        <div style="font-size:13px;color:#3b6db5;letter-spacing:4px;">专&nbsp;&nbsp;用</div>
      </div>
    </div>
    <div style="position:absolute;bottom:24px;font-size:10px;color:#94a3b8;letter-spacing:2px;">浦发集团招商中心</div>
  </div>`;
  const policyPages: string[] = [];
  for (let i = 0; i < total; i++) {
    const p = items[i];
    const daysLeft = p.days_left;
    const isUrgent = daysLeft > 0 && daysLeft <= 30;
    const isExpired = p.expired || daysLeft <= 0;
    const metaItems: string[] = [];
    if (p.amount != null && p.amount > 0) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">金额</span><strong style="color:#dc2626;font-size:12px;">${p.amount}万元</strong></span>`);
    if (p.end_date) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">申报截止</span><strong style="color:#374151;font-size:12px;">${fmtDate(p.end_date)}</strong></span>`);
    const timeColor = isExpired ? "#94a3b8" : isUrgent ? "#dc2626" : "#374151";
    const timeText = isExpired ? "已截止" : `剩余 ${daysLeft} 天`;
    metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">剩余时间</span><strong style="color:${timeColor};font-size:12px;">${timeText}</strong></span>`);
    if (p.industry) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">适用行业</span><strong style="color:#374151;font-size:12px;">${esc(p.industry)}</strong></span>`);
    if (p.subject) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">申报主体</span><strong style="color:#374151;font-size:12px;">${esc(p.subject)}</strong></span>`);
    if (p.cap) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">政策力度</span><strong style="color:#374151;font-size:12px;">${esc(p.cap)}</strong></span>`);
    if (p.area) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">适用区域</span><strong style="color:#374151;font-size:12px;">${esc(p.area)}</strong></span>`);
    if (p.method) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">兑现方式</span><strong style="color:#374151;font-size:12px;">${esc(p.method)}</strong></span>`);
    if (p.dept) metaItems.push(`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="color:#64748b;font-size:11px;">发布单位</span><strong style="color:#374151;font-size:12px;">${esc(p.dept)}</strong></span>`);
    const reasonsHtml = (p._reasons && p._reasons.length > 0) ? `<div style="background:#fff7ed;border-left:3px solid #f97316;padding:7px 10px;border-radius:0 6px 6px 0;margin:8px 0;"><div style="color:#c2410c;font-size:11px;font-weight:700;margin-bottom:2px;">匹配理由</div><div style="color:#7c2d12;font-size:12px;line-height:1.6;">${esc(p._reasons.slice(0, 3).join("；"))}</div></div>` : "";
    const fieldBlock = (label: string, value: string) => { if (!value || value === "未知" || !value.trim()) return ""; return `<div style="display:flex;gap:8px;margin:2px 0;align-items:baseline;"><span style="min-width:84px;color:#374151;font-size:12px;font-weight:600;flex-shrink:0;">${label}</span><span style="color:#475569;font-size:12px;line-height:1.5;word-break:break-all;">${cleanHtml(value)}</span></div>`; };
    const detailsHtml = [fieldBlock("政策对象", p.policyObject || ""), fieldBlock("申报条件", p.policyCondition || ""), fieldBlock("补贴标准", p.paymentStandard || ""), fieldBlock("联系信息", p.contactInfo || "")].filter(Boolean).join("");
    const contentHtml = p.content ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-top:8px;"><div style="color:#1e3a8a;font-size:11px;font-weight:700;margin-bottom:5px;">政策内容</div><div style="color:#475569;font-size:12px;line-height:1.75;white-space:pre-wrap;word-break:break-all;">${cleanHtml(p.content)}</div></div>` : "";
    const pageNum = i + 1;
    policyPages.push(`<div style="width:210mm;min-height:297mm;background:#ffffff;position:relative;box-sizing:border-box;page-break-after:always;">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:72px;font-weight:700;color:rgba(25,65,130,0.06);white-space:nowrap;pointer-events:none;z-index:0;user-select:none;">浦发集团招商中心</div>
  <div style="width:100%;padding:14px 22px 10px;box-sizing:border-box;background:#ffffff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;">
    <div style="font-size:13px;color:#194182;font-weight:700;">${esc(p.name || "")}</div>
    <div style="font-size:11px;color:#94a3b8;">${pageNum} / ${total}</div>
  </div>
  <div style="padding:10px 22px 30px;box-sizing:border-box;position:relative;z-index:1;">
    <div style="background:#f0f4ff;border-radius:6px;padding:8px 12px;margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px 16px;font-size:11.5px;">${metaItems.join("")}</div>
    ${reasonsHtml}
    <div style="border-top:1px solid #e2e8f0;padding-top:8px;margin-top:4px;">${detailsHtml}</div>
    ${contentHtml}
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:1px;background:#e2e8f0;"></div>
  <div style="position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:10px;color:#cbd5e1;">浦发集团招商中心 &nbsp;|&nbsp; ${esc(today)} &nbsp;|&nbsp; 第 ${pageNum} / ${total} 页</div>
</div>`);
  }
  const fullHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4; margin: 0; }
body { width: 210mm; margin: 0; font-family: 'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif; background: #fff; }
</style></head><body>${coverPage}${policyPages.join("\n")}<script>window.addEventListener('load', () => setTimeout(() => window.print(), 800));</script></body></html>`;
  return { html: fullHtml, total };
}
