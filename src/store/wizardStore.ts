"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AngleStrategy, ArticleSourceContext, ContentLength } from "@/types";

/**
 * Wizard selection state.
 *
 * Both angleIds and styleIds are multi-select — a single batch run produces
 * angleIds.length × styleIds.length independent articles (C3).
 *
 * customAngle remains a single textbox — a batch run only carries one
 * optional custom angle. Selecting custom angle clears all preset angle ids
 * (and vice versa) so the two inputs can't both apply at once.
 */
export interface WizardState {
  productId: string | null;
  mode: "manual" | "auto-five";
  articleCount: number;
  contentLength: ContentLength;
  angleStrategy: AngleStrategy;
  angleIds: string[];
  customAngle: string;
  styleIds: string[];
  sourcePack: ArticleSourceContext;
  setProductId: (id: string | null) => void;
  startAutoFive: (productId: string) => void;
  setMode: (mode: WizardState["mode"]) => void;
  setContentLength: (length: ContentLength) => void;
  setAngleStrategy: (strategy: AngleStrategy) => void;
  toggleAngleId: (id: string) => void;
  setAngleIds: (ids: string[]) => void;
  setCustomAngle: (text: string) => void;
  toggleStyleId: (id: string) => void;
  setStyleIds: (ids: string[]) => void;
  setSourcePack: (patch: Partial<ArticleSourceContext>) => void;
  reset: () => void;
}

const initialState = {
  productId: null as string | null,
  mode: "manual" as WizardState["mode"],
  articleCount: 5,
  contentLength: "standard" as ContentLength,
  angleStrategy: "auto" as AngleStrategy,
  angleIds: [] as string[],
  customAngle: "",
  styleIds: [] as string[],
  sourcePack: {
    productNotes: "",
    competitorNotes: "",
    trendNotes: "",
    imageRefs: "",
  } satisfies ArticleSourceContext,
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...initialState,
      setProductId: (id) => set({ productId: id }),
      startAutoFive: (productId) =>
        set({
          productId,
          mode: "auto-five",
          articleCount: 5,
          angleIds: [],
          customAngle: "",
          styleIds: [],
        }),
      setMode: (mode) => set({ mode }),
      setContentLength: (contentLength) => set({ contentLength }),
      setAngleStrategy: (angleStrategy) => set({ angleStrategy }),
      toggleAngleId: (id) =>
        set((state) => {
          const has = state.angleIds.includes(id);
          const nextIds = has
            ? state.angleIds.filter((existing) => existing !== id)
            : [...state.angleIds, id];
          return {
            angleIds: nextIds,
            customAngle: nextIds.length > 0 ? "" : state.customAngle,
          };
        }),
      setAngleIds: (ids) =>
        set({
          angleIds: [...ids],
          customAngle: ids.length > 0 ? "" : initialState.customAngle,
        }),
      setCustomAngle: (text) =>
        set((state) => ({
          customAngle: text,
          angleIds: text.trim() ? [] : state.angleIds,
        })),
      toggleStyleId: (id) =>
        set((state) => {
          const has = state.styleIds.includes(id);
          return {
            styleIds: has
              ? state.styleIds.filter((existing) => existing !== id)
              : [...state.styleIds, id],
          };
        }),
      setStyleIds: (ids) => set({ styleIds: [...ids] }),
      setSourcePack: (patch) =>
        set((state) => ({
          sourcePack: {
            ...state.sourcePack,
            ...patch,
          },
        })),
      reset: () => set({ ...initialState }),
    }),
    {
      name: "joto-wizard-v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.sessionStorage
          : (undefined as unknown as Storage)
      ),
      // Persisted shape evolves: v1 (single angleId/styleId) → v2 (angleIds[],
      // styleId still single) → v3 (styleIds[] also) → v4 (sourcePack)
      // → v5 (auto-five mode) → v6 (length + angle strategy).
      // Migrate gracefully so sessions don't crash on legacy data.
      version: 6,
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== "object") return persisted;
        const legacy = persisted as Record<string, unknown>;

        let angleIds: string[];
        if (Array.isArray(legacy.angleIds)) {
          angleIds = legacy.angleIds.filter(
            (v): v is string => typeof v === "string"
          );
        } else if (typeof legacy.angleId === "string") {
          angleIds = [legacy.angleId];
        } else {
          angleIds = [];
        }

        let styleIds: string[];
        if (Array.isArray(legacy.styleIds)) {
          styleIds = legacy.styleIds.filter(
            (v): v is string => typeof v === "string"
          );
        } else if (typeof legacy.styleId === "string") {
          styleIds = [legacy.styleId];
        } else {
          styleIds = [];
        }

        const sourcePack =
          legacy.sourcePack &&
          typeof legacy.sourcePack === "object" &&
          !Array.isArray(legacy.sourcePack)
            ? {
                ...initialState.sourcePack,
                ...(legacy.sourcePack as Partial<ArticleSourceContext>),
              }
            : initialState.sourcePack;

        const contentLength =
          legacy.contentLength === "short" ||
          legacy.contentLength === "standard" ||
          legacy.contentLength === "deep"
            ? legacy.contentLength
            : initialState.contentLength;

        const angleStrategy =
          legacy.angleStrategy === "auto" ||
          legacy.angleStrategy === "comparison" ||
          legacy.angleStrategy === "education" ||
          legacy.angleStrategy === "scenario" ||
          legacy.angleStrategy === "trend"
            ? legacy.angleStrategy
            : initialState.angleStrategy;

        // Always run through the shape transform on any version < 4 so a
        // legacy single-field store gets normalized; a v3+ store is returned
        // as-is (the path above just copies arrays).
        if (version < 4) {
          return {
            productId:
              typeof legacy.productId === "string" ? legacy.productId : null,
            mode:
              legacy.mode === "auto-five" || legacy.mode === "manual"
                ? legacy.mode
                : initialState.mode,
            articleCount:
              typeof legacy.articleCount === "number"
                ? legacy.articleCount
                : initialState.articleCount,
            contentLength,
            angleStrategy,
            angleIds,
            customAngle:
              typeof legacy.customAngle === "string" ? legacy.customAngle : "",
            styleIds,
            sourcePack,
          } as Partial<WizardState>;
        }
        return {
          ...initialState,
          ...(persisted as Partial<WizardState>),
          contentLength,
          angleStrategy,
        } as Partial<WizardState>;
      },
    }
  )
);
