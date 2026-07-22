import type { ArticleSourceContext, Product, TrendSearchResult } from "@/types";

export interface UnsplashImageConfig {
  defaultQueries: string[];
  products: Record<string, string[]>;
}

export interface UnsplashCoverCandidate {
  id: string;
  url: string;
  url300: string;
  previewUrl?: string;
  styleLabel: string;
  alt?: string;
  attribution: string;
  photographerName: string;
  photographerUrl?: string;
  sourceUrl?: string;
  downloadLocation?: string;
  width?: number;
  height?: number;
}

interface SearchUnsplashCoverCandidatesArgs {
  accessKey: string;
  product: Product;
  trends?: TrendSearchResult[];
  sourcePack?: ArticleSourceContext;
  config?: UnsplashImageConfig;
  count?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

interface BuildUnsplashImageQueriesArgs {
  product: Product;
  trends?: TrendSearchResult[];
  sourcePack?: ArticleSourceContext;
  config?: UnsplashImageConfig;
}

interface UnsplashApiPhoto {
  id?: string;
  alt_description?: string | null;
  description?: string | null;
  width?: number;
  height?: number;
  urls?: {
    raw?: string;
    small?: string;
  };
  user?: {
    name?: string;
    links?: {
      html?: string;
    };
  };
  links?: {
    html?: string;
    download_location?: string;
  };
}

const EMPTY_CONFIG: UnsplashImageConfig = {
  defaultQueries: [],
  products: {},
};

const QUERY_RULES: Array<{ match: RegExp; queries: string[] }> = [
  {
    match:
      /fashion|apparel|garment|clothing|服装|时尚|穿搭|款式|版型|面料|花型|打版|试衣|设计/i,
    queries: [
      "fashion design",
      "garment design",
      "fashion studio",
      "clothing atelier",
    ],
  },
  {
    match: /crm|scrm|私域|客户|销售|跟进|营销|企微/i,
    queries: [
      "sales dashboard",
      "crm workspace",
      "business team",
      "customer relationship",
    ],
  },
  {
    match: /notebook\s*lm|notebooklm|ai\s*笔记|知识库|pdf|文档|会议记录/i,
    queries: ["notebook workspace", "documents desk", "knowledge base"],
  },
  {
    match: /dify|agent|workflow|智能体|工作流|自动化|客服/i,
    queries: ["workflow automation", "technology operations", "support team"],
  },
  {
    match: /excel|表格|bi|数据|报表|分析|dashboard/i,
    queries: ["data dashboard", "analytics workspace", "spreadsheet work"],
  },
  {
    match: /deepseek|chatgpt|大模型|ai\s*写作|办公提效|提示词|prompt/i,
    queries: ["artificial intelligence", "modern workspace", "technology desk"],
  },
];

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function productText(
  product: Product,
  sourcePack?: ArticleSourceContext,
  trends: TrendSearchResult[] = []
): string {
  return [
    product.id,
    product.name,
    product.description,
    ...(product.tags ?? []),
    sourcePack?.productNotes,
    ...trends.flatMap((trend) => [
      trend.title,
      trend.snippet,
      trend.mainstreamAnchor,
      trend.categoryHook,
      trend.featureHint,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

export function parseUnsplashImageConfig(
  raw: string | undefined
): UnsplashImageConfig {
  if (!raw?.trim()) return EMPTY_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<UnsplashImageConfig>;
    const products =
      parsed.products && typeof parsed.products === "object"
        ? Object.fromEntries(
            Object.entries(parsed.products).map(([key, value]) => [
              key,
              Array.isArray(value)
                ? value.filter((item): item is string => typeof item === "string")
                : [],
            ])
          )
        : {};
    return {
      defaultQueries: Array.isArray(parsed.defaultQueries)
        ? parsed.defaultQueries.filter(
            (item): item is string => typeof item === "string"
          )
        : [],
      products,
    };
  } catch {
    return EMPTY_CONFIG;
  }
}

export function buildUnsplashImageQueries({
  product,
  trends = [],
  sourcePack,
  config = EMPTY_CONFIG,
}: BuildUnsplashImageQueriesArgs): string[] {
  const configured = [
    ...(config.products[product.id] ?? []),
    ...(config.products[product.name] ?? []),
  ];
  const text = productText(product, sourcePack, trends);
  const inferred = QUERY_RULES.filter((rule) => rule.match.test(text)).flatMap(
    (rule) => rule.queries
  );
  const trendTerms = trends.flatMap((trend) => [
    trend.categoryHook,
    trend.featureHint,
  ]);
  return uniq([
    ...configured,
    ...inferred,
    ...trendTerms.filter((term): term is string => Boolean(term)),
    ...config.defaultQueries,
    "modern office",
  ]).slice(0, 8);
}

export function buildUnsplashCoverUrl(
  rawUrl: string,
  size = 300
): string {
  const url = new URL(rawUrl);
  url.searchParams.set("w", String(size));
  url.searchParams.set("h", String(size));
  url.searchParams.set("fit", "crop");
  url.searchParams.set("crop", "entropy");
  url.searchParams.set("auto", "format");
  url.searchParams.set("fm", "jpg");
  url.searchParams.set("q", "80");
  return url.toString();
}

function searchUrl(query: string, perPage: number): string {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");
  url.searchParams.set("order_by", "relevant");
  return url.toString();
}

function normalizePhoto(photo: UnsplashApiPhoto): UnsplashCoverCandidate | null {
  const raw = photo.urls?.raw;
  if (typeof raw !== "string") return null;
  const photographerName =
    typeof photo.user?.name === "string" ? photo.user.name : "Unsplash";
  const url300 = buildUnsplashCoverUrl(raw);
  return {
    id: String(photo.id ?? raw),
    url: url300,
    url300,
    previewUrl:
      typeof photo.urls?.small === "string" ? photo.urls.small : undefined,
    styleLabel: `Unsplash · ${photographerName}`,
    alt:
      typeof photo.alt_description === "string"
        ? photo.alt_description
        : typeof photo.description === "string"
          ? photo.description
          : undefined,
    attribution: `Photo by ${photographerName} on Unsplash`,
    photographerName,
    photographerUrl:
      typeof photo.user?.links?.html === "string"
        ? photo.user.links.html
        : undefined,
    sourceUrl:
      typeof photo.links?.html === "string" ? photo.links.html : undefined,
    downloadLocation:
      typeof photo.links?.download_location === "string"
        ? photo.links.download_location
        : undefined,
    width: typeof photo.width === "number" ? photo.width : undefined,
    height: typeof photo.height === "number" ? photo.height : undefined,
  };
}

export async function searchUnsplashCoverCandidates({
  accessKey,
  product,
  trends = [],
  sourcePack,
  config,
  count = 4,
  fetchImpl = fetch,
  signal,
}: SearchUnsplashCoverCandidatesArgs): Promise<UnsplashCoverCandidate[]> {
  if (!accessKey.trim()) return [];
  const queries = buildUnsplashImageQueries({
    product,
    trends,
    sourcePack,
    config,
  });
  const candidates: UnsplashCoverCandidate[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    if (candidates.length >= count) break;
    let data: { results?: UnsplashApiPhoto[] };
    try {
      const res = await fetchImpl(searchUrl(query, Math.max(6, count)), {
        signal,
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          "Accept-Version": "v1",
        },
      });
      if (!res.ok) continue;
      data = (await res.json()) as { results?: UnsplashApiPhoto[] };
    } catch {
      continue;
    }
    for (const photo of data.results ?? []) {
      const candidate = normalizePhoto(photo);
      if (!candidate || seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      candidates.push(candidate);
      if (candidates.length >= count) break;
    }
  }

  return candidates;
}
