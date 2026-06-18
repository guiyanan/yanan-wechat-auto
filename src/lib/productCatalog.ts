import type {
  ArticleSourceContext,
  Product,
  ProductSourcePack,
  ProductUnderstandingEntry,
  ProductUnderstandingEvidence,
} from "@/types";

export const GENERIC_JOTO_PRODUCT_ID = "prod-joto-general";

export const GENERIC_JOTO_PRODUCT: Product = {
  id: GENERIC_JOTO_PRODUCT_ID,
  name: "通用内容",
  description: "未绑定具体产品的 JOTO 公众号内容，用于粘贴文字排版和通用稿件整理。",
  tags: ["JOTO", "通用内容"],
  iconGradient: ["#0071e3", "#8e8e93"],
  knowledgeDocs: [],
};

export function mergeProducts(seed: Product[], custom: Product[]): Product[] {
  const byId = new Map<string, Product>();
  for (const product of seed) byId.set(product.id, product);
  for (const product of custom) {
    const existing = byId.get(product.id);
    byId.set(product.id, existing ? { ...existing, ...product } : product);
  }
  return Array.from(byId.values());
}

export function withGenericProduct(products: Product[]): Product[] {
  if (products.some((product) => product.id === GENERIC_JOTO_PRODUCT_ID)) {
    return products;
  }
  return [GENERIC_JOTO_PRODUCT, ...products];
}

export function productSourceToArticleContext(
  product: Product | null | undefined
): ArticleSourceContext {
  if (!product) {
    return {
      productNotes: "",
      mediaNotes: "",
    };
  }

  return {
    productNotes: buildUnifiedArticleMaterialPack(product),
    mediaNotes: "",
  };
}

export function hasProductMaterial(product: Product): boolean {
  const source: ProductSourcePack = product.sourcePack ?? {};
  return Boolean(
    product.website ||
      product.appUrl ||
      product.understanding?.definition ||
      source.productNotes?.trim() ||
      source.websiteNotes?.trim() ||
      source.pdfNotes?.trim() ||
      source.mediaNotes?.trim() ||
      product.knowledgeDocs.some((doc) => doc.extractedText?.trim()) ||
      (product.sourceMediaAssets?.length ?? 0) > 0 ||
      (product.imageAssets?.length ?? 0) > 0
  );
}

