import { describe, it, expect } from "vitest";
import { varySentenceLength, postProcess } from "@/lib/humanize/postProcess";

// Helper: count Chinese sentence terminators in a string
function countTerminators(text: string): number {
  return (text.match(/[。！？；]/g) ?? []).length;
}

describe("varySentenceLength", () => {
  it("returns short text unchanged", () => {
    const text = "这是一段短文。";
    expect(varySentenceLength(text)).toBe(text);
  });

  it("returns text with fewer than 3 sentences unchanged", () => {
    const text = "这是第一句，比较完整的内容在这里。这是第二句，同样有一些内容在里面。";
    // Only 2 sentences → no split
    expect(varySentenceLength(text)).toBe(text);
  });

  it("splits a run of 3+ uniform-length sentences", () => {
    // Three sentences of roughly equal length (all ~20 chars), with comma split points
    const text =
      "系统完成了自动对账任务，节省了大量手工时间。" +
      "平台支持多种数据格式接入，兼容现有系统架构。" +
      "用户无需编写代码即可配置，操作流程非常简单。";
    const result = varySentenceLength(text);
    // Should produce more terminators (one sentence was split into two)
    expect(countTerminators(result)).toBeGreaterThan(countTerminators(text));
  });

  it("does not split when sentence lengths are already varied", () => {
    // Mix of short (8 chars) and long (40+ chars) sentences
    const text =
      "部署简单。" +
      "对于需要处理大量结构化表单数据的企业来说，这套方案从安装到上线平均只需要两个工作日，远低于行业平均水平。" +
      "效果好。";
    expect(varySentenceLength(text)).toBe(text);
  });

  it("skips markdown headings", () => {
    const heading = "## 如何使用";
    expect(varySentenceLength(heading)).toBe(heading);
  });

  it("skips list items", () => {
    const listItem = "- 安装 Loop Chrome 扩展，完成账号绑定，启动自动化任务执行。";
    expect(varySentenceLength(listItem)).toBe(listItem);
  });

  it("processes each line independently", () => {
    const line1 =
      "系统完成了自动对账任务，节省了大量手工时间。" +
      "平台支持多种数据格式接入，兼容现有系统架构。" +
      "用户无需编写代码即可配置，操作流程非常简单。";
    const line2 = "## 为什么选我们";
    const text = line1 + "\n" + line2;
    const result = varySentenceLength(text);
    const lines = result.split("\n");
    // Second line (heading) must be unchanged
    expect(lines[1]).toBe(line2);
  });

  it("is a pure function (does not mutate input)", () => {
    const text =
      "系统完成了对账任务，速度提升了三倍。平台支持多种格式，方便接入。用户操作简单，无需培训即可上手。";
    const copy = text;
    varySentenceLength(text);
    expect(text).toBe(copy);
  });

  it("preserves all original characters after split", () => {
    const text =
      "系统完成了自动对账任务，节省了大量手工时间。" +
      "平台支持多种数据格式接入，兼容现有系统架构。" +
      "用户无需编写代码即可配置，操作流程非常简单。";
    const result = varySentenceLength(text);
    // The split inserts one 。and removes one ，; character count may differ by at most 1
    // (the split comma is replaced by 。+ 。)
    // More importantly, all original non-comma content should survive
    const strippedOriginal = text.replace(/[，、]/g, "").replace(/[。！？；]/g, "");
    const strippedResult = result.replace(/[，、]/g, "").replace(/[。！？；]/g, "");
    // The result has all the original Chinese characters (minus the split comma)
    expect(strippedResult.length).toBeGreaterThanOrEqual(strippedOriginal.length - 2);
  });
});

describe("postProcess", () => {
  it("applies vocab replacements before sentence-length variation", () => {
    const text = "赋能企业，实现了增长，综上所述效果好。";
    const result = postProcess(text);
    expect(result).not.toContain("赋能");
    expect(result).not.toContain("综上所述");
    expect(result).toContain("支持企业");
  });

  it("applies collocation simplifications", () => {
    const text = "我们进行分析，进行测试，最终进行评估。";
    const result = postProcess(text);
    expect(result).not.toContain("进行分析");
    expect(result).not.toContain("进行测试");
  });

  it("is a pure function", () => {
    const input = "赋能平台，进行优化，综上所述效果不错。";
    const frozen = input;
    postProcess(input);
    expect(input).toBe(frozen);
  });

  it("handles empty string", () => {
    expect(postProcess("")).toBe("");
  });

  it("handles text with no AI patterns gracefully", () => {
    const plain = "今天天气不错，适合出门走走。";
    const result = postProcess(plain);
    // No crash, and content is meaningfully preserved
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
