import { buildHotspotContractPrompt } from "@/lib/trendArticleContract";

type TrendPromptVars = Record<
  | "product"
  | "productDesc"
  | "angle"
  | "angleInstruction"
  | "sourcePack"
  | "lengthInstruction"
  | "styleName"
  | "styleProfile"
  | "styleSample"
  | "outline",
  string
>;

interface TrendTitlePromptInput {
  product: string;
  angle: string;
  styleName: string;
  body: string;
  sourceSummary?: string;
}

/**
 * 热点线 prompt — 2026-06 重写版。
 *
 * 设计原则(对照旧版 30+ 条禁令的"补丁式"写法):
 *   1. 正向指引为主:告诉模型"怎么写"而不是堆"不要写什么"——禁令迷宫是
 *      此前产出生硬、不流畅的主要原因
 *   2. 纪律收敛到少数硬条款(事实来源/不硬蹭/结构/排版),每条都可被验收
 *   3. 节奏显式化:长短句交替、一段 1-3 句、同一句式不复用,这些"流畅感"
 *      要素旧版完全没有正向描述
 */
export function buildTrendTitlePrompt(input: TrendTitlePromptInput) {
  return {
    model: "qwen-plus",
    temperature: 1.2,
    maxTokens: 700,
    system: [
      "你是公众号热点标题编辑,目标是让中国用户刷到会想点。",
      "",
      "好标题长这样:",
      "- 抓一个具体入口:评论区、Excel、截图、打工人、甲方、改稿、返工、平替、怎么选、避坑、先别急",
      "- 口语短句,像朋友转述一个最近刷到的离谱事,自然到不像标题",
      "- 可以不点名热点主角,用它带火的品类、平替、场景接流量。例:NotebookLM 火了,写「现在大家都在用哪些 AI 笔记本」",
      "- 围绕产品功能相关的热点噱头,但读起来不像广告、也不像行业报告",
      "",
      "纪律:",
      "1. 标题禁止出现本产品名,不把本产品或 JOTO 写成主角",
      "2. 每个标题 12-24 个汉字;不用冒号、破折号、感叹号、极限词、人物名",
      "3. 不用理解成本高的生僻梗(如又双叒叕、数字心跳);让人秒懂",
      "4. 蹭热点但内容要兑现得了,不标题党到失真;不写空泛观点句",
      "",
      '输出格式:只输出一行 JSON 数组,正好 5 个标题,例:["标题一","标题二","标题三","标题四","标题五"]。不要分行输出,不要任何其他文字。',
    ].join("\n"),
    user: [
      `禁用产品名:${input.product}`,
      `方向:${input.angle}`,
      `风格:${input.styleName}`,
      input.sourceSummary ? `热点来源摘要:${input.sourceSummary}` : "",
      `正文:${input.body}`,
      "",
      "为这篇正文生成 5 个热点噱头标题,每个抓一个不同的具体入口。",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

export function buildFallbackTrendTitles({
  product,
  angle,
  sourceSummary,
}: Pick<TrendTitlePromptInput, "product" | "angle"> & {
  sourceSummary?: string;
}): string[] {
  const seed = `${sourceSummary ?? ""} ${angle}`.toLowerCase();
  const isNotebook = /notebook\s*lm|notebooklm|ai\s*笔记|ai笔记|知识库|pdf/.test(seed);
  const isFashion = /fashion|apparel|garment|服装|时尚|穿搭|款式|版型|面料|花型|打版|试衣|设计/.test(seed);
  const hasCompetitor = /竞品|对比|功能|参数|官网|截图|表/.test(seed);
  const hasExcel = /excel|表格|功能表|参数/.test(seed);
  const hasComment = /评论|吐槽|争议|吵/.test(seed);

  const titles = isNotebook
    ? [
        "现在大家都在用哪些AI笔记本",
        "AI笔记工具怎么突然火了",
        "PDF总结工具到底怎么选",
        "开会记录终于不用手抄了?",
        "AI记事本别只看总结功能",
      ]
    : isFashion
      ? [
          "AI服装设计怎么突然火了",
          "设计稿改到崩溃的人懂了",
          "服装团队也开始找AI平替了",
          "AI试衣到底靠不靠谱",
          "快时尚为什么都在看AI工具",
        ]
    : [
        hasExcel ? "还在Excel里手抄功能表?" : "Excel都快被功能表整累了",
        hasComment ? "评论区吵翻的点,其实很真实" : "评论区吐槽的点,有点真实",
        hasCompetitor ? "截图抄竞品,真的有用吗" : "同类工具一多,人先烦了",
        "甲方要的对比,别再手搓了",
        "这种工具到底怎么选",
      ];

  return titles
    .map((title) => title.replaceAll(product, "").slice(0, 24))
    .slice(0, 5);
}

export function buildTrendPrompt(
  node: "outline" | "body",
  vars: Partial<TrendPromptVars>
) {
  const groundingRule =
    "每个关键段落都要有至少一个落地锚点:具体对象、用户动作、判断标准、交付物或流程节点。不要让「效率、体验、趋势、价值、赋能、升级」这类抽象词连续空转;每出现一个抽象判断,下一句就要落到用户正在看什么、改什么、确认什么、交付什么或决定什么。";
  const system = [
    "你是 JOTO 小信的产品团队公众号编辑,写给正在关注相关热点和工具选型的真实用户。",
    buildHotspotContractPrompt(),
    "",
    "这样写:",
    "- 第一屏先抓外部话题噱头:同类工具突然火了、一个被讨论的品类、一个选型困惑或一个真实使用风险,但不要写成猎奇吐槽",
    "- 前半段讲清用户为什么会关心这个热点;中段把热闹翻译成真实工作问题;后半段用产品团队视角说明我们如何理解和回应",
    "- 产品可以在中后段自然进入,但必须回应前面的用户问题;不得写成功能清单、参数堆叠或硬广价值论证",
    "- 不要编造第一人称经历、朋友吐槽、小红书刷帖现场、具体网友评论或私人聊天;素材没有就写成观察和判断",
    "- 专业词一出现就用用户动作接住:说清它改变了哪一步判断、减少了哪类反复、让哪个流程更容易落地",
    `- ${groundingRule}`,
    "- 允许使用 ## 小标题、> 重点句和少量列表来形成公众号阅读节奏;小标题必须推进观察,列表只用于判断维度或选择标准,不要变成功能卖点清单",
    "",
    "纪律(数量不多,必须遵守):",
    "1. 事实、时间、点赞数、销量等一切具体数字只用【素材】里有的;素材没有就不写数字,可以写「有网友说」「目前没有官方说法」",
    "2. 不编人名、客户故事、参数型号、版本号、朋友对话、平台评论;不写会议复盘和内部细节",
    "3. 热点素材和产品品类对不上时不硬蹭,改写成贴近产品垂类的同类工具、相似场景或用户困惑做开头噱头",
    "4. 标准稿按完整公众号文章展开,每一部分都必须提供新信息或新判断,不要重复同一个意思撑篇幅",
    "5. 不写来源链接、不插图、不写硬广 CTA;不用「钩子」「第一章」这类内部策划词",
  ].join("\n");

  const shared = [
    `产品:${vars.product ?? ""}`,
    `产品简介:${vars.productDesc ?? ""}`,
    `本篇方向:${vars.angle ?? ""}`,
    `方向说明:${vars.angleInstruction ?? ""}`,
    `长度要求:${vars.lengthInstruction ?? ""}`,
    `热点风格:${vars.styleName ?? "系统兜底"}`,
    `风格要求:${vars.styleProfile ?? ""}`,
    vars.styleSample ? `风格样本(模仿语气与节奏,不抄内容):${vars.styleSample}` : "",
    `素材:\n${vars.sourcePack ?? ""}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (node === "outline") {
    return {
      model: "qwen-plus",
      temperature: 0.6,
      maxTokens: 900,
      system,
      user: [
      shared,
      "写一份产品团队热点观察文大纲。",
      "必须顺着这个走向:热点现象 → 用户困惑 → 真实工作问题 → 产品团队视角 → 我们的回应 → 收束判断。",
      "每一行写清这一部分要回答什么问题,不要写成吐槽串联,也不要把产品提前写成功能清单。",
      "每一行都补一个落地锚点,写清这一部分会落到哪个具体对象、用户动作或判断标准上。",
    ].join("\n\n"),
    };
  }

  return {
    model: "qwen-plus",
    temperature: 0.74,
    maxTokens: 2600,
    system,
    user: [
      shared,
      `大纲:\n${vars.outline ?? ""}`,
      "按大纲写完整热点稿。",
      "前半段用热点现象和用户困惑打开阅读兴趣;中段说明这个热点落到真实工作里会变成什么问题;后半段写产品团队如何回应,也就是产品团队视角和我们的回应。",
      "产品团队视角要清楚:可以写「我们关注的是」「我们在产品里回应的是」「这也是我们做这个产品时反复处理的问题」。",
      "产品出现时只解释它承接了哪一段真实问题,不要罗列功能清单、参数、版本或夸张承诺。",
      "用小标题推进结构,可以穿插一两句重点句或少量列表,但不要把文章写成方案书。",
      "每个关键段落都检查至少一个落地锚点:具体对象、用户动作、判断标准、交付物或流程节点;没有锚点的空泛段落要重写。",
      "如果热点素材和产品品类/场景/相邻功能对不上,改写成更贴近产品垂类的同类话题做噱头。",
      "直接输出正文,不要任何说明文字。",
    ].join("\n\n"),
  };
}

export function fallbackTrendBody(
  vars: Pick<TrendPromptVars, "product" | "productDesc">
): string {
  const context = `${vars.product} ${vars.productDesc}`.toLowerCase();
  const isCrm = /scrm|crm|私域|客户|销售|跟进|营销/.test(context);
  const isFashion = /fashion|apparel|服装|时尚|款式|版型|面料|设计/.test(context);
  const concreteProblem = isCrm
    ? "比如客户消息散在不同入口,跟进记录没人及时补,下一步该找谁确认也不清楚。"
    : isFashion
      ? "比如参考图、款式方向、版型意见和修改记录分散在不同文件里,团队很难判断下一版到底改什么。"
      : "比如资料、截图、记录和待办分散在不同地方,团队很难判断下一步该确认什么。";
  const concreteResponse = isCrm
    ? "把客户消息、跟进记录和下一步动作放回同一条流程里,用户才知道哪里需要处理,哪里可以继续推进。"
    : isFashion
      ? "把参考图、款式判断和修改动作放回同一个流程里,团队才知道哪些方向能继续推进,哪些需要重来。"
      : "把对象、动作和判断标准放回同一条流程里,用户才知道哪里需要处理,哪里可以继续推进。";
  return [
    `最近同类工具、替代方案和相似题材被频繁讨论。作为产品团队,我们更关心的不是热度本身,而是这些讨论背后反复出现的用户问题。`,
    `很多团队点进这类话题,其实是在确认一件事:新的工具能不能真正落到日常流程里,减少判断、整理和反复确认的成本。${concreteProblem}`,
    `如果一个热点只能制造新鲜感,却不能解释真实工作里卡住的环节,它很快就会过去。真正值得讨论的是,这些变化会不会让用户少走一步弯路。`,
    `${vars.product} 要回应的也是这类问题:把热闹的话题放回具体任务里,看它能在哪个环节帮用户更清楚地判断、更稳地推进。${concreteResponse}`,
  ].join("\n\n");
}

export type { TrendPromptVars };
