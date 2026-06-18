import type { Article } from "@/types";

function normalizeTrendStyleName(value?: string | null): string | null {
  const cleaned = value?.replace(/^热点风格[:：]\s*/, "").trim();
  return cleaned || null;
}

export function getTrendStyleLabel(
  article: Pick<Article, "generationMeta">
): string | null {
  const meta = article.generationMeta;
  if (meta?.mode !== "trend-radar") return null;

  const styleName =
    normalizeTrendStyleName(meta.trendStyleName) ??
    (meta.trendStyleSource === "fallback" ? "系统兜底" : "未命名热点风格");

  return `热点风格：${styleName}`;
}
