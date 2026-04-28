import Link from "next/link";
import { FileText } from "lucide-react";
import type { Article, Product } from "@/types";
import { formatRelativeDate } from "@/lib/articles";
import { AiScoreBar } from "./AiScoreBar";
import { StatusBadge } from "./StatusBadge";

interface ArticleRowProps {
  article: Article;
  product?: Product;
}

export function ArticleRow({ article, product }: ArticleRowProps) {
  const isPublished = article.status === "published";
  const href = isPublished
    ? `/editor/${article.id}?readonly=1`
    : `/editor/${article.id}`;

  return (
    <Link
      href={href}
      className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-6 px-5 py-4 text-sm transition-colors hover:bg-slate-50"
    >
      <div className="flex items-center gap-3 min-w-0">
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
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {product?.name ?? "未知产品"} · {article.createdBy}
          </p>
        </div>
      </div>

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

      <div className="text-right text-xs text-slate-500 min-w-[72px]">
        {formatRelativeDate(article.updatedAt)}
      </div>
    </Link>
  );
}
