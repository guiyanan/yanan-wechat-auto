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
          productNotes: "旧 productNotes 不应绕过 V2 产品卡进入正文",
          competitorNotes: "旧 competitorNotes 不应进入正文",
          trendNotes: "旧 trendNotes 不应进入正文",
          imageRefs: "旧 imageRefs 不应进入正文",
          websiteNotes: "旧 websiteNotes 不应在有 V2 卡时重复进入正文",
          pdfNotes: "旧 pdfNotes 不应在有 V2 卡时重复进入正文",
        },
        understanding: {
          definition: "这是一款企业自动化产品。",
          targetCustomers: [
            {
              text: "运营经理",
              confidence: "explicit",
              basis: "人工备注",
            },
          ],
          coreFunctions: [
            {
              text: "流程编排",
              confidence: "explicit",
              basis: "人工备注",
            },
          ],
          painPoints: [
            {
              text: "传统方案需要多后台切换",
              confidence: "explicit",
              basis: "竞品/传统方案素材",
            },
          ],
          traditionalAlternatives: [
            {
              text: "人工多后台切换",
              confidence: "explicit",
              basis: "竞品/传统方案素材",
            },
          ],
          afterUseChanges: [
            {
              text: "把流程编排集中处理",
              confidence: "inferred",
              basis: "核心功能推导",
            },
          ],
          evidence: [
            {
              sourceType: "manual",
              sourceLabel: "人工备注",
              text: "人工补充的 V2 产品边界",
            },
            {
              sourceType: "pdf",
              sourceLabel: "PDF",
              text: "PDF 提到权限控制",
            },
          ],
          writingBoundaries: ["没有客户案例,不得写真实客户故事。"],
          questionsToAsk: ["是否有客户案例?"],
          generatedAt: "2026-05-19T00:00:00.000Z",
          source: "fallback",
        },
      })
    );

    expect(context.productNotes).toContain("【产品卡 V2 / 可写事实】");
    expect(context.productNotes).toContain("官网链接：https://joto.ai");
    expect(context.productNotes).toContain("产品定义：这是一款企业自动化产品。");
    expect(context.productNotes).toContain("核心功能：流程编排");
    expect(context.productNotes).toContain("【产品卡 V2 / 可推导表达】");
    expect(context.productNotes).toContain("产品介入后的变化：把流程编排集中处理");
    expect(context.productNotes).toContain("【产品卡 V2 / 禁写边界】");
    expect(context.productNotes).toContain("没有客户案例,不得写真实客户故事。");
    expect(context.productNotes).toContain("【产品卡 V2 / 资料缺口】");
    expect(context.productNotes).toContain("是否有客户案例?");
    expect(context.productNotes).not.toContain("旧版补充素材");
    expect(context.productNotes).not.toContain("旧 productNotes");
    expect(context.productNotes).not.toContain("旧 competitorNotes");
    expect(context.productNotes).not.toContain("旧 trendNotes");
    expect(context.productNotes).not.toContain("旧 imageRefs");
    expect(context.productNotes).not.toContain("旧 websiteNotes");
    expect(context.productNotes).not.toContain("旧 pdfNotes");
    expect(context.productNotes).not.toContain("适合写作方向");
    expect(context.productNotes).toContain("PDF：PDF 提到权限控制");
    expect(context).not.toHaveProperty("competitorNotes");
    expect(context).not.toHaveProperty("trendNotes");
    expect(context).not.toHaveProperty("imageRefs");
  });

  it("uses uploaded screenshot notes as product material and ignores video notes", () => {
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
    expect(context.productNotes).not.toContain("视频素材");
    expect(context.productNotes).toContain("智能体对话页");
    expect(context).not.toHaveProperty("imageRefs");
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
    expect(understanding?.definition).toContain("Demo 产品");
    expect(understanding?.questionsToAsk).toEqual(
      expect.arrayContaining(["这个产品最典型的真实使用场景是什么?"])
    );
    expect(understanding?.writingBoundaries).toEqual(
      expect.arrayContaining(["未提供真实客户资料,不得写客户名称或客户案例。"])
    );
    expect(understanding).not.toHaveProperty("contentAngles");
  });
});
