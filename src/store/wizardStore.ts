"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
  angleIds: string[];
  customAngle: string;
  styleIds: string[];
  setProductId: (id: string | null) => void;
  toggleAngleId: (id: string) => void;
  setAngleIds: (ids: string[]) => void;
  setCustomAngle: (text: string) => void;
  toggleStyleId: (id: string) => void;
  setStyleIds: (ids: string[]) => void;
  reset: () => void;
}

const initialState = {
  productId: null as string | null,
  angleIds: [] as string[],
  customAngle: "",
  styleIds: [] as string[],
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...initialState,
      setProductId: (id) => set({ productId: id }),
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
      // styleId still single) → v3 (styleIds[] also). Migrate gracefully so
      // sessions don't crash on legacy data.
      version: 3,
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

        // Always run through the shape transform on any version < 3 so a
        // legacy single-field store gets normalized; a v3+ store is returned
        // as-is (the path above just copies arrays).
        if (version < 3) {
          return {
            productId:
              typeof legacy.productId === "string" ? legacy.productId : null,
            angleIds,
            customAngle:
              typeof legacy.customAngle === "string" ? legacy.customAngle : "",
            styleIds,
          } as Partial<WizardState>;
        }
        return persisted as Partial<WizardState>;
      },
    }
  )
);
