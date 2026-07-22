import { NextRequest, NextResponse } from "next/server";
import productsData from "@/data/products.json";
import { searchBochaTrends } from "@/lib/trends/bocha";
import {
  buildFallbackTrends,
  buildTrendSearchQueries,
  filterRelevantTrendResults,
} from "@/lib/trends/hooks";
import type { ArticleSourceContext, Product } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTS = productsData as Product[];

interface TrendSearchRequest {
  productId?: string;
  productSnapshot?: Product;
  sourcePack?: ArticleSourceContext;
}

function resolveProduct(body: TrendSearchRequest): Product | undefined {
  if (body.productSnapshot) return body.productSnapshot;
  return PRODUCTS.find((product) => product.id === body.productId);
}

export async function POST(req: NextRequest) {
  let body: TrendSearchRequest;
  try {
    body = (await req.json()) as TrendSearchRequest;
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

  const queries = buildTrendSearchQueries(product, body.sourcePack);
  const query = queries.join(" | ");
  const apiKey = process.env.BOCHA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      source: "fallback",
      query,
      results: buildFallbackTrends(product),
      warning: "未配置 BOCHA_API_KEY,已使用系统兜底热点。",
    });
  }

  try {
    const batches = await Promise.all(
      queries.map((singleQuery) =>
        searchBochaTrends({
          apiKey,
          query: singleQuery,
          signal: req.signal,
          count: 5,
        }).catch(() => [])
      )
    );
    const seen = new Set<string>();
    const rawResults = batches
      .flat()
      .filter((trend) => {
        const key = trend.url || trend.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const results = filterRelevantTrendResults(
      product,
      body.sourcePack,
      rawResults
    );
    return NextResponse.json({
      ok: true,
      source: results.length ? "bocha" : "fallback",
      query,
      results: results.length ? results.slice(0, 10) : buildFallbackTrends(product),
    });
  } catch (err) {
    return NextResponse.json({
      ok: true,
      source: "fallback",
      query,
      results: buildFallbackTrends(product),
      warning: err instanceof Error ? err.message : "博查搜索失败,已使用兜底热点。",
    });
  }
}
