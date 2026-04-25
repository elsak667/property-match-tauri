/**
 * Tauri 命令桥接
 */
import { invoke } from "@tauri-apps/api/core";

/**
 * 保存 PDF 文件（原生另存为对话框）
 * @param data PDF 原始字节
 * @param filename 建议文件名
 * @returns 保存路径，失败返回错误
 */
export async function savePdf(data: Uint8Array, filename: string): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const path = await invoke<string>("save_pdf_file", { data, filename });
    return { success: true, path };
  } catch (err) {
    const msg = String(err);
    if (msg.includes("用户取消")) {
      return { success: false, error: "用户取消" };
    }
    return { success: false, error: msg };
  }
}

/**
 * 打开打印窗口（打印 HTML 内容）
 * @param html 完整 HTML 字符串（含 window.print()）
 */
export function openPrintWindow(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      reject(new Error("无法打开打印窗口，请检查浏览器弹窗设置"));
      return;
    }
    w.document.write(html);
    w.document.close();
    w.addEventListener("load", () => {
      setTimeout(() => {
        w.print();
        resolve();
      }, 600);
    });
  });
}
