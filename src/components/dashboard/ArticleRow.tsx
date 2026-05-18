import Link from "next/link";
import { FileText, Send } from "lucide-react";
import type { Article, Product } from "@/types";
import { formatRelativeDate } from "@/lib/articles";
import { AiScoreBar } from "./AiScoreBar";
import { StatusBadge } from "./StatusBadge";
import anglesData from "@/data/angles.json";
import stylesData from "@/data/styles.json";
import type { Angle, WritingStyle } from "@/types";

const ANGLES = anglesData as Angle[];
const STYLES = stylesData as WritingStyle[];

function resolveAngleName(article: Article): string | null {
  if (article.customAngle) return `自定义:${article.customAngle}`;
  if (!article.angleId) return null;
  return ANGLES.find((a) => a.id === article.angleId)?.name ?? null;
}

function resolveStyleName(article: Article): string | null {
  if (!article.styleId) return null;
  return STYLES.find((s) => s.id === article.styleId)?.name ?? null;
}

interface ArticleRowProps {
  article: Article;
  product?: Product;
  /** Fired when the row's standalone "推送" button is clicked. */
  onPushClick?: (article: Article) => void;
}

/**
 * One row in the dashboard article list.
 *
 * Layout: the title/product/chips area is a Link to the editor (or readonly
 * preview for published articles). The "推送" button is rendered alongside
 * but outside the Link, so clicking it does NOT trigger navigation —
 * instead it bubbles up via `onPushClick` to open the confirm modal.
 *
 * The push button is hidden for already-published articles.
 */
export function ArticleRow({ article, product, onPushClick }: ArticleRowProps) {
  const isPublished = article.status === "published";
  const href = isPublished
    ? `/editor/${article.id}?readonly=1`
    : `/editor/${article.id}`;

  const angleName = resolveAngleName(article);
  const styleName = resolveStyleName(article);
  const canPush = !isPublished && Boolean(article.contentHtml?.trim());

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto] items-center gap-6 px-5 py-4 text-sm transition-colors hover:bg-slate-50">
      <Link href={href} className="flex items-center gap-3 min-w-0">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
          style={{
            background: product
              ? `linear-gradient(135deg,${product.iconGradient[0]} 0%,${product.iconGradient[1]} 100%)`
              : "linear-gradient(135deg,#94a3b8,#cbd5e1)",
          }}
        >
          <FileText className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{article.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">
              {product?.name ?? "未知产品"} · {article.createdBy}
            </span>
            {angleName && (
              <span className="inline-flex items-center rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                {angleName}
              </span>
            )}
            {styleName && (
              <span className="inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                {styleName}
              </span>
            )}
          </div>
        </div>
      </Link>

      <StatusBadge status={article.status} />

      <div className="hidden lg:block">
        <AiScoreBar score={article.aiScore.value} compact />
      </div>

      <div className="hidden sm:block text-right">
        <p className="font-mono text-xs text-slate-700">
          {isPublished ? (article.readers ?? 0).toLocaleString() : "—"}
        </p>
        <p className="text-[11px] text-slate-400">阅读</p>
      </div>

      {/* Push button — sibling of the title Link so clicks don't navigate. */}
      {canPush ? (
        <button
          type="button"
          onClick={() => onPushClick?.(article)}
          aria-label={`推送 ${article.title} 到微信草稿箱`}
          title="推送到微信公众号草稿箱"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-100"
        >
          <Send className="h-3 w-3" aria-hidden="true" />
          推送
        </button>
      ) : (
        <span className="w-[64px]" aria-hidden="true" />
      )}

      <div className="text-right text-xs text-slate-500 min-w-[72px]">
        {formatRelativeDate(article.updatedAt)}
      </div>
    </div>
  );
}
