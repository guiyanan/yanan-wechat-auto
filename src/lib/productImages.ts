import type { ContentLength, Product, ProductImageAsset, ProductImageKind } from "@/types";

export const PRODUCT_IMAGE_KIND_OPTIONS: ProductImageKind[] = [
  "开头主图",
  "功能截图",
  "流程图",
  "架构图",
  "对比图",
  "视频封面",
  "其他",
];

const KIND_WEIGHT: Record<ProductImageKind, number> = {
  开头主图: 0,
  功能截图: 1,
  流程图: 2,
  架构图: 3,
  对比图: 4,
  视频封面: 5,
  其他: 6,
};

const IMAGE_PLACEHOLDER_RE =
  /<p>\s*\[(?:产品)?(?:截图|图片|视频)(?:\/视频)?(?:封面)?(?:占位)?[:：][\s\S]*?\]\s*<\/p>/gi;

export interface ProductImageInsertionResult {
  html: string;
  insertedAssets: ProductImageAsset[];
  missingSlots: number;
}

export function summarizeProductImageAssets(product: Product): string {
  const assets = normalizedAssets(product);
  if (!assets.length) {
    return "当前产品还没有上传真实图片素材。需要插图时只能提示建议补图,不得编造截图。";
  }
  return assets
    .map((asset) => {
      const caption = asset.caption?.trim() || stripExtension(asset.fileName);
      const tags = asset.tags.length ? `；标签：${asset.tags.join("、")}` : "";
      return `- ${asset.id}｜${asset.kind}｜${caption}${tags}`;
    })
    .join("\n");
}

export function countProductImagesInHtml(html: string): number {
  return (html.match(/data-product-image-id=/g) ?? []).length;
}

export function applyProductImagesToHtml(
  html: string,
  product: Product,
  options: { contentLength?: ContentLength } = {}
): ProductImageInsertionResult {
  const assets = selectProductImages(product, options.contentLength);
  const desired = desiredImageCount(options.contentLength);

  if (!assets.length) {
    return {
      html,
      insertedAssets: [],
      missingSlots: Math.max(0, desired),
    };
  }
  if (countProductImagesInHtml(html) > 0) {
    return { html, insertedAssets: [], missingSlots: 0 };
  }

  const insertedAssets: ProductImageAsset[] = [];
  let nextHtml = html;
  let offset = 0;
  let placeholderIndex = 0;

  nextHtml = nextHtml.replace(IMAGE_PLACEHOLDER_RE, () => {
    const asset = assets[placeholderIndex];
    placeholderIndex += 1;
    if (!asset) return "";
    insertedAssets.push(asset);
    return renderProductImage(asset);
  });

  if (insertedAssets.length > 0) {
    const remainingAssets = assets.slice(insertedAssets.length);
    const positions = findInsertionPositions(nextHtml, remainingAssets.length);
    let remainingOffset = 0;
    remainingAssets.forEach((asset, idx) => {
      const rawPosition = positions[idx] ?? nextHtml.length;
      const position = rawPosition + remainingOffset;
      const figure = renderProductImage(asset);
      nextHtml = `${nextHtml.slice(0, position)}\n${figure}\n${nextHtml.slice(position)}`;
      remainingOffset += figure.length + 2;
      insertedAssets.push(asset);
    });

    return {
      html: nextHtml,
      insertedAssets,
      missingSlots: Math.max(0, desired - insertedAssets.length),
    };
  }

  const positions = findInsertionPositions(html, assets.length);

  assets.forEach((asset, idx) => {
    const rawPosition = positions[idx] ?? nextHtml.length;
    const position = rawPosition + offset;
    const figure = renderProductImage(asset);
    nextHtml = `${nextHtml.slice(0, position)}\n${figure}\n${nextHtml.slice(position)}`;
    offset += figure.length + 2;
    insertedAssets.push(asset);
  });

  return {
    html: nextHtml,
    insertedAssets,
    missingSlots: Math.max(0, desired - insertedAssets.length),
  };
}

export function selectProductImages(
  product: Product,
  contentLength?: ContentLength
): ProductImageAsset[] {
  const limit = desiredImageCount(contentLength);
  return normalizedAssets(product)
    .sort((a, b) => KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind])
    .slice(0, limit);
}

function desiredImageCount(contentLength?: ContentLength): number {
  switch (contentLength) {
    case "short":
      return 1;
    case "deep":
      return 4;
    case "standard":
    default:
      return 3;
  }
}

function normalizedAssets(product: Product): ProductImageAsset[] {
  return (product.imageAssets ?? []).filter((asset) => {
    return Boolean(asset.id && asset.url && asset.fileName && asset.kind);
  });
}

function findInsertionPositions(html: string, count: number): number[] {
  const matches = Array.from(html.matchAll(/<\/(?:p|blockquote|ul|ol|h2|h3)>/gi));
  if (!matches.length) return Array.from({ length: count }, () => html.length);

  const positions: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const targetIndex = Math.min(
      matches.length - 1,
      Math.max(0, Math.floor(((i + 1) * matches.length) / (count + 1)))
    );
    const match = matches[targetIndex];
    positions.push((match.index ?? 0) + match[0].length);
  }
  return Array.from(new Set(positions));
}

function renderProductImage(asset: ProductImageAsset): string {
  const caption = asset.caption?.trim() || stripExtension(asset.fileName);
  const src = escapeAttr(asset.url);
  const alt = escapeAttr(caption);
  return `<section class="joto-product-image" data-product-image-id="${escapeAttr(asset.id)}" data-product-image-kind="${escapeAttr(asset.kind)}" style="margin: 30px auto; text-align: center; box-sizing: border-box;">
  <img class="rich_pages wxw-img" src="${src}" data-src="${src}" alt="${alt}" style="display: block; width: 100%; max-width: 100%; height: auto; margin: 0 auto; border: 1px solid #E6EAF2; border-radius: 6px; box-sizing: border-box;">
  <p style="margin: 8px 0 0; color: #8A8A8A; font-size: 13px; line-height: 1.6; text-align: center;">${escapeHtml(caption)}</p>
</section>`;
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, "");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
