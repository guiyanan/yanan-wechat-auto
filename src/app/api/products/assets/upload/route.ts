import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductImageAsset, ProductImageKind } from "@/types";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const productId = String(formData.get("productId") ?? "").trim();
    const file = formData.get("file");

    if (!productId) {
      return NextResponse.json({ error: "缺少 productId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传图片文件" }, { status: 400 });
    }
    if (!MIME_TO_EXT[file.type]) {
      return NextResponse.json(
        { error: "只支持 PNG、JPG、JPEG、WebP 图片" },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "图片不能超过 12MB" },
        { status: 400 }
      );
    }

    const safeProductId = sanitizeSegment(productId);
    const originalBase = stripExtension(file.name) || "product-image";
    const ext = MIME_TO_EXT[file.type];
    const storedFileName = `${Date.now().toString(36)}-${sanitizeSegment(
      originalBase
    ).slice(0, 42)}${ext}`;
    const relativePath = path.join(
      "uploads",
      "product-assets",
      safeProductId,
      storedFileName
    );
    const absolutePath = path.join(process.cwd(), "public", relativePath);
    const bytes = Buffer.from(await file.arrayBuffer());

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);

    const asset: ProductImageAsset = {
      id: `img-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      url: `/${relativePath.split(path.sep).join("/")}`,
      fileName: file.name,
      kind: guessKind(file.name),
      caption: stripExtension(file.name),
      tags: [],
      uploadedAt: new Date().toISOString(),
    };

    return NextResponse.json({ asset });
  } catch (err) {
    const message = err instanceof Error ? err.message : "图片上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function sanitizeSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "item"
  );
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, "");
}

function guessKind(fileName: string): ProductImageKind {
  const lower = fileName.toLowerCase();
  if (/(hero|cover|首页|封面|主图)/i.test(lower)) return "开头主图";
  if (/(flow|流程|workflow)/i.test(lower)) return "流程图";
  if (/(arch|架构|architecture)/i.test(lower)) return "架构图";
  if (/(compare|对比)/i.test(lower)) return "对比图";
  if (/(video|视频)/i.test(lower)) return "视频封面";
  return "功能截图";
}
