import { describe, expect, it } from "vitest";
import {
  buildFallbackTrends,
  buildTrendSearchQuery,
  buildTrendSearchQueries,
  filterRelevantTrendResults,
  pickTrendSourcesForArticle,
} from "@/lib/trends/hooks";
import type { Product } from "@/types";

function product(patch: Partial<Product>): Product {
  return {
    id: "p",
    name: "Lumen 营销云",
    description: "私域运营自动化 + SCRM",
    tags: ["营销", "私域", "SCRM"],
    iconGradient: ["#1268FF", "#5B8CFF"],
    knowledgeDocs: [],
    ...patch,
  };
}

describe("/api/trends/search helpers", () => {
  it("searches for external hooks instead of product-only topics", () => {
    const query = buildTrendSearchQuery(product({}));

    expect(query).toContain("竞品");
    expect(query).toContain("替代");
    expect(query).toContain("相似");
    expect(query).toContain("案例");
    expect(query).toContain("争议");
    expect(query).toContain("近30天");
  });

  it("expands mainstream anchors into category, alternative, and scenario searches", () => {
    const queries = buildTrendSearchQueries(
      product({
        name: "Nimbus Notes",
        description: "NotebookLM 平替,支持 PDF 总结、AI 笔记本和知识库问答",
        tags: ["AI笔记", "知识库", "PDF"],
      })
    );
    const text = queries.join("\n");

    expect(queries.length).toBeGreaterThanOrEqual(3);
    expect(text).toContain("NotebookLM");
    expect(text).toContain("AI笔记本");
    expect(text).toContain("AI记事本");
    expect(text).toContain("PDF总结");
    expect(text).toContain("平替");
    expect(text).toContain("怎么选");
    expect(text).toContain("抖音");
    expect(text).toContain("小红书");
    expect(text).toContain("避坑");
  });

  it("uses product understanding when custom product description is empty", () => {
    const queries = buildTrendSearchQueries(
      product({
        name: "竞品分析助手",
        description: "",
        tags: [],
        understanding: {
          definition:
            "竞品分析助手是一个客户反馈分析工具,面向产品经理和市场分析人员,自动聚合用户评论,通过情感分类和标签提取输出可视化图表。",
          coreFunctions: [],
          targetCustomers: [],
          painPoints: [],
          traditionalAlternatives: [],
          afterUseChanges: [],
          evidence: [],
          writingBoundaries: [],
          questionsToAsk: [],
          generatedAt: "2026-06-17T00:00:00.000Z",
          source: "manual",
        },
      })
    );
    const text = queries.join("\n");

    expect(text).toContain("Excel");
    expect(text).toContain("AI表格工具");
    expect(text).toContain("数据分析");
    expect(text).not.toContain("AI服装设计");
    expect(text).not.toContain("AI试衣");
  });

  it("filters fashion try-on trends for customer feedback analysis products", () => {
    const filtered = filterRelevantTrendResults(
      product({
        name: "竞品分析助手",
        description: "",
        tags: [],
        understanding: {
          definition:
            "竞品分析助手是一个客户反馈分析工具,面向产品经理和市场分析人员,自动聚合用户评论,通过情感分类和标签提取输出可视化图表。",
          coreFunctions: [],
          targetCustomers: [],
          painPoints: [],
          traditionalAlternatives: [],
          afterUseChanges: [],
          evidence: [],
          writingBoundaries: [],
          questionsToAsk: [],
          generatedAt: "2026-06-17T00:00:00.000Z",
          source: "manual",
        },
      }),
      undefined,
      [
        {
          id: "fashion",
          title: "AI试衣换装app下载最新版",
          snippet: "AI试衣换装APP是一款基于人工智能技术的时尚穿搭助手。",
          url: "https://example.com/fashion",
        },
        {
          id: "feedback",
          title: "AI数据分析工具到底能帮谁省事",
          snippet: "产品经理用评论分析、情感分类和可视化图表快速判断用户反馈。",
          url: "https://example.com/feedback",
        },
      ]
    ).map((trend) => trend.id);

    expect(filtered).toEqual(["feedback"]);
  });

  it("filters low-signal Excel shortcut tutorials for data analysis products", () => {
    const filtered = filterRelevantTrendResults(
      product({
        name: "竞品分析助手",
        description: "",
        tags: [],
        understanding: {
          definition:
            "竞品分析助手是一个客户反馈分析工具,面向产品经理和市场分析人员,自动聚合用户评论,通过情感分类和标签提取输出可视化图表。",
          coreFunctions: [],
          targetCustomers: [],
          painPoints: [],
          traditionalAlternatives: [],
          afterUseChanges: [],
          evidence: [],
          writingBoundaries: [],
          questionsToAsk: [],
          generatedAt: "2026-06-17T00:00:00.000Z",
          source: "manual",
        },
      }),
      undefined,
      [
        {
          id: "excel-shortcut",
          title: "Excel 快捷键:显示替换功能菜单-办公软件-PHP中文网",
          snippet: "介绍 Excel 快捷键和替换功能菜单。",
          source: "php中文网",
          url: "https://example.com/excel-shortcut",
        },
        {
          id: "ai-data",
          title: "AI数据分析工具到底能帮谁省事",
          snippet: "产品经理用评论分析、情感分类和可视化图表快速判断用户反馈。",
          url: "https://example.com/ai-data",
        },
      ]
    ).map((trend) => trend.id);

    expect(filtered).toEqual(["ai-data"]);
  });

  it("keeps fashion design products on fashion/design hooks instead of NotebookLM from weak PDF words", () => {
    const queries = buildTrendSearchQueries(
      product({
        name: "Fasium AI",
        description:
          "AI fashion design platform for apparel teams, supports trend observation, virtual model preview, Tech Pack PDF export and garment design.",
        tags: ["服装", "设计", "版型", "面料"],
      }),
      {
        productNotes: "支持导出 PDF 和 Excel 版单,但核心场景是服装设计、版型预览和 Tech Pack。",
      }
    );
    const text = queries.join("\n");

    expect(text).toContain("AI服装设计");
    expect(text).toContain("服装打版");
    expect(text).toContain("Tech Pack");
    expect(text).toContain("Midjourney");
    expect(text).not.toContain("NotebookLM");
    expect(text).not.toContain("AI笔记本");
  });

  it("filters unrelated notebook and dev-template trends for fashion design products", () => {
    const fasium = product({
      name: "Fasium AI",
      description:
        "AI fashion design platform for apparel teams, supports garment design, virtual model preview and Tech Pack.",
      tags: ["服装", "设计", "版型"],
    });
    const filtered = filterRelevantTrendResults(fasium, undefined, [
      {
        id: "notebook",
        title: "排名一性价比高的笔记本电脑推荐",
        snippet: "NotebookLM 和 Evernote 的笔记本软件推荐。",
        url: "https://example.com/notebook",
      },
      {
        id: "php",
        title: "小红书对比文提示词模板-人工智能-PHP中文网",
        snippet: "PHP 模板下载和提示词教程。",
        url: "https://example.com/php",
      },
      {
        id: "fashion",
        title: "AI 服装设计工具最近为什么火了",
        snippet: "设计师在讨论虚拟模特、版型预览和 Tech Pack。",
        url: "https://example.com/fashion",
      },
    ]).map((trend) => trend.id);

    expect(filtered).toEqual(["fashion"]);
  });

  it("fallback trends provide competitor or similar-topic hooks", () => {
    const trends = buildFallbackTrends(product({}));
    const text = trends.map((trend) => `${trend.title}\n${trend.snippet}`).join("\n");

    expect(text).toContain("同类");
    expect(text).toContain("竞品");
    expect(text).toContain("替代");
    expect(text).toContain("相似题材");
    expect(text).toContain("先拿外部话题做噱头");
    expect(text).toContain("别急着讲产品");
    expect(text).not.toContain("入口之争");
    expect(text).not.toContain("系统兜底素材");
  });

  it("assigns different source traces to different hotspot articles", () => {
    const trends = buildFallbackTrends(
      product({
        name: "Nimbus Notes",
        description: "NotebookLM 平替,支持 PDF 总结、AI 笔记本和知识库问答",
        tags: ["AI笔记", "知识库", "PDF"],
      })
    );
    const first = pickTrendSourcesForArticle(trends, 0).map((trend) => trend.id);
    const second = pickTrendSourcesForArticle(trends, 1).map((trend) => trend.id);

    expect(first).toHaveLength(4);
    expect(second).toHaveLength(4);
    expect(first).not.toEqual(second);
  });
});
