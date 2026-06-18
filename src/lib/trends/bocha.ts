import type { TrendSearchResult } from "@/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function findResultArray(payload: unknown): unknown[] {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const webPages = asRecord(data?.webPages);
  if (Array.isArray(webPages?.value)) return webPages.value;
  if (Array.isArray(data?.value)) return data.value;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(root?.results)) return root.results;
  return [];
}

export function normalizeBochaResults(payload: unknown): TrendSearchResult[] {
  const rows: Array<TrendSearchResult | null> = findResultArray(payload).map(
    (item, index) => {
      const row = asRecord(item);
      if (!row) return null;
      const title = asString(row.name) || asString(row.title);
      const url = asString(row.url) || asString(row.link);
      const snippet =
        asString(row.snippet) ||
        asString(row.summary) ||
        asString(row.description) ||
        asString(row.content);
      if (!title || !url) return null;

      const source =
        asString(row.siteName) || asString(row.source) || asString(row.site);
      const publishedAt =
        asString(row.datePublished) ||
        asString(row.publishedAt) ||
        asString(row.date) ||
        asString(row.time);

      return {
        id: `trend-${index + 1}-${title.slice(0, 18)}`,
        title,
        url,
        snippet,
        ...(source ? { source } : {}),
        ...(publishedAt ? { publishedAt } : {}),
      };
    }
  );

  return rows.filter((item): item is TrendSearchResult => item !== null);
}

export async function searchBochaTrends(input: {
  apiKey: string;
  query: string;
  signal?: AbortSignal;
  count?: number;
}): Promise<TrendSearchResult[]> {
  const res = await fetch("https://api.bochaai.com/v1/web-search", {
    method: "POST",
    signal: input.signal,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: input.query,
      freshness: "oneMonth",
      count: input.count ?? 10,
      summary: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`博查搜索失败: HTTP ${res.status}`);
  }
  return normalizeBochaResults(await res.json());
}
