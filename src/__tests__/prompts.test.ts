import { describe, it, expect } from "vitest";
import {
  getTemplate,
  renderPrompt,
  renderTemplate,
  PromptVariableError,
} from "@/lib/prompts";

describe("prompts · getTemplate", () => {
  it("returns distinct templates per node", () => {
    const nodes = ["outline", "body", "titles", "humanize", "factcheck"] as const;
    const names = nodes.map((n) => getTemplate(n).node);
    expect(new Set(names).size).toBe(nodes.length);
  });

  it("uses qwen-max with low temperature for factcheck (PRD 6.2.5)", () => {
    const t = getTemplate("factcheck");
    expect(t.model).toBe("qwen-max");
    expect(t.temperature).toBe(0.3);
  });

  it("uses higher temperature for titles than outline (PRD 6.2.5)", () => {
    expect(getTemplate("titles").temperature).toBeGreaterThan(
      getTemplate("outline").temperature
    );
  });
});

describe("prompts · renderTemplate", () => {
  it("replaces placeholders with variable values", () => {
    expect(
      renderTemplate("hello {name}!", ["name"], { name: "Tommy" })
    ).toBe("hello Tommy!");
  });

  it("replaces multiple occurrences", () => {
    expect(
      renderTemplate("{a}-{a}-{b}", ["a", "b"], { a: "x", b: "y" })
    ).toBe("x-x-y");
  });

  it("throws PromptVariableError when a declared var is missing", () => {
    expect(() =>
      renderTemplate("{x}{y}", ["x", "y"], { x: "1" })
    ).toThrow(PromptVariableError);
  });

  it("empty string is a valid value (not missing)", () => {
    expect(
      renderTemplate("[{x}]", ["x"], { x: "" })
    ).toBe("[]");
  });

  it("ignores extra keys in vars", () => {
    expect(
      renderTemplate("hi {n}", ["n"], { n: "Bob", extra: "ignored" })
    ).toBe("hi Bob");
  });
});

