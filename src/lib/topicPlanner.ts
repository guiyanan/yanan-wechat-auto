import type {
  AngleStrategy,
  ContentLength,
  Product,
  TopicPlan,
  TrafficHookMode,
  TrendSearchResult,
} from "@/types";
import { buildHotspotContractPrompt } from "@/lib/trendArticleContract";

export interface TopicPlannerOptions {
  angleStrategy?: AngleStrategy;
  contentLength?: ContentLength;
}

const TREND_RADAR_HARD_RULES =
  [
    buildHotspotContractPrompt(),
    "热点稿硬约束:第一屏先写外部话题噱头,但不要硬嫁接不相干素材;前半段围绕热点、品类、平替、场景或用户困惑建立阅读入口;中后段必须进入产品团队视角和我们的回应,解释产品承接了哪个真实用户问题;产品可以在中后段自然进入,但不得写成功能清单、参数堆叠或硬广 CTA;不展示来源链接,不插图,不编造人名、朋友对话、客户、合作、数据、竞品事实或产品流程;避免第三方测评口吻、纯吐槽、入口之争、系统兜底等分析感或内部感词。",
  ].join("\n");

const NO_FICTIONAL_PERSON_RULE =
  "不要写具体人名、英文名或有名有姓的人物剧情;只允许使用一位设计师、某个运营同事、一个团队、某个流程这类匿名角色。";

const TRAFFIC_HOOK_MODES: TrafficHookMode[] = [
  "mainstream_product",
  "category_heat",
  "domestic_alternative",
  "usage_explainer",
  "pitfall",
];

const PRODUCT_CHAIN_RULE = [
  "每篇都必须完整覆盖产品链路:",
  "产品是什么",
  "给谁用",
  "痛点",
  "传统做法",
  "产品介入",
  "使用后的变化",
  "不能写什么",
].join("、");

const FIXED_PRODUCT_ENTRY_PLANS: TopicPlan[] = [
  {
    id: "topic-scenario-pain",
    angleLabel: "场景痛点入口",
    angleType: "scenario",
    reason: "先从目标用户正在经历的工作卡点进入,降低理解成本,再完整讲清产品链路。",
    promptInstruction:
      "入口固定为场景痛点。先写一个匿名工作场景里的真实卡点,再依次讲清产品是什么、给谁用、痛点、传统做法、产品介入、使用后的变化、不能写什么。不要只写痛点,每一节都要回到产品链路。",
    sourceNeedLevel: "low",
  },
  {
    id: "topic-traditional-alternative",
    angleLabel: "传统做法入口",
    angleType: "product_diff",
    reason: "从旧流程和替代方案切入,更容易解释为什么需要这个产品,同时避免自由发散。",
    promptInstruction:
      "入口固定为传统做法。先写用户过去通常怎么处理这件事,再依次讲清产品是什么、给谁用、痛点、传统做法、产品介入、使用后的变化、不能写什么。只写传统方案和工作方式变化,不得编造竞品事实或客户案例。",
    sourceNeedLevel: "medium",
  },
  {
    id: "topic-capability-audience",
    angleLabel: "产品能力/适用人群入口",
    angleType: "product_intro",
    reason: "从能力和适用人群切入,用于讲清产品定位、核心功能和适合谁先用。",
    promptInstruction:
      "入口固定为产品能力/适用人群。先讲这个产品到底能帮哪类人处理什么任务,再依次讲清产品是什么、给谁用、痛点、传统做法、产品介入、使用后的变化、不能写什么。不要罗列功能,每个功能都要落到角色、动作和边界。",
    sourceNeedLevel: "low",
  },
];

function uniquePlans(plans: TopicPlan[]): TopicPlan[] {
  const seen = new Set<string>();
  const result: TopicPlan[] = [];
  for (const plan of plans) {
    const key = plan.angleLabel.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(plan);
  }
  return result.slice(0, 5);
}

