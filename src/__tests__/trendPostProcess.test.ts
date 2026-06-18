import { describe, expect, it } from "vitest";
import {
  postProcessTrendBody,
  postProcessTrendTitle,
} from "@/lib/trendPostProcess";

const fasium = {
  product: "Fasium AI",
  productDesc:
    "AI fashion design platform for apparel teams, supports garment design, virtual model preview and Tech Pack.",
};

describe("trend post processing", () => {
  function paragraphCount(text: string): number {
    return text.split(/\n{2,}/).filter((paragraph) => paragraph.trim()).length;
  }

  it("cleans hotspot titles that look like hard-to-read product copy", () => {
    const title = postProcessTrendTitle(
      "服装厂打工人截图求救：这版Tech Pack又双叒叕被裁床拒了",
      fasium
    );

    expect(title).not.toContain("：");
    expect(title).not.toContain(":");
    expect(title).not.toContain("Tech Pack");
    expect(title).not.toContain("又双叒叕");
    expect(title.length).toBeLessThanOrEqual(28);
  });

  it("removes unrelated notebook topics, fictional names, and dense fake parameters for fashion articles", () => {
    const body = postProcessTrendBody(
      [
        "你刷到NotebookLM平替测评、小红书对比文模板、AI会议纪要工具推荐时，其实也在悄悄统一一个困惑。",
        "林薇盯着PS里第17版配色方案发呆，直到凌晨四点收到主管微信。",
        "更别提 Pantone 编号输错一位，15-1247TPG 和 15-1247TCX，袖长58cm+缝份1.2cm，克重185g/m²，QC 直接退回。",
        "最近很多服装团队都在聊 AI 设计工具。",
        "大家不是想看一堆专业词，只是想知道改稿能不能少一点来回。",
        "如果你也在找类似方向，最后再顺手看一眼 Fasium AI 就够了。",
      ].join("\n\n"),
      fasium
    );

    expect(body).not.toContain("NotebookLM");
    expect(body).not.toContain("林薇");
    expect(body).not.toContain("Pantone");
    expect(body).not.toContain("15-1247");
    expect(body).not.toContain("58cm");
    expect(body).not.toContain("185g");
    expect(body).not.toContain("：");
    expect(body).not.toContain(":");
    expect(body).toContain("很多服装团队都在聊 AI 设计工具");
    expect(body).toContain("改稿能不能少一点来回");
  });

  it("applies unrelated-anchor filtering to non-fashion products too", () => {
    const body = postProcessTrendBody(
      [
        "NotebookLM 平替测评又火了,大家都在讨论 PDF 总结怎么选。",
        "最近很多私域团队更关心的是客户消息太散,跟进记录到处都是。",
        "如果你也在找类似方向,最后再顺手看一眼 Lumen 营销云 就够了。",
      ].join("\n\n"),
      {
        product: "Lumen 营销云",
        productDesc: "私域运营自动化 + SCRM,帮助销售团队做客户跟进。",
      }
    );

    expect(body).not.toContain("NotebookLM");
    expect(body).not.toContain("PDF 总结");
    expect(body).toContain("私域团队");
    expect(body).toContain("客户消息太散");
  });

  it("keeps NotebookLM hooks when the product context is actually about AI notes", () => {
    const body = postProcessTrendBody(
      [
        "NotebookLM 带火了 AI 笔记这类需求。",
        "很多人不是想追新工具,只是想把 PDF、会议记录和资料问答放到一起。",
        "如果你也在找类似方向,最后再顺手看一眼 Nimbus Notes 就够了。",
      ].join("\n\n"),
      {
        product: "Nimbus Notes",
        productDesc: "面向企业知识库的 AI 笔记产品,支持 PDF 总结和资料问答。",
      }
    );

    expect(body).toContain("NotebookLM");
    expect(body).toContain("AI 笔记");
  });

  it("keeps an existing 4-7 paragraph hotspot article instead of chopping it into sentence chunks", () => {
    const input = [
      "最近很多人刷到 AI 设计工具,第一反应不是想研究模型,而是想看看它到底能不能少改几轮。朋友圈里有人晒出一张试衣图,底下马上有人问这是哪个工具做的。评论里最常见的问题也很朴素,这东西真能用到工作里吗。",
      "这种内容会被点开,不是因为大家突然都懂设计,而是因为改图、找参考、等反馈这些小麻烦太常见了。",
      "真正要看的也不是图有多炫。普通团队更关心的是,它能不能把想法先变成一个能讨论的样子。",
      "如果你也在找类似方向,最后再顺手看一眼 Fasium AI 就够了。",
    ].join("\n\n");

    const body = postProcessTrendBody(input, fasium);

    expect(paragraphCount(body)).toBe(4);
    expect(body).toContain("朋友圈里有人晒出一张试衣图");
    expect(body).toContain("底下马上有人问这是哪个工具做的");
    expect(body).toContain("评论里最常见的问题也很朴素");
  });

  it("preserves公众号 structure instead of stripping headings, callouts, and lists", () => {
    const input = [
      "## 我们为什么关注这件事",
      "",
      "最近 AI 服装设计工具被频繁讨论。对产品团队来说,真正值得看的不是热闹,而是用户为什么会把注意力放到这里。",
      "",
      "> 热点只是入口,用户真正关心的是落地后能不能少一轮反复。",
      "",
      "## 这个问题落到工作里",
      "",
      "- 设计师需要先把参考图变成可讨论的方向",
      "- 主管需要判断这套方向能不能继续推进",
      "",
      "Fasium AI 要回应的就是这类判断和推进问题,而不是把热点写成功能清单。",
    ].join("\n");

    const body = postProcessTrendBody(input, fasium);

    expect(body).toContain("## 我们为什么关注这件事");
    expect(body).toContain("> 热点只是入口");
    expect(body).toContain("- 设计师需要先把参考图变成可讨论的方向");
    expect(body).toContain("- 主管需要判断这套方向能不能继续推进");
  });

  it("does not truncate a complete公众号 article to seven paragraphs", () => {
    const input = Array.from({ length: 9 }, (_, index) => {
      return `第 ${index + 1} 段,这是一段围绕热点、用户问题和产品团队回应展开的新信息。它不是重复撑篇幅,而是在补充不同判断。`;
    }).join("\n\n");

    const body = postProcessTrendBody(input, fasium);

    expect(paragraphCount(body)).toBe(9);
    expect(body).toContain("第 9 段");
  });

  it("splits a single long hotspot paragraph back into a 4-7 paragraph article", () => {
    const input =
      "最近很多人刷到 AI 设计工具,第一反应不是想研究模型,而是想看看它到底能不能少改几轮。朋友圈里有人晒出一张试衣图,底下马上有人问这是哪个工具做的。这种内容会被点开,不是因为大家突然都懂设计,而是因为改图、找参考、等反馈这些小麻烦太常见了。真正要看的也不是图有多炫。普通团队更关心的是,它能不能把想法先变成一个能讨论的样子。如果只是看热闹,刷完就过去了。可一旦要真的用到工作里,就得看它能不能接住日常改稿和确认。所以试用前别只看成品图,也要看看过程里是不是容易复用、容易修改、容易和同事对齐。如果你也在找类似方向,最后再顺手看一眼 Fasium AI 就够了。";

    const body = postProcessTrendBody(input, fasium);

    expect(paragraphCount(body)).toBeGreaterThanOrEqual(4);
    expect(paragraphCount(body)).toBeLessThanOrEqual(7);
    expect(body).not.toContain("http");
    expect(body).not.toContain("01");
  });
});
