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
    });
    expect(out.user).toContain("【重写意图】扩写");
    expect(out.user).toContain("原文段落");
    expect(out.system).toContain("卡兹克");
  });
});
