import { NextRequest, NextResponse } from "next/server";
import type {
  Product,
  ProductUnderstanding,
  ProductUnderstandingConfidence,
  ProductUnderstandingEntry,
  ProductUnderstandingEvidence,
  ProductUnderstandingEvidenceSource,
} from "@/types";
import { completeChat, QwenAuthError } from "@/lib/qwen";
import { buildFallbackUnderstanding } from "@/lib/productCatalog";
import { getDeepSeekChatOptions } from "@/lib/deepseek";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PDF_PROMPT_TEXT_LIMIT = 12_000;

const KNOWN_CORE_FUNCTIONS = [
  "趋势观察",
  "灵感筛选",
  "花型生成",
  "版型预览",
  "Tech Pack",
  "虚拟试穿",
  "三视图生成",
  "广告图生成",
  "自然语言驱动设计",
  "快速衍生设计",
  "交互式设计画板",
  "品牌风格一致性",
  "动态知识库",
  "统一解析",
  "精准调用",
  "知识驱动",
  "浏览器自动化",
  "自动化任务",
  "数据分析",
  "评论分析",
  "客户反馈",
];

const KNOWN_TARGET_CUSTOMERS = [
  "服装品牌",
  "设计团队",
  "设计主管",
  "设计师",
  "快时尚品牌",
  "独立设计师品牌",
  "代工厂 / ODM",
  "代工厂/ODM",
  "电商服装卖家",
  "运营团队",
  "产品经理",
  "市场团队",
  "IT 团队",
  "网络工程师",
  "SRE 团队",
];

const KNOWN_PAIN_PATTERNS = [
  { match: ["不该这么慢", "慢"], text: "传统流程推进慢,从调研到确认需要较长周期" },
  { match: ["工具切换", "流程割裂"], text: "工作分散在多个工具里,切换和整理成本高" },
  { match: ["反复修改", "反复讨论"], text: "方案确认需要多轮反复讨论和修改" },
  { match: ["经验判断", "不确定"], text: "依赖经验判断,结果不确定且难量化" },
  { match: ["手动", "耗时"], text: "大量重复操作需要人工手动完成" },
  { match: ["散落", "群聊"], text: "资料散落在文件和沟通渠道中,交付信息不集中" },
  { match: ["打样", "等待"], text: "依赖线下打样或等待反馈,试错成本较高" },
  { match: ["库存风险"], text: "选款缺少数据支撑时容易带来库存风险" },
];

const KNOWN_ALTERNATIVES = [
  { match: ["传统设计流程", "传统流程"], text: "传统人工设计流程" },
  { match: ["多平台", "工具切换"], text: "多个平台和工具来回切换" },
  { match: ["PS/AI", "手动绘制"], text: "用 PS、AI 等设计软件手动绘制和改稿" },
  { match: ["Excel", "手工填写"], text: "用 Excel 或文档手工整理版单和交付信息" },
  { match: ["外包", "摄影", "修图"], text: "依赖外包摄影、修图或人工制作营销物料" },
  { match: ["凭经验", "经验判断"], text: "靠经验做趋势判断和选款决策" },
];

const KNOWN_AFTER_USE_CHANGES = [
  { match: ["趋势观察", "灵感筛选", "花型生成"], text: "从趋势观察、灵感筛选到方案生成可以集中在同一流程里完成" },
  { match: ["Tech Pack", "版单"], text: "设计确认后可以整理为更适合交付工厂的 Tech Pack 或版单资料" },
  { match: ["虚拟试穿", "版型预览"], text: "设计在打样前可以先通过预览或虚拟试穿降低试错成本" },
  { match: ["三视图生成"], text: "概念图可以进一步转成正面、背面、侧面的技术款式图" },
  { match: ["广告图生成", "营销物料"], text: "设计稿可以继续生成广告图等营销物料" },
  { match: ["知识库", "精准调用"], text: "生成过程可以受行业知识、版型规范或品牌偏好约束" },
  { match: ["自动化", "Agent"], text: "重复操作可以交给自动化能力或 Agent 处理" },
  { match: ["数据分析", "评论分析"], text: "用户反馈可以被集中分析,用于定位问题和优化方向" },
];

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

function materialText(body: UnderstandRequest): string {
  return [
    body.product.sourcePack?.websiteNotes,
    body.product.sourcePack?.pdfNotes,
    body.product.sourcePack?.mediaNotes,
    body.product.sourcePack?.productNotes,
    body.websiteNotes,
    body.pdfText,
    body.mediaNotes,
    body.extraNotes,
    body.product.description,
    ...(body.product.sourceMediaAssets ?? [])
      .filter((asset) => asset.fileType === "image")
      .map((asset) => [asset.caption, asset.analysis].filter(Boolean).join(" ")),
  ]
    .filter(Boolean)
    .join("\n");
}

