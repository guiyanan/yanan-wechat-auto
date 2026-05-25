"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/types";

interface ProductStoreState {
  products: Record<string, Product>;
  serverLoaded: boolean;
  serverError?: string;
  loadFromServer: () => Promise<void>;
  upsert: (product: Product) => void;
  remove: (id: string) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function newerProduct(current: Product | undefined, incoming: Product): Product {
  if (!current) return incoming;
  const currentTime = Date.parse(current.updatedAt ?? "");
  const incomingTime = Date.parse(incoming.updatedAt ?? "");
  if (Number.isFinite(incomingTime) && incomingTime > (currentTime || 0)) {
    return incoming;
  }
  return current;
}

function mergeProductRecords(
  localProducts: Record<string, Product>,
  serverProducts: Record<string, Product>
): Record<string, Product> {
  const merged: Record<string, Product> = { ...serverProducts };
  for (const product of Object.values(localProducts)) {
    merged[product.id] = newerProduct(merged[product.id], product);
  }
  return merged;
}

async function saveProductLibrary(products: Record<string, Product>) {
  if (!isBrowser()) return;
  await fetch("/api/products/library", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products }),
  });
}

function persistProduct(product: Product) {
  if (!isBrowser()) return;
  void fetch("/api/products/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product }),
  });
}

function deletePersistedProduct(id: string) {
  if (!isBrowser()) return;
  void fetch(`/api/products/library?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export const useProductStore = create<ProductStoreState>()(
  persist(
    (set, get) => ({
      products: {},
      serverLoaded: false,
      serverError: undefined,
      loadFromServer: async () => {
        if (!isBrowser() || get().serverLoaded) return;
        try {
          const res = await fetch("/api/products/library", { cache: "no-store" });
          const data = (await res.json()) as {
            ok?: boolean;
            products?: Record<string, Product>;
            error?: string;
          };
          if (!res.ok || !data.ok) {
            throw new Error(data.error ?? "读取项目产品库失败");
          }
          const serverProducts = data.products ?? {};
          const merged = mergeProductRecords(get().products, serverProducts);
          set({
            products: merged,
            serverLoaded: true,
            serverError: undefined,
          });
          if (JSON.stringify(merged) !== JSON.stringify(serverProducts)) {
            void saveProductLibrary(merged);
          }
        } catch (err) {
          set({
            serverLoaded: true,
            serverError:
              err instanceof Error ? err.message : "读取项目产品库失败",
          });
        }
      },
      upsert: (product) =>
        set((state) => {
          const saved = { ...product, updatedAt: nowIso() };
          persistProduct(saved);
          return {
            products: {
              ...state.products,
              [product.id]: saved,
            },
          };
        }),
      remove: (id) =>
        set((state) => {
          const next = { ...state.products };
          delete next[id];
          deletePersistedProduct(id);
          return { products: next };
        }),
    }),
    {
      name: "joto-product-library-v1",
      partialize: (state) => ({ products: state.products }),
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : (undefined as unknown as Storage)
      ),
    }
  )
);