function withOptions(
  plans: TopicPlan[],
  options: TopicPlannerOptions = {}
): TopicPlan[] {
  const angleStrategy =
    options.angleStrategy === "trend" ? "auto" : options.angleStrategy;
  return uniquePlans(plans).map((plan) => ({
    ...plan,
    promptInstruction: appendInstruction(
      plan.promptInstruction,
      NO_FICTIONAL_PERSON_RULE
    ),
    contentLength: options.contentLength ?? plan.contentLength,
    angleStrategy: angleStrategy ?? plan.angleStrategy,
  }));
}

function appendInstruction(instruction: string, rule: string): string {
  return instruction.includes(rule) ? instruction : `${instruction}\n${rule}`;
}

function isUsableModelInstruction(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (text.length < 30) return false;
  return /产品|用户|痛点|传统|场景|能力|使用|变化|介入/.test(text);
}

function trendContextText(trends: TrendSearchResult[] = []): string {
  return trends
    .slice(0, 5)
    .map((trend, idx) => {
      const source = trend.source ? ` / ${trend.source}` : "";
      const date = trend.publishedAt ? ` / ${trend.publishedAt}` : "";
      return `${idx + 1}. ${trend.title}${source}${date}: ${trend.snippet}`;
    })
    .join("\n");
}

