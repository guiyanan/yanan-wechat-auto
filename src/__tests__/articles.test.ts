import { describe, it, expect } from "vitest";
import {
  computeKpis,
  formatRelativeDate,
  getAllAccounts,
  getAllArticles,
  getAllProducts,
  STATUS_META,
  getArticleById,
  getAccountById,
  getProductById,
} from "@/lib/articles";
import type { Article, ArticleStatus } from "@/types";

describe("articles · data accessors", () => {
  it("loads non-empty product/article/account seed", () => {
    expect(getAllProducts().length).toBeGreaterThan(0);
    expect(getAllArticles().length).toBeGreaterThan(0);
    expect(getAllAccounts().length).toBeGreaterThan(0);
  });

  it("findById returns undefined for unknown id", () => {
    expect(getArticleById("nope")).toBeUndefined();
    expect(getProductById("nope")).toBeUndefined();
    expect(getAccountById("nope")).toBeUndefined();
  });

  it("findById returns matching record", () => {
    const articles = getAllArticles();
    const first = articles[0];
    expect(getArticleById(first.id)?.id).toBe(first.id);
  });
});

describe("articles · STATUS_META", () => {
  it("covers all statuses used by seed articles", () => {
    const statuses: Set<ArticleStatus> = new Set(
      getAllArticles().map((a) => a.status)
    );
    for (const s of statuses) {
      expect(STATUS_META[s]).toBeDefined();
      expect(STATUS_META[s].label).toBeTruthy();
    }
  });
});

describe("articles · computeKpis", () => {
  it("returns zero KPIs for empty list", () => {
    expect(computeKpis([])).toEqual({
      monthlyGenerated: 0,
      published: 0,
      avgAiScore: 0,
      avgReaders: 0,
    });
  });

  it("counts only articles with status=published for published KPI", () => {
    const mock: Article[] = [
      {
        ...makeArticle("a1", "published"),
        readers: 100,
      },
      makeArticle("a2", "draft"),
      {
        ...makeArticle("a3", "published"),
        readers: 200,
      },
    ];
    const k = computeKpis(mock);
    expect(k.published).toBe(2);
    expect(k.avgReaders).toBe(150);
  });

  it("avgAiScore is integer-rounded", () => {
    const mock: Article[] = [
      { ...makeArticle("a1"), aiScore: { value: 40, checkedAt: "", iterations: 0 } },
      { ...makeArticle("a2"), aiScore: { value: 41, checkedAt: "", iterations: 0 } },
    ];
    expect(computeKpis(mock).avgAiScore).toBe(41);
  });
});

describe("articles · formatRelativeDate", () => {
  it("recent time returns 刚刚", () => {
    expect(formatRelativeDate(new Date().toISOString())).toBe("刚刚");
  });

  it("N minutes ago", () => {
    const d = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeDate(d)).toMatch(/5 分钟前/);
  });

  it("old dates formatted as YYYY-MM-DD", () => {
    const d = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString();
    expect(formatRelativeDate(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

function makeArticle(id: string, status: ArticleStatus = "draft"): Article {
  const now = new Date().toISOString();
  return {
    id,
    productId: "prod-x",
    styleId: "style-x",
    status,
    title: id,
    titleCandidates: [],
    contentHtml: "",
    coverCandidates: [],
    aiScore: { value: 30, checkedAt: now, iterations: 0 },
    compliance: {
      limitWords: [],
      sensitiveTopics: [],
      aigcMetaEmbedded: false,
      coverSelected: false,
      factCheckPassed: true,
    },
    reviewAudit: [],
    createdBy: "t",
    createdAt: now,
    updatedAt: now,
  };
}
