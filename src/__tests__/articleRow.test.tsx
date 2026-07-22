import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleRow } from "@/components/dashboard/ArticleRow";
import { PushConfirmModal } from "@/components/dashboard/PushConfirmModal";
import type { Article, Product } from "@/types";

function makeArticle(patch: Partial<Article> = {}): Article {
  const iso = "2026-05-18T00:00:00.000Z";
  return {
    id: "art-joto",
    productId: "p1",
    angleId: "angle-product-intro",
    styleId: "style-joto",
    status: "draft",
    title: "JOTO 文章",
    titleCandidates: [],
    contentHtml: "<p>正文</p>",
    coverCandidates: [],
    aiScore: { value: 12, checkedAt: iso, iterations: 0 },
    compliance: {
      limitWords: [],
      sensitiveTopics: [],
      aigcMetaEmbedded: false,
      coverSelected: false,
      factCheckPassed: true,
    },
    reviewAudit: [],
    createdBy: "Tester",
    createdAt: iso,
    updatedAt: iso,
    layoutTheme: "joto",
    ...patch,
  };
}

const product: Product = {
  id: "p1",
  name: "Pharaoh Command",
  description: "AI 智问中枢",
  tags: ["JOTO"],
  knowledgeDocs: [],
  iconGradient: ["#1268FF", "#5B8CFF"],
};

describe("ArticleRow", () => {
  it("opens generated articles in review so the JOTO template is preserved", () => {
    render(<ArticleRow article={makeArticle()} product={product} />);
    expect(screen.getByRole("link", { name: /JOTO 文章/ })).toHaveAttribute(
      "href",
      "/review/art-joto"
    );
  });

  it("opens empty drafts in editor", () => {
    render(
      <ArticleRow
        article={makeArticle({ id: "art-empty", contentHtml: "" })}
        product={product}
      />
    );
    expect(screen.getByRole("link", { name: /JOTO 文章/ })).toHaveAttribute(
      "href",
      "/editor/art-empty"
    );
  });

  it("dashboard push modal shows the single-account WeChat preview before pushing", () => {
    render(
      <PushConfirmModal
        article={makeArticle({ contentHtml: "<p>公众号排版预览正文</p>" })}
        product={product}
        open
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("当前接入公众号")).toBeInTheDocument();
    expect(screen.getByText("JOTO 官方")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "检测" })).toBeInTheDocument();
    expect(screen.getByTitle("JOTO WeChat article preview")).toHaveAttribute(
      "srcdoc",
      expect.stringContaining("公众号排版预览正文")
    );
    expect(
      screen.getByRole("button", { name: "推送到公众号草稿箱" })
    ).toBeEnabled();
  });
});
