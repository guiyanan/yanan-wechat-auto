import { describe, expect, it } from "vitest";
import { finalizeGeneratedBody } from "@/lib/generatedArticleBody";

describe("finalizeGeneratedBody", () => {
  it("uses trend post-processing for trend articles before saving drafts", () => {
    const body = finalizeGeneratedBody({
      rawMarkdown: [
        "## 我们为什么关注这件事",
        "",
        "NotebookLM 平替测评不该出现在服装设计产品里。",
        "",
        "> 热点只是入口,用户真正关心的是落地后能不能少一轮反复。",
        "",
        "- 设计师需要先把参考图变成可讨论的方向",
        "- 主管需要判断这套方向能不能继续推进",
      ].join("\n"),
      isTrendArticle: true,
      trendContext: {
        product: "Fasium AI",
        productDesc: "AI fashion design platform for apparel teams.",
      },
    });

    expect(body).toContain("## 我们为什么关注这件事");
    expect(body).toContain("> 热点只是入口");
    expect(body).toContain("- 设计师需要先把参考图变成可讨论的方向");
    expect(body).not.toContain("NotebookLM");
  });
});
