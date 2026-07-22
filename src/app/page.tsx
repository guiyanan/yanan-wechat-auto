"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  Boxes,
  ChevronDown,
  FileText,
  Inbox,
  LayoutDashboard,
  Mail,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BatchBanner } from "@/components/dashboard/BatchBanner";
import { ArticleList } from "@/components/dashboard/ArticleList";
import { ArticleListSkeleton } from "@/components/dashboard/ArticleListSkeleton";
import { useArticleStore } from "@/store/articleStore";
import { useLearnedStyleStore } from "@/store/learnedStyleStore";
import { useProductStore } from "@/store/productStore";
import {
  computeKpis,
  filterDashboardVisible,
  getAllArticles,
  getAllProducts,
} from "@/lib/articles";
import { AUTO_ARTICLE_COUNT } from "@/lib/generationConstants";
import { mergeProducts, withGenericProduct } from "@/lib/productCatalog";
import type { Article } from "@/types";

const SIDEBAR_ITEMS = [
  { label: "应用中心", href: "/", icon: Boxes, active: true },
  { label: "内容队列", href: "#content-queue", icon: LayoutDashboard },
  { label: "产品库", href: "/admin/products", icon: Inbox },
  { label: "模板库", href: "/templates", icon: BookOpen },
  { label: "风格库", href: "/styles", icon: WandSparkles },
  { label: "邮箱", href: "/email", icon: Mail },
];

type AppVisualKind =
  | "generation"
  | "format"
  | "products"
  | "templates"
  | "styles";

type AppCard = {
  title: string;
  description: string;
  href: string;
  primaryLabel: string;
  secondaryLabel: string;
  secondaryHref: string;
  icon: LucideIcon;
  status: string;
  visual: AppVisualKind;
};

const APP_CARDS: AppCard[] = [
  {
    title: "产品文章生成",
    description: `选择产品后自动生成 ${AUTO_ARTICLE_COUNT} 篇候选，并进入公众号预览。`,
    href: "/wizard/product",
    primaryLabel: `生成 ${AUTO_ARTICLE_COUNT} 篇`,
    secondaryLabel: "完善产品",
    secondaryHref: "/admin/products",
    icon: Sparkles,
    status: "核心流程",
    visual: "generation",
  },
  {
    title: "粘贴文字排版",
    description: "把已经打磨好的正文，一键套成 JOTO 官方公众号版式。",
    href: "/format",
    primaryLabel: "开始排版",
    secondaryLabel: "查看模板",
    secondaryHref: "/templates",
    icon: FileText,
    status: "可用",
    visual: "format",
  },
  {
    title: "产品资料库",
    description: "维护事实卡、PDF、截图素材，减少生成时的虚构风险。",
    href: "/admin/products",
    primaryLabel: "管理产品",
    secondaryLabel: "新增资料",
    secondaryHref: "/admin/products",
    icon: Inbox,
    status: "建议先做",
    visual: "products",
  },
  {
    title: "公众号模板",
    description: "采集和预览固定头尾模块，让推送草稿更接近官方格式。",
    href: "/templates",
    primaryLabel: "查看模板",
    secondaryLabel: "采集公众号",
    secondaryHref: "/templates",
    icon: BookOpen,
    status: "排版",
    visual: "templates",
  },
  {
    title: "写作风格库",
    description: "保存范文语气和节奏，后续生成时随机混用。",
    href: "/styles",
    primaryLabel: "管理风格",
    secondaryLabel: "学习新风格",
    secondaryHref: "/styles",
    icon: WandSparkles,
    status: "可选",
    visual: "styles",
  },
];

