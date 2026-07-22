"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CapturedWechatTemplate {
  html: string;
  capturedAt: string;
  sourceLabel?: string;
}

export type WechatTemplateSlot = "followHeader" | "contactFooter";

interface WechatTemplateState {
  followHeader?: CapturedWechatTemplate;
  contactFooter?: CapturedWechatTemplate;
  setTemplate: (slot: WechatTemplateSlot, template: CapturedWechatTemplate) => void;
  clearTemplate: (slot: WechatTemplateSlot) => void;
}

export const useWechatTemplateStore = create<WechatTemplateState>()(
  persist(
    (set) => ({
      setTemplate: (slot, template) =>
        set((state) => ({
          ...state,
          [slot]: template,
        })),
      clearTemplate: (slot) =>
        set((state) => ({
          ...state,
          [slot]: undefined,
        })),
    }),
    {
      name: "joto-wechat-templates-v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : (undefined as unknown as Storage)
      ),
      partialize: (state) => ({
        followHeader: state.followHeader,
        contactFooter: state.contactFooter,
      }),
    }
  )
);
