import { describe, expect, it } from "vitest";
import {
  ARTICLE_TYPES,
  inferArticleType,
  type ArticleType,
} from "@/lib/articleType";

describe("articleType · inferArticleType", () => {
  it("falls back to 产品介绍 when nothing is provided", () => {
    expect(inferArticleType({})).toBe("产品介绍");
    expect(inferArticleType({ angleId: null, customAngle: null })).toBe(
      "产品介绍"
    );
  });

  // JOTO content factory has five primary angles. Each must map cleanly to
  // the article-type keys that drive prompts and theme defaults.
  const seedAngleExpectations: Record<string, ArticleType> = {
    "angle-product-intro": "产品介绍",
    "angle-product-diff": "产品差异",
    "angle-competitor": "竞品对比",
    "angle-trend": "时事热点",
    "angle-scenario": "场景案例",
  };

  for (const [angleId, expected] of Object.entries(seedAngleExpectations)) {
    it(`angle ${angleId} → ${expected}`, () => {
      expect(inferArticleType({ angleId })).toBe(expected);
    });
  }

  it("unknown angleId falls back to customAngle scan", () => {
    expect(
      inferArticleType({ angleId: "angle-totally-bogus", customAngle: "" })
    ).toBe("产品介绍");
  });

  it("customAngle 热点 keyword → 时事热点", () => {
    expect(
      inferArticleType({ customAngle: "结合最近行业热点写一篇对比稿" })
    ).toBe("时事热点");
    expect(inferArticleType({ customAngle: "一篇新闻事件借势评论" })).toBe(
      "时事热点"
    );
  });

  it("customAngle 竞品 keyword → 竞品对比", () => {
    expect(inferArticleType({ customAngle: "和传统监控平台做竞品对比" })).toBe(
      "竞品对比"
    );
    expect(inferArticleType({ customAngle: "为什么比某类平台更适合" })).toBe(
      "竞品对比"
    );
  });

  it("customAngle 差异 keyword → 产品差异", () => {
    expect(inferArticleType({ customAngle: "突出相对传统方案的产品差异" })).toBe(
      "产品差异"
    );
    expect(inferArticleType({ customAngle: "讲清楚新方案的优势变化" })).toBe(
      "产品差异"
    );
  });

  it("customAngle without recognized keywords → 产品介绍", () => {
    expect(inferArticleType({ customAngle: "面向 CIO 的 ROI 视角" })).toBe(
      "产品介绍"
    );
    expect(inferArticleType({ customAngle: "面向 CIO 的 ROI 视角" })).toBe(
      "产品介绍"
    );
  });

  it("customAngle 场景 keyword → 场景案例", () => {
    expect(inferArticleType({ customAngle: "讲清这个产品怎么使用" })).toBe(
      "场景案例"
    );
    expect(inferArticleType({ customAngle: "客户故事和真实场景案例" })).toBe(
      "场景案例"
    );
  });

  it("angleId category wins over customAngle keyword", () => {
    // angle-product-intro is 产品介绍; even if customAngle contains a 热点 keyword,
    // the angleId still takes precedence.
    expect(
      inferArticleType({
        angleId: "angle-product-intro",
        customAngle: "热点竞品对比",
      })
    ).toBe("产品介绍");
  });

  it("ARTICLE_TYPES list is stable", () => {
    expect(ARTICLE_TYPES).toEqual([
      "产品介绍",
      "产品差异",
      "竞品对比",
      "时事热点",
      "场景案例",
    ]);
  });
});
