"use client";

import { useMemo, useState } from "react";
import { Inbox, Search } from "lucide-react";
import { toast } from "sonner";
import type { Article, ArticleStatus, Product } from "@/types";
import {
  ArticleRow,
  resolveAngleName,
  resolveStyleName,
} from "./ArticleRow";
import { PushConfirmModal } from "./PushConfirmModal";
import { cn } from "@/lib/utils";
import { useEmailStore } from "@/store/emailStore";
import { STATUS_META } from "@/lib/articles";

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
  const [emailSendingId, setEmailSendingId] = useState<string | null>(null);
  const recipients = useEmailStore((s) => s.recipients);
  const addSendHistory = useEmailStore((s) => s.addSendHistory);

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

  async function handleEmailArticle(article: Article) {
    if (article.humanizeMeta?.status !== "passed") {
      toast.error("这篇文章需要先通过 Humanize，才能发给产品经理邮箱组");
      return;
    }
    if (recipients.length === 0) {
      toast.error("请先在邮箱管理里保存产品经理邮箱组");
      return;
    }

    setEmailSendingId(article.id);
    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3004";
      const productName = productMap.get(article.productId)?.name ?? "产品";
      const res = await fetch("/api/email/send-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: article.batchId ?? `dashboard-${article.id}`,
          productName,
          recipients: recipients.map((recipient) => ({
            email: recipient.email,
            name: recipient.name,
          })),
          articles: [
            {
              id: article.id,
              title: article.title,
              angleLabel:
                article.generationMeta?.angleLabel ?? resolveAngleName(article),
              styleName:
                article.generationMeta?.learnedStyleName ??
                resolveStyleName(article),
              summary: htmlPreview(article.contentHtml, 120),
              reviewUrl: `${origin}/review/${article.id}`,
              humanizeStatus: article.humanizeMeta.status,
            },
          ],
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: "success" | "partial_success" | "failed";
        messageIds?: string[];
        recipientEmails?: string[];
        results?: Array<{
          email: string;
          ok: boolean;
          messageId?: string;
          error?: string;
        }>;
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
        batchId: article.batchId ?? `dashboard-${article.id}`,
        articleCount: 1,
        articleIds: [article.id],
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
      toast.error(err instanceof Error ? err.message : "邮件发送失败");
    } finally {
      setEmailSendingId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#d2d2d7]/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="flex flex-col gap-3 border-b border-[#e5e5ea] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            内容队列
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {filtered.length} 篇 · 点击行查看公众号预览，按钮只执行对应动作
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
              className="h-9 w-56 rounded-lg border border-[#d2d2d7] bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/15"
            />
          </label>
        </div>
      </header>

      <div className="border-b border-[#e5e5ea] px-5 py-3">
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-[#f5f5f7] p-1">
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
      </div>

      <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto] items-center gap-6 border-b border-[#e5e5ea] bg-[#fbfbfd] px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 md:grid">
        <span>标题 · 产品 · 作者</span>
        <span>状态</span>
        <span className="hidden lg:inline">AI 浓度</span>
        <span className="hidden sm:inline text-right">阅读</span>
        <span className="text-right">操作</span>
        <span className="text-right">更新</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState filter={filter} query={query} />
      ) : (
        <ul className="divide-y divide-[#e5e5ea]">
          {filtered.map((article) => (
            <li key={article.id}>
              <ArticleRow
                article={article}
                product={productMap.get(article.productId)}
                onPushClick={setPushTarget}
                onEmailClick={handleEmailArticle}
                emailSending={emailSendingId === article.id}
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

function htmlPreview(html: string, maxLength = 120): string {
  const text = html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
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

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  status?: ArticleStatus;
}

function FilterChip({ label, active, onClick, status }: FilterChipProps) {
  const meta = status ? STATUS_META[status] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "bg-white text-slate-950 shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-[#d2d2d7]"
          : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
      )}
    >
      {meta && (
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotColor)} />
      )}
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
