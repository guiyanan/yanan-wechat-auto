import { NextResponse } from "next/server";
import { completeChat } from "@/lib/qwen";
import { getDeepSeekChatOptions } from "@/lib/deepseek";
import { markdownToHtml } from "@/lib/markdown";
import {
  basicFormatJotoPaste,
  normaliseEnhancedMarkdown,
  type FormatJotoResult,
} from "@/lib/jotoFormatter";
import { GENERIC_JOTO_PRODUCT } from "@/lib/productCatalog";
import type { Product } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FormatRequestBody {
  title?: string;
  rawText?: string;
  productId?: string;
  productSnapshot?: Product;
  author?: string;
}

interface DeepSeekFormatPayload {
  title?: string;
  markdown?: string;
  summary?: string;
}

function extractJsonPayload(text: string): DeepSeekFormatPayload {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("DeepSeek did not return JSON");
  return JSON.parse(match[0]) as DeepSeekFormatPayload;
}

function buildPrompt(body: FormatRequestBody, product: Product): string {
  return [
    "你是 JOTO 小信的公众号编辑，任务是把用户已经打磨好的中文稿件做“编辑增强”和官方公众号排版。",
    "",
    "硬性要求：",
    "1. 只整理、增强表达和结构，不能新增企业案例、客户名、合作关系、营收、百分比、周期、提效数字。",
    "2. 清理裸 Markdown 标记、emoji 列表符号、重复空行，不输出简单 emoji bullet。",
    "3. 文章要像轻松的公众号产品稿：开头有具体工作场景，中间用小标题解密，重点句用 > 引用表达，不要把普通短语加粗。",
    "4. 不自动加入“往期回顾”、二维码、联系方式或图片。",
    "5. 正文里最多使用 2 个 > 重点句，不要使用 **加粗** 做蓝色强调。",
    "6. 输出 JSON，不要 Markdown 代码块。",
    "",
    "JSON 结构：",
    '{"title":"文章标题","markdown":"正文 Markdown，使用 ## 小标题、- 列表、> 重点句","summary":"80 字以内摘要"}',
    "",
    `产品：${product.name}`,
    `产品简介：${product.description}`,
    product.tags.length ? `标签：${product.tags.join("、")}` : "",
    body.title ? `用户给的标题：${body.title}` : "",
    "",
    "用户稿件：",
    body.rawText ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  let body: FormatRequestBody;
  try {
    body = (await req.json()) as FormatRequestBody;
  } catch {
    return NextResponse.json({ error: "请求 JSON 无效" }, { status: 400 });
  }

  const rawText = body.rawText?.trim();
  if (!rawText) {
    return NextResponse.json({ error: "正文不能为空" }, { status: 400 });
  }

  const product = body.productSnapshot ?? GENERIC_JOTO_PRODUCT;

  try {
    const response = await completeChat({
      ...getDeepSeekChatOptions(),
      messages: [
        {
          role: "system",
          content:
            "你只输出合法 JSON。你是克制、清楚、有公众号编辑手感的中文产品内容编辑。",
        },
        { role: "user", content: buildPrompt(body, product) },
      ],
      temperature: 0.35,
      maxTokens: 2600,
    });
    const parsed = extractJsonPayload(response);
    const markdown = normaliseEnhancedMarkdown(parsed.markdown ?? "");
    if (!markdown) throw new Error("DeepSeek returned empty markdown");
    const contentHtml = markdownToHtml(markdown);
    const fallback = basicFormatJotoPaste({
      title: parsed.title ?? body.title,
      rawText,
      product,
      author: body.author,
    });
    const result: FormatJotoResult = {
      title: parsed.title?.trim() || body.title?.trim() || fallback.title,
      contentHtml,
      summary: parsed.summary?.trim() || fallback.summary,
      warnings: [],
      mode: "deepseek",
    };
    return NextResponse.json(result);
  } catch {
    const fallback = basicFormatJotoPaste({
      title: body.title,
      rawText,
      product,
      author: body.author,
    });
    return NextResponse.json({
      ...fallback,
      warnings: ["DeepSeek 不可用，已完成基础排版，可继续预览和保存。"],
      mode: "fallback",
    } satisfies FormatJotoResult);
  }
}
