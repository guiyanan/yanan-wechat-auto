import type { AngleStrategy, ContentLength, Product, TopicPlan } from "@/types";

export interface TopicPlannerOptions {
  angleStrategy?: AngleStrategy;
  contentLength?: ContentLength;
}

const MATURE_MARKET_KEYWORDS = [
  "notebooklm",
  "notebook lm",
  "google",
  "竞品",
  "替代",
  "生态",
  "价格",
  "对比",
  "知识库",
  "笔记",
  "文档",
];

const NEW_CONCEPT_KEYWORDS = [
  "服装",
  "时装",
  "穿搭",
  "面料",
  "款式",
  "版型",
  "设计师",
  "设计",
  "灵感",
  "新概念",
];

function normalize(input: string): string {
  return input.toLowerCase();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

function productText(product: Pick<Product, "name" | "description" | "tags">): string {
  return normalize([product.name, product.description, ...product.tags].join(" "));
}

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
  return uniquePlans(plans).map((plan) => ({
    ...plan,
    contentLength: options.contentLength ?? plan.contentLength,
    angleStrategy: options.angleStrategy ?? plan.angleStrategy,
  }));
}

function buildComparisonPlans(options: TopicPlannerOptions = {}): TopicPlan[] {
  return withOptions(
    [
      {
        id: "topic-competitor-choice",
        angleLabel: "为什么选择我们的产品",
        angleType: "competitor",
        reason: "产品处在成熟赛道,用户会自然拿它和已有工具比较,需要先回答选型理由。",
        promptInstruction:
          "从读者的选型困惑切入:为什么不继续用熟悉的工具。围绕价格、生态、使用门槛、协作方式和数据沉淀解释为什么选择 JOTO 产品。不得编造竞品事实、客户或数据。",
        sourceNeedLevel: "high",
      },
      {
        id: "topic-pricing-ecosystem",
        angleLabel: "价格与生态对比",
        angleType: "pricing",
        reason: "成熟产品的购买决策常被预算、生态兼容和迁移成本影响。",
        promptInstruction:
          "围绕预算、账号体系、生态集成、迁移成本和长期维护展开,讲清 JOTO 产品怎样让组织更容易开始使用。没有明确价格素材时不要编造金额。",
        sourceNeedLevel: "medium",
      },
      {
        id: "topic-replacement",
        angleLabel: "从旧工具迁移到新工作流",
        angleType: "product_diff",
        reason: "用户已有旧工具时,最关心新产品是否值得替换现有流程。",
        promptInstruction:
          "用旧工具流程和新工作流做对照,每节写一个用户动作变化:少切换、少整理、少等待、少返工。",
        sourceNeedLevel: "medium",
      },
      {
        id: "topic-traditional-alternative",
        angleLabel: "传统方案到底卡在哪里",
        angleType: "product_diff",
        reason: "没有明确竞品素材时,用传统方案对比更安全,也更容易让读者理解差异。",
        promptInstruction:
          "只和传统方案做克制对比,写清旧流程里的切换、等待、重复录入和协作断点,再说明 JOTO 产品如何减少这些动作。",
        sourceNeedLevel: "low",
      },
      {
        id: "topic-easy-story",
        angleLabel: "一个普通用户为什么会用它",
        angleType: "education",
        reason: "成熟赛道也需要把差异讲成普通读者能理解的日常故事。",
        promptInstruction:
          "用一个匿名普通用户的日常工作开头,按使用前、第一次使用、用完后的感受写,不要写真实客户案例或虚构指标。",
        sourceNeedLevel: "low",
      },
    ],
    options
  );
}

function buildEducationPlans(options: TopicPlannerOptions = {}): TopicPlan[] {
  return withOptions(
    [
      {
        id: "topic-why-need",
        angleLabel: "为什么需要这个产品",
        angleType: "education",
        reason: "产品概念较新,用户未必知道问题存在,需要先做需求教育。",
        promptInstruction:
          "不要直接推销功能。先写目标用户在真实工作中的低效、反复和不可控,再解释为什么需要一个新的产品来改变这件事。",
        sourceNeedLevel: "low",
      },
      {
        id: "topic-scenario-education",
        angleLabel: "使用场景教育",
        angleType: "scenario",
        reason: "新概念产品需要用场景把抽象价值翻译成可感知的工作变化。",
        promptInstruction:
          "选择 3 个常见使用场景,每个场景按人物、任务、卡点、产品介入、结果变化来写。场景可以匿名泛化,不得写成真实客户案例。",
        sourceNeedLevel: "low",
      },
      {
        id: "topic-product-intro",
        angleLabel: "产品介绍",
        angleType: "product_intro",
        reason: "用户建立需求认知后,需要一篇清楚说明产品是什么的基础文章。",
        promptInstruction:
          "讲清产品是什么、给谁用、入口在哪里、第一次使用会发生什么,避免术语堆叠。",
        sourceNeedLevel: "low",
      },
      {
        id: "topic-workflow-before-after",
        angleLabel: "使用前后对比",
        angleType: "product_diff",
        reason: "新产品的价值最容易通过工作流变化被理解。",
        promptInstruction:
          "用使用前和使用后的工作流做对照,突出协作、确定性和少返工的变化。没有素材时不得新增具体时间或百分比。",
        sourceNeedLevel: "medium",
      },
      {
        id: "topic-first-try",
        angleLabel: "第一次怎么用它",
        angleType: "education",
        reason: "低认知产品需要降低上手门槛,让读者知道从哪里开始试。",
        promptInstruction:
          "把第一次使用写成 3-5 个自然动作,从一个小任务开始,讲清读者如何把材料、流程或需求交给产品处理。",
        sourceNeedLevel: "low",
      },
    ],
    options
  );
}

