import { describe, expect, it } from "vitest";
import { getTrendStyleLabel } from "@/lib/trendStyleLabel";
import type { Article } from "@/types";

function makeArticle(
  generationMeta: Article["generationMeta"]
): Pick<Article, "generationMeta"> {
  return { generationMeta };
}

describe("getTrendStyleLabel", () => {
  it("returns the learned trend style actually used by a trend article", () => {
    const article = makeArticle({
      mode: "trend-radar",
      angleLabel: "热点短评",
      styleSource: "learned",
      trendStyleId: "trend-1",
      trendStyleName: "轻评论体",
      trendStyleSource: "learned",
    });

    expect(getTrendStyleLabel(article)).toBe("热点风格：轻评论体");
  });

  it("returns system fallback without exposing a visible default style pool", () => {
    const article = makeArticle({
      mode: "trend-radar",
      angleLabel: "热点短评",
      styleSource: "official",
      trendStyleSource: "fallback",
    });

    expect(getTrendStyleLabel(article)).toBe("热点风格：系统兜底");
  });

  it("does not label non-trend articles as trend styles", () => {
    const article = makeArticle({
      mode: "auto-five",
      angleLabel: "产品介绍",
      styleSource: "learned",
      learnedStyleName: "人味叙事体",
    });

    expect(getTrendStyleLabel(article)).toBeNull();
  });
});
