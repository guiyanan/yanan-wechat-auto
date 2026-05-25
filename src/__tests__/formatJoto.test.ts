import { describe, expect, it } from "vitest";
import { basicFormatJotoPaste } from "@/lib/jotoFormatter";

describe("basicFormatJotoPaste", () => {
  it("turns polished text into clean JOTO-ready html without raw markdown or emoji bullets", () => {
    const result = basicFormatJotoPaste({
      title: "设计时间去哪儿了？",
      rawText: [
        "你有没有发现，设计师最烦的不是画图。",
        "",
        "## 文件到底散在哪",
        "",
        "- ⭐ 打开 PS、Sketch、Figma，找最新版",
        "- ✅ 群里 @ 人确认谁改过",
        "- 📌 最后再把 **15cm** 重新输一遍",
        "",
        "> 设计开始这件事，应该比双击图标还快。",
      ].join("\n"),
    });

    expect(result.title).toBe("设计时间去哪儿了？");
    expect(result.contentHtml).toContain("<h2>文件到底散在哪</h2>");
    expect(result.contentHtml).toContain("<ul>");
    expect(result.contentHtml).toContain("<strong>15cm</strong>");
    expect(result.contentHtml).not.toContain("⭐");
    expect(result.contentHtml).not.toContain("✅");
    expect(result.contentHtml).not.toContain("📌");
    expect(result.contentHtml).not.toContain("**");
  });

  it("uses the first non-empty line as the title when no title is provided", () => {
    const result = basicFormatJotoPaste({
      rawText: "AI 真的懂服装吗？\n\n第一段正文。\n\n第二段正文。",
    });

    expect(result.title).toBe("AI 真的懂服装吗？");
    expect(result.contentHtml).toContain("<p>第一段正文。</p>");
    expect(result.contentHtml).not.toContain("<p>AI 真的懂服装吗？</p>");
  });
});