describe("prompts · renderPrompt", () => {
  it("renders system + user for outline with all variables", () => {
    const out = renderPrompt("outline", {
      product: "Loop RPA",
      productDesc: "浏览器 Agent",
      angle: "产品测评",
      angleInstruction: "实测对比",
    });
    expect(out.system).toContain("你是一个资深的企业公众号内容编辑");
    expect(out.user).toContain("Loop RPA");
    expect(out.user).toContain("产品测评");
    expect(out.model).toBe("qwen-plus");
    expect(out.temperature).toBe(0.8);
    expect(out.maxTokens).toBe(1200);
  });

  it("throws when body node is missing required vars", () => {
    expect(() =>
      renderPrompt("body", {
        product: "p",
        productDesc: "d",
        angle: "a",
        angleInstruction: "i",
        // missing styleName, styleProfile, styleSample, outline
      })
    ).toThrow(PromptVariableError);
  });

  it("humanize template inlines intent and text", () => {
    const out = renderPrompt("humanize", {
      intent: "扩写",
      text: "原文段落",
      styleName: "卡兹克",
      styleProfile: "口语锐利",
      articleType: "产品推广",
    });
    expect(out.user).toContain("【重写意图】扩写");
    expect(out.user).toContain("原文段落");
    expect(out.system).toContain("卡兹克");
  });

  it("humanize injects 产品推广 branch block (business-perspective, no colloquial)", () => {
    const out = renderPrompt("humanize", {
      intent: "x",
      text: "y",
      styleName: "s",
      styleProfile: "p",
      articleType: "产品推广",
    });
    expect(out.system).toContain("【产品推广】专属约束");
    expect(out.system).toContain("业务视角开篇");
    expect(out.system).toContain("效益数字");
    expect(out.system).toContain("禁止第一人称随意表达");
    // Old colloquial prescriptions are gone
    expect(out.system).not.toContain("第一人称试用视角");
    expect(out.system).not.toContain("做对一件事让 Y 翻倍");
    expect(out.system).not.toContain("【场景推广】专属约束");
    expect(out.system).not.toContain("【峰会消息】专属约束");
  });

  it("humanize injects 场景推广 branch block (scene-driven, no colloquial)", () => {
    const out = renderPrompt("humanize", {
      intent: "x",
      text: "y",
      styleName: "s",
      styleProfile: "p",
      articleType: "场景推广",
    });
    expect(out.system).toContain("【场景推广】专属约束");
    expect(out.system).toContain("传统方式 → 新方案");
    expect(out.system).toContain("场景驱动");
    expect(out.system).toContain("禁止口语化叙述");
    // Old colloquial prescriptions are gone
    expect(out.system).not.toContain("第一人称视角更重");
    expect(out.system).not.toContain("这个流程可以直接抄");
    expect(out.system).not.toContain("【产品推广】专属约束");
    expect(out.system).not.toContain("【峰会消息】专属约束");
  });

  it("humanize injects 峰会消息 branch block (third-person reportage)", () => {
    const out = renderPrompt("humanize", {
      intent: "x",
      text: "y",
      styleName: "s",
      styleProfile: "p",
      articleType: "峰会消息",
    });
    expect(out.system).toContain("【峰会消息】专属约束");
    expect(out.system).toContain("客观第三人称报道体");
    expect(out.system).toContain("嘉宾名");
    expect(out.system).not.toContain("【产品推广】专属约束");
    expect(out.system).not.toContain("【场景推广】专属约束");
  });

  it("humanize throws when articleType is missing", () => {
    expect(() =>
      renderPrompt("humanize", {
        intent: "x",
        text: "y",
        styleName: "s",
        styleProfile: "p",
        // missing articleType
      })
    ).toThrow(PromptVariableError);
  });

  it("humanize throws when articleType is unrecognized", () => {
    expect(() =>
      renderPrompt("humanize", {
        intent: "x",
        text: "y",
        styleName: "s",
        styleProfile: "p",
        articleType: "随便写写",
      })
    ).toThrow(PromptVariableError);
  });

  it("body system contains fixed 3-section skeleton requirement", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "浏览器 Agent",
      angle: "产品推广",
      angleInstruction: "效益数字",
      styleName: "JOTO",
      styleProfile: "专业克制",
      styleSample: "示例段落",
      outline: "## 大纲",
    });
    expect(out.system).toContain("固定文章骨架");
    expect(out.system).toContain("钩子");
    expect(out.system).toContain("如何使用");
    expect(out.system).toContain("为什么选我们");
  });

  it("body system contains non-colloquial tone requirement", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "浏览器 Agent",
      angle: "产品推广",
      angleInstruction: "效益数字",
      styleName: "JOTO",
      styleProfile: "专业克制",
      styleSample: "示例段落",
      outline: "## 大纲",
    });
    expect(out.system).toContain("不口语化");
    expect(out.system).toContain("不过度学术");
    expect(out.system).toContain("业务决策层");
  });

  it("body user prompt references 3-section structure", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "浏览器 Agent",
      angle: "产品推广",
      angleInstruction: "效益数字",
      styleName: "JOTO",
      styleProfile: "专业克制",
      styleSample: "示例段落",
      outline: "## 大纲",
    });
    expect(out.user).toContain("钩子 → 如何使用 → 为什么选我们");
  });

  it("humanize system always carries shared cliché blacklist", () => {
    for (const articleType of ["产品推广", "场景推广", "峰会消息"] as const) {
      const out = renderPrompt("humanize", {
        intent: "x",
        text: "y",
        styleName: "s",
        styleProfile: "p",
        articleType,
      });
      expect(out.system).toContain("通用硬约束");
      // Cliché blacklist is shared across all branches.
      expect(out.system).toContain("赋能");
      expect(out.system).toContain("毋庸置疑");
    }
  });

  it("humanize system contains expanded AI-tone blacklist from chineseAntiPatterns", () => {
    const out = renderPrompt("humanize", {
      intent: "x",
      text: "y",
      styleName: "s",
      styleProfile: "p",
      articleType: "产品推广",
    });
    // Should contain the pipe-separated blacklist from getPromptBlacklist()
    expect(out.system).toContain("AI 腔黑名单");
    expect(out.system).toContain("值得注意的是");
    expect(out.system).toContain("在当今");
    expect(out.system).toContain("闭环");
    expect(out.system).toContain("底层逻辑");
    expect(out.system).toContain("降本增效");
    expect(out.system).toContain("综上所述");
    expect(out.system).toContain("令人瞩目");
  });

  it("humanize system contains structural anti-pattern constraints", () => {
    const out = renderPrompt("humanize", {
      intent: "x",
      text: "y",
      styleName: "s",
      styleProfile: "p",
      articleType: "场景推广",
    });
    expect(out.system).toContain("结构反模式");
    expect(out.system).toContain("三件套排比");
    expect(out.system).toContain("机械递进");
    expect(out.system).toContain("总结式收尾");
    expect(out.system).toContain("句长均匀");
    expect(out.system).toContain("价值拔高");
  });

  // ─── China-localization constraint ────────────────────────────────
  // Published on WeChat Official Account (微信公众号) — all examples,
  // companies, and memes must be Chinese; foreign references break tone
  // and reduce reader trust.

  it("body system requires concrete paragraphs under every ### subheading", () => {
    // Without this, Qwen tends to compress all content into headings,
    // leaving the article structure-rich but paragraph-poor — and the
    // humanize step has nothing to rewrite.
    const out = renderPrompt("body", {
      product: "p",
      productDesc: "d",
      angle: "a",
      angleInstruction: "i",
      styleName: "s",
      styleProfile: "p",
      styleSample: "x",
      outline: "## o",
    });
    expect(out.system).toMatch(/正文段落|展开段落|完整段落/);
    // Explicit prohibition against packing content into headings
    expect(out.system).toContain("禁止");
  });

  it("body system enforces China-only examples / companies / memes", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "x",
      angle: "产品推广",
      angleInstruction: "y",
      styleName: "JOTO",
      styleProfile: "z",
      styleSample: "s",
      outline: "## o",
    });
    expect(out.system).toMatch(/中国本土化|中国本土/);
    expect(out.system).toContain("不得使用中国以外");
    // Positive examples invoked by name so the model knows what's OK
    expect(out.system).toMatch(/阿里|腾讯|字节|美团|拼多多|京东|华为/);
    // Anti-examples explicitly banned
    expect(out.system).toMatch(/Google|Apple|Amazon|Tesla|OpenAI/);
  });

  it("humanize system enforces China-only examples across all branches", () => {
    for (const articleType of ["产品推广", "场景推广", "峰会消息"] as const) {
      const out = renderPrompt("humanize", {
        intent: "x",
        text: "y",
        styleName: "s",
        styleProfile: "p",
        articleType,
      });
      expect(out.system).toMatch(/中国本土化|中国本土/);
      expect(out.system).toContain("不得使用中国以外");
      expect(out.system).toMatch(/阿里|腾讯|字节|美团|拼多多|京东|华为/);
    }
  });
});
