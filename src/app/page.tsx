"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, FileText, Gauge, Plus, Users } from "lucide-react";
import { TopNav } from "@/components/nav/TopNav";
import { BatchBanner } from "@/components/dashboard/BatchBanner";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ArticleList } from "@/components/dashboard/ArticleList";
import { ArticleListSkeleton } from "@/components/dashboard/ArticleListSkeleton";
import { useArticleStore } from "@/store/articleStore";
import {
  computeKpis,
  filterDashboardVisible,
  getAllArticles,
  getAllProducts,
} from "@/lib/articles";
import type { Article } from "@/types";
import { aiScoreMeta } from "@/lib/aiScore";

export default function DashboardPage() {
  const [hydrated, setHydrated] = useState(false);
  const drafts = useArticleStore((s) => s.drafts);
  const products = getAllProducts();

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

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 lg:py-10">
        <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium text-blue-600">
              JOTO 内容工厂 · Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              欢迎回来,Tommy
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              合规 · 专业 · 稳定 —— 今天,让每一篇发得出去的内容都站得住
            </p>
          </div>
          <Link
            href="/wizard/product"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            新建文章
          </Link>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={FileText}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            label="本月生成"
            value={kpis.monthlyGenerated}
            hint="12 位作者在用"
          />
          <KpiCard
            icon={Users}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
            label="已发布"
            value={kpis.published}
            hint="对比上月 +2"
            hintColor="text-emerald-600"
          />
          <KpiCard
            icon={Gauge}
            iconColor={scoreMeta.textColor}
            iconBg={scoreMeta.bgColor}
            label="平均 AI 浓度"
            value={kpis.avgAiScore}
            hint={scoreMeta.label}
            hintColor={scoreMeta.textColor}
          />
          <KpiCard
            icon={Eye}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
            label="平均阅读"
            value={kpis.avgReaders.toLocaleString()}
            hint="仅计已发布"
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
