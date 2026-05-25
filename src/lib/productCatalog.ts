import type { ArticleSourceContext, Product, ProductSourcePack } from "@/types";
import { summarizeProductImageAssets } from "@/lib/productImages";

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
      competitorNotes: "",
      trendNotes: "",
      imageRefs: "",
    };
  }

  const source = product.sourcePack ?? {};
  const understanding = product.understanding;
  const generatedNotes = understanding
    ? [
        `产品理解简介：${understanding.summary}`,
        understanding.targetUsers.length
          ? `目标用户：${understanding.targetUsers.join("、")}`
          : "",
        understanding.coreCapabilities.length
          ? `核心能力：${understanding.coreCapabilities.join("、")}`
          : "",
        understanding.contentAngles.length
          ? `适合写作方向：${understanding.contentAngles.join("、")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const imageSummary =
    (product.imageAssets?.length ?? 0) > 0 ? summarizeProductImageAssets(product) : "";
  const sourceMediaSummary =
    (product.sourceMediaAssets ?? [])
      .map((asset, index) =>
        [
          `${index + 1}. ${asset.fileType === "video" ? "视频" : "截图"}：${
            asset.caption || asset.fileName
          }`,
          asset.analysis ? `系统理解：${asset.analysis}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n\n");

  return {
    productNotes: [
      `产品名称：${product.name}`,
      `产品简介：${product.description}`,
      product.website ? `官网链接：${product.website}` : "",
      product.appUrl ? `产品前端/演示页面：${product.appUrl}` : "",
      source.websiteNotes ? `官网补充：${source.websiteNotes}` : "",
      source.pdfNotes ? `PDF 摘要：${source.pdfNotes}` : "",
      source.mediaNotes ? `截图/视频理解素材：${source.mediaNotes}` : "",
      generatedNotes,
      source.productNotes,
    ]
      .filter(Boolean)
      .join("\n\n"),
    competitorNotes: source.competitorNotes ?? "",
    trendNotes: source.trendNotes ?? "",
    imageRefs: [source.imageRefs, sourceMediaSummary, imageSummary]
      .filter(Boolean)
      .join("\n\n"),
    mediaNotes: source.mediaNotes ?? "",
  };
}

export function hasProductMaterial(product: Product): boolean {
  const source: ProductSourcePack = product.sourcePack ?? {};
  return Boolean(
    product.website ||
      product.appUrl ||
      product.understanding?.summary ||
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
  return {
    summary: `${product.name} 是一款围绕「${tags}」展开的产品。它目前的基础描述是：${product.description}。后续写文章时建议继续补充目标用户、典型使用场景、核心差异、可确认案例和截图素材。`,
    targetUsers: product.tags.length
      ? product.tags.map((tag) => `${tag} 相关团队`)
      : ["需要进一步补充目标用户"],
    coreCapabilities: product.description
      .split(/[，,、；;。\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4),
    contentAngles: ["产品介绍", "使用场景教育", "产品差异", "传统方案对比", "为什么需要"],
    missingInfo: [
      "典型客户或目标角色",
      "真实使用场景",
      "关键截图或视频封面",
      "竞品/传统方案的可确认对比信息",
    ],
    generatedAt: new Date().toISOString(),
    source: "fallback",
  };
}
