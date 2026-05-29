import { describe, expect, it } from "vitest";
import { cleanGeneratedMarkdown } from "@/lib/generatedMarkdown";

describe("cleanGeneratedMarkdown", () => {
  it("removes AI prefaces, emoji bullets, and raw markdown bold markers", () => {
    const input = [
      "以下是为你生成的一篇文章",
      "",
      "- ✅ 拖一拖 **滑块**，就能调领高。",
      "- 💡 最后 Tech Pack 页面自动带齐尺寸表。",
      "",
      "不用再输一遍 15cm”。 **",
    ].join("\n");

    const output = cleanGeneratedMarkdown(input);

    expect(output).not.toContain("以下是");
    expect(output).not.toContain("✅");
    expect(output).not.toContain("💡");
    expect(output).not.toContain("**");
    expect(output).toContain("- 拖一拖 滑块");
  });

  it("does not delete a meaningful opening sentence that starts with 这是", () => {
    const output = cleanGeneratedMarkdown(
      "这是很多设计师每天都会遇到的小麻烦。\n\n下一段。"
    );

    expect(output).toContain("这是很多设计师每天都会遇到的小麻烦。");
  });
});
