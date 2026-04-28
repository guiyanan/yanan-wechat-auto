"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import seedArticles from "@/data/articles.json";
import type { Article, ArticleStatus } from "@/types";

const SEED: readonly Article[] = seedArticles as Article[];

export interface ArticleStoreState {
  drafts: Record<string, Article>;

  // Reads
  listAll: () => Article[];
  getById: (id: string) => Article | undefined;

  // Writes
  upsert: (article: Article) => void;
  patch: (id: string, patch: Partial<Article>) => void;
  setStatus: (id: string, status: ArticleStatus) => void;
  remove: (id: string) => void;

  // Lifecycle
  createDraft: (input: CreateDraftInput) => Article;

  /**
   * Rolls back a draft that never completed pipeline generation.
   * Safe to call from useEffect cleanup without knowing completion state —
   * the store checks the article hasn't been patched to a terminal state.
   */
  rollbackIncompleteDraft: (id: string) => void;
}

export interface CreateDraftInput {
  id?: string;
  productId: string;
  angleId?: string;
  customAngle?: string;
  styleId: string;
  createdBy?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `art-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `art-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function blankArticle(input: CreateDraftInput): Article {
  const id = input.id ?? genId();
  const iso = nowIso();
  return {
    id,
    productId: input.productId,
    angleId: input.angleId,
    customAngle: input.customAngle,
    styleId: input.styleId,
    status: "draft",
    title: "草稿 · 待生成",
    titleCandidates: [],
    contentHtml: "",
    coverCandidates: [],
    aiScore: { value: 0, checkedAt: iso, iterations: 0 },
    compliance: {
      limitWords: [],
      sensitiveTopics: [],
      aigcMetaEmbedded: false,
      coverSelected: false,
      factCheckPassed: true,
    },
    reviewAudit: [],
    createdBy: input.createdBy ?? "当前用户",
    createdAt: iso,
    updatedAt: iso,
  };
}

export const useArticleStore = create<ArticleStoreState>()(
  persist(
    (set, get) => ({
      drafts: {},

      listAll: () => {
        const drafts = Object.values(get().drafts);
        const byId = new Map<string, Article>();
        // Drafts take priority over seed
        for (const s of SEED) byId.set(s.id, s);
        for (const d of drafts) byId.set(d.id, d);
        return Array.from(byId.values()).sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      },

      getById: (id) => {
        const draft = get().drafts[id];
        if (draft) return draft;
        return SEED.find((a) => a.id === id);
      },

      upsert: (article) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [article.id]: { ...article, updatedAt: nowIso() },
          },
        })),

      patch: (id, patch) =>
        set((state) => {
          const existing =
            state.drafts[id] ?? SEED.find((a) => a.id === id);
          if (!existing) return state;
          return {
            drafts: {
              ...state.drafts,
              [id]: { ...existing, ...patch, updatedAt: nowIso() },
            },
          };
        }),

      setStatus: (id, status) =>
        set((state) => {
          const existing =
            state.drafts[id] ?? SEED.find((a) => a.id === id);
          if (!existing) return state;
          const publishedAt =
            status === "published" ? nowIso() : existing.publishedAt;
          return {
            drafts: {
              ...state.drafts,
              [id]: {
                ...existing,
                status,
                publishedAt,
                updatedAt: nowIso(),
              },
            },
          };
        }),

      remove: (id) =>
        set((state) => {
          const next = { ...state.drafts };
          delete next[id];
          return { drafts: next };
        }),

      createDraft: (input) => {
        const article = blankArticle(input);
        set((state) => ({
          drafts: { ...state.drafts, [article.id]: article },
        }));
        return article;
      },

      rollbackIncompleteDraft: (id) =>
        set((state) => {
          const d = state.drafts[id];
          // Only rollback if it's still empty (pipeline never wrote content)
          if (!d || d.contentHtml.length > 0 || d.titleCandidates.length > 0) {
            return state;
          }
          const next = { ...state.drafts };
          delete next[id];
          return { drafts: next };
        }),
    }),
    {
      name: "joto-articles-v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : (undefined as unknown as Storage)
      ),
      partialize: (state) => ({ drafts: state.drafts }),
    }
  )
);
