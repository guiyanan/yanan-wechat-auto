import { NextRequest, NextResponse } from "next/server";
import productsData from "@/data/products.json";
import type {
  AngleStrategy,
  ArticleSourceContext,
  ContentLength,
  Product,
  TopicPlan,
  TrendSearchResult,
} from "@/types";
import { completeChat, QwenAuthError } from "@/lib/qwen";
import { getDeepSeekChatOptions } from "@/lib/deepseek";
import {
  buildFallbackTopicPlans,
  buildFallbackTrendTopicPlans,
  coerceTopicPlans,
  coerceTrendTopicPlans,
} from "@/lib/topicPlanner";
import {
  getAngleStrategyInstruction,
  getContentLengthInstruction,
} from "@/lib/contentSettings";
import { AUTO_ARTICLE_COUNT } from "@/lib/generationConstants";
import { productSourceToArticleContext } from "@/lib/productCatalog";
import { filterRelevantTrendResults } from "@/lib/trends/hooks";
import { buildHotspotContractPrompt } from "@/lib/trendArticleContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTS = productsData as Product[];

interface TopicPlanRequest {
  productId: string;
  productSnapshot?: Product;
  sourcePack?: ArticleSourceContext;
  contentLength?: ContentLength;
  angleStrategy?: AngleStrategy;
  mode?: "auto-five" | "trend-radar";
  trendResults?: TrendSearchResult[];
  articleCount?: number;
}

function sourcePackText(sourcePack?: ArticleSourceContext, product?: Product): string {
  return (
    (product ? productSourceToArticleContext(product).productNotes : "") ||
    sourcePack?.productNotes?.trim() ||
    "未提供补充素材。"
  );
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
  angleStrategy?: AngleStrategy,
  articleCount = AUTO_ARTICLE_COUNT
) {
  const system = [
    "你是 JOTO 内容工厂的智能选题策划。",
    "你只允许基于用户给出的产品资料和素材判断,不得联网,不得编造市场事实。",
    `目标:为一个产品规划 ${articleCount} 篇微信公众号候选文章。`,
    "普通产品文章不再自由发散角度,必须固定为 3 个入口,顺序不能变:",
    "1. 场景痛点入口:从目标用户的工作卡点进入。",
    "2. 传统做法入口:从旧流程、传统方案或替代做法进入。",
    "3. 产品能力/适用人群入口:从核心能力和适合谁先用进入。",
    "每篇虽然入口不同,但都必须完整覆盖产品链路:产品是什么、给谁用、痛点、传统做法、产品介入、使用后的变化、不能写什么。",
    getAngleStrategyInstruction(angleStrategy),
    getContentLengthInstruction(contentLength),
    "场景案例不是默认优先项。只有用户素材里明确提供真实客户、真实项目或真实效果数据时,才规划客户案例/实施效果类文章。",
    "所有 promptInstruction 都必须禁止编造客户名、合作关系、营收、提效百分比和部署周期。",
    "所有 promptInstruction 都必须禁止编造具体人名、英文名和有名有姓的人物剧情;只能使用匿名角色,如一位设计师、某个运营同事、一个团队、某个流程。",
    "如果产品资料没有明确真实使用流程,不得规划需要具体按钮、后台路径、点击顺序、部署步骤的文章;应换成通用场景、产品启蒙或提示补资料。",
    "每篇文章的事实点必须能从产品简介、补充素材或图片说明中找到依据;不确定时写成风险提示,不要把猜测写成事实。",
    "如文章需要插图,只能使用产品资料输入中的真实截图、视频理解素材或用户明确提供的图片说明;没有合适素材时提示建议补图,不得虚构截图。",
  ].join("\n");
  const user = [
    `【产品】${product.name}`,
    `【产品简介】${product.description}`,
    `【标签】${product.tags.join("、")}`,
    "",
    "【补充素材】",
    sourcePackText(sourcePack, product),
    "",
    `请输出严格 JSON 数组,必须正好 ${articleCount} 项,不要输出解释文字。`,
    "三项顺序和入口必须固定:",
    "1. id=topic-scenario-pain, angleLabel=场景痛点入口, angleType=scenario",
    "2. id=topic-traditional-alternative, angleLabel=传统做法入口, angleType=product_diff",
    "3. id=topic-capability-audience, angleLabel=产品能力/适用人群入口, angleType=product_intro",
    "每项字段:",
    "- id: 英文短 id",
    `- angleLabel: 中文选题入口名,${articleCount} 项不得重复,不得改成自由角度`,
    "- angleType: product_intro | product_diff | competitor | scenario | education | pricing | ecosystem",
    "- reason: 30-60 字,说明为什么这个产品适合该角度",
    "- promptInstruction: 给正文生成模型的具体写作指令,80-160 字,必须写明该入口如何完整覆盖产品链路",
    "- sourceNeedLevel: low | medium | high",
    "每项 promptInstruction 都要自然体现篇幅和角度策略,但不要把字数写进标题。",
  ].join("\n");
  return { system, user };
}

function trendSourceText(trends: TrendSearchResult[] = []): string {
  return (
    trends
      .slice(0, 10)
      .map((trend, idx) => {
        const source = trend.source ? ` / ${trend.source}` : "";
        const date = trend.publishedAt ? ` / ${trend.publishedAt}` : "";
        return `${idx + 1}. ${trend.title}${source}${date}\n摘要: ${trend.snippet}`;
      })
      .join("\n\n") || "未抓到可用热点。可写成近期行业观察,但不得假装引用新闻。"
  );
}