function buildScenarioPlans(options: TopicPlannerOptions = {}): TopicPlan[] {
  return withOptions(
    [
      {
        id: "topic-office-moment",
        angleLabel: "一个办公室里的真实卡点",
        angleType: "scenario",
        reason: "场景痛点适合用轻松故事开篇,让 IT、运营和白领读者更容易读下去。",
        promptInstruction:
          "从一个办公室里的具体工作瞬间写起,用角色、任务和卡点带出产品。少讲概念,多写用户动作和工作变化。",
        sourceNeedLevel: "low",
      },
      {
        id: "topic-small-task-start",
        angleLabel: "从一个小任务开始试用",
        angleType: "education",
        reason: "轻量内容需要降低阅读和试用门槛,不要一上来讲体系。",
        promptInstruction:
          "围绕一个小任务展开,写清传统做法的麻烦、产品介入方式和读者可以马上尝试的一步。",
        sourceNeedLevel: "low",
      },
      {
        id: "topic-before-coffee",
        angleLabel: "这件事本来不该耗一上午",
        angleType: "scenario",
        reason: "水文短稿更适合抓住一个日常抱怨,再自然引出产品。",
        promptInstruction:
          "用轻松但克制的公众号语气写一个日常卡顿,重点写少切换、少追问、少整理,不要编造效率数字。",
        sourceNeedLevel: "low",
      },
      {
        id: "topic-team-handoff",
        angleLabel: "团队交接为什么总丢信息",
        angleType: "product_diff",
        reason: "交接、协作和版本断点是多数工具类产品都能承接的通用场景。",
        promptInstruction:
          "从团队交接和信息断点切入,写清产品如何让上下文更集中、责任更清楚、后续动作更顺。",
        sourceNeedLevel: "medium",
      },
      {
        id: "topic-friendly-intro",
        angleLabel: "给同事解释这个产品",
        angleType: "product_intro",
        reason: "场景偏好也需要一篇像对同事解释一样的基础介绍稿。",
        promptInstruction:
          "像给同事解释一个新工具一样写:它是什么、适合哪个任务、第一次怎么试、适合谁先用。",
        sourceNeedLevel: "low",
      },
    ],
    options
  );
}

function buildTrendPlans(options: TopicPlannerOptions = {}): TopicPlan[] {
  return withOptions(
    [
      {
        id: "topic-trend-material",
        angleLabel: "热点背后的工作方式变化",
        angleType: "trend",
        reason: "热点素材适合先讲行业事件背后的矛盾,再接到产品观点。",
        promptInstruction:
          "只有素材包提供热点信息时才复述事件;否则写成趋势观察。先讲行业变化,再解释产品如何回应这种变化。",
        sourceNeedLevel: "high",
      },
      {
        id: "topic-trend-vs-reality",
        angleLabel: "热闹概念和真实落地之间",
        angleType: "trend",
        reason: "热点文章需要避免跟风,更适合把概念拉回真实工作场景。",
        promptInstruction:
          "对比热闹概念与一线工作里的真实卡点,讲清产品能解决哪一小段具体流程,不得编造新闻事实。",
        sourceNeedLevel: "high",
      },
      {
        id: "topic-why-now",
        angleLabel: "为什么现在值得关注",
        angleType: "education",
        reason: "趋势切入后仍要回答读者为什么现在应该了解这个产品。",
        promptInstruction:
          "从工作方式变化切入,解释为什么这个产品不是噱头,而是某类重复工作变得可以被重新组织。",
        sourceNeedLevel: "medium",
      },
      {
        id: "topic-old-new-workflow",
        angleLabel: "旧流程正在被改写",
        angleType: "product_diff",
        reason: "趋势观点需要落到旧流程和新流程的具体差异。",
        promptInstruction:
          "写旧流程与新流程的对照,每段只讲一个动作变化,不要写泛泛的宏大判断。",
        sourceNeedLevel: "medium",
      },
      {
        id: "topic-safe-choice",
        angleLabel: "怎么判断它适不适合你",
        angleType: "competitor",
        reason: "趋势内容最后需要回到选择标准,帮助用户克制判断。",
        promptInstruction:
          "写一组安全的选择标准:适合什么任务、不适合什么任务、需要补哪些素材才能判断。不得写绝对化承诺。",
        sourceNeedLevel: "low",
      },
    ],
    options
  );
}

