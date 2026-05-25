"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  RotateCcw,
} from "lucide-react";
import anglesData from "@/data/angles.json";
import stylesData from "@/data/styles.json";
import type { Angle, Article, Product, WritingStyle } from "@/types";
import {
  getAngleStrategyOption,
  getContentLengthOption,
} from "@/lib/contentSettings";
import { countProductImagesInHtml } from "@/lib/productImages";
import { cn } from "@/lib/utils";

const ANGLES = anglesData as Angle[];
const STYLES = stylesData as WritingStyle[];

interface BatchArticleCardProps {
  article: Article;
  product?: Product;
  selected: boolean;
  selectedForSend: boolean;
  humanizeStatus: NonNullable<Article["humanizeMeta"]>["status"];
  onSelect: () => void;
  onToggleSend: () => void;
  onRehumanize: () => void;
}

function resolveAngleName(article: Article): string {
  if (article.customAngle) return `自定义：${article.customAngle}`;
  if (!article.angleId) return "未知角度";
  return ANGLES.find((a) => a.id === article.angleId)?.name ?? article.angleId;
}

function resolveStyleName(article: Article): string {
  if (article.generationMeta?.learnedStyleName) {
    return article.generationMeta.learnedStyleName;
  }
  return STYLES.find((s) => s.id === article.styleId)?.name ?? article.styleId;
}

function htmlPreview(html: string, max = 200): string {
  if (!html) return "";
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function BatchArticleCard({
  article,
  product,
  selected,
  selectedForSend,
  humanizeStatus,
  onSelect,
  onToggleSend,
  onRehumanize,
}: BatchArticleCardProps) {
  const angleName = resolveAngleName(article);
  const lengthOption = getContentLengthOption(
    article.generationMeta?.contentLength
  );
  const strategyOption = getAngleStrategyOption(
    article.generationMeta?.angleStrategy
  );
  const styleName =
    article.generationMeta?.learnedStyleName ?? resolveStyleName(article);
  const preview = htmlPreview(article.contentHtml);
  const imageCount = countProductImagesInHtml(article.contentHtml);
  const canSend = humanizeStatus === "passed";
  const canRehumanize =
    humanizeStatus !== "running" && article.contentHtml.trim().length > 0;

  return (
    <li
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition-all",
        selected
          ? "border-emerald-500 ring-2 ring-emerald-200"
          : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-pressed={selectedForSend}
          aria-label={
            canSend
              ? "选择放入 Dashboard 草稿箱"
              : "Humanize 通过后可放入 Dashboard 草稿箱"
          }
          onClick={(e) => {
            e.stopPropagation();
            if (canSend) onToggleSend();
          }}
          disabled={!canSend}
          className={cn(
            "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selectedForSend
              ? "border-emerald-500 bg-emerald-500"
              : canSend
                ? "border-slate-300 hover:border-emerald-400"
                : "border-slate-200 bg-slate-100"
          )}
        >
          {selectedForSend ? (
            <span className="h-2 w-2 rounded-full bg-white" />
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2.5">
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-slate-900">
                  {article.title}
                </h2>
                <HumanizeBadge status={humanizeStatus} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {product?.name ?? "未知产品"}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="inline-flex items-center rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                  {angleName}
                </span>
                <span className="inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                  {styleName}
                </span>
                <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {lengthOption.label} · {strategyOption.label}
                </span>
                {imageCount > 0 && (
                  <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    已插入 {imageCount} 张图
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                }}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                预览
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (canRehumanize) onRehumanize();
                }}
                disabled={!canRehumanize}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                重新 Humanize
              </button>
            </div>
          </div>

          {preview && (
            <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-slate-600">
              {preview}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function HumanizeBadge({
  status,
}: {
  status: NonNullable<Article["humanizeMeta"]>["status"];
}) {
  if (status === "passed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        已通过
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Humanize 中
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        未通过
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
      等待 Humanize
    </span>
  );
}
