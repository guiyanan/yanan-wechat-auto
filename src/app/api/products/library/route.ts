import { NextRequest, NextResponse } from "next/server";
import {
  readPersistedProducts,
  removePersistedProduct,
  upsertPersistedProduct,
  writePersistedProducts,
} from "@/lib/persistentLibrary";
import type { Product } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const products = await readPersistedProducts();
  return NextResponse.json({ ok: true, products });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { products?: Record<string, Product> };
    const products = body.products ?? {};
    const saved = await writePersistedProducts(products);
    return NextResponse.json({ ok: true, products: saved });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "保存产品库失败" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { product?: Product };
    if (!body.product?.id) {
      return NextResponse.json(
        { ok: false, error: "缺少产品信息" },
        { status: 400 }
      );
    }
    const products = await upsertPersistedProduct(body.product);
    return NextResponse.json({ ok: true, products });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "保存产品失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "缺少产品 ID" },
        { status: 400 }
      );
    }
    const products = await removePersistedProduct(id);
    return NextResponse.json({ ok: true, products });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "删除产品失败" },
      { status: 500 }
    );
  }
}
