"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import type { Article, Product } from "@/types";
import { useArticleStore } from "@/store/articleStore";

interface PushConfirmModalProps {
  article: Article | null;
  product?: Product;
  open: boolean;
  onClose: () => void;
}

/**
 * Confirmation dialog for one-click WeChat draft push from Dashboard.
 *
 * On confirm: POSTs to /api/wechat/push-draft with the article's stored
 * theme (or "polished" default), then promotes the article to status
 * "published" on success. Mirrors the review page's push flow but skips
 * theme picker / account picker / compliance agreement.
 *
 * The article's `aiScore` / `compliance` fields are left untouched.
 */
export function PushConfirmModal({
  article,
  product,
  open,
  onClose,
}: PushConfirmModalProps) {
  const setStatus = useArticleStore((s) => s.setStatus);
  const [pushing, setPushing] = useState(false);

  // Reset internal state when the modal closes
  useEffect(() => {
    if (!open) setPushing(false);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pushing) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pushing, onClose]);

  if (!open || !article) return null;

  const theme = article.exportTheme ?? "polished";
  const digest = article.contentHtml
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 120);

  async function handleConfirm() {
    if (!article) return;
    setPushing(true);
    try {
      const res = await fetch("/api/wechat/push-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: article.title,
          bodyHtml: article.contentHtml,
          author: article.createdBy,
          theme,
          decorate: true,
          addAigcNotice: true,
          articleId: article.id,
          digest,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatus(article.id, "published");
        toast.success("已推送到微信草稿箱，请到公众号后台发布", {
          duration: 6000,
          action: {
            label: "打开公众号后台",
            onClick: () => window.open("https://mp.weixin.qq.com", "_blank"),
          },
        });
        onClose();
      } else {
        const err = data.error ?? `HTTP ${res.status}`;
        toast.error(`推送失败：${err}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "网络错误";
      toast.error(`推送失败：${msg}`);
    } finally {
      setPushing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pushing) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="push-confirm-title"
            className="text-lg font-semibold text-slate-900"
          >
            推送到微信公众号草稿箱
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pushing}
            aria-label="关闭"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-medium text-slate-900">{article.title}</p>
            {product && (
              <p className="mt-1 text-xs text-slate-500">{product.name}</p>
            )}
          </div>
          <dl className="space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <dt>排版主题</dt>
              <dd className="font-medium text-slate-700">{theme}</dd>
            </div>
            <div className="flex justify-between">
              <dt>装饰处理</dt>
              <dd className="font-medium text-slate-700">启用（含 AIGC 标注）</dd>
            </div>
          </dl>
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            推送后会出现在公众号后台「草稿箱」，需要你手动在公众号后台点击「发布」。
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pushing}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pushing}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pushing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                推送中…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                确认推送
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
