/**
 * PDF 生成：
 *  1. openPrintHtml  — 用浏览器打开打印页（推荐）
 *  2. generatePdfBytes — jsPDF（保留备用）
 */
import type { PolicyResult } from "../app/policy/types";
import { openInBrowser } from "./tauri";
import { invoke } from "@tauri-apps/api/core";

function esc(s: string | undefined | null): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function cleanHtml(s: string | undefined | null): string {
  return String(s ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return "长期有效";
  try { return d.slice(0, 10); } catch { return d; }
}

function makeCoverPage(coName: string, total: number, today: string): string {
  return `<div style="width:210mm;height:297mm;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;box-sizing:border-box;">
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#3b6db5;"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:#3b6db5;"></div>
  <div style="position:relative;z-index:1;text-align:center;">
    <div style="font-size:11px;color:#3b6db5;letter-spacing:3px;margin-bottom:18px;">浦发集团招商中心</div>
    <div style="font-size:40px;font-weight:700;color:#1e293b;line-height:1.2;margin-bottom:20px;letter-spacing:3px;">政策匹配清单</div>
    <div style="width:60px;height:2px;background:#3b6db5;margin:0 auto 24px;"></div>
    <div style="font-size:13px;color:#64748b;margin-bottom:44px;">生成日期：${esc(today)} &nbsp;|&nbsp; 共 ${total} 条政策</div>
    <div style="background:#ffffff;border:1.5px solid #3b6db5;border-radius:12px;padding:22px 52px;display:inline-block;box-shadow:0 2px 12px rgba(59,109,181,0.14);">
      <div style="font-size:30px;font-weight:700;color:#1e293b;margin-bottom:6px;">${esc(coName || "某企业")}</div>
      <div style="font-size:13px;color:#3b6db5;letter-spacing:4px;">专&nbsp;&nbsp;用</div>
    </div>
  </div>
  <div style="position:absolute;bottom:24px;font-size:10px;color:#94a3b8;letter-spacing:2px;">浦发集团招商中心</div>
</div>`;
}

function makePolicyPage(p: PolicyResult, i: number, total: number, today: string): string {
  const daysLeft = p.days_left;
  const isUrgent = daysLeft > 0 && daysLeft <= 30;
  const isExpired = p.expired || daysLeft <= 0;
  const timeColor = isExpired ? "#94a3b8" : isUrgent ? "#dc2626" : "#374151";
  const timeText = isExpired ? "已截止" : `剩余 ${daysLeft} 天`;

  const metaItems: string[] = [];
  if (p.amount != null && p.amount > 0) metaItems.push(`<span class="m"><span class="l">金额</span><strong class="v red">${p.amount}万元</strong></span>`);
  if (p.end_date) metaItems.push(`<span class="m"><span class="l">申报截止</span><strong class="v">${fmtDate(p.end_date)}</strong></span>`);
  metaItems.push(`<span class="m"><span class="l">剩余时间</span><strong class="v" style="color:${timeColor}">${timeText}</strong></span>`);
  if (p.industry) metaItems.push(`<span class="m"><span class="l">适用行业</span><strong class="v">${esc(p.industry)}</strong></span>`);
  if (p.subject) metaItems.push(`<span class="m"><span class="l">申报主体</span><strong class="v">${esc(p.subject)}</strong></span>`);
  if (p.cap) metaItems.push(`<span class="m"><span class="l">政策力度</span><strong class="v">${esc(p.cap)}</strong></span>`);
  if (p.area) metaItems.push(`<span class="m"><span class="l">适用区域</span><strong class="v">${esc(p.area)}</strong></span>`);
  if (p.method) metaItems.push(`<span class="m"><span class="l">兑现方式</span><strong class="v">${esc(p.method)}</strong></span>`);
  if (p.dept) metaItems.push(`<span class="m"><span class="l">发布单位</span><strong class="v">${esc(p.dept)}</strong></span>`);

  const reasonsHtml = (p._reasons && p._reasons.length > 0)
    ? `<div class="reason"><div class="reason-title">匹配理由</div><div class="reason-body">${esc(p._reasons.slice(0, 3).join("；"))}</div></div>`
    : "";

  const fieldBlock = (label: string, value: string) => {
    if (!value || value === "未知" || !value.trim()) return "";
    return `<div class="field"><span class="fl">${label}</span><span class="fv">${cleanHtml(value)}</span></div>`;
  };
  const detailsHtml = [fieldBlock("政策对象", p.policyObject || ""), fieldBlock("申报条件", p.policyCondition || ""), fieldBlock("补贴标准", p.paymentStandard || ""), fieldBlock("联系信息", p.contactInfo || "")].filter(Boolean).join("");

  const contentHtml = p.content
    ? `<div class="content-block"><div class="content-title">政策内容</div><div class="content-body">${cleanHtml(p.content)}</div></div>`
    : "";

  const pageNum = i + 1;
  return `<div class="page">
  <div class="watermark">浦发集团招商中心</div>
  <div class="page-header">
    <div class="page-title">${esc(p.name || "")}</div>
    <div class="page-num">${pageNum} / ${total}</div>
  </div>
  <div class="page-body">
    <div class="meta-row">${metaItems.join("")}</div>
    ${reasonsHtml}
    <div class="details">${detailsHtml}</div>
    ${contentHtml}
  </div>
  <div class="page-footer">浦发集团招商中心 &nbsp;|&nbsp; ${esc(today)} &nbsp;|&nbsp; 第 ${pageNum} / ${total} 页</div>
</div>`;
}

/** 打开浏览器打印窗口（推荐方式） */
export async function openPrintHtml(items: PolicyResult[], coName: string): Promise<void> {
  if (items.length === 0) return;
  const total = items.length;
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

  const pages = [makeCoverPage(coName || "某企业", total, today)];
  for (let i = 0; i < total; i++) {
    pages.push(makePolicyPage(items[i], i, total, today));
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>政策匹配清单</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4 portrait; margin: 0; }
body { width: 210mm; margin: 0 auto; font-family: 'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif; background: #fff; }
.page, .cover { position: relative; width: 210mm; min-height: 297mm; background: #fff; page-break-after: always; overflow: hidden; }
.cover { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; }
.watermark {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%,-50%) rotate(-45deg);
  font-size: 72px; font-weight: 700; color: rgba(25,65,130,0.06);
  white-space: nowrap; pointer-events: none; z-index: 0; user-select: none;
}
.page-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 22px 10px; border-bottom: 1px solid #e2e8f0; position: relative; z-index: 1; }
.page-title { font-size: 13px; color: #194182; font-weight: 700; }
.page-num { font-size: 11px; color: #94a3b8; }
.page-body { padding: 12px 22px 40px; position: relative; z-index: 1; }
.meta-row { background: #f0f4ff; border-radius: 6px; padding: 8px 12px; display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 11.5px; margin-bottom: 8px; }
.m { display: inline-flex; align-items: center; gap: 4px; }
.l { color: #64748b; font-size: 11px; }
.v { color: #374151; font-size: 12px; }
.v.red { color: #dc2626; }
.reason { background: #fff7ed; border-left: 3px solid #f97316; padding: 7px 10px; border-radius: 0 6px 6px 0; margin: 8px 0; }
.reason-title { color: #c2410c; font-size: 11px; font-weight: 700; margin-bottom: 2px; }
.reason-body { color: #7c2d12; font-size: 12px; line-height: 1.6; }
.details { border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 4px; }
.field { display: flex; gap: 8px; margin: 2px 0; align-items: baseline; }
.fl { min-width: 84px; color: #374151; font-size: 12px; font-weight: 600; flex-shrink: 0; }
.fv { color: #475569; font-size: 12px; line-height: 1.5; word-break: break-all; }
.content-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-top: 8px; }
.content-title { color: #1e3a8a; font-size: 11px; font-weight: 700; margin-bottom: 5px; }
.content-body { color: #475569; font-size: 12px; line-height: 1.75; white-space: pre-wrap; word-break: break-all; }
.page-footer { position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; font-size: 10px; color: #cbd5e1; }
@media print { body { width: 100%; margin: 0; } .page, .cover { width: 100%; min-height: 100vh; page-break-after: always; } }
</style>
</head>
<body>
${pages.join("\n")}
<script>
window.addEventListener('load', () => { setTimeout(() => { window.print(); }, 600); });
<\/script>
</body>
</html>`;

  // 将 HTML 内容写入临时文件，由 Rust 处理
  const encoder = new TextEncoder();
  const bytes = encoder.encode(html);
  const data: number[] = Array.from(bytes);
  const tmpFilename = `policy_print_${Date.now()}.html`;
  const path = await invoke<string>("write_temp_file", { data, filename: tmpFilename });
  await openInBrowser("file://" + path);
}

/** jsPDF 字节生成（保留备用，文件较大） */
export async function generatePdfBytes(
  items: PolicyResult[],
  coName: string,
): Promise<{ success: boolean; data?: Uint8Array; filename?: string; error?: string }> {
  if (items.length === 0) return { success: false, error: "没有选中的政策" };
  try {
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const JsPDF = jsPDF as any;
    const total = items.length;
    const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    const pdf = new JsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    // 封面
    const coverHtml = makeCoverPage(coName || "某企业", total, today);
    const coverDiv = document.createElement("div");
    coverDiv.style.cssText = "width:595pt;height:842pt;background:#fff;overflow:hidden;";
    coverDiv.innerHTML = coverHtml;
    document.body.appendChild(coverDiv);
    try {
      const coverCanvas = await html2canvas(coverDiv as unknown as HTMLElement, {
        scale: 1.5, useCORS: true, allowTaint: false, logging: false,
        backgroundColor: "#ffffff",
      });
      const coverImg = coverCanvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(coverImg, "JPEG", 0, 0, 595, 842);
    } finally {
      document.body.removeChild(coverDiv);
    }

    // 政策页
    for (let i = 0; i < total; i++) {
      pdf.addPage();
      const pHtml = makePolicyPage(items[i], i, total, today);
      const pDiv = document.createElement("div");
      pDiv.style.cssText = "width:595pt;min-height:842pt;background:#fff;overflow:hidden;";
      pDiv.innerHTML = pHtml;
      document.body.appendChild(pDiv);
      try {
        const pCanvas = await html2canvas(pDiv as unknown as HTMLElement, {
          scale: 1.5, useCORS: true, allowTaint: false, logging: false,
          backgroundColor: "#ffffff",
        });
        const pImg = pCanvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(pImg, "JPEG", 0, 0, 595, 842);
      } finally {
        document.body.removeChild(pDiv);
      }
    }

    const data = pdf.output("arraybuffer");
    const filename = coName ? `浦发政策清单_${coName}.pdf` : "浦发政策清单.pdf";
    return { success: true, data: new Uint8Array(data), filename };
  } catch (err: unknown) {
    console.error("[PDF] generatePdfBytes ERROR:", err);
    return { success: false, error: String(err) };
  }
}
