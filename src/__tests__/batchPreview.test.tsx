import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BatchArticleCard } from "@/components/batch/BatchArticleCard";
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
});
