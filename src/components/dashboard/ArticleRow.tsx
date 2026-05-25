import Link from "next/link";
import { FileText, Loader2, Mail, Send } from "lucide-react";
import type { Article, Product } from "@/types";
import { formatRelativeDate } from "@/lib/articles";
import { AiScoreBar } from "./AiScoreBar";
import { StatusBadge } from "./StatusBadge";
import anglesData from "@/data/angles.json";
import stylesData from "@/data/styles.json";
import type { Angle, WritingStyle } from "@/types";

const ANGLES = anglesData as Angle[];
const STYLES = stylesData as WritingStyle[];

export function resolveAngleName(article: Article): string | null {
  if (article.customAngle) return `自定义:${article.customAngle}`;
  if (!article.angleId) return null;
  return ANGLES.find((a) => a.id === article.angleId)?.name ?? null;
}

export function resolveStyleName(article: Article): string | null {
  if (article.generationMeta?.learnedStyleName) {
    return article.generationMeta.learnedStyleName;
  }
  if (!article.styleId) return null;
  return STYLES.find((s) => s.id === article.styleId)?.name ?? null;
}

interface ArticleRowProps {
  article: Article;
  product?: Product;
  /** Fired when the row's standalone "推送" button is clicked. */
  onPushClick?: (article: Article) => void;
  /** Fired when the row's standalone "邮件" button is clicked. */
  onEmailClick?: (article: Article) => void;
  emailSending?: boolean;
}

/**
 * One row in the dashboard article list.
 *
 * Layout: the title/product/chips area opens generated articles in the review
 * preview so the WeChat/JOTO template is preserved. Empty drafts still open in
 * the editor. The "推送" button is rendered alongside but outside the Link, so
 * clicking it does NOT trigger navigation — instead it bubbles up via
 * `onPushClick` to open the confirm modal.
 *
 * The push button is hidden for already-published articles.
 */
export function ArticleRow({
  article,
  product,
  onPushClick,
  onEmailClick,
  emailSending = false,
}: ArticleRowProps) {
  const isPublished = article.status === "published";
  const hasGeneratedContent = Boolean(article.contentHtml?.trim());
  const href = hasGeneratedContent
    ? `/review/${article.id}`
    : `/editor/${article.id}`;

  const angleName = resolveAngleName(article);
  const styleName = resolveStyleName(article);
  const canPush = !isPublished && Boolean(article.contentHtml?.trim());
  const canEmail =
    hasGeneratedContent && article.humanizeMeta?.status === "passed";

  return (
    <div className="grid grid-cols-1 gap-3 px-5 py-4 text-sm transition-colors hover:bg-[#f5f5f7]/70 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto] md:items-center md:gap-6">
      <Link href={href} className="flex items-center gap-3 min-w-0">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#d2d2d7]/70 bg-[#f2f7ff]"
          title={product?.name}
        >
          <FileText className="h-4 w-4 text-[#0071e3]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-950">{article.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">
              {product?.name ?? "未知产品"} · {article.createdBy}
            </span>
            {angleName && (
              <span className="inline-flex items-center rounded-md bg-[#f5f2ff] px-1.5 py-0.5 text-[10px] font-medium text-[#5e5ce6]">
                {angleName}
              </span>
            )}
            {styleName && (
              <span className="inline-flex items-center rounded-md bg-[#eef6ff] px-1.5 py-0.5 text-[10px] font-medium text-[#0071e3]">
                {styleName}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between md:block">
        <span className="text-xs text-slate-400 md:hidden">状态</span>
        <StatusBadge status={article.status} />
      </div>

      <div className="hidden lg:block">
        <AiScoreBar score={article.aiScore.value} compact />
      </div>

      <div className="hidden text-right sm:block">
        <p className="font-mono text-xs text-slate-700">
          {isPublished ? (article.readers ?? 0).toLocaleString() : "—"}
        </p>
        <p className="text-[11px] text-slate-400">阅读</p>
      </div>

      <div className="flex min-w-[150px] justify-start gap-1.5 md:justify-end">
        {canPush ? (
          <button
            type="button"
            onClick={() => onPushClick?.(article)}
            aria-label={`推送 ${article.title} 到微信草稿箱`}
            title="推送到微信公众号草稿箱"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#0071e3]/30 bg-white px-2.5 text-[11px] font-medium text-[#0071e3] transition-colors hover:border-[#0071e3] hover:bg-[#eef6ff]"
          >
            <Send className="h-3 w-3" aria-hidden="true" />
            推送
          </button>
        ) : (
          <span className="w-[58px]" aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={() => onEmailClick?.(article)}
          disabled={!canEmail || emailSending}
          aria-label={`邮件发送 ${article.title} 给产品经理邮箱组`}
          title={
            canEmail
              ? "发送给产品经理邮箱组"
              : "需先通过 Humanize 才能邮件发送"
          }
          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#d2d2d7] bg-white px-2.5 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {emailSending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Mail className="h-3 w-3" aria-hidden="true" />
          )}
          邮件
        </button>
      </div>

      <div className="text-left text-xs text-slate-500 md:min-w-[72px] md:text-right">
        {formatRelativeDate(article.updatedAt)}
      </div>
    </div>
  );
}
