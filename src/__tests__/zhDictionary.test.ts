import { describe, it, expect } from "vitest";
import {
  AI_VOCAB_REPLACEMENTS,
  COLLOCATION_SIMPLIFICATIONS,
  applyVocabReplacements,
  applyCollocationSimplifications,
  applyAllReplacements,
} from "@/lib/humanize/zhDictionary";

describe("zhDictionary · AI_VOCAB_REPLACEMENTS", () => {
  it("has at least 60 entries", () => {
    expect(AI_VOCAB_REPLACEMENTS.length).toBeGreaterThanOrEqual(60);
  });

  it("each entry has from and to fields", () => {
    for (const r of AI_VOCAB_REPLACEMENTS) {
      expect(typeof r.from).toBe("string");
      expect(r.from.length).toBeGreaterThan(0);
      expect(typeof r.to).toBe("string");
    }
  });

  it("no duplicate from values", () => {
    const froms = AI_VOCAB_REPLACEMENTS.map((r) => r.from);
    expect(new Set(froms).size).toBe(froms.length);
  });
});

describe("zhDictionary · COLLOCATION_SIMPLIFICATIONS", () => {
  it("has at least 20 entries", () => {
    expect(COLLOCATION_SIMPLIFICATIONS.length).toBeGreaterThanOrEqual(20);
  });

  it("regex patterns compile without error", () => {
    for (const r of COLLOCATION_SIMPLIFICATIONS) {
      if (r.isRegex) {
        expect(() => new RegExp(r.from, "g")).not.toThrow();
      }
    }
  });
});

describe("zhDictionary · applyVocabReplacements", () => {
  it("replaces corporate buzzwords with plain language", () => {
    expect(applyVocabReplacements("我们要赋能企业")).toBe("我们要支持企业");
    expect(applyVocabReplacements("这是底层逻辑")).toBe("这是基本原理");
    expect(applyVocabReplacements("闭环管理")).toBe("完整流程管理");
  });

  it("deletes authority fillers", () => {
    expect(applyVocabReplacements("值得注意的是，数据增长了")).toBe(
      "，数据增长了"
    );
    expect(applyVocabReplacements("众所周知，AI 很强")).toBe("，AI 很强");
    expect(applyVocabReplacements("毋庸置疑，结论成立")).toBe("，结论成立");
  });

  it("deletes era clichés", () => {
    expect(applyVocabReplacements("在当今社会，技术发展")).toBe("，技术发展");
  });

  it("deletes summary clichés", () => {
    expect(applyVocabReplacements("综上所述，方案可行")).toBe("，方案可行");
    expect(applyVocabReplacements("总而言之，效果好")).toBe("，效果好");
  });

  it("simplifies superlatives", () => {
    expect(applyVocabReplacements("这至关重要")).toBe("这很关键");
    expect(applyVocabReplacements("前所未有的突破")).toBe("空前的的突破");
  });

  it("handles multiple replacements in same text", () => {
    const input = "赋能企业,打造闭环生态";
    const result = applyVocabReplacements(input);
    expect(result).toBe("支持企业,建设完整流程体系");
  });

  it("preserves text without matches", () => {
    const plain = "今天天气不错，适合出门";
    expect(applyVocabReplacements(plain)).toBe(plain);
  });
});

describe("zhDictionary · applyCollocationSimplifications", () => {
  it("simplifies 进行+verb patterns", () => {
    expect(applyCollocationSimplifications("进行分析")).toBe("分析");
    expect(applyCollocationSimplifications("进行测试后")).toBe("测试后");
    expect(applyCollocationSimplifications("进行部署")).toBe("部署");
  });

  it("simplifies 实现了+noun patterns", () => {
    expect(applyCollocationSimplifications("实现了突破")).toBe("突破了");
    expect(applyCollocationSimplifications("实现了提升")).toBe("提升了");
  });

  it("simplifies verbose achievement phrases", () => {
    expect(applyCollocationSimplifications("取得了显著的成效")).toBe("效果明显");
    expect(applyCollocationSimplifications("得到了广泛的应用")).toBe("用得广");
  });

  it("handles regex-based flexible matching", () => {
    expect(applyCollocationSimplifications("进行了一次调研")).toBe("调研");
    expect(applyCollocationSimplifications("进行了深入的分析")).toBe("分析");
  });

  it("preserves text without matches", () => {
    const plain = "我们完成了三个项目";
    expect(applyCollocationSimplifications(plain)).toBe(plain);
  });
});

describe("zhDictionary · applyAllReplacements", () => {
  it("chains vocab + collocation replacements", () => {
    const input = "赋能企业后，我们进行分析，综上所述效果显著";
    const result = applyAllReplacements(input);
    expect(result).toContain("支持企业");
    expect(result).toContain("分析");
    expect(result).not.toContain("赋能");
    expect(result).not.toContain("进行分析");
    expect(result).not.toContain("综上所述");
  });

  it("is a pure function (does not mutate input)", () => {
    const input = "赋能企业";
    const frozen = input;
    applyAllReplacements(input);
    expect(input).toBe(frozen);
  });
});
