import { describe, expect, it } from "vitest";
import {
  buildFallbackTopicPlans,
  buildFallbackTrendTopicPlans,
  coerceTopicPlans,
} from "@/lib/topicPlanner";
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
  it("uses the fixed three product-entry plans for mature products", () => {
    const plans = buildFallbackTopicPlans(
      product({
        name: "JOTO Notebook",
        description: "类似 Google NotebookLM 的企业知识库笔记工具,强调生态和价格优势",
        tags: ["知识库", "竞品对比"],
      })
    );

    expect(plans.map((p) => p.angleLabel)).toEqual([
      "场景痛点入口",
      "传统做法入口",
      "产品能力/适用人群入口",
    ]);
  });

  it("uses the same fixed three product-entry plans for new concept products", () => {
    const plans = buildFallbackTopicPlans(
      product({
        name: "AI 服装设计助手",
        description: "帮助服装设计师从灵感、面料、款式到版型快速生成方案的新概念产品",
        tags: ["服装设计", "新概念"],
      })
    );

    expect(plans.map((p) => p.angleLabel)).toEqual([
      "场景痛点入口",
      "传统做法入口",
      "产品能力/适用人群入口",
    ]);
  });

  it("coerces invalid model output back to the three fixed plans", () => {
    const plans = coerceTopicPlans("not json", product({ name: "普通产品" }));
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.id)).toEqual([
      "topic-scenario-pain",
      "topic-traditional-alternative",
      "topic-capability-audience",
    ]);
  });

  it("preserves explicit comparison strategy without changing the three entries", () => {
    const plans = buildFallbackTopicPlans(product({ name: "普通产品" }), {
      angleStrategy: "comparison",
      contentLength: "deep",
    });

    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.angleLabel)).toEqual([
      "场景痛点入口",
      "传统做法入口",
      "产品能力/适用人群入口",
    ]);
    expect(plans.every((p) => p.angleStrategy === "comparison")).toBe(true);
    expect(plans.every((p) => p.contentLength === "deep")).toBe(true);
  });

  it("preserves explicit education strategy without changing the three entries", () => {
    const plans = buildFallbackTopicPlans(product({ name: "普通产品" }), {
      angleStrategy: "education",
      contentLength: "short",
    });

    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.angleLabel)).toEqual([
      "场景痛点入口",
      "传统做法入口",
      "产品能力/适用人群入口",
    ]);
    expect(plans.every((p) => p.angleStrategy === "education")).toBe(true);
    expect(plans.every((p) => p.contentLength === "short")).toBe(true);
  });

  it("makes every fixed plan cover the full product chain", () => {
    const plans = buildFallbackTopicPlans(product({ name: "普通产品" }));
    const required = [
      "产品是什么",
      "给谁用",
      "痛点",
      "传统做法",
      "产品介入",
      "使用后的变化",
      "不能写什么",
    ];

    expect(plans).toHaveLength(3);
    for (const plan of plans) {
      for (const item of required) {
        expect(plan.promptInstruction).toContain(item);
      }
    }
  });

  it("coerces free-angle model output back into the fixed three entries", () => {
    const plans = coerceTopicPlans(
      [
        {
          id: "free-1",
          angleLabel: "价格生态对比",
          angleType: "pricing",
          promptInstruction: "自由角度",
        },
        {
          id: "free-2",
          angleLabel: "客户故事",
          angleType: "scenario",
          promptInstruction: "自由角度",
        },
        {
          id: "free-3",
          angleLabel: "竞品替代",
          angleType: "competitor",
          promptInstruction: "自由角度",
        },
        {
          id: "free-4",
          angleLabel: "另一个角度",
          angleType: "education",
          promptInstruction: "自由角度",
        },
      ],
      product({ name: "普通产品" })
    );

    expect(plans.map((p) => p.angleLabel)).toEqual([
      "场景痛点入口",
      "传统做法入口",
      "产品能力/适用人群入口",
    ]);
  });

  it("fallback topic instructions avoid fictional named-character stories", () => {
    const plans = buildFallbackTopicPlans(product({ name: "普通产品" }), {
      angleStrategy: "scenario",
    });

    expect(plans.every((p) => p.promptInstruction.includes("不要写具体人名"))).toBe(
      true
    );
    expect(plans.map((p) => p.promptInstruction).join("\n")).not.toContain(
      "人物、任务"
    );
  });

  it("treats legacy trend strategy as auto in ordinary product generation", () => {
    const plans = buildFallbackTopicPlans(product({ name: "普通产品" }), {
      angleStrategy: "trend",
    });

    expect(plans).toHaveLength(3);
    expect(plans.every((p) => p.angleType !== "trend")).toBe(true);
    expect(plans.every((p) => p.angleStrategy === "auto")).toBe(true);
  });

  it("builds hotspot fallback plans with product-team observation constraints", () => {
    const plans = buildFallbackTrendTopicPlans(
      product({
        name: "法老-智能运维",
        description: "AI 驱动的 NetOps 平台",
      }),
      [
        {
          id: "trend-1",
          title: "AI 运维成为企业 IT 热点",
          snippet: "近 30 天里,企业开始关注用 AI 降低运维沟通成本。",
          source: "行业观察",
          url: "https://example.com/trend",
        },
      ]
    );

    expect(plans).toHaveLength(5);
    expect(plans.every((p) => p.angleType === "trend")).toBe(true);
    expect(plans.every((p) => p.trafficHookLabel)).toBe(true);
    expect(new Set(plans.map((p) => p.trafficHookMode)).size).toBeGreaterThanOrEqual(4);
    expect(plans.map((p) => p.trafficHookMode)).toEqual(
      expect.arrayContaining([
        "mainstream_product",
        "category_heat",
        "domestic_alternative",
        "usage_explainer",
        "pitfall",
      ])
    );
    expect(plans.every((p) => p.promptInstruction.includes("不展示来源链接"))).toBe(
      true
    );
    expect(plans.every((p) => p.promptInstruction.includes("不插图"))).toBe(true);
    expect(plans.every((p) => p.promptInstruction.includes("不要硬嫁接"))).toBe(true);
    expect(plans.every((p) => p.promptInstruction.includes("外部话题噱头"))).toBe(
      true
    );
    expect(plans.every((p) => p.promptInstruction.includes("第一屏"))).toBe(true);
    expect(plans.every((p) => p.promptInstruction.includes("产品团队写给用户的完整公众号观察文"))).toBe(
      true
    );
    expect(plans.every((p) => p.promptInstruction.includes("产品团队视角"))).toBe(
      true
    );
    expect(plans.every((p) => p.promptInstruction.includes("我们的回应"))).toBe(
      true
    );
    expect(plans.every((p) => p.promptInstruction.includes("产品可以在中后段自然进入"))).toBe(
      true
    );
    expect(plans.every((p) => p.promptInstruction.includes("不得写成功能清单"))).toBe(
      true
    );
    expect(plans.map((p) => p.promptInstruction).join("\n")).not.toContain("前 80%");
    expect(plans.map((p) => p.promptInstruction).join("\n")).not.toContain("产品只允许在结尾");
    expect(plans.map((p) => p.angleLabel).join("\n")).not.toContain("入口之争");
  });
});
