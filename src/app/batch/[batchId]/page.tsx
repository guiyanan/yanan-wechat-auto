"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useArticleStore } from "@/store/articleStore";
import { useEmailStore } from "@/store/emailStore";
import { useProductStore } from "@/store/productStore";
import { BatchArticleCard } from "@/components/batch/BatchArticleCard";
import { TrendSourceTracePanel } from "@/components/batch/TrendSourceTracePanel";
import { WechatArticleFrame } from "@/components/wechat/WechatArticleFrame";
import { getAllProducts } from "@/lib/articles";
import { mergeProducts } from "@/lib/productCatalog";
import { inferArticleType } from "@/lib/articleType";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown";
import {
  postProcessGeneratedMarkdown,
} from "@/lib/generatedMarkdown";
import { getTrendStyleLabel } from "@/lib/trendStyleLabel";
import { postProcessTrendBody } from "@/lib/trendPostProcess";
import { buildTrendHumanizeRequest } from "@/lib/trendHumanize";
import anglesData from "@/data/angles.json";
import stylesData from "@/data/styles.json";
import type { Angle, Article, Product, WritingStyle } from "@/types";

const ANGLES = anglesData as Angle[];
const STYLES = stylesData as WritingStyle[];

// ─── Helpers ─────────────────────────────────────────────────────────

function resolveAngleName(article: Article): string {
  if (article.generationMeta?.mode === "trend-radar") {
    const label =
      article.generationMeta.trafficHookLabel ??
      article.generationMeta.angleLabel ??
      article.customAngle;
    return label ? `引流切口：${label}` : "引流切口";
  }
  if (article.customAngle) return `自定义：${article.customAngle}`;
  if (!article.angleId) return "未知角度";
  return ANGLES.find((a) => a.id === article.angleId)?.name ?? article.angleId;
}

