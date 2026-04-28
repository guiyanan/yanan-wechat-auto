"use client";

import type { Article, WechatAccount } from "@/types";

interface PreviewCardProps {
  article: Article;
  account: WechatAccount | null;
}

function extractSummary(html: string, limit = 80): string {
  const text = html
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit) + "…";
}

export function PreviewCard({ article, account }: PreviewCardProps) {
  const summary = extractSummary(article.contentHtml);
  const cover = article.coverImageUrl ?? article.coverCandidates[0];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
        微信公众号推送预览 · {account?.name ?? "未选账号"}
      </div>
      <div className="p-4">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={article.title}
            className="aspect-[16/9] w-full rounded-lg object-cover"
          />
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
            未选封面
          </div>
        )}
        <h3 className="mt-3 text-lg font-semibold leading-snug text-slate-900">
          {article.title || "(未命名标题)"}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">
          {summary || "(正文为空)"}
        </p>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
          <span>{account?.name ?? "--"}</span>
          {account && <span>·</span>}
          <span>{new Date().toLocaleDateString("zh-CN")}</span>
        </div>
      </div>
    </div>
  );
}
