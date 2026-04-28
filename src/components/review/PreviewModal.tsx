"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface PreviewModalProps {
  html: string;
  onClose: () => void;
}

/**
 * Accessible modal:
 *   - Esc closes
 *   - focus moves to close button on mount
 *   - focus is trapped within the dialog (Tab/Shift+Tab cycles)
 *   - outside click closes
 *   - body scroll locked while open
 */
export function PreviewModal({ html, onClose }: PreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Move focus into the dialog and remember the trigger so we can
    // restore focus on close.
    const trigger = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !root.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      trigger?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="微信 HTML 预览"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              微信 HTML 预览
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              这就是粘贴到公众号后台后会呈现的样式(样式已内联) · 按 Esc 关闭
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="关闭预览"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <iframe
          title="wechat-preview"
          srcDoc={html}
          sandbox=""
          className="flex-1 w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}