function sourceLabelFor(body: UnderstandRequest): string {
  const labels: string[] = [];
  if (body.websiteNotes?.trim() || body.product.sourcePack?.websiteNotes?.trim()) {
    labels.push("官网资料");
  }
  if (body.pdfText?.trim() || body.product.sourcePack?.pdfNotes?.trim()) {
    labels.push("PDF资料");
  }
  if (body.mediaNotes?.trim() || body.product.sourcePack?.mediaNotes?.trim()) {
    labels.push("截图资料");
  }
  if (body.extraNotes?.trim() || body.product.sourcePack?.productNotes?.trim()) {
    labels.push("人工补充");
  }
  return labels.join("、") || "产品资料";
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function uniqueTexts<T extends { text: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = item.text.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function makeEntry(
  text: string,
  confidence: ProductUnderstandingConfidence,
  basis: string
): ProductUnderstandingEntry {
  return { text, confidence, basis };
}

function knownTermEntries(
  material: string,
  terms: string[],
  basis: string,
  limit: number
): ProductUnderstandingEntry[] {
  return uniqueTexts(
    terms
      .filter((term) => material.includes(term))
      .map((term) => makeEntry(term, "explicit", basis))
  ).slice(0, limit);
}

function patternEntries(
  material: string,
  patterns: Array<{ match: string[]; text: string }>,
  basis: string,
  limit: number
): ProductUnderstandingEntry[] {
  return uniqueTexts(
    patterns
      .filter((pattern) => includesAny(material, pattern.match))
      .map((pattern) => makeEntry(pattern.text, "explicit", basis))
  ).slice(0, limit);
}

function firstMaterialSentence(material: string): string {
  const labelPattern =
    /^官网链接|页面标题|页面描述|页面解析质量|页面核心线索|页面可读文本片段/;
  const preferredFragment = material
    .split(/[。！？!?；;\n/]/)
    .map((item) => item.trim())
    .find(
      (item) =>
        item.length >= 18 &&
        /是专为|是面向|是一款|是给|是为/.test(item) &&
        !labelPattern.test(item)
    );
  if (preferredFragment) return preferredFragment;

  const preferred = material.match(
    /(?:是专为|是面向|是一款|是给|是为)[^。！？!?；;\n/]{12,180}/
  )?.[0]?.trim();
  if (
    preferred &&
    !labelPattern.test(preferred)
  ) {
    return preferred;
  }
  const sentence = material
    .split(/[。！？!?；;\n]/)
    .map((item) => item.trim())
    .find(
      (item) =>
        item.length >= 18 &&
        !labelPattern.test(item)
    );
  return sentence ?? "";
}

function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function buildFallbackDefinition(product: Product, materialSentence: string): string {
  if (!materialSentence) {
    return `${product.name} 是一款需要继续补充资料的产品。当前产品卡为系统根据已有资料生成的保守理解,所有不确定内容已标注为推测。`;
  }
  const sentence = materialSentence.slice(0, 180);
  return normalizeForMatch(sentence).includes(normalizeForMatch(product.name))
    ? sentence
    : `${product.name}：${sentence}`;
}

function buildMaterialFallbackUnderstanding(
  body: UnderstandRequest
): ProductUnderstanding {
  const product = body.product;
  const material = materialText(body);
  const basis = sourceLabelFor(body);
  const base = buildFallbackUnderstanding({
    ...product,
    sourcePack: {
      ...product.sourcePack,
      websiteNotes: [product.sourcePack?.websiteNotes, body.websiteNotes]
        .filter(Boolean)
        .join("\n"),
      pdfNotes: [product.sourcePack?.pdfNotes, body.pdfText]
        .filter(Boolean)
        .join("\n"),
      mediaNotes: [product.sourcePack?.mediaNotes, body.mediaNotes]
        .filter(Boolean)
        .join("\n"),
      productNotes: [product.sourcePack?.productNotes, body.extraNotes]
        .filter(Boolean)
        .join("\n"),
    },
  })!;

  const materialSentence = firstMaterialSentence(material);
  const targetCustomers = [
    ...knownTermEntries(material, KNOWN_TARGET_CUSTOMERS, basis, 6),
    ...base.targetCustomers,
  ];
  const coreFunctions = [
    ...knownTermEntries(material, KNOWN_CORE_FUNCTIONS, basis, 8),
    ...base.coreFunctions,
  ];
  const painPoints = [
    ...patternEntries(material, KNOWN_PAIN_PATTERNS, basis, 8),
    ...base.painPoints,
  ];
  const traditionalAlternatives = [
    ...patternEntries(material, KNOWN_ALTERNATIVES, basis, 6),
    ...base.traditionalAlternatives,
  ];
  const afterUseChanges = [
    ...patternEntries(material, KNOWN_AFTER_USE_CHANGES, basis, 8),
    ...base.afterUseChanges,
  ];
  const evidence: ProductUnderstandingEvidence[] = uniqueTexts([
    ...knownTermEntries(material, KNOWN_CORE_FUNCTIONS, basis, 8).map((entry) => ({
      sourceType: body.websiteNotes?.trim() ? "website" : "manual",
      sourceLabel: basis,
      text: `资料明确出现「${entry.text}」。`,
    }) satisfies ProductUnderstandingEvidence),
    ...base.evidence,
  ]).slice(0, 12);

  return {
    definition: buildFallbackDefinition(product, materialSentence),
    coreFunctions: uniqueTexts(coreFunctions).slice(0, 8),
    targetCustomers: uniqueTexts(targetCustomers).slice(0, 6),
    painPoints: uniqueTexts(painPoints).slice(0, 8),
    traditionalAlternatives: uniqueTexts(traditionalAlternatives).slice(0, 6),
    afterUseChanges: uniqueTexts(afterUseChanges).slice(0, 8),
    evidence,
    writingBoundaries: [
      "未提供真实客户资料,不得写客户名称或客户案例。",
      "未提供可核验效果数据,不得写百分比、金额、客户数量或节省时间。",
      "未提供真实截图流程,不得写按钮名称、后台路径或具体点击步骤。",
      "官网/PDF没有明确写到的功能,只能作为推测,不能写成确定事实。",
      ...base.writingBoundaries,
    ].slice(0, 8),
    questionsToAsk: uniqueTexts(
      [
        makeEntry("是否有真实客户案例或行业客户可以写?", "inferred", "资料缺口"),
        makeEntry("哪些功能已经上线,哪些仍是演示或规划?", "inferred", "资料缺口"),
        makeEntry("有没有可公开引用的效果数据或交付指标?", "inferred", "资料缺口"),
        makeEntry("最希望文章强调的目标客户是哪一类?", "inferred", "资料缺口"),
      ].map((entry) => ({ text: entry.text }))
    )
      .map((entry) => entry.text)
      .slice(0, 8),
    generatedAt: new Date().toISOString(),
    source: "fallback",
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];
}

function hasV2UnderstandingShape(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const row = input as Record<string, unknown>;
  return (
    typeof row.definition === "string" ||
    Array.isArray(row.coreFunctions) ||
    Array.isArray(row.targetCustomers) ||
    Array.isArray(row.painPoints) ||
    Array.isArray(row.traditionalAlternatives) ||
    Array.isArray(row.afterUseChanges) ||
    Array.isArray(row.evidence) ||
    Array.isArray(row.writingBoundaries) ||
    Array.isArray(row.questionsToAsk)
  );
}

function normalizeConfidence(value: unknown): ProductUnderstandingConfidence {
  return value === "explicit" || value === "inferred" ? value : "inferred";
}

function asEntryArray(
  value: unknown,
  fallback: ProductUnderstandingEntry[]
): ProductUnderstandingEntry[] {
  if (!Array.isArray(value)) return fallback;
  const entries = value
    .map((item): ProductUnderstandingEntry | null => {
      if (typeof item === "string" && item.trim()) {
        return { text: item.trim(), confidence: "inferred" };
      }
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.text !== "string" || !row.text.trim()) return null;
      return {
        text: row.text.trim(),
        confidence: normalizeConfidence(row.confidence),
        basis:
          typeof row.basis === "string" && row.basis.trim()
            ? row.basis.trim()
            : undefined,
      };
    })
    .filter((item): item is ProductUnderstandingEntry => Boolean(item))
    .slice(0, 8);
  return entries.length ? entries : fallback;
}

function normalizeEvidenceSource(
  value: unknown
): ProductUnderstandingEvidenceSource {
  return value === "product" ||
    value === "website" ||
    value === "pdf" ||
    value === "media" ||
    value === "manual" ||
    value === "inferred"
    ? value
    : "inferred";
}

function asEvidenceArray(
  value: unknown,
  fallback: ProductUnderstandingEvidence[]
): ProductUnderstandingEvidence[] {
  if (!Array.isArray(value)) return fallback;
  const evidence = value
    .map((item): ProductUnderstandingEvidence | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.text !== "string" || !row.text.trim()) return null;
      return {
        sourceType: normalizeEvidenceSource(row.sourceType),
        sourceLabel:
          typeof row.sourceLabel === "string" && row.sourceLabel.trim()
            ? row.sourceLabel.trim()
            : "未标注来源",
        text: row.text.trim(),
      };
    })
    .filter((item): item is ProductUnderstandingEvidence => Boolean(item))
    .slice(0, 12);
  return evidence.length ? evidence : fallback;
}

