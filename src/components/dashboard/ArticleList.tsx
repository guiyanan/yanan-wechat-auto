"use client";

import { useMemo, useState } from "react";
import { Inbox, Search } from "lucide-react";
import type { Article, ArticleStatus, Product } from "@/types";
import { ArticleRow } from "./ArticleRow";
import { PushConfirmModal } from "./PushConfirmModal";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

interface ArticleListProps {
  articles: Article[];
  products: Product[];
}

const FILTERS: Array<{ key: ArticleStatus | "all"; label: string }> = [
  { key: "all", label: "全部" },
  { key: "draft", label: "草稿" },
  { key: "pending_review", label: "待审核" },
  { key: "approved", label: "已通过" },
  { key: "published", label: "已发布" },
  { key: "rejected", label: "已打回" },
];

export function ArticleList({ articles, products }: ArticleListProps) {
  const [filter, setFilter] = useState<ArticleStatus | "all">("all");
  const [query, setQuery] = useState("");
  // Single shared modal for the whole list; each row's "推送" button
  // bubbles its article up here. Holding the article (not just its id)
  // avoids a re-read after status changes mid-push.
  const [pushTarget, setPushTarget] = useState<Article | null>(null);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (filter !== "all" && a.status !== filter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (
          !a.title.toLowerCase().includes(q) &&
          !a.createdBy.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [articles, filter, query]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">历史文章</h2>
          <p className="text-xs text-slate-500">
            {filtered.length} 篇 · 点击行进入编辑器
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              placeholder="按标题/作者搜索"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="搜索文章"
              className="h-9 w-48 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
        {FILTERS.map((f) => (
          <FilterChip
            key={f.key}
            active={filter === f.key}
            onClick={() => setFilter(f.key)}
            label={f.label}
            status={f.key === "all" ? undefined : (f.key as ArticleStatus)}
          />
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto] items-center gap-6 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <span>标题 · 产品 · 作者</span>
        <span>状态</span>
        <span className="hidden lg:inline">AI 浓度</span>
        <span className="hidden sm:inline text-right">阅读</span>
        <span className="text-center">推送</span>
        <span className="text-right">更新</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState filter={filter} query={query} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((article) => (
            <li key={article.id}>
              <ArticleRow
                article={article}
                product={productMap.get(article.productId)}
                onPushClick={setPushTarget}
              />
            </li>
          ))}
        </ul>
      )}

      <PushConfirmModal
        article={pushTarget}
        product={pushTarget ? productMap.get(pushTarget.productId) : undefined}
        open={pushTarget !== null}
        onClose={() => setPushTarget(null)}
      />
    </section>
  );
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  status?: ArticleStatus;
}

function FilterChip({ label, active, onClick, status }: FilterChipProps) {
  if (status) {
    return (
      <StatusBadge
        status={status}
        interactive
        active={active}
        onClick={onClick}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-all",
        active
          ? "bg-blue-100 text-blue-700 ring-2 ring-offset-1 ring-blue-400"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      )}
    >
      {label}
    </button>
  );
}

interface EmptyStateProps {
  filter: ArticleStatus | "all";
  query: string;
}

function EmptyState({ filter, query }: EmptyStateProps) {
  const hasQuery = query.trim().length > 0;
  const hasFilter = filter !== "all";
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Inbox className="h-6 w-6 text-slate-400" aria-hidden="true" />
      </div>
      <p className="text-sm text-slate-600">
        {hasQuery || hasFilter
          ? "没有符合筛选条件的文章"
          : "还没有文章,点「新建文章」开始"}
      </p>
      <p className="text-xs text-slate-400">
        {hasQuery
          ? `搜索词:"${query}"`
          : hasFilter
            ? "试试切换回「全部」"
            : ""}
      </p>
    </div>
  );
}
