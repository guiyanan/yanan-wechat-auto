import type { ArticleSourceContext, Product, TrendSearchResult } from "@/types";

interface TrendHookSeed {
  mainstreamAnchor: string;
  categoryHook: string;
  featureHint: string;
  scenarioTerms: string[];
}

const MAINSTREAM_HOOKS: Array<{
  match: RegExp;
  seed: TrendHookSeed;
}> = [
  {
    match:
      /canva|midjourney|stable\s*diffusion|fashion|apparel|garment|clothing|design|ai\s*design|设计|图片|服装|时尚|穿搭|款式|版型|面料|花型|打版|试衣|素材|海报/i,
    seed: {
      mainstreamAnchor: "Lovart",
      categoryHook: "AI服装设计",
      featureHint: "服装设计生成和版型预览",
      scenarioTerms: [
        "Lovart",
        "Canva",
        "Midjourney",
        "AI试衣",
        "虚拟模特",
        "服装打版",
        "Tech Pack",
        "花型生成",
        "小红书穿搭",
      ],
    },
  },
  {
    match:
      /notebook\s*lm|notebooklm|ai\s*笔记|知识库问答|pdf\s*(总结|问答|阅读)|文档问答|ai\s*记事|记事本/i,
    seed: {
      mainstreamAnchor: "NotebookLM",
      categoryHook: "AI笔记本",
      featureHint: "知识库问答",
      scenarioTerms: ["AI记事本", "PDF总结", "会议记录", "资料问答"],
    },
  },
  {
    match: /dify|agent|workflow|智能体|工作流|客服|机器人/i,
    seed: {
      mainstreamAnchor: "Dify",
      categoryHook: "AI应用搭建",
      featureHint: "工作流编排",
      scenarioTerms: ["AI客服", "智能体", "企业知识库", "低代码"],
    },
  },
  {
    match: /deepseek|chatgpt|大模型|ai\s*写作|办公提效|提示词生成|prompt\s*(生成|写作)/i,
    seed: {
      mainstreamAnchor: "DeepSeek",
      categoryHook: "AI办公工具",
      featureHint: "提示词和知识问答",
      scenarioTerms: ["ChatGPT", "提示词", "AI写作", "办公提效"],
    },
  },
  {
    match: /excel|表格|bi|数据|报表|分析/i,
    seed: {
      mainstreamAnchor: "Excel",
      categoryHook: "AI表格工具",
      featureHint: "数据分析",
      scenarioTerms: ["WPS", "数据看板", "自动报表", "参数对比"],
    },
  },
  {
    match: /飞书|协作|crm|scrm|私域|营销|销售/i,
    seed: {
      mainstreamAnchor: "飞书",
      categoryHook: "AI协作工具",
      featureHint: "客户跟进和团队协作",
      scenarioTerms: ["企微", "SCRM", "销售跟进", "私域运营"],
    },
  },
];

const DEFAULT_HOOK: TrendHookSeed = {
  mainstreamAnchor: "DeepSeek",
  categoryHook: "AI工具",
  featureHint: "办公提效",
  scenarioTerms: ["ChatGPT", "抖音热榜", "小红书避坑", "怎么选"],
};

function productText(product: Product, sourcePack?: ArticleSourceContext): string {
  return [
    product.name,
    product.description,
    ...(product.tags ?? []),
    product.understanding?.definition,
    ...(product.understanding?.coreFunctions ?? []).map((entry) => entry.text),
    ...(product.understanding?.targetCustomers ?? []).map((entry) => entry.text),
    ...(product.understanding?.painPoints ?? []).map((entry) => entry.text),
    sourcePack?.productNotes,
  ]
    .filter(Boolean)
    .join(" ");
}

function inferHookSeeds(
  product: Product,
  sourcePack?: ArticleSourceContext
): TrendHookSeed[] {
  const text = productText(product, sourcePack);
  const seeds = MAINSTREAM_HOOKS.filter((hook) => hook.match.test(text)).map(
    (hook) => hook.seed
  );
  return seeds.length > 0 ? seeds.slice(0, 3) : [DEFAULT_HOOK];
}