function coerceUnderstanding(input: unknown, product: Product): ProductUnderstanding {
  const fallback = buildFallbackUnderstanding(product)!;
  const row = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    definition:
      typeof row.definition === "string" && row.definition.trim()
        ? row.definition.trim()
        : fallback.definition,
    coreFunctions: asEntryArray(row.coreFunctions, fallback.coreFunctions),
    targetCustomers: asEntryArray(row.targetCustomers, fallback.targetCustomers),
    painPoints: asEntryArray(row.painPoints, fallback.painPoints),
    traditionalAlternatives: asEntryArray(
      row.traditionalAlternatives,
      fallback.traditionalAlternatives
    ),
    afterUseChanges: asEntryArray(row.afterUseChanges, fallback.afterUseChanges),
    evidence: asEvidenceArray(row.evidence, fallback.evidence),
    writingBoundaries: asStringArray(row.writingBoundaries).length
      ? asStringArray(row.writingBoundaries)
      : fallback.writingBoundaries,
    questionsToAsk: asStringArray(row.questionsToAsk).length
      ? asStringArray(row.questionsToAsk)
      : fallback.questionsToAsk,
    generatedAt: new Date().toISOString(),
    source: "deepseek",
  };
}

function hasRichMaterial(body: UnderstandRequest): boolean {
  const text = [
    body.websiteNotes,
    body.pdfText,
    body.mediaNotes,
    body.extraNotes,
    body.product.description,
  ]
    .filter(Boolean)
    .join("\n");
  return text.length >= 600;
}

