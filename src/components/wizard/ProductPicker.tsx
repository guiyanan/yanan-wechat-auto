"use client";

import { Check } from "lucide-react";
import type { Product } from "@/types";
import { cn } from "@/lib/utils";

interface ProductPickerProps {
  products: Product[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ProductPicker({
  products,
  selectedId,
  onSelect,
}: ProductPickerProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const selected = selectedId === product.id;
        return (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => onSelect(product.id)}
              aria-pressed={selected}
              className={cn(
                "group relative flex w-full flex-col gap-3 rounded-xl border bg-white p-5 text-left shadow-sm transition-all",
                selected
                  ? "border-blue-500 ring-2 ring-blue-100"
                  : "border-slate-200 hover:border-slate-300 hover:shadow-md"
              )}
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm"
                  style={{
                    background: `linear-gradient(135deg,${product.iconGradient[0]} 0%,${product.iconGradient[1]} 100%)`,
                  }}
                  aria-hidden="true"
                >
                  {product.name.slice(0, 1)}
                </div>
                {selected && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                )}
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {product.name}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {product.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {product.knowledgeDocs.length} 篇知识库文档
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