function buildTrendPrompt(
  product: Product,
  sourcePack?: ArticleSourceContext,
  trendResults?: TrendSearchResult[],
  contentLength?: ContentLength,
  articleCount = AUTO_ARTICLE_COUNT
) {
  const system = [
    "你是 JOTO 小信的热点选题编辑。",
    buildHotspotContractPrompt(),
    `任务:根据近 30 天中文热点摘要、同类竞品、替代方案、相似题材和产品事实,规划 ${articleCount} 个受控随机引流切口。`,
    "热点稿必须和普通产品稿明显不同:第一屏先写外部话题噱头,用主流产品带火的品类、平替、使用场景、避坑问题或用户困惑吸引读者;标题可以显性或隐性蹭热点,不必直接点名热点主角。",
    "主次硬约束:前半段用热点、品类、平替、场景或用户困惑建立入口;中后段必须进入产品团队视角,说明我们如何理解和回应这个问题。",
    "热点模板负责结构:热点/品类/平替噱头 -> 这件事为什么让人想点开 -> 用户正在比较什么或哪里容易踩坑 -> 真实工作问题 -> 产品团队视角 -> 我们的回应 -> 收束判断。",
    "只允许使用输入中的热点摘要和产品资料;不得展示来源链接;不得编造新闻事实、客户、合作、数据、竞品事实或产品流程。",
    "不要规划插图;不要把产品回应写成功能清单、参数堆叠或硬广 CTA。",
    "相关性硬约束:热点必须和产品所在品类、用户场景或相邻功能有关。不要把 NotebookLM、论文、代码模板、无关 AI 工具等素材硬嫁接到服装设计、营销、数据分析等不相干产品上。",
    getContentLengthInstruction(contentLength),
  ].join("\n");
  const user = [
    `【产品】${product.name}`,
    `【产品简介】${product.description}`,
    `【标签】${product.tags.join("、")}`,
    "",
    "【产品补充素材】",
    sourcePackText(sourcePack, product),
    "",
    "【热点素材摘要】",
    trendSourceText(trendResults),
    "",
    `请输出严格 JSON 数组,必须正好 ${articleCount} 项,不要输出解释文字。`,
    "每项字段:",
    "- id: 英文短 id",
    "- angleLabel: 兼容字段,填 trafficHookLabel 相同内容",
    "- angleType: 固定为 trend",
    `- trafficHookLabel: 中文引流切口名,${articleCount} 项不得重复`,
    "- trafficHookMode: mainstream_product | category_heat | domestic_alternative | usage_explainer | pitfall | scenario",
    "- mainstreamAnchor: 可选,本切口借势的主流产品名,如 Lovart / Canva / NotebookLM / Dify",
    "- reason: 30-60 字,说明为什么这个外部话题噱头适合承接目标客户流量",
    "- promptInstruction: 给正文生成模型的具体写作指令,120-220 字。必须包含:这是产品团队写给用户的完整公众号观察文、热点现象或主流产品 -> 需求 -> 为什么关心 -> 真实工作问题 -> 产品团队视角 -> 我们的回应 -> 收束判断、外部话题必须和产品品类/场景/相邻功能有关、前半段不把本产品写成主角、产品可在中后段自然进入但必须回应真实问题、不能写成功能清单或硬广 CTA、不展示来源链接、不插图、不编造新闻事实/客户/合作/数据/竞品事实/产品流程。",
    "- sourceNeedLevel: low | medium | high",
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

  const isTrendMode = body.mode === "trend-radar";
  const articleCount = AUTO_ARTICLE_COUNT;
  const relevantTrendResults: TrendSearchResult[] = isTrendMode
    ? filterRelevantTrendResults(
        product,
        body.sourcePack,
        body.trendResults ?? []
      )
    : body.trendResults ?? [];

  try {
    const prompt = isTrendMode
      ? buildTrendPrompt(
          product,
          body.sourcePack,
          relevantTrendResults,
          body.contentLength,
          articleCount
        )
      : buildPrompt(
          product,
          body.sourcePack,
          body.contentLength,
          body.angleStrategy,
          articleCount
        );
    const raw = await completeChat({
      ...getDeepSeekChatOptions(),
      temperature: 0.7,
      maxTokens: 1600,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      signal: req.signal,
    });
    const plans = isTrendMode
      ? coerceTrendTopicPlans(extractJsonArray(raw), product, relevantTrendResults, {
          contentLength: body.contentLength,
          angleStrategy: body.angleStrategy,
        })
      : coerceTopicPlans(extractJsonArray(raw), product, {
          contentLength: body.contentLength,
          angleStrategy: body.angleStrategy,
        });
    return NextResponse.json({
      plans: plans.slice(0, articleCount),
      source: "deepseek",
    });
  } catch (err) {
    const plans: TopicPlan[] = isTrendMode
      ? buildFallbackTrendTopicPlans(product, relevantTrendResults, {
          contentLength: body.contentLength,
          angleStrategy: body.angleStrategy,
        })
      : buildFallbackTopicPlans(product, {
          contentLength: body.contentLength,
          angleStrategy: body.angleStrategy,
        });
    const reason =
      err instanceof QwenAuthError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return NextResponse.json({
      plans: plans.slice(0, articleCount),
      source: "fallback",
      reason,
    });
  }
}
