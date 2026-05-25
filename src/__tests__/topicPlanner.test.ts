import { describe, expect, it } from "vitest";
import { buildFallbackTopicPlans, coerceTopicPlans } from "@/lib/topicPlanner";
import type { Product } from "@/types";

function product(patch: Partial<Product>): Product {
  return {
    id: "p",
    name: "测试产品",
    description: "测试简介",
    tags: [],
    iconGradient: ["#1268FF", "#5B8CFF"],
    knowledgeDocs: [],
    ...patch,
  };
}

describe("topicPlanner", () => {
  it("prioritizes competitor/ecosystem/pricing angles for NotebookLM-like products", () => {
    const plans = buildFallbackTopicPlans(
      product({
        name: "JOTO Notebook",
        description: "类似 Google NotebookLM 的企业知识库笔记工具,强调生态和价格优势",
        tags: ["知识库", "竞品对比"],
      })
    );

    expect(plans).toHaveLength(5);
    expect(new Set(plans.map((p) => p.angleLabel)).size).toBe(5);
    expect(plans.map((p) => p.angleType)).toEqual(
      expect.arrayContaining(["competitor", "pricing", "product_diff"])
    );
  });

  it("prioritizes why-need and scenario education for new fashion design products", () => {
    const plans = buildFallbackTopicPlans(
      product({
        name: "AI 服装设计助手",
        description: "帮助服装设计师从灵感、面料、款式到版型快速生成方案的新概念产品",
        tags: ["服装设计", "新概念"],
      })
    );

    expect(plans).toHaveLength(5);
    expect(plans.map((p) => p.angleType)).toEqual(
      expect.arrayContaining(["education", "scenario", "product_intro"])
    );
    expect(plans[0].angleLabel).toContain("为什么");
  });

  it("coerces invalid model output back to five fallback plans", () => {
    const plans = coerceTopicPlans("not json", product({ name: "普通产品" }));
    expect(plans).toHaveLength(5);
  });

  it("honors explicit comparison strategy preference", () => {
    const plans = buildFallbackTopicPlans(product({ name: "普通产品" }), {
      angleStrategy: "comparison",
      contentLength: "deep",
    });

    expect(plans).toHaveLength(5);
    expect(plans.map((p) => p.angleType)).toEqual(
      expect.arrayContaining(["competitor", "pricing", "product_diff"])
    );
    expect(plans.every((p) => p.angleStrategy === "comparison")).toBe(true);
    expect(plans.every((p) => p.contentLength === "deep")).toBe(true);
  });

  it("honors explicit education strategy preference", () => {
    const plans = buildFallbackTopicPlans(product({ name: "普通产品" }), {
      angleStrategy: "education",
      contentLength: "short",
    });

    expect(plans).toHaveLength(5);
    expect(plans.map((p) => p.angleType)).toEqual(
      expect.arrayContaining(["education", "scenario", "product_intro"])
    );
    expect(plans.every((p) => p.angleStrategy === "education")).toBe(true);
    expect(plans.every((p) => p.contentLength === "short")).toBe(true);
  });
});
