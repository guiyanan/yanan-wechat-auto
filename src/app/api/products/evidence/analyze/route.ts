import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Product, ProductSourceMediaAsset } from "@/types";
import { createQwenClient } from "@/lib/qwen";
import { getDeepSeekVisionOptions } from "@/lib/deepseek";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnalyzeRequest {
  product: Product;
  asset: ProductSourceMediaAsset;
}

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function POST(req: NextRequest) {
  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.product?.name?.trim() || !body.asset?.url) {
    return NextResponse.json(
      { error: "缺少产品或素材信息" },
      { status: 400 }
    );
  }

  if (body.asset.fileType === "video") {
    return NextResponse.json(
      { error: "产品理解素材只支持网页截图,不再支持视频理解" },
      { status: 400 }
    );
  }

  try {
    const absolutePath = localPublicPath(body.asset.url);
    const ext = path.extname(absolutePath).toLowerCase();
    const mime = EXT_TO_MIME[ext] ?? "image/png";
    const bytes = await readFile(absolutePath);
    const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
    const deepSeekOptions = getDeepSeekVisionOptions();
    const client = createQwenClient(deepSeekOptions);
    const res = await client.chat.completions.create(
      {
        model: deepSeekOptions.model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "你是产品资料分析助手。请根据截图判断这个产品页面可能在做什么,只描述画面可见信息和合理推断,不要编造客户、数据、价格或合作关系。",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  `产品名：${body.product.name}`,
                  `产品简介：${body.product.description || "未填写"}`,
                  `素材说明：${body.asset.caption || body.asset.fileName}`,
                  "请用 80-160 字中文输出：这是哪个页面/智能体/流程、给谁用、可能解决什么问题、后续写文章可强调什么。不要输出 Markdown。",
                ].join("\n"),
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ] as never,
      },
      { signal: req.signal }
    );
    const analysis = res.choices[0]?.message?.content?.trim();
    return NextResponse.json({
      analysis:
        analysis ||
        `截图「${body.asset.caption || body.asset.fileName}」已保存,请补充它展示的产品页面和使用场景。`,
      source: "deepseek",
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      analysis: `截图「${body.asset.caption || body.asset.fileName}」已保存。自动识别暂不可用：${reason}。请手动补充它展示的页面、角色和解决的问题。`,
      source: "fallback",
      reason,
    });
  }
}

function localPublicPath(publicUrl: string): string {
  const urlPath = publicUrl.split("?")[0] ?? "";
  const clean = urlPath.replace(/^\/+/, "");
  if (!clean.startsWith("uploads/product-evidence/")) {
    throw new Error("只允许分析产品理解素材目录里的文件");
  }
  return path.join(process.cwd(), "public", clean);
}
