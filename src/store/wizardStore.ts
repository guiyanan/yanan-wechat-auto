"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface WizardState {
  productId: string | null;
  angleId: string | null;
  customAngle: string;
  styleId: string | null;
  setProductId: (id: string | null) => void;
  setAngleId: (id: string | null) => void;
  setCustomAngle: (text: string) => void;
  setStyleId: (id: string | null) => void;
  reset: () => void;
}

const initialState = {
  productId: null as string | null,
  angleId: null as string | null,
  customAngle: "",
  styleId: null as string | null,
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...initialState,
      setProductId: (id) => set({ productId: id }),
      setAngleId: (id) =>
        set({ angleId: id, customAngle: id ? "" : initialState.customAngle }),
      setCustomAngle: (text) =>
        set((state) => ({
          customAngle: text,
          angleId: text.trim() ? null : state.angleId,
        })),
      setStyleId: (id) => set({ styleId: id }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: "joto-wizard-v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.sessionStorage
          : (undefined as unknown as Storage)
      ),
    }
  )
);
