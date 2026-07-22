import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductSourceMediaAsset } from "@/types";

export const runtime = "nodejs";

const MAX_SOURCE_IMAGE_BYTES = 50 * 1024 * 1024;
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
      return NextResponse.json({ error: "请上传网页截图文件" }, { status: 400 });
    }
    if (!MIME_TO_EXT[file.type]) {
      return NextResponse.json(
        { error: "只支持 PNG、JPG、JPEG、WebP 截图" },
        { status: 400 }
      );
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "网页截图不能超过 50MB" },
        { status: 400 }
      );
    }

    const safeProductId = sanitizeSegment(productId);
    const originalBase = stripExtension(file.name) || "product-evidence";
    const ext = MIME_TO_EXT[file.type];
    const storedFileName = `${Date.now().toString(36)}-${sanitizeSegment(
      originalBase
    ).slice(0, 42)}${ext}`;
    const relativePath = path.join(
      "uploads",
      "product-evidence",
      safeProductId,
      storedFileName
    );
    const absolutePath = path.join(process.cwd(), "public", relativePath);
    const bytes = Buffer.from(await file.arrayBuffer());

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);

    const asset: ProductSourceMediaAsset = {
      id: `media-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      url: `/${relativePath.split(path.sep).join("/")}`,
      fileName: file.name,
      fileType: "image",
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      caption: guessCaption(file.name),
      uploadedAt: new Date().toISOString(),
    };

    return NextResponse.json({ asset });
  } catch (err) {
    const message = err instanceof Error ? err.message : "素材上传失败";
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

function guessCaption(fileName: string): string {
  const base = stripExtension(fileName);
  if (/(agent|chat|bot|智能体|对话|问答)/i.test(fileName)) {
    return "智能体页面截图";
  }
  if (/(demo|演示|操作|流程)/i.test(fileName)) {
    return "产品流程截图";
  }
  return base || "产品页面截图";
}
