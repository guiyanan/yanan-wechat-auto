import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BatchArticleCard } from "@/components/batch/BatchArticleCard";
import { TrendSourceTracePanel } from "@/components/batch/TrendSourceTracePanel";
import { WechatArticleFrame } from "@/components/wechat/WechatArticleFrame";
import type { Article, Product } from "@/types";

function makeArticle(patch: Partial<Article> = {}): Article {
  const iso = "2026-05-19T00:00:00.000Z";
  return {
    id: "art-batch-preview",
    productId: "prod-loop",
    angleId: "angle-scenario",
    styleId: "style-joto-official",
    status: "draft",
    title: "浏览器里长出来的机器人",
    titleCandidates: [],
    contentHtml: "<p>右侧应该直接显示正文。</p>",
    coverCandidates: [],
    aiScore: { value: 0, checkedAt: iso, iterations: 0 },
    compliance: {
      limitWords: [],
      sensitiveTopics: [],
      aigcMetaEmbedded: false,
      coverSelected: true,
      factCheckPassed: true,
    },
    reviewAudit: [],
    createdBy: "Tester",
    createdAt: iso,
    updatedAt: iso,
    batchId: "batch-preview",
    stage: "batch",
    layoutTheme: "joto",
    ...patch,
  };
}

const product: Product = {
  id: "prod-loop",
  name: "Loop RPA",
  description: "浏览器原生 Agent",
  tags: ["RPA"],
  iconGradient: ["#6366f1", "#ec4899"],
  knowledgeDocs: [],
};

describe("Batch preview", () => {
  it("uses an in-page preview button instead of a navigation link", () => {
    const onSelect = vi.fn();
    render(
      <BatchArticleCard
        article={makeArticle()}
        product={product}
        selected={false}
        selectedForSend={false}
        humanizeStatus="pending"
        onSelect={onSelect}
        onToggleSend={vi.fn()}
        onRehumanize={vi.fn()}
      />
    );

    expect(screen.queryByRole("link", { name: "预览" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "预览" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("selects only passed articles for dashboard draft promotion", () => {
    const onToggleSend = vi.fn();
    render(
      <BatchArticleCard
        article={makeArticle()}
        product={product}
        selected={false}
        selectedForSend={false}
        humanizeStatus="passed"
        onSelect={vi.fn()}
        onToggleSend={onToggleSend}
        onRehumanize={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "选择放入 Dashboard 草稿箱" }));

    expect(onToggleSend).toHaveBeenCalledTimes(1);
  });

  it("lets a passed article be humanized again without navigating", () => {
    const onSelect = vi.fn();
    const onRehumanize = vi.fn();
    render(
      <BatchArticleCard
        article={makeArticle()}
        product={product}
        selected={false}
        selectedForSend={false}
        humanizeStatus="passed"
        onSelect={onSelect}
        onToggleSend={vi.fn()}
        onRehumanize={onRehumanize}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "重新 Humanize" }));

    expect(onRehumanize).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps selected article HTML inside the WeChat preview frame", () => {
    render(
      <WechatArticleFrame
        title="JOTO 公众号预览"
        contentHtml="<p>右侧应该直接显示正文。</p>"
        theme="joto"
      />
    );

    const iframe = screen.getByTitle("JOTO WeChat article preview");
    expect(iframe).toHaveAttribute("srcdoc", expect.stringContaining("右侧应该直接显示正文"));
    expect(iframe).not.toHaveAttribute("sandbox");
  });

  it("keeps the generated article inside the decorated JOTO official-account template", () => {
    render(
      <WechatArticleFrame
        title="生成后的产品文章标题"
        contentHtml={[
          "<h2>先把产品说清楚</h2>",
          "<p>这是一段会进入公众号模板的正文。</p>",
          "<blockquote><p>这是需要蓝色强调的重点句。</p></blockquote>",
        ].join("")}
        theme="joto"
        decorate
      />
    );

    const iframe = screen.getByTitle("JOTO WeChat article preview");
    const srcdoc = iframe.getAttribute("srcdoc") ?? "";

    expect(srcdoc).toContain("生成后的产品文章标题");
    expect(srcdoc).toContain("点击蓝字 关注我们");
    expect(srcdoc).toContain("这是一段会进入公众号模板的正文。");
    expect(srcdoc).toContain("产品截图 / 视频封面占位");
    expect(srcdoc).toContain("这是需要蓝色强调的重点句。");
    expect(srcdoc).toContain("border-left: 4px solid #1268FF");
    expect(srcdoc).toContain("joto-article-shell");
  });

  it("shows source text for hotspot articles on the batch preview page", () => {
    render(
      <TrendSourceTracePanel
        sources={[
          {
            id: "trend-source-1",
            title: "AI 伪人模特和实物对比合集播放破千万",
            snippet:
              "一条高赞笔记提到，消费者想看的不是 AI 模特有多像真人，而是衣服穿在普通人身上的真实效果。",
            url: "https://example.com/trend/ai-model",
            source: "小红书",
            publishedAt: "2026-06-10",
          },
        ]}
      />
    );

    expect(screen.getByLabelText("热点来源素材")).toBeInTheDocument();
    expect(screen.getByText("热点原文 / 来源素材")).toBeInTheDocument();
    expect(
      screen.getByText("AI 伪人模特和实物对比合集播放破千万")
    ).toBeInTheDocument();
    expect(screen.getByText(/消费者想看的不是 AI 模特/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "打开原文：AI 伪人模特和实物对比合集播放破千万",
      })
    ).toHaveAttribute("href", "https://example.com/trend/ai-model");
  });

  it("labels hotspot articles as traffic hooks instead of custom angles", () => {
    render(
      <BatchArticleCard
        article={makeArticle({
          customAngle: "Lovart 国内平替怎么选",
          generationMeta: {
            mode: "trend-radar",
            angleLabel: "Lovart 国内平替怎么选",
            trafficHookLabel: "Lovart 国内平替怎么选",
            trafficHookMode: "domestic_alternative",
            styleSource: "official",
          },
        })}
        product={product}
        selected={false}
        selectedForSend={false}
        humanizeStatus="pending"
        onSelect={vi.fn()}
        onToggleSend={vi.fn()}
        onRehumanize={vi.fn()}
      />
    );

    expect(screen.getByText("引流切口：Lovart 国内平替怎么选")).toBeInTheDocument();
    expect(screen.queryByText(/自定义/)).not.toBeInTheDocument();
  });
});
