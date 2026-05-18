import { describe, expect, it } from "vitest";
import {
  ARTICLE_TYPES,
  inferArticleType,
  type ArticleType,
} from "@/lib/articleType";

describe("articleType · inferArticleType", () => {
  it("falls back to 产品推广 when nothing is provided", () => {
    expect(inferArticleType({})).toBe("产品推广");
    expect(inferArticleType({ angleId: null, customAngle: null })).toBe(
      "产品推广"
    );
  });

  // C1: 3 angles replace the previous 10. Each must map cleanly to one of
  // the three article-type keys (which still drive humanize prompt branching
  // and 排版 theme defaults). If anyone adds an angle without a category,
  // this test is the canary.
  const seedAngleExpectations: Record<string, ArticleType> = {
    "angle-promo": "产品推广",
    "angle-compare": "场景推广",
    "angle-summit": "峰会消息",
  };

  for (const [angleId, expected] of Object.entries(seedAngleExpectations)) {
    it(`angle ${angleId} → ${expected}`, () => {
      expect(inferArticleType({ angleId })).toBe(expected);
    });
  }

  it("unknown angleId falls back to customAngle scan", () => {
    expect(
      inferArticleType({ angleId: "angle-totally-bogus", customAngle: "" })
    ).toBe("产品推广");
  });

  it("customAngle 峰会 keyword → 峰会消息", () => {
    expect(
      inferArticleType({ customAngle: "下个月的智能办公峰会现场报道" })
    ).toBe("峰会消息");
    expect(inferArticleType({ customAngle: "圆桌讨论的关键观点" })).toBe(
      "峰会消息"
    );
    expect(inferArticleType({ customAngle: "技术沙龙速记" })).toBe("峰会消息");
  });

  it("customAngle 场景 keyword → 场景推广", () => {
    expect(inferArticleType({ customAngle: "对账场景的实操踩坑笔记" })).toBe(
      "场景推广"
    );
    expect(inferArticleType({ customAngle: "三周复盘:落地过程" })).toBe(
      "场景推广"
    );
    expect(inferArticleType({ customAngle: "上手教程" })).toBe("场景推广");
  });

  it("customAngle without recognized keywords → 产品推广", () => {
    expect(inferArticleType({ customAngle: "面向 CFO 的 ROI 视角" })).toBe(
      "产品推广"
    );
    expect(inferArticleType({ customAngle: "为什么我们卖得贵" })).toBe(
      "产品推广"
    );
  });

  it("angleId category wins over customAngle keyword", () => {
    // angle-promo is 产品推广; even if customAngle contains a 峰会 keyword,
    // the angleId still takes precedence.
    expect(
      inferArticleType({
        angleId: "angle-promo",
        customAngle: "峰会案例分享",
      })
    ).toBe("产品推广");
  });

  it("ARTICLE_TYPES list is stable", () => {
    expect(ARTICLE_TYPES).toEqual(["产品推广", "场景推广", "峰会消息"]);
  });
});
