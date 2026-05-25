import { describe, expect, it } from "vitest";
import {
  buildFallbackUnderstanding,
  hasProductMaterial,
  mergeProducts,
  productSourceToArticleContext,
} from "@/lib/productCatalog";
import type { Product } from "@/types";

function product(patch: Partial<Product> = {}): Product {
  return {
    id: "prod-demo",
    name: "Demo 产品",
    description: "面向运营团队的自动化产品",
    tags: ["自动化", "运营"],
    iconGradient: ["#1268FF", "#5B8CFF"],
    knowledgeDocs: [],
    ...patch,
  };
}

describe("productCatalog", () => {
  it("lets custom product data override seed product data", () => {
    const merged = mergeProducts(
      [product({ description: "旧简介" })],
      [product({ description: "新简介", website: "https://joto.ai" })]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      description: "新简介",
      website: "https://joto.ai",
    });
  });

  it("turns product library materials into article source context", () => {
    const context = productSourceToArticleContext(
      product({
        website: "https://joto.ai",
        sourcePack: {
          productNotes: "人工补充的产品边界",
          competitorNotes: "传统方案需要多后台切换",
          imageRefs: "首页截图",
          websiteNotes: "官网强调企业级部署",
          pdfNotes: "PDF 提到权限控制",
        },
        understanding: {
          summary: "这是一款企业自动化产品。",
          targetUsers: ["运营经理"],
          coreCapabilities: ["流程编排"],
          contentAngles: ["为什么需要"],
          missingInfo: ["客户案例"],
          generatedAt: "2026-05-19T00:00:00.000Z",
          source: "fallback",
        },
      })
    );

    expect(context.productNotes).toContain("官网链接：https://joto.ai");
    expect(context.productNotes).toContain("产品理解简介：这是一款企业自动化产品。");
    expect(context.productNotes).toContain("PDF 摘要：PDF 提到权限控制");
    expect(context.competitorNotes).toBe("传统方案需要多后台切换");
    expect(context.imageRefs).toBe("首页截图");
  });

  it("uses uploaded screenshot and video notes as product material", () => {
    const context = productSourceToArticleContext(
      product({
        sourcePack: {
          mediaNotes:
            "截图素材：智能体对话页显示用户输入一句问题后返回网络诊断步骤。\n视频素材：演示从告警到根因定位的完整流程。",
        },
        sourceMediaAssets: [
          {
            id: "media-1",
            url: "/uploads/product-evidence/prod-demo/screen.png",
            fileName: "screen.png",
            fileType: "image",
            sizeKb: 420,
            caption: "智能体对话页",
            analysis: "页面像一个智能问答入口，用于让运维同事用自然语言查询网络问题。",
            uploadedAt: "2026-05-22T00:00:00.000Z",
          },
        ],
      })
    );

    expect(context.productNotes).toContain("截图素材：智能体对话页");
    expect(context.imageRefs).toContain("智能体对话页");
    expect(hasProductMaterial(product({ sourceMediaAssets: [] }))).toBe(false);
    expect(
      hasProductMaterial(
        product({
          sourceMediaAssets: [
            {
              id: "media-1",
              url: "/uploads/product-evidence/prod-demo/screen.png",
              fileName: "screen.png",
              fileType: "image",
              sizeKb: 420,
              caption: "智能体对话页",
              analysis: "用于理解产品定位。",
              uploadedAt: "2026-05-22T00:00:00.000Z",
            },
          ],
        })
      )
    ).toBe(true);
  });

  it("builds a fallback understanding when model analysis is unavailable", () => {
    const understanding = buildFallbackUnderstanding(product());
    expect(understanding?.summary).toContain("Demo 产品");
    expect(understanding?.missingInfo).toEqual(
      expect.arrayContaining(["真实使用场景"])
    );
  });
});