export default function DashboardPage() {
  const [hydrated, setHydrated] = useState(false);
  const drafts = useArticleStore((s) => s.drafts);
  const loadProducts = useProductStore((s) => s.loadFromServer);
  const customProducts = useProductStore((s) => s.products);
  const loadStyles = useLearnedStyleStore((s) => s.loadFromServer);
  const learnedStyleCount = useLearnedStyleStore((s) => s.styles.length);
  const products = useMemo(
    () =>
      withGenericProduct(
        mergeProducts(getAllProducts(), Object.values(customProducts))
      ),
    [customProducts]
  );

  useEffect(() => {
    setHydrated(true);
    void loadProducts();
    void loadStyles();
  }, [loadProducts, loadStyles]);

  const articles = useMemo<Article[]>(() => {
    const seed = getAllArticles();
    const byId = new Map<string, Article>();
    for (const s of seed) byId.set(s.id, s);
    for (const d of Object.values(drafts)) byId.set(d.id, d);
    return filterDashboardVisible(Array.from(byId.values())).sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [drafts]);

  const kpis = computeKpis(articles);
  const draftCount = articles.filter((a) => a.status === "draft").length;
  const riskCount = articles.filter((a) => a.aiScore.value >= 40).length;
  const productCount = products.filter((p) => p.id !== "generic").length;

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-slate-950 lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200/80 bg-white/95 px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-2xl px-1 py-1 transition-colors hover:bg-slate-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-base font-semibold text-white shadow-sm">
            J
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">JOTO小信</p>
            <p className="text-xs text-slate-500">公众号内容自动化</p>
          </div>
        </Link>

        <nav className="mt-6 flex gap-1 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </>
            );

            if (item.href.startsWith("#")) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 lg:w-full"
                >
                  {content}
                </a>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={
                  item.active
                    ? "flex h-10 shrink-0 items-center gap-3 rounded-xl bg-[#f0edff] px-3 text-sm font-semibold text-[#5e45e8] lg:w-full"
                    : "flex h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 lg:w-full"
                }
              >
                {content}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden space-y-4 pt-6 lg:block">
          <Link
            href="/admin/accounts"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            管理控制台
          </Link>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5e45e8] text-sm font-semibold text-white">
              T
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Tommy</p>
              <p className="truncate text-xs text-slate-500">JOTO 内容运营</p>
            </div>
            <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 px-5 py-4 backdrop-blur-xl lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">
                JOTO小信 · 应用中心
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                今天要把哪篇内容送出去？
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  placeholder="搜索文章、产品..."
                  aria-label="搜索文章、产品"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-[#5e45e8] focus:ring-4 focus:ring-[#5e45e8]/10 sm:w-80"
                />
              </label>
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50"
              >
                简体中文
              </button>
              <button
                type="button"
                aria-label="通知"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500" />
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1480px] px-5 py-7 lg:px-8 lg:py-9">
          <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full bg-[#5e45e8] px-5 py-2 text-sm font-semibold text-white shadow-sm"
              >
                全部
              </button>
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white hover:shadow-sm"
              >
                内容生产
              </button>
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white hover:shadow-sm"
              >
                资料维护
              </button>
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white hover:shadow-sm"
              >
                发布流转
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/templates"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
              >
                <Star className="h-4 w-4" aria-hidden="true" />
                模板采集
              </Link>
              <Link
                href="/wizard/product"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                新建文章
              </Link>
            </div>
          </section>

          {hydrated && <BatchBanner />}

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {APP_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="flex min-h-[236px] flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-start gap-4">
                    <AppCardVisual kind={card.visual} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="truncate text-lg font-semibold tracking-tight">
                          {card.title}
                        </h2>
                        <Icon className="h-5 w-5 flex-shrink-0 text-slate-400" />
                      </div>
                      <span className="mt-1 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {card.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-5 min-h-[48px] text-sm leading-6 text-slate-600">
                    {card.description}
                  </p>
                  <div className="mt-auto space-y-2 pt-5">
                    <Link
                      href={card.href}
                      className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#5e45e8] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5140d4]"
                    >
                      {card.primaryLabel}
                    </Link>
                    <Link
                      href={card.secondaryHref}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-slate-50"
                    >
                      <Sparkles className="h-4 w-4 text-[#5e45e8]" />
                      {card.secondaryLabel}
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatusSummary
              label="产品库"
              value={productCount}
              hint="个产品可生成"
              icon={Inbox}
            />
            <StatusSummary
              label="学习风格"
              value={learnedStyleCount}
              hint="个风格可混用"
              icon={WandSparkles}
            />
            <StatusSummary
              label="待处理草稿"
              value={draftCount}
              hint="篇可继续发布"
              icon={FileText}
            />
            <StatusSummary
              label="风险复检"
              value={riskCount}
              hint={`平均 AI 浓度 ${kpis.avgAiScore}`}
              icon={ShieldCheck}
            />
          </section>

          <section id="content-queue" className="mt-8 scroll-mt-24">
            {hydrated ? (
              <ArticleList articles={articles} products={products} />
            ) : (
              <ArticleListSkeleton />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function AppCardVisual({ kind }: { kind: AppVisualKind }) {
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[#f8f9fd] shadow-inner"
      aria-hidden="true"
    >
      {kind === "generation" && (
        <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none">
          <rect x="15" y="13" width="27" height="35" rx="5" fill="#e8f0ff" />
          <rect
            x="20"
            y="18"
            width="27"
            height="35"
            rx="5"
            fill="#ffffff"
            stroke="#2166f3"
            strokeWidth="2"
          />
          <path
            d="M27 27h12M27 34h9M27 41h14"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M45 12l1.8 4.2L51 18l-4.2 1.8L45 24l-1.8-4.2L39 18l4.2-1.8L45 12Z"
            fill="#5e45e8"
          />
          <circle cx="18" cy="46" r="3" fill="#14b8a6" />
        </svg>
      )}

      {kind === "format" && (
        <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none">
          <rect
            x="13"
            y="12"
            width="38"
            height="42"
            rx="6"
            fill="#ffffff"
            stroke="#2166f3"
            strokeWidth="2"
          />
          <rect x="19" y="19" width="26" height="5" rx="2.5" fill="#5e45e8" />
          <rect x="19" y="29" width="14" height="15" rx="3" fill="#dbeafe" />
          <path
            d="M38 31h7M38 37h7M19 49h25"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M48 44c3 0 5-2 5-5 0 3 2 5 5 5-3 0-5 2-5 5 0-3-2-5-5-5Z"
            fill="#14b8a6"
          />
        </svg>
      )}

      {kind === "products" && (
        <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none">
          <rect x="14" y="18" width="36" height="30" rx="7" fill="#eaf7f2" />
          <path
            d="M18 25h28v20H18z"
            fill="#ffffff"
            stroke="#14b8a6"
            strokeWidth="2"
          />
          <path
            d="M23 32h9M23 38h18"
            stroke="#64748b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M17 25l5-8h20l5 8" stroke="#2166f3" strokeWidth="2" />
          <rect x="39" y="13" width="10" height="10" rx="3" fill="#5e45e8" />
          <circle cx="44" cy="18" r="2" fill="#ffffff" />
        </svg>
      )}

      {kind === "templates" && (
        <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none">
          <rect
            x="18"
            y="9"
            width="28"
            height="46"
            rx="7"
            fill="#ffffff"
            stroke="#2166f3"
            strokeWidth="2"
          />
          <rect x="23" y="16" width="18" height="6" rx="3" fill="#dbeafe" />
          <path
            d="M23 30h18M23 36h13M23 42h18"
            stroke="#64748b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="27" cy="50" r="2" fill="#5e45e8" />
          <circle cx="33" cy="50" r="2" fill="#5e45e8" />
          <circle cx="39" cy="50" r="2" fill="#5e45e8" />
          <path d="M12 25h7M45 25h7" stroke="#94a3b8" strokeWidth="2" />
        </svg>
      )}

      {kind === "styles" && (
        <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none">
          <path
            d="M18 42l5 5 23-23-5-5-23 23Z"
            fill="#ffffff"
            stroke="#2166f3"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M36 24l5 5" stroke="#94a3b8" strokeWidth="2" />
          <path
            d="M16 49l7-2-5-5-2 7Z"
            fill="#14b8a6"
            stroke="#14b8a6"
            strokeLinejoin="round"
          />
          <path
            d="M17 18c5-5 9 5 14 0s9 5 14 0"
            stroke="#5e45e8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M20 29h14M20 35h9"
            stroke="#cbd5e1"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="49" cy="17" r="3" fill="#14b8a6" />
        </svg>
      )}
    </div>
  );
}

function StatusSummary({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