function withChinaHookTerms(parts: string[]): string {
  return [
    ...parts,
    "抖音",
    "小红书",
    "知乎",
    "避坑",
    "实测",
    "平替",
    "怎么选",
    "评论区",
    "教程",
    "对比",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 240);
}

export function buildTrendSearchQuery(
  product: Product,
  sourcePack?: ArticleSourceContext
): string {
  return buildTrendSearchQueries(product, sourcePack)[0];
}

export function buildTrendSearchQueries(
  product: Product,
  sourcePack?: ArticleSourceContext
): string[] {
  const seeds = inferHookSeeds(product, sourcePack);
  const base = [product.description, ...(product.tags ?? [])].filter(Boolean);
  const queries = seeds.flatMap((seed) => [
    withChinaHookTerms([
      seed.mainstreamAnchor,
      seed.categoryHook,
      seed.featureHint,
      ...seed.scenarioTerms,
      "竞品",
      "替代",
      "相似",
      "案例",
      "争议",
      "近30天",
      "平替",
      "怎么选",
    ]),
    withChinaHookTerms([
      seed.categoryHook,
      ...seed.scenarioTerms,
      "用户吐槽",
      "评论区",
      "避坑",
      ...base,
    ]),
    withChinaHookTerms([
      seed.mainstreamAnchor,
      seed.categoryHook,
      "替代方案",
      "竞品对比",
      "真实体验",
      ...base,
    ]),
  ]);
  return Array.from(new Set(queries)).slice(0, 6);
}

function hookForIndex(index: number, product: Product): TrendHookSeed {
  const seeds = inferHookSeeds(product);
  return seeds[index % seeds.length] ?? DEFAULT_HOOK;
}

