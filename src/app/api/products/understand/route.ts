import { NextRequest, NextResponse } from "next/server";
import type { Product, ProductUnderstanding } from "@/types";
import { completeChat, QwenAuthError } from "@/lib/qwen";
import { buildFallbackUnderstanding } from "@/lib/productCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UnderstandRequest {
  product: Product;
  pdfText?: string;
  websiteNotes?: string;
  extraNotes?: string;
  mediaNotes?: string;
}

function extractJsonObject(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];
}

function coerceUnderstanding(input: unknown, product: Product): ProductUnderstanding {
  const fallback = buildFallbackUnderstanding(product)!;
  const row = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    summary:
      typeof row.summary === "string" && row.summary.trim()
        ? row.summary.trim()
        : fallback.summary,
    targetUsers: asStringArray(row.targetUsers).length
      ? asStringArray(row.targetUsers)
      : fallback.targetUsers,
    coreCapabilities: asStringArray(row.coreCapabilities).length
      ? asStringArray(row.coreCapabilities)
      : fallback.coreCapabilities,
    contentAngles: asStringArray(row.contentAngles).length
      ? asStringArray(row.contentAngles)
      : fallback.contentAngles,
    missingInfo: asStringArray(row.missingInfo).length
      ? asStringArray(row.missingInfo)
      : fallback.missingInfo,
    generatedAt: new Date().toISOString(),
    source: "qwen",
  };
}

function buildPrompt(body: UnderstandRequest) {
  const product = body.product;
  const system = [
    "你是 JOTO 内容工厂的产品资料分析助手。",
    "任务不是写公众号文章,而是帮助用户理解产品,形成后续写文章可用的产品资料卡。",
    "只能基于用户给出的产品名、简介、官网备注、PDF 摘要和补充说明,不得编造客户、价格、数据或功能。",
  ].join("\n");

  const user = [
    `【产品名】${product.name}`,
    `【产品简介】${product.description}`,
    `【Landing Page】${product.website ?? "未提供"}`,
    `【产品前端/演示页面】${product.appUrl ?? "未提供"}`,
    `【标签】${product.tags.join("、") || "未提供"}`,
    "",
    "【官网/人工备注】",
    body.websiteNotes?.trim() || "未提供",
    "",
    "【PDF 可读文本片段】",
    body.pdfText?.trim().slice(0, 6000) || "未提供或无法读取",
    "",
    "【截图/视频理解素材】",
    [
      body.mediaNotes?.trim(),
      ...(product.sourceMediaAssets ?? []).map((asset) =>
        [
          `${asset.fileType === "video" ? "视频" : "截图"}：${
            asset.caption || asset.fileName
          }`,
          asset.analysis ? `系统识别：${asset.analysis}` : "",
        ]
          .filter(Boolean)
          .join("；")
      ),
    ]
      .filter(Boolean)
      .join("\n") || "未提供",
    "",
    "【额外补充】",
    body.extraNotes?.trim() || "未提供",
    "",
    "请输出严格 JSON 对象,不要解释文字。字段:",
    "- summary: 120-220 字中文产品理解简介",
    "- targetUsers: string[] 目标用户/角色",
    "- coreCapabilities: string[] 核心能力",
    "- contentAngles: string[] 后续适合写的文章方向",
    "- missingInfo: string[] 需要用户浏览确认并补充的信息",
  ].join("\n");
  return { system, user };
}

export async function POST(req: NextRequest) {
  let body: UnderstandRequest;
  try {
    body = (await req.json()) as UnderstandRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.product?.name?.trim()) {
    return NextResponse.json({ error: "product name required" }, { status: 400 });
  }

  try {
    const prompt = buildPrompt(body);
    const raw = await completeChat({
      model: "qwen-plus",
      temperature: 0.3,
      maxTokens: 1200,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      signal: req.signal,
    });
    return NextResponse.json({
      understanding: coerceUnderstanding(extractJsonObject(raw), body.product),
      source: "qwen",
    });
  } catch (err) {
    const understanding = buildFallbackUnderstanding(body.product);
    const reason =
      err instanceof QwenAuthError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return NextResponse.json({ understanding, source: "fallback", reason });
  }
}
