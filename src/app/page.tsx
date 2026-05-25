"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Gauge,
  Inbox,
  LayoutTemplate,
  Plus,
  Send,
  WandSparkles,
} from "lucide-react";
import { TopNav } from "@/components/nav/TopNav";
import { BatchBanner } from "@/components/dashboard/BatchBanner";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ArticleList } from "@/components/dashboard/ArticleList";
import { ArticleListSkeleton } from "@/components/dashboard/ArticleListSkeleton";
import { useArticleStore } from "@/store/articleStore";
import { useProductStore } from "@/store/productStore";
import {
  computeKpis,
  filterDashboardVisible,
  getAllArticles,
  getAllProducts,
} from "@/lib/articles";
import { mergeProducts, withGenericProduct } from "@/lib/productCatalog";
import type { Article } from "@/types";
import { aiScoreMeta } from "@/lib/aiScore";

export default function DashboardPage() {
  const [hydrated, setHydrated] = useState(false);
  const drafts = useArticleStore((s) => s.drafts);
  const customProducts = useProductStore((s) => s.products);
  const products = useMemo(
    () =>
      withGenericProduct(
        mergeProducts(getAllProducts(), Object.values(customProducts))
      ),
    [customProducts]
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  const articles = useMemo<Article[]>(() => {
    const seed = getAllArticles();
    const byId = new Map<string, Article>();
    for (const s of seed) byId.set(s.id, s);
    for (const d of Object.values(drafts)) byId.set(d.id, d);
    // Hide articles still in batch preview stage — they belong to /batch/[id],
    // not the main Dashboard, until humanize promotes them to stage="main".
    return filterDashboardVisible(Array.from(byId.values())).sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [drafts]);

  const kpis = computeKpis(articles);
  const scoreMeta = aiScoreMeta(kpis.avgAiScore);
  const draftCount = articles.filter((a) => a.status === "draft").length;
  const wechatDraftCount = articles.filter(
    (a) => a.wechatDraftMediaId || a.wechatPushedAt
  ).length;
  const pendingHumanizeCount = articles.filter(
    (a) => a.humanizeMeta?.status === "pending" || a.humanizeMeta?.status === "failed"
  ).length;
  const riskCount = articles.filter((a) => a.aiScore.value >= 40).length;

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f7]">
      <TopNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 lg:py-11">
        <section className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium text-[#0071e3]">
              JOTO小信 · 内容运营指挥台
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              今日内容队列
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {draftCount} 篇草稿待处理，{wechatDraftCount} 篇已推送到公众号草稿箱，
              {pendingHumanizeCount > 0
                ? `${pendingHumanizeCount} 篇需要继续优化。`
                : "当前候选内容状态稳定。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/templates"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-[#fbfbfd] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/15"
            >
              <LayoutTemplate className="h-4 w-4 text-[#0071e3]" aria-hidden="true" />
              采集公众号
            </Link>
            <Link
              href="/format"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-[#fbfbfd] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/15"
            >
              <WandSparkles className="h-4 w-4 text-[#0071e3]" aria-hidden="true" />
              粘贴排版
            </Link>
            <Link
              href="/wizard/product"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0071e3] px-5 text-sm font-medium text-white shadow-[0_2px_10px_rgba(0,113,227,0.22)] transition-colors hover:bg-[#0077ed] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              新建文章
            </Link>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={FileText}
            iconColor="text-[#0071e3]"
            iconBg="bg-[#eef6ff]"
            label="本月生成"
            value={kpis.monthlyGenerated}
            hint={`${articles.length} 篇进入主队列`}
            eyebrow="Volume"
          />
          <KpiCard
            icon={Inbox}
            iconColor="text-slate-700"
            iconBg="bg-[#f5f5f7]"
            label="草稿待处理"
            value={draftCount}
            hint={draftCount > 0 ? "可继续预览或推送" : "没有待处理草稿"}
            hintColor={draftCount > 0 ? "text-slate-600" : "text-emerald-600"}
            eyebrow="Queue"
          />
          <KpiCard
            icon={Send}
            iconColor="text-emerald-700"
            iconBg="bg-emerald-50"
            label="微信草稿"
            value={wechatDraftCount}
            hint={`${kpis.published} 篇已标记发布`}
            hintColor="text-emerald-700"
            eyebrow="WeChat"
          />
          <KpiCard
            icon={Gauge}
            iconColor={scoreMeta.textColor}
            iconBg={scoreMeta.bgColor}
            label="AI 风险"
            value={kpis.avgAiScore}
            hint={riskCount > 0 ? `${riskCount} 篇建议复检` : scoreMeta.label}
            hintColor={riskCount > 0 ? "text-amber-700" : scoreMeta.textColor}
            eyebrow="Quality"
          />
        </section>

        {hydrated && <BatchBanner />}

        {/* Avoid hydration mismatch: list renders after client hydrate */}
        {hydrated ? (
          <ArticleList articles={articles} products={products} />
        ) : (
          <ArticleListSkeleton />
        )}
      </main>
    </div>
  );
}
