"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverPickerProps {
  candidates: string[];
  selectedUrl?: string;
  onSelect: (url: string) => void;
  disabled?: boolean;
}

export function CoverPicker({
  candidates,
  selectedUrl,
  onSelect,
  disabled,
}: CoverPickerProps) {
  if (candidates.length === 0) {
    return (
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          候选封面
        </h2>
        <p className="text-sm text-slate-400">暂无候选封面</p>
      </section>
    );
  }
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        候选封面
      </h2>
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        role="radiogroup"
        aria-label="候选封面"
      >
        {candidates.map((url, i) => {
          const active = url === selectedUrl;
          return (
            <button
              key={`${i}-${url.slice(0, 20)}`}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => !disabled && onSelect(url)}
              disabled={disabled}
              className={cn(
                "group relative aspect-video overflow-hidden rounded-lg border-2 shadow-sm transition-all",
                active
                  ? "border-blue-500 ring-2 ring-blue-100"
                  : "border-transparent hover:border-slate-300",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`封面候选 ${i + 1}`}
                className="h-full w-full object-cover"
              />
              {active && (
                <span className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