function countUsefulEntries(entries: ProductUnderstandingEntry[]): number {
  return entries.filter(
    (entry) =>
      entry.text.trim() &&
      !/需要(用户)?(进一步)?(补充|确认)|资料不足|无法确认/.test(entry.text)
  ).length;
}

function validateUnderstandingQuality(
  understanding: ProductUnderstanding,
  body: UnderstandRequest
) {
  if (!hasRichMaterial(body)) return;

  const missing: string[] = [];
  if (countUsefulEntries(understanding.coreFunctions) < 4) missing.push("核心功能");
  if (countUsefulEntries(understanding.targetCustomers) < 2)
    missing.push("目标客户/角色");
  if (countUsefulEntries(understanding.painPoints) < 3) missing.push("用户痛点");
  if (countUsefulEntries(understanding.traditionalAlternatives) < 2)
    missing.push("传统做法/替代方案");
  if (countUsefulEntries(understanding.afterUseChanges) < 3)
    missing.push("产品介入后的变化");
  if (understanding.evidence.length < 4) missing.push("可用证据");

  if (missing.length) {
    throw new Error(
      `产品理解卡内容太少,未充分使用已有官网/PDF资料。缺少: ${missing.join("、")}`
    );
  }
}

function buildPrompt(body: UnderstandRequest) {
  const product = body.product;
  const system = [
    "你是 JOTO 内容工厂的产品资料分析助手。",
    "任务不是写公众号文章,而是帮助用户理解产品,形成后续写文章可用的产品卡 V2。",
    "只能基于用户给出的产品名、简介、官网备注、PDF 摘要和补充说明,不得编造客户、价格、数据或功能。",
    "你要区分资料明确写到的内容和根据材料推测的内容;推测必须标记为 inferred。",
    "如果官网或 PDF 已经提供大量产品模块,必须充分提取,不要只摘产品一句话简介。",
    "不得用「需要补充」「需要进一步确认」替代已有材料中已经写明的功能、场景、流程或变化。",
    "处理方式要接近产品内容资料库整理:先理解资料,再归纳成稳定事实,最后映射为产品卡字段。",
    "不要输出 contentAngles、写作方向、标题建议或营销口号。",
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
    body.pdfText?.trim().slice(0, PDF_PROMPT_TEXT_LIMIT) ||
      "未提供或无法读取",
    "",
    "【截图理解素材】",
    [
      body.mediaNotes?.trim(),
      ...(product.sourceMediaAssets ?? [])
        .filter((asset) => asset.fileType === "image")
        .map((asset) =>
          [
            `截图：${asset.caption || asset.fileName}`,
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
    "请先整理一张产品内容资料库,但不要把资料库作为单独字段输出;你要在心里完成整理,再把结果映射为 V2 字段。",
    "资料库必须覆盖这些栏目:",
    "- 产品基本信息: 产品名称、产品定义、核心定位、可确认的一句话描述",
    "- 目标用户: 直接用户、管理者/决策者、业务团队、技术/交付团队;如果官网出现角色名称必须提取",
    "- 用户痛点: 资料中出现的问题所在、困境、慢、乱、不确定、工具割裂、重复劳动、沟通成本",
    "- 核心功能: 按官网模块拆分,不要只摘英文简介;例如趋势观察、灵感筛选、生成、预览、导出、分析、知识库等",
    "- 典型场景: 从观察、筛选、生成、确认、交付、复用等流程提炼真实工作场景",
    "- 主流替代方案: 传统人工流程、Excel/PPT/设计软件/脚本/传统系统/外包/多工具拼接等,必须基于资料保守推导",
    "- 产品介入后的变化: 信息集中、流程变短、协作更清楚、输出更可交付、重复操作减少;无数据时只写定性变化",
    "- 可用证据: 每条证据标注来自官网、PDF、截图视频或人工补充",
    "- 写作禁区: 未给客户就不写客户,未给数据就不写百分比,未给截图流程就不写按钮路径",
    "",
    "再把资料库映射为 V2 字段。映射关系:",
    "- 产品基本信息 -> definition",
    "- 核心功能 -> coreFunctions",
    "- 目标用户 -> targetCustomers",
    "- 用户痛点 -> painPoints",
    "- 主流替代方案 -> traditionalAlternatives",
    "- 产品介入后的变化 -> afterUseChanges",
    "- 可用证据 -> evidence",
    "- 写作禁区 -> writingBoundaries",
    "- 资料库仍缺的关键信息 -> questionsToAsk",
    "",
    "请输出严格 JSON 对象,不要解释文字。字段:",
    "- definition: 80-180 字中文产品定义。写清给谁用、处理什么、产出什么;朴素表达,不要营销腔",
    "- coreFunctions: ProductUnderstandingEntry[] 核心功能点,4-8 项,每项必须是具体能力",
    "- targetCustomers: ProductUnderstandingEntry[] 目标客户/角色,3-6 项,区分 explicit 和 inferred",
    "- painPoints: ProductUnderstandingEntry[] 用户痛点,4-8 项,来自资料或保守推导",
    "- traditionalAlternatives: ProductUnderstandingEntry[] 传统做法/替代方案,3-6 项",
    "- afterUseChanges: ProductUnderstandingEntry[] 产品介入后的可确认变化,4-8 项,无数据时只写定性变化",
    "- evidence: ProductUnderstandingEvidence[] 可用证据,6-12 项,标注 sourceType、sourceLabel、text",
    "- writingBoundaries: string[] 禁写边界,4-8 条,例如没有客户不得写客户案例、没有数据不得写百分比、没有流程不得写按钮路径",
    "- questionsToAsk: string[] 资料不足时需要追问用户的问题,3-8 条",
    "",
    "生成质量要求:",
    "- 如果官网资料里出现产品模块、工作流程、应用场景、问题描述,必须拆进对应字段",
    "- 不要把英文简介原样拆成核心功能;要翻译成中文、业务可读的具体能力",
    "- 只有资料完全没有写明时,才允许写 questionsToAsk",
    "- 有充足官网资料时,targetCustomers、painPoints、traditionalAlternatives、afterUseChanges 不得为空",
    "",
    "ProductUnderstandingEntry 格式:{\"text\":\"...\",\"confidence\":\"explicit|inferred\",\"basis\":\"来源或推测依据\"}",
    "ProductUnderstandingEvidence 格式:{\"sourceType\":\"product|website|pdf|media|manual|inferred\",\"sourceLabel\":\"...\",\"text\":\"...\"}",
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
      ...getDeepSeekChatOptions(),
      temperature: 0.3,
      maxTokens: 2600,
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      signal: req.signal,
    });
    const parsed = extractJsonObject(raw);
    if (!parsed) {
      throw new Error("模型未返回可解析的产品理解卡 JSON");
    }
    if (!hasV2UnderstandingShape(parsed)) {
      throw new Error("模型未返回 V2 产品理解卡字段");
    }
    const understanding = coerceUnderstanding(parsed, body.product);
    validateUnderstandingQuality(understanding, body);
    return NextResponse.json({
      understanding,
      source: "deepseek",
    });
  } catch (err) {
    const understanding = buildMaterialFallbackUnderstanding(body);
    const reason =
      err instanceof QwenAuthError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return NextResponse.json({ understanding, source: "fallback", reason });
  }
}
