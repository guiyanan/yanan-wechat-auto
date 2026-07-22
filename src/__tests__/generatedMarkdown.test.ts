import { describe, expect, it } from "vitest";
import {
  cleanGeneratedMarkdown,
  cleanGeneratedTitle,
  extractGeneratedBodyTitle,
  postProcessGeneratedMarkdown,
  resolveGeneratedArticleTitle,
} from "@/lib/generatedMarkdown";

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

  it("removes internal planning labels from visible article text", () => {
    const output = cleanGeneratedMarkdown(
      "## 01 钩子：当设计师第一次听到 AI 懂服装时\n\n事实点：Fasium 支持 Web 端注册登录后使用。"
    );

    expect(output).toContain("## 01 当设计师第一次听到 AI 懂服装时");
    expect(output).toContain("Fasium 支持 Web 端注册登录后使用。");
    expect(output).not.toContain("钩子：");
    expect(output).not.toContain("事实点：");
  });

  it("removes leaked golden-sentence labels from paragraphs and quotes", () => {
    const output = cleanGeneratedMarkdown(
      [
        "> 金句：数据不发烫，但敢拍板。",
        "",
        "- 蓝色金句：少一点猜，会议就少一点绕。",
      ].join("\n")
    );

    expect(output).toContain("> 数据不发烫，但敢拍板。");
    expect(output).toContain("- 少一点猜，会议就少一点绕。");
    expect(output).not.toContain("金句：");
    expect(output).not.toContain("蓝色金句：");
  });

  it("removes generated title lines from the article body", () => {
    const output = cleanGeneratedMarkdown(
      "标题：还在截图抄功能表？竞品报告先别装专业\n\n01 很多人做竞品分析,第一步就是打开官网。"
    );

    expect(output).not.toContain("标题：");
    expect(output).not.toContain("还在截图抄功能表");
    expect(output).toContain("01 很多人做竞品分析");
  });

  it("removes bare generated title lines from the article body", () => {
    const input = [
      "【产品自研】做了五年服装设计，最累的不是想不出款式，而是每次都要在十几个平台里“找自己”",
      "",
      "## 01 凌晨两点，设计主管还在找素材",
      "",
      "正文继续讲真实流程。",
    ].join("\n");

    const output = cleanGeneratedMarkdown(input);

    expect(output).not.toContain("【产品自研】做了五年服装设计");
    expect(output).toContain("## 01 凌晨两点，设计主管还在找素材");
    expect(output).toContain("正文继续讲真实流程。");
  });

  it("extracts a bare generated body title as a fallback article title", () => {
    const input = [
      "【产品自研】做了五年服装设计，最累的不是想不出款式，而是每次都要在十几个平台里“找自己”",
      "",
      "## 01 凌晨两点，设计主管还在找素材",
    ].join("\n");

    expect(extractGeneratedBodyTitle(input)).toBe(
      "【产品自研】做了五年服装设计，最累的不是想不出款式，而是每次都要在十几个平台里“找自己”"
    );
  });

  it("uses a body title when title generation only returns placeholders", () => {
    const input = [
      "【产品自研】做了五年服装设计，最累的不是想不出款式，而是每次都要在十几个平台里“找自己”",
      "",
      "## 01 凌晨两点，设计主管还在找素材",
    ].join("\n");

    const resolved = resolveGeneratedArticleTitle({
      titles: ["未命名标题"],
      bodyMarkdown: input,
      fallbackTitle: "",
    });

    expect(resolved.title).toBe(
      "【产品自研】做了五年服装设计，最累的不是想不出款式，而是每次都要在十几个平台里“找自己”"
    );
    expect(resolved.titleCandidates).toEqual([resolved.title]);
  });

  it("removes chapter and opening labels from numbered JOTO headings", () => {
    const output = cleanGeneratedMarkdown(
      [
        "## 01 开场：一张美图，卡在打样前",
        "",
        "## 02 第一章：为什么99%的 AI 设计图，进不了打样",
        "",
        "## 03 第二章：把碎花连衣裙讲清楚",
      ].join("\n")
    );

    expect(output).toContain("## 01 一张美图，卡在打样前");
    expect(output).toContain("## 02 为什么99%的 AI 设计图，进不了打样");
    expect(output).toContain("## 03 把碎花连衣裙讲清楚");
    expect(output).not.toContain("开场：");
    expect(output).not.toContain("第一章：");
    expect(output).not.toContain("第二章：");
  });

  it("removes internal labels from titles while keeping numbering text intact", () => {
    expect(cleanGeneratedTitle("01 开场：这次别只看热闹")).toBe(
      "01 这次别只看热闹"
    );
    expect(cleanGeneratedTitle("第一章：为什么工作还是卡住")).toBe(
      "为什么工作还是卡住"
    );
    expect(cleanGeneratedTitle("钩子：AI 运维真正该看什么")).toBe(
      "AI 运维真正该看什么"
    );
  });

  it("extracts the first usable title from JSON-array-like title fragments", () => {
    expect(cleanGeneratedTitle('["设计团队的内耗，藏在哪里","打样前3')).toBe(
      "设计团队的内耗，藏在哪里"
    );
    expect(cleanGeneratedTitle('["试用AI数据分析工具被忽悠瘸了？","下单前最该先看的一件事"]')).toBe(
      "试用AI数据分析工具被忽悠瘸了？"
    );
  });
});

describe("postProcessGeneratedMarkdown", () => {
  it("keeps all sections even when contentLength is short", () => {
    const longParagraph =
      "这个段落用来模拟模型很爱重复解释同一件事：不用在多个系统之间来回切换，也不用把相同的信息复制三遍，团队可以把注意力放回真正要处理的问题上。";
    const input = [
      "开头先说一个很日常的场景。",
      "",
      "## 01 第一节",
      longParagraph.repeat(7),
      "",
      "## 02 第二节",
      longParagraph.repeat(7),
      "",
      "## 03 第三节不应该出现在水文里",
      longParagraph.repeat(7),
    ].join("\n");

    const output = postProcessGeneratedMarkdown(input, "short");

    expect(output).toContain("## 01 第一节");
    expect(output).toContain("## 02 第二节");
    expect(output).toContain("## 03 第三节不应该出现在水文里");
    expect(output.replace(/\s/g, "").length).toBeGreaterThan(1250);
  });

  it("removes repeated paragraph blocks while keeping distinct content", () => {
    const repeated =
      "设计师不用再导出、重命名、上传网盘、群里提醒一遍，因为这些动作已经被放进同一个工作流里。";
    const input = [
      "**开头**",
      "",
      repeated,
      "",
      repeated,
      "",
      "这是一段新的信息，讲的是运营同事收到文件后可以直接继续接力。",
    ].join("\n");

    const output = postProcessGeneratedMarkdown(input, "standard");

    expect(output).not.toContain("**");
    expect(output.match(/设计师不用再导出/g)).toHaveLength(1);
    expect(output).toContain("运营同事收到文件后可以直接继续接力");
  });

  it("does not cap standard and deep drafts to fixed section limits", () => {
    const input = Array.from({ length: 6 }, (_, index) => {
      const no = String(index + 1).padStart(2, "0");
      return [`## ${no} 小节${no}`, `这是第${no}节的内容。`].join("\n");
    }).join("\n\n");

    const standard = postProcessGeneratedMarkdown(input, "standard");
    const deep = postProcessGeneratedMarkdown(input, "deep");

    expect(standard.match(/^##\s+/gm)).toHaveLength(6);
    expect(deep.match(/^##\s+/gm)).toHaveLength(6);
  });
});
