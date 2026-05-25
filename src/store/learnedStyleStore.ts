"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LearnedWritingStyle } from "@/types";

interface LearnedStyleState {
  styles: LearnedWritingStyle[];
  serverLoaded: boolean;
  serverError?: string;
  loadFromServer: () => Promise<void>;
  upsertStyle: (style: LearnedWritingStyle) => void;
  removeStyle: (id: string) => void;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function newerStyle(
  current: LearnedWritingStyle | undefined,
  incoming: LearnedWritingStyle
): LearnedWritingStyle {
  if (!current) return incoming;
  const currentTime = Date.parse(current.createdAt ?? "");
  const incomingTime = Date.parse(incoming.createdAt ?? "");
  if (Number.isFinite(incomingTime) && incomingTime > (currentTime || 0)) {
    return incoming;
  }
  return current;
}

function sortStyles(styles: LearnedWritingStyle[]): LearnedWritingStyle[] {
  return [...styles].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
}

function mergeStyles(
  localStyles: LearnedWritingStyle[],
  serverStyles: LearnedWritingStyle[]
): LearnedWritingStyle[] {
  const byId = new Map<string, LearnedWritingStyle>();
  for (const style of serverStyles) byId.set(style.id, style);
  for (const style of localStyles) {
    byId.set(style.id, newerStyle(byId.get(style.id), style));
  }
  return sortStyles(Array.from(byId.values()));
}

async function saveStyleLibrary(styles: LearnedWritingStyle[]) {
  if (!isBrowser()) return;
  await fetch("/api/styles/library", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ styles }),
  });
}

function persistStyle(style: LearnedWritingStyle) {
  if (!isBrowser()) return;
  void fetch("/api/styles/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ style }),
  });
}

function deletePersistedStyle(id: string) {
  if (!isBrowser()) return;
  void fetch(`/api/styles/library?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export const useLearnedStyleStore = create<LearnedStyleState>()(
  persist(
    (set, get) => ({
      styles: [],
      serverLoaded: false,
      serverError: undefined,
      loadFromServer: async () => {
        if (!isBrowser() || get().serverLoaded) return;
        try {
          const res = await fetch("/api/styles/library", { cache: "no-store" });
          const data = (await res.json()) as {
            ok?: boolean;
            styles?: LearnedWritingStyle[];
            error?: string;
          };
          if (!res.ok || !data.ok) {
            throw new Error(data.error ?? "读取项目风格库失败");
          }
          const serverStyles = data.styles ?? [];
          const merged = mergeStyles(get().styles, serverStyles);
          set({
            styles: merged,
            serverLoaded: true,
            serverError: undefined,
          });
          if (JSON.stringify(merged) !== JSON.stringify(serverStyles)) {
            void saveStyleLibrary(merged);
          }
        } catch (err) {
          set({
            serverLoaded: true,
            serverError:
              err instanceof Error ? err.message : "读取项目风格库失败",
          });
        }
      },
      upsertStyle: (style) =>
        set((state) => {
          const without = state.styles.filter((s) => s.id !== style.id);
          const styles = sortStyles([style, ...without]);
          persistStyle(style);
          return { styles };
        }),
      removeStyle: (id) =>
        set((state) => {
          deletePersistedStyle(id);
          return {
            styles: state.styles.filter((s) => s.id !== id),
          };
        }),
    }),
    {
      name: "joto-learned-writing-styles-v1",
      partialize: (state) => ({ styles: state.styles }),
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : (undefined as unknown as Storage)
      ),
    }
  )
);
