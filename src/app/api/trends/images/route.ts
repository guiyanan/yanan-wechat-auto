import { NextRequest, NextResponse } from "next/server";
import productsData from "@/data/products.json";
import {
  buildUnsplashImageQueries,
  parseUnsplashImageConfig,
  searchUnsplashCoverCandidates,
} from "@/lib/trends/unsplash";
import type {
  ArticleSourceContext,
  Product,
  TrendSearchResult,
} from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTS = productsData as Product[];

interface TrendImagesRequest {
  productId?: string;
  productSnapshot?: Product;
  sourcePack?: ArticleSourceContext;
  trends?: TrendSearchResult[];
  count?: number;
}

function resolveProduct(body: TrendImagesRequest): Product | undefined {
  if (body.productSnapshot) return body.productSnapshot;
  return PRODUCTS.find((product) => product.id === body.productId);
}

export async function POST(req: NextRequest) {
  let body: TrendImagesRequest;
  try {
    body = (await req.json()) as TrendImagesRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const product = resolveProduct(body);
  if (!product) {
    return NextResponse.json(
      { ok: false, error: "未找到产品,请先选择产品。" },
      { status: 404 }
    );
  }

  const config = parseUnsplashImageConfig(
    process.env.UNSPLASH_TREND_IMAGE_QUERY_MAP
  );
  const trends = Array.isArray(body.trends) ? body.trends : [];
  const queries = buildUnsplashImageQueries({
    product,
    trends,
    sourcePack: body.sourcePack,
    config,
  });
  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();

  if (!accessKey) {
    return NextResponse.json({
      ok: true,
      source: "not_configured",
      queries,
      candidates: [],
      warning: "未配置 UNSPLASH_ACCESS_KEY,暂不抓取 Unsplash 封面候选图。",
    });
  }

  try {
    const candidates = await searchUnsplashCoverCandidates({
      accessKey,
      product,
      trends,
      sourcePack: body.sourcePack,
      config,
      count: Math.min(Math.max(body.count ?? 4, 1), 8),
      signal: req.signal,
    });
    return NextResponse.json({
      ok: true,
      source: "unsplash",
      queries,
      candidates,
    });
  } catch (err) {
    return NextResponse.json({
      ok: true,
      source: "unsplash_error",
      queries,
      candidates: [],
      warning: err instanceof Error ? err.message : "Unsplash 图片抓取失败。",
    });
  }
}
