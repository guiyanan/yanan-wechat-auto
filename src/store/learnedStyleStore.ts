"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildPromptProfileFromStyle } from "@/lib/learnedStyles";
import type { LearnedWritingStyle } from "@/types";

interface LearnedStyleState {
  styles: LearnedWritingStyle[];
  serverLoaded: boolean;
  serverError?: string;
  loadFromServer: () => Promise<void>;
  upsertStyle: (style: LearnedWritingStyle) => Promise<void>;
  removeStyle: (id: string) => Promise<void>;
}

interface StyleLibraryResponse {
  ok?: boolean;
  styles?: LearnedWritingStyle[];
  error?: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function newerStyle(
  current: LearnedWritingStyle | undefined,
  incoming: LearnedWritingStyle
): LearnedWritingStyle {
  const normalizedIncoming = normalizeStyle(incoming);
  if (!current) return normalizedIncoming;
  const currentTime = Date.parse(current.createdAt ?? "");
  const incomingTime = Date.parse(normalizedIncoming.createdAt ?? "");
  if (Number.isFinite(incomingTime) && incomingTime > (currentTime || 0)) {
    return normalizedIncoming;
  }
  return normalizeStyle(current);
}

function normalizeStyle(style: LearnedWritingStyle): LearnedWritingStyle {
  return {
    ...style,
    scope: style.scope ?? "product",
    promptProfile:
      style.promptProfile?.trim() || buildPromptProfileFromStyle(style),
  };
}

function sortStyles(styles: LearnedWritingStyle[]): LearnedWritingStyle[] {
  return styles.map(normalizeStyle).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
}

function mergeStyles(
  localStyles: LearnedWritingStyle[],
  serverStyles: LearnedWritingStyle[]
): LearnedWritingStyle[] {
  const byId = new Map<string, LearnedWritingStyle>();
  for (const style of serverStyles) byId.set(style.id, normalizeStyle(style));
  for (const style of localStyles) {
    byId.set(style.id, newerStyle(byId.get(style.id), normalizeStyle(style)));
  }
  return sortStyles(Array.from(byId.values()));
}

async function parseStyleLibraryResponse(
  res: Response,
  fallbackMessage: string
): Promise<LearnedWritingStyle[]> {
  const data = (await res.json()) as StyleLibraryResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? fallbackMessage);
  }
  return sortStyles(data.styles ?? []);
}

async function saveStyleLibrary(
  styles: LearnedWritingStyle[]
): Promise<LearnedWritingStyle[]> {
  if (!isBrowser()) return sortStyles(styles);
  const res = await fetch("/api/styles/library", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ styles }),
  });
  return parseStyleLibraryResponse(res, "保存风格库失败");
}

async function persistStyle(
  style: LearnedWritingStyle
): Promise<LearnedWritingStyle[]> {
  if (!isBrowser()) return sortStyles([style]);
  const res = await fetch("/api/styles/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ style }),
  });
  return parseStyleLibraryResponse(res, "保存风格失败");
}

async function deletePersistedStyle(id: string): Promise<LearnedWritingStyle[]> {
  if (!isBrowser()) return [];
  const res = await fetch(`/api/styles/library?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return parseStyleLibraryResponse(res, "删除风格失败");
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
          const serverStyles = (data.styles ?? []).map(normalizeStyle);
          const merged =
            serverStyles.length === 0 ? [] : mergeStyles(get().styles, serverStyles);
          set({
            styles: merged,
            serverLoaded: true,
            serverError: undefined,
          });
          if (
            serverStyles.length > 0 &&
            JSON.stringify(merged) !== JSON.stringify(serverStyles)
          ) {
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
      upsertStyle: async (style) => {
        const styles = await persistStyle(normalizeStyle(style));
        set({ styles });
      },
      removeStyle: async (id) => {
        const styles = await deletePersistedStyle(id);
        set({ styles });
      },
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
