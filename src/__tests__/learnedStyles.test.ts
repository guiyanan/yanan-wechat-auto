import { describe, expect, it } from "vitest";
import {
  buildProductStylePicks,
  buildTrendStylePicks,
  learnedToWritingStyle,
} from "@/lib/learnedStyles";
import type { LearnedWritingStyle, WritingStyle } from "@/types";

const officialStyle: WritingStyle = {
  id: "style-joto",
  name: "JOTO 官方",
  tags: [],
  sampleText: "官方样例",
  scopeDesc: "默认",
  scope: "platform",
  promptProfile: "官方 prompt",
};

function learned(
  id: string,
  patch: Partial<LearnedWritingStyle> = {}
): LearnedWritingStyle {
  return {
    id,
    scope: "product",
    name: `风格${id}`,
    sourceUrls: [],
    toneProfile: "语气",
    titlePattern: "标题",
    openingPattern: "开头",
    paragraphPattern: "段落",
    keySentencePattern: "金句",
    promptProfile: `固定风格提示词 ${id}`,
    sampleDigest: "摘要",
    createdAt: `2026-06-1${id}T00:00:00.000Z`,
    ...patch,
  };
}

describe("learned style helpers", () => {
  it("uses the visible fixed prompt as the generation style profile", () => {
    const style = learnedToWritingStyle(learned("1"));

    expect(style.promptProfile).toBe("固定风格提示词 1");
    expect(style.sampleText).toBe("摘要");
  });

  it("falls back to structured fields for old styles without promptProfile", () => {
    const oldStyle = learned("1", { promptProfile: undefined });
    const style = learnedToWritingStyle(oldStyle);

    expect(style.promptProfile).toContain("语气");
    expect(style.promptProfile).toContain("标题结构:标题");
    expect(style.promptProfile).toContain("不得照抄来源文章内容");
  });

  it("product generation picks learned styles first and keeps one cycle distinct", () => {
    const picks = buildProductStylePicks(
      5,
      [learned("1"), learned("2"), learned("3")],
      officialStyle,
      () => 0.5
    );

    expect(picks.map((pick) => pick.styleSource)).toEqual([
      "learned",
      "learned",
      "learned",
      "learned",
      "learned",
    ]);
    expect(new Set(picks.slice(0, 3).map((pick) => pick.styleId)).size).toBe(3);
    expect(picks.map((pick) => pick.styleName)).not.toContain("JOTO 官方");
  });

  it("product generation falls back to official style only when no learned style exists", () => {
    const picks = buildProductStylePicks(2, [], officialStyle, () => 0.5);

    expect(picks).toEqual([
      {
        styleId: "style-joto",
        styleName: "JOTO 官方",
        styleSource: "official",
      },
      {
        styleId: "style-joto",
        styleName: "JOTO 官方",
        styleSource: "official",
      },
    ]);
  });

  it("trend generation rotates through learned trend prompts instead of reusing the first", () => {
    const picks = buildTrendStylePicks(
      3,
      [
        learned("1", { scope: "trend", name: "热点一" }),
        learned("2", { scope: "trend", name: "热点二" }),
      ],
      () => 0.5
    );

    expect(picks.map((pick) => pick.trendStyleSource)).toEqual([
      "learned",
      "learned",
      "learned",
    ]);
    expect(new Set(picks.slice(0, 2).map((pick) => pick.styleId)).size).toBe(2);
  });

  it("trend fallback style cannot override the hotspot article contract", () => {
    const [pick] = buildTrendStylePicks(1, [], () => 0.5);

    expect(pick.styleOverride?.promptProfile).toContain("产品团队写给用户的完整公众号观察文");
    expect(pick.styleOverride?.promptProfile).toContain("风格只能影响表达方式");
    expect(pick.styleOverride?.promptProfile).toContain("不能改变任务骨架");
    expect(pick.styleOverride?.promptProfile).not.toContain("产品只在结尾一句轻点");
    expect(pick.styleOverride?.promptProfile).not.toContain("不写 01/02、小标题、引用块、列表");
  });

  it("learned trend styles are wrapped so old short-review rules stay expression-only", () => {
    const [pick] = buildTrendStylePicks(
      1,
      [
        learned("1", {
          scope: "trend",
          name: "短评旧风格",
          promptProfile:
            "用热点短评体写,产品只在结尾一句轻点,不要小标题,像第三方测评一样克制。",
        }),
      ],
      () => 0.5
    );

    expect(pick.styleOverride?.promptProfile).toContain("产品团队写给用户的完整公众号观察文");
    expect(pick.styleOverride?.promptProfile).toContain("风格只能影响表达方式");
    expect(pick.styleOverride?.promptProfile).toContain("不能改变产品回应策略");
    expect(pick.styleOverride?.promptProfile).not.toContain("产品只在结尾一句轻点");
    expect(pick.styleOverride?.promptProfile).not.toContain("不要小标题");
    expect(pick.styleOverride?.promptProfile).not.toContain("像第三方测评");
  });
});