function resolveStyleName(article: Article): string {
  const trendStyleLabel = getTrendStyleLabel(article);
  if (trendStyleLabel) return trendStyleLabel;
  if (article.generationMeta?.learnedStyleName) return article.generationMeta.learnedStyleName;
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

function humanizeStatus(article: Article): NonNullable<Article["humanizeMeta"]>["status"] {
  if (article.humanizeMeta?.status) return article.humanizeMeta.status;
  return article.stage === "main" ? "passed" : "pending";
}

function isHumanizePassed(article: Article): boolean {
  return humanizeStatus(article) === "passed";
}

function formatEmailSendError(
  data: {
    error?: string;
    results?: Array<{ email: string; ok: boolean; error?: string }>;
  },
  status: number
): string {
  if (data.error) return data.error;
  const failed = data.results?.filter((result) => !result.ok) ?? [];
  if (failed.length > 0) {
    return failed
      .map((result) => `${result.email}：${result.error ?? "未知错误"}`)
      .join("；");
  }
  return `HTTP ${status}`;
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
  const promoteToDashboardDrafts = useArticleStore(
    (s) => s.promoteToDashboardDrafts
  );
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSendIds, setSelectedSendIds] = useState<string[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const startedHumanizeIdsRef = useRef<Set<string>>(new Set());
  const recipients = useEmailStore((s) => s.recipients);
  const addSendHistory = useEmailStore((s) => s.addSendHistory);
  const customProducts = useProductStore((s) => s.products);
  const loadProducts = useProductStore((s) => s.loadFromServer);

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
  const products = useMemo(
    () => mergeProducts(getAllProducts(), Object.values(customProducts)),
    [customProducts]
  );
  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const firstPreviewableArticle = useMemo(
    () =>
      articles.find((a) => a.contentHtml.trim().length > 0) ??
      articles.find((a) => a.stage === "batch") ??
      articles[0] ??
      null,
    [articles]
  );

  // Keep the right preview anchored to a real article. During generation a
  // selected draft can be replaced or briefly have no body; once completed,
  // prefer an article that already has renderable HTML.
  useEffect(() => {
    if (!hydrated) return;
    if (!firstPreviewableArticle) return;

    const current = articles.find((a) => a.id === selectedId);
    if (!current) {
      setSelectedId(firstPreviewableArticle.id);
      return;
    }
    if (
      current.contentHtml.trim().length === 0 &&
      firstPreviewableArticle.contentHtml.trim().length > 0
    ) {
      setSelectedId(firstPreviewableArticle.id);
    }
  }, [hydrated, articles, firstPreviewableArticle, selectedId]);

  const selectedArticle =
    articles.find((a) => a.id === selectedId) ?? firstPreviewableArticle;
  const selectedTrendSources =
    selectedArticle?.generationMeta?.mode === "trend-radar"
      ? selectedArticle.generationMeta.sourceTrace
      : undefined;
  const selectedIsTrendArticle =
    selectedArticle?.generationMeta?.mode === "trend-radar";
  const passedArticles = articles.filter(isHumanizePassed);
  const runningHumanizeCount = articles.filter((a) => humanizeStatus(a) === "running").length;
  const failedHumanizeCount = articles.filter((a) => humanizeStatus(a) === "failed").length;
  const rehumanizableArticles = articles.filter(
    (article) => humanizeStatus(article) !== "running" && article.contentHtml.trim().length > 0
  );
  const selectedSendArticles = articles.filter(
    (article) => selectedSendIds.includes(article.id) && isHumanizePassed(article)
  );

  const runHumanizeArticle = useCallback(
    async (article: Article) => {
      if (humanizeStatus(article) === "running") return;
      const isTrendArticle = article.generationMeta?.mode === "trend-radar";
      const articleProduct = productMap.get(article.productId);
      const trendPostProcessContext = {
        product: articleProduct?.name,
        productDesc: articleProduct?.description,
      };
      const style = STYLES.find((s) => s.id === article.styleId);
      const articleType = inferArticleType({
        angleId: article.angleId,
        customAngle: article.customAngle,
      });

    // Round-trip: HTML → Markdown → pipeline → Markdown → HTML.
    // Going through Markdown (instead of stripping to plain text) preserves
    // **bold** spans, ## headings, - lists, > blockquotes — without this the
    // humanized article comes back as a flat sequence of <p> tags.
    const markdown = isTrendArticle
      ? postProcessTrendBody(
          htmlToMarkdown(article.contentHtml),
          trendPostProcessContext
        )
      : postProcessGeneratedMarkdown(
          htmlToMarkdown(article.contentHtml),
          article.generationMeta?.contentLength
        );

    if (!markdown.trim()) {
      patch(article.id, {
        humanizeMeta: {
          status: "failed",
          error: "文章正文为空，无法 humanize",
          checkedAt: new Date().toISOString(),
        },
      });
      return;
    }

    patch(article.id, {
      humanizeMeta: {
        status: "running",
        checkedAt: new Date().toISOString(),
      },
    });

    try {
      const requestBody = isTrendArticle
        ? buildTrendHumanizeRequest({
            markdown,
            styleName: resolveStyleName(article),
          })
        : {
            text: markdown,
            articleType,
            styleName: style?.name ?? "默认",
            styleProfile: style?.promptProfile ?? "",
            intent: undefined,
            // Preserve the article's visual structure (h2 / h3 / list /
            // blockquote) — humanize only rewrites paragraph blocks so the
            // hand-curated layout from the generation step survives.
            preserveStructure: true,
          };

      const res = await fetch("/api/humanize/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errMsg = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${errMsg ? `：${errMsg}` : ""}`);
      }

      const data = (await res.json()) as {
        text: string;
        scoreBreakdown: { total: number };
        beforeScoreBreakdown?: { total: number };
        similarity?: number;
        mode?: "two-pass-strong" | "legacy";
        passed?: boolean;
        totalRounds: number;
      };

      if (data.passed === false) {
        throw new Error("Humanize 质量门禁未通过，请重试或补充更具体的产品素材");
      }

      // Convert pipeline output (Markdown) back to rich HTML — preserves
      // headings, **bold**, lists, blockquotes from Qwen's rewrite.
      const newHtml = markdownToHtml(
        isTrendArticle
          ? postProcessTrendBody(data.text, trendPostProcessContext)
          : postProcessGeneratedMarkdown(
              data.text,
              article.generationMeta?.contentLength
            )
      );

      patch(article.id, {
        contentHtml: newHtml,
        stage: "batch",
        humanizeMeta: {
          status: "passed",
          score: data.scoreBreakdown.total,
          beforeScore: data.beforeScoreBreakdown?.total,
          afterScore: data.scoreBreakdown.total,
          similarity: data.similarity,
          mode: data.mode ?? "two-pass-strong",
          checkedAt: new Date().toISOString(),
          iterations: data.totalRounds,
        },
        aiScore: {
          value: data.scoreBreakdown.total,
          checkedAt: new Date().toISOString(),
          iterations: data.totalRounds,
        },
      });

      toast.success(`Humanize 完成：${article.title} · L3 ${data.scoreBreakdown.total}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patch(article.id, {
        humanizeMeta: {
          status: "failed",
          error: msg,
          checkedAt: new Date().toISOString(),
        },
      });
      toast.error(`Humanize 失败：${article.title} · ${msg}`);
    }
    },
    [patch, productMap]
  );

  useEffect(() => {
    if (!hydrated || articles.length === 0) return;
    const targets = articles.filter((article) => {
      const status = humanizeStatus(article);
      return (
        article.stage === "batch" &&
        article.contentHtml.trim().length > 0 &&
        (status === "pending" || status === "failed") &&
        !startedHumanizeIdsRef.current.has(article.id)
      );
    });
    if (targets.length === 0) return;
    for (const article of targets) {
      startedHumanizeIdsRef.current.add(article.id);
      void runHumanizeArticle(article);
    }
  }, [articles, hydrated, runHumanizeArticle]);

  function handleRetryFailedHumanize() {
    const failed = articles.filter((article) => humanizeStatus(article) === "failed");
    if (failed.length === 0) return;
    for (const article of failed) {
      startedHumanizeIdsRef.current.delete(article.id);
      void runHumanizeArticle(article);
    }
  }

  function handleRehumanizeArticle(article: Article) {
    if (humanizeStatus(article) === "running" || article.contentHtml.trim().length === 0) {
      return;
    }
    setSelectedSendIds((prev) => prev.filter((id) => id !== article.id));
    startedHumanizeIdsRef.current.delete(article.id);
    void runHumanizeArticle(article);
  }

  function handleRehumanizeAll() {
    if (rehumanizableArticles.length === 0 || runningHumanizeCount > 0) return;
    const rerunIds = new Set(rehumanizableArticles.map((article) => article.id));
    setSelectedSendIds((prev) => prev.filter((id) => !rerunIds.has(id)));
    for (const article of rehumanizableArticles) {
      startedHumanizeIdsRef.current.delete(article.id);
      void runHumanizeArticle(article);
    }
  }

  async function handleSendEmail() {
    if (recipients.length === 0) {
      toast.error("请先在邮箱管理里保存产品经理邮箱组");
      return;
    }
    if (selectedSendArticles.length === 0) {
      toast.error("请先勾选已通过 Humanize 的文章");
      return;
    }
    setSendingEmail(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "http://localhost:3004";
      const productName =
        productMap.get(selectedSendArticles[0]?.productId ?? "")?.name ?? "产品";
      const res = await fetch("/api/email/send-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          productName,
          recipients: recipients.map((recipient) => ({
            email: recipient.email,
            name: recipient.name,
          })),
          articles: selectedSendArticles.map((article) => ({
            id: article.id,
            title: article.title,
            angleLabel:
              article.generationMeta?.angleLabel ?? resolveAngleName(article),
            trafficHookLabel: article.generationMeta?.trafficHookLabel,
            styleName: resolveStyleName(article),
            summary: htmlPreview(article.contentHtml, 120),
            reviewUrl: `${origin}/review/${article.id}`,
            humanizeStatus: humanizeStatus(article),
          })),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: "success" | "partial_success" | "failed";
        messageIds?: string[];
        recipientEmails?: string[];
        results?: Array<{ email: string; ok: boolean; messageId?: string; error?: string }>;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(formatEmailSendError(data, res.status));
      }
      addSendHistory({
        id: `history-${Date.now().toString(36)}`,
        messageId: data.messageIds?.[0],
        messageIds: data.messageIds,
        recipientEmail: data.recipientEmails?.[0],
        recipientEmails: data.recipientEmails,
        batchId,
        articleCount: selectedSendArticles.length,
        articleIds: selectedSendArticles.map((article) => article.id),
        sentAt: new Date().toISOString(),
        status: data.status,
      });
      const failed = data.results?.filter((r) => !r.ok) ?? [];
      if (failed.length > 0) {
        toast.warning(`部分发送成功，${failed.length} 个邮箱失败，可检查发送历史`);
      } else {
        toast.success(`已发送给 ${recipients.length} 个产品经理邮箱`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送失败");
    } finally {
      setSendingEmail(false);
    }
  }

  function handlePromoteToDashboardDrafts() {
    if (runningHumanizeCount > 0) {
      toast.error("请等 Humanize 全部完成后再放入草稿箱");
      return;
    }
    if (selectedSendArticles.length === 0) {
      toast.error("请先勾选已通过 Humanize 的文章");
      return;
    }
    const count = promoteToDashboardDrafts(
      selectedSendArticles.map((article) => article.id)
    );
    if (count === 0) {
      toast.error("没有可放入 Dashboard 草稿箱的文章");
      return;
    }
    toast.success(`已放入 Dashboard 草稿箱：${count} 篇`);
    router.push("/");
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
    <main className="min-h-screen bg-slate-950 pb-32 lg:h-screen lg:overflow-hidden lg:pb-0">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:h-[calc(100vh-88px)] lg:grid-cols-[390px_minmax(0,1fr)] lg:overflow-hidden lg:py-6">
        <aside className="min-h-0 lg:flex lg:flex-col">
          <div className="shrink-0">
            <Link
              href="/wizard/product"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回产品选择
            </Link>

            <header className="mt-4">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                当前批次文章
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                共 {articles.length} 篇 · 左侧切换,右侧直接看 JOTO 公众号版式
                {passedArticles.length > 0 && (
                  <>
                    {" · "}
                    <span className="text-emerald-400">
                      Humanize 通过 {passedArticles.length} 篇
                    </span>
                  </>
                )}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                批次 ID：
                <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">
                  {batchId}
                </code>
              </p>
            </header>
          </div>

          {articles.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mt-5 min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2 lg:pb-4">
              <ul className="space-y-3">
                {articles.map((a) => (
                  <BatchArticleCard
                    key={a.id}
                    article={a}
                    product={productMap.get(a.productId)}
                    selected={selectedArticle?.id === a.id}
                    selectedForSend={selectedSendIds.includes(a.id)}
                    humanizeStatus={humanizeStatus(a)}
                    onSelect={() => setSelectedId(a.id)}
                    onToggleSend={() =>
                      setSelectedSendIds((prev) =>
                        prev.includes(a.id)
                          ? prev.filter((id) => id !== a.id)
                          : [...prev, a.id]
                      )
                    }
                    onRehumanize={() => handleRehumanizeArticle(a)}
                  />
                ))}
              </ul>
            </div>
          )}
        </aside>

        <section className="min-h-0 min-w-0 lg:flex lg:flex-col">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-blue-300">
                JOTO 公众号预览
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold text-white">
                {selectedArticle?.title ?? "请选择一篇文章"}
              </h2>
            </div>
            <span className="shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
              当前页预览
            </span>
          </div>
          <TrendSourceTracePanel sources={selectedTrendSources} />
          <WechatArticleFrame
            title={selectedArticle?.title ?? "JOTO 公众号预览"}
            contentHtml={selectedArticle?.contentHtml ?? ""}
            coverUrl={
              selectedArticle?.coverImageUrl ?? selectedArticle?.coverCandidates[0]
            }
            author={selectedArticle?.createdBy}
            theme={
              selectedArticle?.layoutTheme ??
              (selectedIsTrendArticle ? "minimal" : "joto")
            }
            decorate={!selectedIsTrendArticle}
            fillHeight
            className="h-[720px] lg:min-h-0 lg:flex-1"
            iframeClassName="h-full"
          />
        </section>
      </div>

      {/* Sticky bottom action bar */}
      {articles.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="min-w-0 text-sm">
              {selectedArticle ? (
                <div className="space-y-1">
                  <p className="text-slate-700">
                    当前预览：
                    <span className="font-medium text-slate-900">
                      {resolveAngleName(selectedArticle)} ×{" "}
                      {resolveStyleName(selectedArticle)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Humanize 通过 {passedArticles.length}/{articles.length} ·
                    运行中 {runningHumanizeCount} · 失败 {failedHumanizeCount} ·
                    已勾选 {selectedSendArticles.length} · 收件人 {recipients.length}
                  </p>
                </div>
              ) : (
                <p className="text-slate-400">从上面选一篇文章</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleRehumanizeAll}
                disabled={runningHumanizeCount > 0 || rehumanizableArticles.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                重新 Humanize 全部
              </button>
              {failedHumanizeCount > 0 && (
                <button
                  type="button"
                  onClick={handleRetryFailedHumanize}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-medium text-amber-700 shadow-sm transition-colors hover:bg-amber-100"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  重试失败稿
                </button>
              )}
              <button
                type="button"
                onClick={handlePromoteToDashboardDrafts}
                disabled={
                  selectedSendArticles.length === 0 ||
                  runningHumanizeCount > 0
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                放入 Dashboard 草稿箱
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={
                  sendingEmail ||
                  selectedSendArticles.length === 0 ||
                  recipients.length === 0 ||
                  runningHumanizeCount > 0
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 shadow-sm transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="h-4 w-4" aria-hidden="true" />
                )}
                发送给产品经理邮箱组
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
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