export function buildFallbackUnderstanding(product: Product): Product["understanding"] {
  const tags = product.tags.length ? product.tags.join("、") : "当前产品赛道";
  const coreFunctions = product.description
    .split(/[，,、；;。\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((text) => ({
      text,
      confidence: "explicit" as const,
      basis: "产品简介",
    }));
  return {
    definition: `${product.name} 是一款围绕「${tags}」展开的产品。目前可确认的基础描述是：${product.description}。在补充更多资料前,只能围绕这条基础描述做保守理解。`,
    targetCustomers: product.tags.length
      ? product.tags.slice(0, 4).map((tag) => ({
          text: `${tag} 相关团队`,
          confidence: "inferred" as const,
          basis: "根据产品标签保守推测",
        }))
      : [
          {
            text: "需要用户补充目标客户或目标角色",
            confidence: "inferred" as const,
            basis: "产品资料不足",
          },
        ],
    coreFunctions,
    painPoints: [
      {
        text: "需要进一步确认用户在真实工作中的具体麻烦",
        confidence: "inferred",
        basis: "产品资料不足",
      },
    ],
    traditionalAlternatives: [
      {
        text: "需要进一步确认传统做法或替代方案",
        confidence: "inferred",
        basis: "产品资料不足",
      },
    ],
    afterUseChanges: [
      {
        text: "只能写产品描述可合理支持的定性变化,不得写具体数据",
        confidence: "inferred",
        basis: "产品资料不足",
      },
    ],
    evidence: [
      {
        sourceType: "product",
        sourceLabel: "产品简介",
        text: product.description,
      },
    ],
    writingBoundaries: [
      "未提供真实客户资料,不得写客户名称或客户案例。",
      "未提供效果数据,不得写百分比、金额、节省时间或客户数量。",
      "未提供真实流程或截图说明,不得写按钮名称、后台路径或具体点击步骤。",
      "未提供金融客户资料,不得写银行、券商、保险等金融客户正在使用。",
    ],
    questionsToAsk: [
      "这个产品最典型的真实使用场景是什么?",
      "主要目标客户或目标角色是谁?",
      "传统做法或替代方案是什么?",
      "是否有可确认的客户案例、行业客户或效果数据?",
      "是否有真实截图、视频或流程说明可以支撑具体操作描写?",
    ],
    generatedAt: new Date().toISOString(),
    source: "fallback",
  };
}

function formatUnderstandingEntries(
  label: string,
  entries: ProductUnderstandingEntry[]
): string {
  if (!entries.length) return "";
  const text = entries
    .map((entry) => {
      const suffix = [
        entry.confidence === "explicit" ? "明确" : "推测",
        entry.basis,
      ]
        .filter(Boolean)
        .join("/");
      return suffix ? `${entry.text}（${suffix}）` : entry.text;
    })
    .join("；");
  return `${label}：${text}`;
}

function formatInferredEntries(
  label: string,
  entries: ProductUnderstandingEntry[]
): string {
  return formatUnderstandingEntries(
    label,
    entries.filter((entry) => entry.confidence === "inferred")
  );
}

function formatExplicitEntries(
  label: string,
  entries: ProductUnderstandingEntry[]
): string {
  return formatUnderstandingEntries(
    label,
    entries.filter((entry) => entry.confidence === "explicit")
  );
}

function formatUnderstandingEvidence(
  evidence: ProductUnderstandingEvidence[]
): string {
  if (!evidence.length) return "";
  return `可用证据：${evidence
    .map((item) => `${item.sourceLabel}：${item.text}`)
    .join("；")}`;
}

function sourceMediaEvidence(product: Product): string {
  return (product.sourceMediaAssets ?? [])
    .filter((asset) => asset.fileType === "image")
    .map((asset, index) =>
      [
        `${index + 1}. 截图：${asset.caption || asset.fileName}`,
        asset.analysis ? `系统理解：${asset.analysis}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function screenshotMediaNotes(notes: string | undefined): string {
  return (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("视频素材"))
    .join("\n");
}

export function buildUnifiedArticleMaterialPack(product: Product): string {
  const source = product.sourcePack ?? {};
  const understanding = product.understanding;
  const rawSourceFacts = understanding
    ? []
    : [
        source.productNotes ? `人工补充：${source.productNotes}` : "",
        source.websiteNotes ? `官网补充：${source.websiteNotes}` : "",
        source.pdfNotes ? `PDF 摘要：${source.pdfNotes}` : "",
        screenshotMediaNotes(source.mediaNotes)
          ? `截图理解素材：${screenshotMediaNotes(source.mediaNotes)}`
          : "",
        sourceMediaEvidence(product),
      ];
  const writableFacts = [
    `产品名称：${product.name}`,
    product.description ? `产品简介：${product.description}` : "",
    product.website ? `官网链接：${product.website}` : "",
    product.appUrl ? `产品前端/演示页面：${product.appUrl}` : "",
    understanding?.definition ? `产品定义：${understanding.definition}` : "",
    understanding
      ? formatExplicitEntries("目标客户/角色", understanding.targetCustomers)
      : "",
    understanding
      ? formatExplicitEntries("核心功能", understanding.coreFunctions)
      : "",
    understanding ? formatExplicitEntries("用户痛点", understanding.painPoints) : "",
    understanding
      ? formatExplicitEntries(
          "传统做法/替代方案",
          understanding.traditionalAlternatives
        )
      : "",
    understanding
      ? formatExplicitEntries("产品介入后的变化", understanding.afterUseChanges)
      : "",
    ...rawSourceFacts,
    understanding ? formatUnderstandingEvidence(understanding.evidence) : "",
  ].filter(Boolean);

  const inferred = understanding
    ? [
        formatInferredEntries("目标客户/角色", understanding.targetCustomers),
        formatInferredEntries("核心功能", understanding.coreFunctions),
        formatInferredEntries("用户痛点", understanding.painPoints),
        formatInferredEntries(
          "传统做法/替代方案",
          understanding.traditionalAlternatives
        ),
        formatInferredEntries("产品介入后的变化", understanding.afterUseChanges),
      ].filter(Boolean)
    : [];

  const boundaries = understanding?.writingBoundaries ?? [
    "缺少事实时必须提示需要补充素材,不得编造。",
  ];
  const questions = understanding?.questionsToAsk ?? [];

  return [
    "【产品卡 V2 / 可写事实】",
    writableFacts.join("\n") || "未提供可写事实。",
    "",
    "【产品卡 V2 / 可推导表达】",
    inferred.join("\n") || "暂无可推导表达;写作时只使用可写事实。",
    "",
    "【产品卡 V2 / 禁写边界】",
    boundaries.join("\n"),
    "",
    "【产品卡 V2 / 资料缺口】",
    questions.length
      ? `${questions.join("\n")}\n以上只用于向用户追问或判断素材不足,不得直接写入正文。`
      : "暂无追问问题。",
  ].join("\n");
}
