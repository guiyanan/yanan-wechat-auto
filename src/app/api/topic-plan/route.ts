import { NextRequest, NextResponse } from "next/server";
import productsData from "@/data/products.json";
import type {
  AngleStrategy,
  ArticleSourceContext,
  ContentLength,
  Product,
  TopicPlan,
} from "@/types";
import { completeChat, QwenAuthError } from "@/lib/qwen";
import { buildFallbackTopicPlans, coerceTopicPlans } from "@/lib/topicPlanner";
import {
  getAngleStrategyInstruction,
  getContentLengthInstruction,
} from "@/lib/contentSettings";
import { summarizeProductImageAssets } from "@/lib/productImages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTS = productsData as Product[];

interface TopicPlanRequest {
  productId: string;
  productSnapshot?: Product;
  sourcePack?: ArticleSourceContext;
  contentLength?: ContentLength;
  angleStrategy?: AngleStrategy;
}

function sourcePackText(sourcePack?: ArticleSourceContext, product?: Product): string {
  const safeSourcePack = sourcePack ?? {};
  return [
    ["产品素材", safeSourcePack.productNotes],
    ["竞品/传统方案素材", safeSourcePack.competitorNotes],
    ["热点/行业事件素材", safeSourcePack.trendNotes],
    ["截图/视频/图片素材", safeSourcePack.imageRefs],
    ["当前产品真实图片素材库", product ? summarizeProductImageAssets(product) : ""],
  ]
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([label, value]) => `【${label}】${String(value).trim()}`)
    .join("\n") || "未提供补充素材。";
}

function extractJsonArray(raw: string): unknown {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function buildPrompt(
  product: Product,
  sourcePack?: ArticleSourceContext,
  contentLength?: ContentLength,
  angleStrategy?: AngleStrategy
) {
  const system = [
    "你是 JOTO 内容工厂的智能选题策划。",
    "你只允许基于用户给出的产品资料和素材判断,不得联网,不得编造市场事实。",
    "目标:为一个产品规划 5 篇不同角度的微信公众号候选文章。",
    "如果产品处在成熟赛道或有明显替代方案,优先考虑竞品、价格、生态、替代方案、为什么选择我们。",
    "如果产品是新概念或低认知产品,优先考虑为什么需要、使用场景教育、产品启蒙、产品介绍。",
    getAngleStrategyInstruction(angleStrategy),
    getContentLengthInstruction(contentLength),
    "场景案例不是默认优先项。只有用户素材里明确提供真实客户、真实项目或真实效果数据时,才规划客户案例/实施效果类文章。",
    "所有 promptInstruction 都必须禁止编造客户名、合作关系、营收、提效百分比和部署周期。",
    "如文章需要插图,只能使用当前产品真实图片素材库里列出的素材;没有合适素材时提示建议补图,不得虚构截图。",
  ].join("\n");
  const user = [
    `【产品】${product.name}`,
    `【产品简介】${product.description}`,
    `【标签】${product.tags.join("、")}`,
    "",
    "【补充素材】",
    sourcePackText(sourcePack, product),
    "",
    "请输出严格 JSON 数组,必须正好 5 项,不要输出解释文字。",
    "每项字段:",
    "- id: 英文短 id",
    "- angleLabel: 中文选题角度名,5 项不得重复",
    "- angleType: product_intro | product_diff | competitor | trend | scenario | education | pricing | ecosystem",
    "- reason: 30-60 字,说明为什么这个产品适合该角度",
    "- promptInstruction: 给正文生成模型的具体写作指令,80-160 字",
    "- sourceNeedLevel: low | medium | high",
    "每项 promptInstruction 都要自然体现篇幅和角度策略,但不要把字数写进标题。",
  ].join("\n");
  return { system, user };
}

export async function POST(req: NextRequest) {
  let body: TopicPlanRequest;
  try {
    body = (await req.json()) as TopicPlanRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const product =
    body.productSnapshot?.id === body.productId
      ? body.productSnapshot
      : PRODUCTS.find((p) => p.id === body.productId);
  if (!product) {
    return NextResponse.json(
      { error: `product not found: ${body.productId}` },
      { status: 400 }
    );
  }

  try {
    const prompt = buildPrompt(
      product,
      body.sourcePack,
      body.contentLength,
      body.angleStrategy
    );
    const raw = await completeChat({
      model: "qwen-plus",
      temperature: 0.7,
      maxTokens: 1600,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      signal: req.signal,
    });
    const plans = coerceTopicPlans(extractJsonArray(raw), product, {
      contentLength: body.contentLength,
      angleStrategy: body.angleStrategy,
    });
    return NextResponse.json({ plans, source: "qwen" });
  } catch (err) {
    const plans: TopicPlan[] = buildFallbackTopicPlans(product, {
      contentLength: body.contentLength,
      angleStrategy: body.angleStrategy,
    });
    const reason =
      err instanceof QwenAuthError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return NextResponse.json({ plans, source: "fallback", reason });
  }
}