function includesTerm(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function isFashionDesignProduct(
  product: Product,
  sourcePack?: ArticleSourceContext
): boolean {
  return /fashion|apparel|garment|clothing|design|服装|时尚|穿搭|款式|版型|面料|花型|打版|试衣|设计/i.test(
    productText(product, sourcePack)
  );
}

function isDataAnalysisProduct(
  product: Product,
  sourcePack?: ArticleSourceContext
): boolean {
  return /excel|表格|bi|数据|报表|分析|评论|反馈|情感分类|可视化/i.test(
    productText(product, sourcePack)
  );
}

function relevantTermsForProduct(
  product: Product,
  sourcePack?: ArticleSourceContext
): string[] {
  const seeds = inferHookSeeds(product, sourcePack);
  const terms = seeds.flatMap((seed) => [
    seed.mainstreamAnchor,
    seed.categoryHook,
    seed.featureHint,
    ...seed.scenarioTerms,
  ]);
  if (isFashionDesignProduct(product, sourcePack)) {
    terms.push(
      "服装",
      "时尚",
      "穿搭",
      "款式",
      "版型",
      "面料",
      "花型",
      "打版",
      "试衣",
      "模特",
      "设计",
      "AI作图",
      "AI设计",
      "Midjourney",
      "Canva",
      "Tech Pack",
      "fashion",
      "apparel",
      "garment",
      "clothing",
      "design"
    );
  }
  return Array.from(new Set(terms.filter((term) => term.trim().length >= 2)));
}

function looksLikeUnrelatedNotebookOrDevTopic(text: string): boolean {
  return /notebook\s*lm|notebooklm|ai\s*笔记|笔记本电脑|知识库问答|pdf\s*总结|论文|php|代码|编程|模板下载/i.test(
    text
  );
}

function looksLikeLowSignalOfficeTutorial(text: string): boolean {
  return /php中文网|快捷键|功能菜单|软件下载|app下载|下载最新版|安装包|破解版|模板下载/i.test(
    text
  );
}

function hasStrongDataAnalysisSignal(text: string): boolean {
  return /ai\s*(数据|表格|分析)|ai数据|ai表格|数据分析|表格工具|bi|报表|自动报表|数据看板|评论分析|用户反馈|情感分类|标签提取|可视化图表|竞品分析/i.test(
    text
  );
}

export function filterRelevantTrendResults(
  product: Product,
  sourcePack: ArticleSourceContext | undefined,
  trends: TrendSearchResult[]
): TrendSearchResult[] {
  const terms = relevantTermsForProduct(product, sourcePack);
  const fashionProduct = isFashionDesignProduct(product, sourcePack);
  const dataAnalysisProduct = isDataAnalysisProduct(product, sourcePack);

  return trends.filter((trend) => {
    if (trend.url.startsWith("internal://")) return true;
    const text = [trend.title, trend.snippet, trend.source, trend.categoryHook, trend.featureHint]
      .filter(Boolean)
      .join(" ");
    const hasRelevantTerm = includesTerm(text, terms);

    if (fashionProduct && looksLikeUnrelatedNotebookOrDevTopic(text) && !hasRelevantTerm) {
      return false;
    }
    if (
      dataAnalysisProduct &&
      looksLikeLowSignalOfficeTutorial(text) &&
      !hasStrongDataAnalysisSignal(text)
    ) {
      return false;
    }

    return hasRelevantTerm;
  });
}

export function buildFallbackTrends(product: Product): TrendSearchResult[] {
  const base = product.name || "这个产品";
  const firstHook = hookForIndex(0, product);
  return [
    {
      id: "trend-fallback-competitor",
      title: `${firstHook.categoryHook}最近怎么都火了`,
      snippet:
        `先拿外部话题做噱头: ${firstHook.mainstreamAnchor} 带火了 ${firstHook.categoryHook} 这类需求。别急着讲 ${base},先聊大家到底在找什么平替、怎么选。`,
      url: "internal://trend/competitor-hook",
      source: "系统兜底",
      mainstreamAnchor: firstHook.mainstreamAnchor,
      categoryHook: firstHook.categoryHook,
      hookMode: "category_hook",
      featureHint: firstHook.featureHint,
    },
    {
      id: "trend-fallback-alternative",
      title: "替代方案越多,用户越烦",
      snippet:
        `先从替代选择的拥挤感切入:用户不是缺工具,而是不想再听一遍功能清单。别急着讲产品,正文只把 ${base} 当作一句轻观察。`,
      url: "internal://trend/alternative-hook",
      source: "系统兜底",
      mainstreamAnchor: firstHook.mainstreamAnchor,
      categoryHook: firstHook.categoryHook,
      hookMode: "comparison_hook",
      featureHint: firstHook.featureHint,
    },
    {
      id: "trend-fallback-similar-topic",
      title: "相似题材一火,评论区先吵起来",
      snippet:
        "先借相似题材的热度做开场,比如同类 AI 工具、自动化工具或协作产品被讨论。别急着讲产品,先写评论区为什么会吵、普通人为什么会点进去。",
      url: "internal://trend/similar-topic-hook",
      source: "系统兜底",
      mainstreamAnchor: firstHook.mainstreamAnchor,
      categoryHook: firstHook.categoryHook,
      hookMode: "scenario_hook",
      featureHint: firstHook.featureHint,
    },
    {
      id: "trend-fallback-case",
      title: "别人案例很热闹,普通人只问能不能用",
      snippet:
        "先借行业案例或竞品发布做外部话题,吸引读者进来;正文不编造具体客户。别急着讲产品,先写普通团队看到热闹案例时最真实的疑问。",
      url: "internal://trend/case-hook",
      source: "系统兜底",
      mainstreamAnchor: firstHook.mainstreamAnchor,
      categoryHook: firstHook.categoryHook,
      hookMode: "explicit_anchor",
      featureHint: firstHook.featureHint,
    },
    {
      id: "trend-fallback-controversy",
      title: "AI 工具越火,吐槽也越多",
      snippet:
        `先用行业争议做噱头:智能工具、自动化平台或同类产品常被吐槽不够落地。别急着讲产品,先写大家为什么会不信,再把 ${base} 一笔带过。`,
      url: "internal://trend/controversy-hook",
      source: "系统兜底",
      mainstreamAnchor: firstHook.mainstreamAnchor,
      categoryHook: firstHook.categoryHook,
      hookMode: "pitfall_hook",
      featureHint: firstHook.featureHint,
    },
  ];
}

export function pickTrendSourcesForArticle(
  trends: TrendSearchResult[],
  articleIndex: number,
  count = 4
): TrendSearchResult[] {
  if (trends.length <= count) return trends;
  return Array.from({ length: count }, (_, offset) => {
    const index = (articleIndex + offset) % trends.length;
    return trends[index];
  });
}
