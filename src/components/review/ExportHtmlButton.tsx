"use client";

import { useState } from "react";
import { Check, Clipboard, Download, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PreviewModal } from "./PreviewModal";

interface ExportHtmlButtonProps {
  html: string;
  filename: string;
  disabled?: boolean;
}

/**
 * Copy `html` to the clipboard as both text/html (WeChat editor paste target)
 * and text/plain (fallback). ClipboardItem is required — plain
 * navigator.clipboard.writeText would lose formatting on paste.
 */
async function copyHtmlToClipboard(html: string): Promise<void> {
  if (
    typeof ClipboardItem !== "undefined" &&
    typeof navigator !== "undefined" &&
    navigator.clipboard?.write
  ) {
    const blobs: Record<string, Blob> = {
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([html], { type: "text/plain" }),
    };
    await navigator.clipboard.write([new ClipboardItem(blobs)]);
    return;
  }
  // Legacy fallback — plain text only
  await navigator.clipboard.writeText(html);
}

function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportHtmlButton({
  html,
  filename,
  disabled,
}: ExportHtmlButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (copying) return;
    setCopying(true);
    try {
      await copyHtmlToClipboard(html);
      setCopied(true);
      toast.success("HTML 已复制到剪贴板,可粘贴到微信公众号后台");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(
        `复制失败:${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setCopying(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={disabled || copying}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          ) : (
            <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          复制 HTML
        </button>
        <button
          type="button"
          onClick={() => downloadHtml(html, filename)}
          disabled={disabled}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          下载 .html
        </button>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={disabled}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          预览
        </button>
      </div>

      {modalOpen && (
        <PreviewModal html={html} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}