export function buildFallbackTopicPlans(
  product: Pick<Product, "name" | "description" | "tags">,
  options: TopicPlannerOptions = {}
): TopicPlan[] {
  const strategy = options.angleStrategy ?? "auto";
  if (strategy === "comparison") return buildComparisonPlans(options);
  if (strategy === "education") return buildEducationPlans(options);
  if (strategy === "scenario") return buildScenarioPlans(options);
  if (strategy === "trend") return buildTrendPlans(options);

  const text = productText(product);
  const isMature = includesAny(text, MATURE_MARKET_KEYWORDS);
  const isNewConcept = includesAny(text, NEW_CONCEPT_KEYWORDS) && !isMature;

  if (isMature) {
    return buildComparisonPlans(options);
  }

  if (isNewConcept) {
    return buildEducationPlans(options);
  }

  return withOptions([
    {
      id: "topic-product-intro",
      angleLabel: "产品介绍",
      angleType: "product_intro",
      reason: "需要先讲清产品是什么、解决谁的问题、怎么用。",
      promptInstruction:
        "从目标用户的一天开场,讲清产品定位、核心能力、典型使用动作和为什么值得试。不要编造客户和量化结果。",
      sourceNeedLevel: "low",
    },
    {
      id: "topic-product-diff",
      angleLabel: "为什么选我们",
      angleType: "product_diff",
      reason: "产品需要和传统做法建立清晰差异,避免只写功能说明。",
      promptInstruction:
        "围绕旧流程与新流程的变化展开,回答为什么选这个产品而不是继续沿用传统做法。只写流程差异和体验变化,不编造效果数据。",
      sourceNeedLevel: "medium",
    },
    {
      id: "topic-why-need",
      angleLabel: "为什么要用这个产品",
      angleType: "education",
      reason: "低认知或泛用产品需要先让用户意识到这个问题值得解决。",
      promptInstruction:
        "开头放一个日常工作钩子,中间解密这个产品解决的真实卡点,结尾写读者可以从哪个小任务开始试用。",
      sourceNeedLevel: "low",
    },
    {
      id: "topic-competitor",
      angleLabel: "传统方案对比",
      angleType: "competitor",
      reason: "即使没有明确竞品,也可以和传统方案比较,讲清变化。",
      promptInstruction:
        "只和传统方案做克制对比,不编造具体竞品事实,重点写流程差异和适用场景。",
      sourceNeedLevel: "high",
    },
    {
      id: "topic-trend",
      angleLabel: "趋势观察",
      angleType: "trend",
      reason: "趋势视角能帮助用户理解产品为什么现在值得关注。",
      promptInstruction:
        "从行业变化和组织效率切入,把产品放进更大的工作方式变化里讨论。",
      sourceNeedLevel: "medium",
    },
  ], options);
}

export function coerceTopicPlans(
  input: unknown,
  product: Pick<Product, "name" | "description" | "tags">,
  options: TopicPlannerOptions = {}
): TopicPlan[] {
  const fallback = buildFallbackTopicPlans(product, options);
  if (!Array.isArray(input)) return fallback;

  const parsed = uniquePlans(
    input.map((item, idx): TopicPlan => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        id:
          typeof row.id === "string" && row.id.trim()
            ? row.id.trim()
            : `topic-ai-${idx + 1}`,
        angleLabel:
          typeof row.angleLabel === "string" && row.angleLabel.trim()
            ? row.angleLabel.trim()
            : fallback[idx]?.angleLabel ?? `选题 ${idx + 1}`,
        angleType:
          typeof row.angleType === "string"
            ? (row.angleType as TopicPlan["angleType"])
            : fallback[idx]?.angleType ?? "product_intro",
        reason:
          typeof row.reason === "string" && row.reason.trim()
            ? row.reason.trim()
            : fallback[idx]?.reason ?? "根据产品资料选择。",
        promptInstruction:
          typeof row.promptInstruction === "string" && row.promptInstruction.trim()
            ? row.promptInstruction.trim()
            : fallback[idx]?.promptInstruction ?? fallback[0].promptInstruction,
        sourceNeedLevel:
          row.sourceNeedLevel === "high" ||
          row.sourceNeedLevel === "medium" ||
          row.sourceNeedLevel === "low"
            ? row.sourceNeedLevel
            : fallback[idx]?.sourceNeedLevel ?? "medium",
        contentLength: options.contentLength,
        angleStrategy: options.angleStrategy,
      };
    })
  );

  if (parsed.length >= 5) return parsed.slice(0, 5);

  const merged = uniquePlans([...parsed, ...fallback]);
  return merged.length >= 5 ? merged.slice(0, 5) : fallback;
}
