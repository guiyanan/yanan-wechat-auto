import articlesData from "@/data/articles.json";
import productsData from "@/data/products.json";
import accountsData from "@/data/accounts.json";
import type { Article, ArticleStatus, Product, WechatAccount } from "@/types";

export function getAllArticles(): Article[] {
  return articlesData as Article[];
}

export function getAllProducts(): Product[] {
  return productsData as Product[];
}

export function getAllAccounts(): WechatAccount[] {
  return accountsData as WechatAccount[];
}

export function getArticleById(id: string): Article | undefined {
  return getAllArticles().find((a) => a.id === id);
}

export function getProductById(id: string): Product | undefined {
  return getAllProducts().find((p) => p.id === id);
}

export function getAccountById(id: string): WechatAccount | undefined {
  return getAllAccounts().find((a) => a.id === id);
}

export interface DashboardKpis {
  monthlyGenerated: number;
  published: number;
  avgAiScore: number;
  avgReaders: number;
}

export function computeKpis(articles: Article[]): DashboardKpis {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = articles.filter(
    (a) => new Date(a.createdAt) >= monthStart
  );
  const published = articles.filter((a) => a.status === "published");
  const scores = articles.map((a) => a.aiScore.value);
  const avgAiScore =
    scores.length === 0
      ? 0
      : Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const readersList = published
    .map((a) => a.readers ?? 0)
    .filter((v) => v > 0);
  const avgReaders =
    readersList.length === 0
      ? 0
      : Math.round(readersList.reduce((s, v) => s + v, 0) / readersList.length);
  return {
    monthlyGenerated: thisMonth.length,
    published: published.length,
    avgAiScore,
    avgReaders,
  };
}

export interface StatusMeta {
  label: string;
  dotColor: string;
  textColor: string;
  bgColor: string;
}

export const STATUS_META: Record<ArticleStatus, StatusMeta> = {
  draft: {
    label: "草稿",
    dotColor: "bg-slate-400",
    textColor: "text-slate-700",
    bgColor: "bg-slate-100",
  },
  pending_review: {
    label: "待审核",
    dotColor: "bg-amber-500",
    textColor: "text-amber-700",
    bgColor: "bg-amber-50",
  },
  in_review: {
    label: "审核中",
    dotColor: "bg-blue-500",
    textColor: "text-blue-700",
    bgColor: "bg-blue-50",
  },
  approved: {
    label: "已通过",
    dotColor: "bg-emerald-500",
    textColor: "text-emerald-700",
    bgColor: "bg-emerald-50",
  },
  rejected: {
    label: "已打回",
    dotColor: "bg-red-500",
    textColor: "text-red-700",
    bgColor: "bg-red-50",
  },
  published: {
    label: "已发布",
    dotColor: "bg-emerald-600",
    textColor: "text-emerald-800",
    bgColor: "bg-emerald-100",
  },
  archived: {
    label: "已归档",
    dotColor: "bg-slate-400",
    textColor: "text-slate-600",
    bgColor: "bg-slate-100",
  },
};

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
