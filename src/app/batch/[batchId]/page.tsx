"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useArticleStore } from "@/store/articleStore";
import { getAllProducts } from "@/lib/articles";
import { inferArticleType } from "@/lib/articleType";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown";
import anglesData from "@/data/angles.json";
import stylesData from "@/data/styles.json";
import type { Angle, Article, Product, WritingStyle } from "@/types";
import { cn } from "@/lib/utils";

const ANGLES = anglesData as Angle[];
const STYLES = stylesData as WritingStyle[];

// ─── Helpers ─────────────────────────────────────────────────────────

function resolveAngleName(article: Article): string {
  if (article.customAngle) return `自定义：${article.customAngle}`;
  if (!article.angleId) return "未知角度";
  return ANGLES.find((a) => a.id === article.angleId)?.name ?? article.angleId;
}

function resolveStyleName(article: Article): string {
  return STYLES.find((s) => s.id === article.styleId)?.name ?? article.styleId;
}

/** First 200 plain-text chars of HTML body, for preview. */
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

// ─── Page ────────────────────────────────────────────────────────────

export default function BatchPreviewPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = use(params);
  const router = useRouter();
  const patch = useArticleStore((s) => s.patch);
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [humanizing, setHumanizing] = useState(false);

  // Subscribe to the raw drafts map, derive the batch list in useMemo
  // (returning the array directly from the selector would trip zustand's
  // infinite-loop guard since each call returns a new array reference).
  // `drafts` is a trigger-only dep — its identity changes whenever a
  // draft is added/patched, which is exactly when we want to re-derive.
  const drafts = useArticleStore((s) => s.drafts);
  const articles = useMemo(
    () => useArticleStore.getState().listByBatch(batchId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, batchId]
  );
  const products = useMemo(() => getAllProducts(), []);
  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Auto-select the first "still waiting" article when the list loads
  useEffect(() => {
    if (!hydrated) return;
    if (selectedId) return;
    const firstAvailable = articles.find((a) => a.stage === "batch");
    if (firstAvailable) setSelectedId(firstAvailable.id);
  }, [hydrated, articles, selectedId]);

  const selectedArticle = articles.find((a) => a.id === selectedId);
  const promotedCount = articles.filter((a) => a.stage === "main").length;

  /**
   * Run the L1+L2+L3 humanize pipeline on the selected article, promote
   * it from stage="batch" to stage="main" (so it surfaces in Dashboard),
   * then navigate to Dashboard.
   *
   * - Body is extracted from contentHtml (strip tags → markdown-ish text).
   * - Pipeline result body is written back as a simple paragraph wrap.
   * - L3 total score is written into article.aiScore for visibility.
   */
  async function handleHumanize() {
    if (!selectedArticle) {
      toast.error("请先选择一篇文章");
      return;
    }
    const article = selectedArticle;
    const style = STYLES.find((s) => s.id === article.styleId);
    const articleType = inferArticleType({
      angleId: article.angleId,
      customAngle: article.customAngle,
    });

    // Round-trip: HTML → Markdown → pipeline → Markdown → HTML.
    // Going through Markdown (instead of stripping to plain text) preserves
    // **bold** spans, ## headings, - lists, > blockquotes — without this the
    // humanized article comes back as a flat sequence of <p> tags.
    const markdown = htmlToMarkdown(article.contentHtml);

    if (!markdown.trim()) {
      toast.error("文章正文为空，无法 humanize");
      return;
    }

    setHumanizing(true);
    try {
      const res = await fetch("/api/humanize/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: markdown,
          articleType,
          styleName: style?.name ?? "默认",
          styleProfile: style?.promptProfile ?? "",
          // Preserve the article's visual structure (h2 / h3 / list /
          // blockquote) — humanize only rewrites paragraph blocks so the
          // hand-curated layout from the generation step survives.
          preserveStructure: true,
        }),
      });

      if (!res.ok) {
        const errMsg = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${errMsg ? `：${errMsg}` : ""}`);
      }

      const data = (await res.json()) as {
        text: string;
        scoreBreakdown: { total: number };
        totalRounds: number;
      };

      // Convert pipeline output (Markdown) back to rich HTML — preserves
      // headings, **bold**, lists, blockquotes from Qwen's rewrite.
      const newHtml = markdownToHtml(data.text);

      patch(article.id, {
        contentHtml: newHtml,
        stage: "main",
        aiScore: {
          value: data.scoreBreakdown.total,
          checkedAt: new Date().toISOString(),
          iterations: data.totalRounds,
        },
      });

      // Stash batch metadata so Dashboard banner can show a friendly label
      try {
        sessionStorage.setItem(
          "joto-last-humanize",
          JSON.stringify({
            articleId: article.id,
            title: article.title,
            score: data.scoreBreakdown.total,
            ts: Date.now(),
          })
        );
      } catch {
        /* sessionStorage may be unavailable; non-fatal */
      }

      toast.success(
        `Humanize 完成：L3 评分 ${data.scoreBreakdown.total}，已发布到 Dashboard`
      );
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Humanize 失败：${msg}`);
    } finally {
      setHumanizing(false);
    }
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <div className="mx-auto max-w-3xl text-center text-sm text-slate-400">
          加载中…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-32">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          回 Dashboard
        </Link>

        <header className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            批次预览
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            共 {articles.length} 篇 · 选一篇 humanize 后发布到 Dashboard
            {promotedCount > 0 && (
              <>
                {" · "}
                <span className="text-emerald-600">已入库 {promotedCount} 篇</span>
              </>
            )}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            批次 ID：
            <code className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono text-[10px]">
              {batchId}
            </code>
          </p>
        </header>

        {articles.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-6 space-y-3">
            {articles.map((a) => (
              <BatchArticleCard
                key={a.id}
                article={a}
                product={productMap.get(a.productId)}
                selected={selectedId === a.id}
                disabled={a.stage === "main"}
                onSelect={() => setSelectedId(a.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Sticky bottom action bar */}
      {articles.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div className="min-w-0 text-sm">
              {selectedArticle ? (
                <p className="text-slate-700">
                  已选：
                  <span className="font-medium text-slate-900">
                    {resolveAngleName(selectedArticle)} ×{" "}
                    {resolveStyleName(selectedArticle)}
                  </span>
                </p>
              ) : (
                <p className="text-slate-400">从上面选一篇文章</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleHumanize}
              disabled={!selectedArticle || humanizing}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {humanizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Humanize 中… (L1 → L2 → L3)
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Humanize 所选 → 发布到 Dashboard
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Article card ────────────────────────────────────────────────────

interface BatchArticleCardProps {
  article: Article;
  product?: Product;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}

function BatchArticleCard({
  article,
  product,
  selected,
  disabled,
  onSelect,
}: BatchArticleCardProps) {
  const angleName = resolveAngleName(article);
  const styleName = resolveStyleName(article);
  const preview = htmlPreview(article.contentHtml);

  return (
    <li
      className={cn(
        "rounded-xl border bg-white p-5 shadow-sm transition-all",
        disabled
          ? "border-slate-200 opacity-60"
          : selected
            ? "border-emerald-500 ring-2 ring-emerald-200"
            : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Radio button (left) */}
        <button
          type="button"
          role="radio"
          aria-checked={selected}
          disabled={disabled}
          onClick={onSelect}
          className={cn(
            "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            disabled
              ? "border-slate-300 bg-slate-100"
              : selected
                ? "border-emerald-500 bg-emerald-500"
                : "border-slate-300 hover:border-emerald-400"
          )}
        >
          {selected && !disabled && (
            <span className="h-2 w-2 rounded-full bg-white" />
          )}
          {disabled && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
        </button>

        {/* Card body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
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
                <h2 className="truncate text-base font-semibold text-slate-900">
                  {article.title}
                </h2>
                {disabled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    已入库
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {product?.name ?? "未知产品"}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                  {angleName}
                </span>
                <span className="inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                  {styleName}
                </span>
              </div>
            </div>
            <Link
              href={`/editor/${article.id}?readonly=1`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              预览
            </Link>
          </div>

          {preview && (
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
              {preview}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <p className="text-sm text-slate-500">
        没找到这个批次的文章。
        <br />
        （可能是 ID 无效，或本地存储已被清空。）
      </p>
    </div>
  );
}
