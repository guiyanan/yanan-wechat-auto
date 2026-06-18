import { describe, expect, it } from "vitest";
import {
  buildFallbackTrendTitles,
  buildTrendTitlePrompt,
  buildTrendPrompt,
  fallbackTrendBody,
} from "@/lib/trendGenerationPrompt";

// Phase 1 回归锚点:
//   - 热点稿身份是产品团队写给用户的完整公众号观察文
//   - 热点是入口,用户问题是主线,产品团队回应是后半段承接
//   - 风格只能改变表达方式,不能覆盖身份、结构和产品回应策略

const OUTLINE_VARS = {
  product: "Lumen 营销云",
  productDesc: "私域运营自动化 + SCRM",
  angle: "工具越多,用户越烦",
  angleInstruction: "外部话题噱头",
  sourcePack: "同类工具最近被频繁讨论。",
  lengthInstruction: "水文",
  styleName: "热点风格",
  styleProfile: "轻松",
};

const BODY_VARS = { ...OUTLINE_VARS, outline: "先写外部热闹。" };

describe("trend generation prompt", () => {
  it("system anchors hotspot articles as product-team公众号观察文", () => {
    const body = buildTrendPrompt("body", BODY_VARS);
    expect(body.system).toContain("产品团队写给用户的完整公众号观察文");
    expect(body.system).toContain("不得装成第三方测评");
    expect(body.system).toContain("不得写成热点短评");
    expect(body.system).toContain("风格只能影响表达方式");
    expect(body.system).not.toContain("像朋友聊天讲一个最近刷到的事");
    expect(body.system).not.toContain("它不是趋势分析,不是产品稿");
  });

  it("keeps the hard discipline: facts only from sources, no fabrication", () => {
    const body = buildTrendPrompt("body", BODY_VARS);
    expect(body.system).toContain("只用【素材】里有的");
    expect(body.system).toContain("素材没有就不写数字");
    expect(body.system).toContain("不编人名、客户故事、参数型号");
    expect(body.system).toContain("不硬蹭");
  });

  it("keeps the structural contract: hotspot to user problem to product-team response", () => {
    const body = buildTrendPrompt("body", BODY_VARS);
    expect(body.system).toContain("热点现象");
    expect(body.system).toContain("用户困惑");
    expect(body.system).toContain("真实工作问题");
    expect(body.system).toContain("产品团队视角");
    expect(body.system).toContain("我们的回应");
    expect(body.user).toContain("产品团队视角");
    expect(body.user).toContain("我们的回应");
    expect(body.user).not.toContain("必须输出 4-7 个自然段");
  });

  it("allows product response in the latter half without becoming a feature list", () => {
    const body = buildTrendPrompt("body", BODY_VARS);
    expect(body.system).toContain("产品可以在中后段自然进入");
    expect(body.system).toContain("不得写成功能清单");
    expect(body.user).toContain("产品团队如何回应");
    expect(body.system).not.toContain("产品只允许在结尾最多一句轻点");
  });

  it("allows restrained公众号 formatting for complete hotspot articles", () => {
    const body = buildTrendPrompt("body", BODY_VARS);
    expect(body.system).toContain("允许使用 ## 小标题");
    expect(body.system).toContain("重点句");
    expect(body.system).toContain("少量列表");
    expect(body.user).toContain("用小标题推进结构");
    expect(body.user).not.toContain("不要输出 ##");
    expect(body.user).not.toContain("不要输出引用块或列表");
  });

  it("requires grounding anchors so hotspot articles do not float above the work scene", () => {
    const body = buildTrendPrompt("body", BODY_VARS);
    expect(body.system).toContain("落地锚点");
    expect(body.system).toContain("具体对象");
    expect(body.system).toContain("用户动作");
    expect(body.system).toContain("判断标准");
    expect(body.system).toContain("交付物");
    expect(body.system).toContain("抽象词连续空转");
    expect(body.user).toContain("每个关键段落");
    expect(body.user).toContain("至少一个落地锚点");
  });

  it("outline asks for product-team observation, not a hook-only sketch", () => {
    const outline = buildTrendPrompt("outline", OUTLINE_VARS);
    expect(outline.user).toContain("产品团队热点观察文大纲");
    expect(outline.user).toContain("热点现象");
    expect(outline.user).toContain("用户困惑");
    expect(outline.user).toContain("我们的回应");
    expect(outline.user).toContain("落地锚点");
    expect(outline.user).toContain("动作或判断标准");
    expect(outline.user).not.toContain("热点轻噱头引流稿大纲");
  });

  it("relevance fallback: rewrite into adjacent category topics when sources mismatch", () => {
    const body = buildTrendPrompt("body", BODY_VARS);
    expect(body.user).toContain("如果热点素材和产品品类/场景/相邻功能对不上");
    expect(body.user).toContain("贴近产品垂类");
  });

  it("fallback hotspot body stays simple and does not become trend analysis", () => {
    const text = fallbackTrendBody({
      product: "Lumen 营销云",
      productDesc: "私域运营自动化 + SCRM",
    });

    expect(text).toContain("作为产品团队");
    expect(text).toContain("Lumen 营销云");
    expect(text).toContain("客户消息");
    expect(text).toContain("跟进记录");
    expect(text).toContain("下一步该找谁");
    expect(text).not.toContain("入口之争");
    expect(text).not.toContain("趋势分析");
    expect(text).not.toContain("这玩意儿");
  });

  it("title prompt: concrete Chinese hooks, no product name, single-line JSON output", () => {
    const prompt = buildTrendTitlePrompt({
      product: "竞品分析助手",
      angle: "谁还在手抄竞品表",
      styleName: "热点轻噱头引流",
      body: "很多人一听到竞品分析,脑子里想到的就是截图、Excel、功能表和评论区吐槽。",
      sourceSummary:
        "掘金: 如何做竞品分析很多人一听到竞品分析就打开官网截图,手抄功能列表。",
    });

    expect(prompt.system).toContain("刷到会想点");
    expect(prompt.system).toContain("具体入口");
    expect(prompt.system).toContain("标题禁止出现本产品名");
    expect(prompt.system).toContain("12-24 个汉字");
    expect(prompt.system).toContain("只输出一行 JSON 数组");
    expect(prompt.system).toContain("不要分行输出");
    expect(prompt.user).toContain("禁用产品名:竞品分析助手");
    expect(prompt.user).toContain("每个抓一个不同的具体入口");
  });

  it("title prompt keeps the category-hook strategy for borrowed traffic", () => {
    const prompt = buildTrendTitlePrompt({
      product: "Nimbus Notes",
      angle: "AI 笔记工具怎么选",
      styleName: "热点轻噱头引流",
      body: "NotebookLM 带火了 AI 笔记本、AI 记事本和 PDF 总结这类需求。",
      sourceSummary: "NotebookLM: AI 笔记本 知识库问答 PDF总结 平替 怎么选",
    });
    expect(prompt.system).toContain("可以不点名热点主角");
    expect(prompt.system).toContain("现在大家都在用哪些 AI 笔记本");
  });

  it("uses simpler fashion hotspot fallback titles", () => {
    const titles = buildFallbackTrendTitles({
      product: "Fasium AI",
      angle: "AI 服装设计怎么选",
      sourceSummary:
        "AI服装设计 虚拟模特 版型预览 Tech Pack 小红书穿搭 怎么选",
    });

    expect(titles).toContain("AI服装设计怎么突然火了");
    expect(titles.join("\n")).not.toContain("Fasium AI");
    expect(titles.join("\n")).not.toContain("Tech Pack");
    expect(titles.join("\n")).not.toContain("：");
  });

  it("fallback hotspot titles are concrete enough to click", () => {
    const titles = buildFallbackTrendTitles({
      product: "竞品分析助手",
      angle: "谁还在手抄竞品表",
      sourceSummary:
        "掘金: 很多人一听到竞品分析就打开官网截图,手抄功能列表。",
    });

    expect(titles).toHaveLength(5);
    expect(titles.join("\n")).toContain("Excel");
    expect(titles.join("\n")).toContain("评论区");
    expect(titles.join("\n")).not.toContain("竞品分析助手");
    expect(titles.every((title) => title.length <= 24)).toBe(true);
  });
});