function withTrendRules(
  instruction: string,
  trends: TrendSearchResult[] = []
): string {
  const context = trendContextText(trends);
  return [
    instruction,
    TREND_RADAR_HARD_RULES,
    context ? `可参考的热点素材摘要如下,只作内部追溯,正文不得展示链接:\n${context}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function rotateModes(seed: string): TrafficHookMode[] {
  const offset = hashText(seed) % TRAFFIC_HOOK_MODES.length;
  return [
    ...TRAFFIC_HOOK_MODES.slice(offset),
    ...TRAFFIC_HOOK_MODES.slice(0, offset),
  ].slice(0, 5);
}

function inferTrafficContext(
  product: Pick<Product, "name" | "description" | "tags">,
  trends: TrendSearchResult[] = []
): { category: string; anchor?: string } {
  const text = [product.name, product.description, ...product.tags].join(" ");
  const trendAnchor = trends.find((trend) => trend.mainstreamAnchor)?.mainstreamAnchor;
  if (/lovart|canva|midjourney|fashion|apparel|garment|服装|时尚|穿搭|设计|版型|面料|试衣/i.test(text)) {
    return { category: "AI设计工具", anchor: trendAnchor ?? "Lovart" };
  }
  if (/notebook\s*lm|notebooklm|ai\s*笔记|知识库|pdf|文档|资料|会议记录/i.test(text)) {
    return { category: "AI笔记工具", anchor: trendAnchor ?? "NotebookLM" };
  }
  if (/dify|agent|workflow|智能体|工作流|客服|机器人/i.test(text)) {
    return { category: "AI应用搭建工具", anchor: trendAnchor ?? "Dify" };
  }
  if (/excel|表格|bi|数据|报表|分析/i.test(text)) {
    return { category: "AI数据分析工具", anchor: trendAnchor ?? "Excel" };
  }
  if (/飞书|协作|crm|scrm|私域|营销|销售/i.test(text)) {
    return { category: "AI协作工具", anchor: trendAnchor ?? "飞书" };
  }
  return { category: "AI工具", anchor: trendAnchor ?? trends[0]?.mainstreamAnchor };
}

function labelForTrafficHook(
  mode: TrafficHookMode,
  context: { category: string; anchor?: string }
): string {
  const anchor = context.anchor;
  switch (mode) {
    case "mainstream_product":
      return anchor ? `${anchor} 是什么,适合谁用` : `${context.category}最近为什么火`;
    case "category_heat":
      return `现在大家都在找哪些${context.category}`;
    case "domestic_alternative":
      return anchor
        ? `${anchor} 国内平替怎么选`
        : `${context.category}国内类似方案怎么选`;
    case "usage_explainer":
      return `${context.category}到底能帮谁省事`;
    case "pitfall":
      return `试用${context.category}前先看什么`;
    case "scenario":
      return `为什么大家开始关注${context.category}`;
  }
}

function instructionForTrafficHook(
  mode: TrafficHookMode,
  context: { category: string; anchor?: string },
  productName: string,
  trendLead: string,
  trends: TrendSearchResult[] = []
): string {
  const label = labelForTrafficHook(mode, context);
  const anchor = context.anchor ?? context.category;
  const base =
    `${trendLead}这篇是产品团队写给用户的完整公众号观察文,围绕“${label}”这个引流切口展开。` +
    "第一屏必须先写外部热点现象或主流产品噱头;正文按:热点现象或主流产品 -> 它带火了什么需求 -> 用户为什么关心 -> 真实工作问题 -> 产品团队视角 -> 我们的回应 -> 收束判断。";

  const modeInstruction: Record<TrafficHookMode, string> = {
    mainstream_product: `先用 ${anchor} 是什么、大家为什么搜它做入口,再讲它带火的需求。`,
    category_heat: `先写 ${context.category} 这个品类为什么被更多人搜索,再讲用户通常在比较什么。`,
    domestic_alternative: `先写为什么有人会找国内平替或类似方案,允许说国内平替,但不得编造完全替代或官方关系。`,
    usage_explainer: `先用人话解释这类工具到底能做什么、适合谁,不要写成教程或功能清单。`,
    pitfall: `先写试用或下单前最容易看错的一点,语气是提醒和避坑,不是抨击或泄愤。`,
    scenario: `先写某类用户为什么开始关注这类工具,必须是泛化场景,不要虚构具体人物剧情。${NO_FICTIONAL_PERSON_RULE}`,
  };

  return withTrendRules(
    [
      base,
      modeInstruction[mode],
      "外部话题噱头必须和产品品类、用户场景或相邻功能有关,来源弱时改用品类兜底。",
      `产品 ${productName} 可以在中后段自然进入,但只能说明它如何回应前文的真实问题,不得写成功能清单。`,
      "不抨击 AI,不抨击竞品,不嘲讽用户,不写泄愤吐槽。",
    ].join(" "),
    trends
  );
}

function buildProductEntryPlans(options: TopicPlannerOptions = {}): TopicPlan[] {
  return withOptions(FIXED_PRODUCT_ENTRY_PLANS, options).map((plan) => ({
    ...plan,
    promptInstruction: appendInstruction(plan.promptInstruction, PRODUCT_CHAIN_RULE),
  }));
}

export function buildFallbackTrendTopicPlans(
  product: Pick<Product, "name" | "description" | "tags">,
  trends: TrendSearchResult[] = [],
  options: TopicPlannerOptions = {}
): TopicPlan[] {
  const trendLead = trends[0]?.title
    ? `优先参考热点「${trends[0].title}」,但正文不要展示来源链接。`
    : "没有可用热点时,写成近期行业观察,不要假装引用新闻。";
  const context = inferTrafficContext(product, trends);
  const modes = rotateModes(`${product.name}:${trends[0]?.title ?? ""}`);
  return withOptions(
    modes.map((mode, index): TopicPlan => {
      const label = labelForTrafficHook(mode, context);
      return {
        id: `traffic-hook-${mode}-${index + 1}`,
        angleLabel: label,
        angleType: "trend",
        reason: "这是热点引流切口,用于承接外部搜索、品类热度或平替需求,不是产品角度判断。",
        promptInstruction: instructionForTrafficHook(
          mode,
          context,
          product.name,
          trendLead,
          trends
        ),
        sourceNeedLevel: mode === "mainstream_product" ? "medium" : "low",
        trafficHookLabel: label,
        trafficHookMode: mode,
        mainstreamAnchor:
          mode === "mainstream_product" || mode === "domestic_alternative"
            ? context.anchor
            : undefined,
      };
    }),
    options
  );
}

export function buildFallbackTopicPlans(
  product: Pick<Product, "name" | "description" | "tags">,
  options: TopicPlannerOptions = {}
): TopicPlan[] {
  void product;
  const strategy =
    options.angleStrategy === "trend" ? "auto" : options.angleStrategy ?? "auto";
  return buildProductEntryPlans({ ...options, angleStrategy: strategy });
}

export function coerceTopicPlans(
  input: unknown,
  product: Pick<Product, "name" | "description" | "tags">,
  options: TopicPlannerOptions = {}
): TopicPlan[] {
  const fallback = buildFallbackTopicPlans(product, options);
  if (!Array.isArray(input)) return fallback;

  return fallback.map((plan, idx) => {
    const row = input[idx] && typeof input[idx] === "object"
      ? (input[idx] as Record<string, unknown>)
      : {};
    const modelInstruction = isUsableModelInstruction(row.promptInstruction)
      ? appendInstruction(row.promptInstruction.trim(), PRODUCT_CHAIN_RULE)
      : plan.promptInstruction;
    return {
      ...plan,
      reason:
        typeof row.reason === "string" && row.reason.trim()
          ? row.reason.trim()
          : plan.reason,
      promptInstruction: appendInstruction(
        appendInstruction(modelInstruction, NO_FICTIONAL_PERSON_RULE),
        PRODUCT_CHAIN_RULE
      ),
    };
  });
}

export function coerceTrendTopicPlans(
  input: unknown,
  product: Pick<Product, "name" | "description" | "tags">,
  trends: TrendSearchResult[] = [],
  options: TopicPlannerOptions = {}
): TopicPlan[] {
  const fallback = buildFallbackTrendTopicPlans(product, trends, options);
  if (!Array.isArray(input)) return fallback;

  const parsed = uniquePlans(
    input.map((item, idx): TopicPlan => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const rawInstruction =
        typeof row.promptInstruction === "string" && row.promptInstruction.trim()
          ? row.promptInstruction.trim()
          : fallback[idx]?.promptInstruction ?? fallback[0].promptInstruction;
      return {
        id:
          typeof row.id === "string" && row.id.trim()
            ? row.id.trim()
            : `trend-ai-${idx + 1}`,
        angleLabel:
          typeof row.angleLabel === "string" && row.angleLabel.trim()
            ? row.angleLabel.trim()
            : fallback[idx]?.angleLabel ?? `热点选题 ${idx + 1}`,
        angleType: "trend",
        reason:
          typeof row.reason === "string" && row.reason.trim()
            ? row.reason.trim()
            : fallback[idx]?.reason ?? "根据产品资料和热点素材选择。",
        promptInstruction: rawInstruction.includes(TREND_RADAR_HARD_RULES)
          ? rawInstruction
          : withTrendRules(rawInstruction, trends),
        sourceNeedLevel:
          row.sourceNeedLevel === "high" ||
          row.sourceNeedLevel === "medium" ||
          row.sourceNeedLevel === "low"
            ? row.sourceNeedLevel
            : fallback[idx]?.sourceNeedLevel ?? "medium",
        contentLength: options.contentLength,
        angleStrategy: undefined,
        trafficHookLabel:
          typeof row.trafficHookLabel === "string" && row.trafficHookLabel.trim()
            ? row.trafficHookLabel.trim()
            : fallback[idx]?.trafficHookLabel ?? fallback[idx]?.angleLabel,
        trafficHookMode:
          typeof row.trafficHookMode === "string"
            ? (row.trafficHookMode as TrafficHookMode)
            : fallback[idx]?.trafficHookMode,
        mainstreamAnchor:
          typeof row.mainstreamAnchor === "string" && row.mainstreamAnchor.trim()
            ? row.mainstreamAnchor.trim()
            : fallback[idx]?.mainstreamAnchor,
      };
    })
  );

  if (parsed.length >= 5) return parsed.slice(0, 5);
  const merged = uniquePlans([...parsed, ...fallback]);
  return merged.length >= 5 ? merged.slice(0, 5) : fallback;
}
