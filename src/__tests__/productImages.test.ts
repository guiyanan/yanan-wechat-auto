import { describe, expect, it } from "vitest";
import {
  applyProductImagesToHtml,
  countProductImagesInHtml,
  summarizeProductImageAssets,
} from "@/lib/productImages";
import type { Product } from "@/types";

function product(patch: Partial<Product> = {}): Product {
  return {
    id: "prod-fashion",
    name: "Fasium AI",
    description: "AI 服装设计平台",
    tags: ["服装", "AI"],
    iconGradient: ["#1268FF", "#5B8CFF"],
    knowledgeDocs: [],
    imageAssets: [
      {
        id: "img-hero",
        url: "/uploads/product-assets/prod-fashion/hero.webp",
        fileName: "hero.webp",
        kind: "开头主图",
        caption: "Fasium AI 设计工作台",
        tags: ["首页", "设计"],
        uploadedAt: "2026-05-20T00:00:00.000Z",
      },
      {
        id: "img-flow",
        url: "/uploads/product-assets/prod-fashion/flow.png",
        fileName: "flow.png",
        kind: "流程图",
        caption: "从灵感到样衣的工作流",
        tags: ["流程"],
        uploadedAt: "2026-05-20T00:00:00.000Z",
      },
      {
        id: "img-feature",
        url: "/uploads/product-assets/prod-fashion/feature.jpg",
        fileName: "feature.jpg",
        kind: "功能截图",
        caption: "",
        tags: ["Prompt"],
        uploadedAt: "2026-05-20T00:00:00.000Z",
      },
      {
        id: "img-extra",
        url: "/uploads/product-assets/prod-fashion/extra.jpg",
        fileName: "extra.jpg",
        kind: "其他",
        caption: "补充截图",
        tags: [],
        uploadedAt: "2026-05-20T00:00:00.000Z",
      },
    ],
    ...patch,
  };
}

describe("productImages", () => {
  it("summarizes only current product image assets for prompts", () => {
    const summary = summarizeProductImageAssets(product());

    expect(summary).toContain("img-hero");
    expect(summary).toContain("开头主图");
    expect(summary).toContain("Fasium AI 设计工作台");
    expect(summary).not.toContain("其他产品");
  });

  it("inserts a short article with at most one real product image", () => {
    const result = applyProductImagesToHtml(
      "<p>开头故事。</p><h2>第一节</h2><p>正文。</p><h2>第二节</h2><p>正文。</p>",
      product(),
      { contentLength: "short" }
    );

    expect(countProductImagesInHtml(result.html)).toBe(1);
    expect(result.insertedAssets.map((asset) => asset.id)).toEqual(["img-hero"]);
    expect(result.html).toContain("/uploads/product-assets/prod-fashion/hero.webp");
    expect(result.html).toContain("Fasium AI 设计工作台");
  });

  it("inserts up to three images for a standard article and avoids duplicates", () => {
    const source =
      "<p>开头故事。</p><h2>第一节</h2><p>正文。</p><h2>第二节</h2><p>正文。</p><h2>第三节</h2><p>正文。</p>";
    const first = applyProductImagesToHtml(source, product(), {
      contentLength: "standard",
    });
    const second = applyProductImagesToHtml(first.html, product(), {
      contentLength: "standard",
    });

    expect(countProductImagesInHtml(first.html)).toBe(3);
    expect(first.insertedAssets.map((asset) => asset.id)).toEqual([
      "img-hero",
      "img-feature",
      "img-flow",
    ]);
    expect(countProductImagesInHtml(second.html)).toBe(3);
    expect(second.insertedAssets).toEqual([]);
  });

  it("does not insert unrelated placeholders when a product has no images", () => {
    const result = applyProductImagesToHtml("<p>正文。</p>", product({ imageAssets: [] }), {
      contentLength: "deep",
    });

    expect(result.html).toBe("<p>正文。</p>");
    expect(result.insertedAssets).toEqual([]);
    expect(result.missingSlots).toBeGreaterThan(0);
  });
});
