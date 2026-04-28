"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TitleCandidatesProps {
  title: string;
  candidates: string[];
  regenerating: boolean;
  onSelect: (title: string) => void;
  onRegenerate: () => void;
  disabled?: boolean;
}

export function TitleCandidates({
  title,
  candidates,
  regenerating,
  onSelect,
  onRegenerate,
  disabled,
}: TitleCandidatesProps) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          候选标题
        </h2>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={disabled || regenerating}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {regenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
          )}
          再生成
        </button>
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-slate-400">暂无候选标题</p>
      ) : (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="候选标题">
          {candidates.map((t, i) => {
            const active = t === title;
            return (
              <button
                key={`${t}-${i}`}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => !disabled && onSelect(t)}
                disabled={disabled}
                className={cn(
                  "inline-flex max-w-sm items-center rounded-full border px-3 py-1.5 text-sm shadow-sm transition-colors",
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-100"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  disabled && "cursor-not-allowed opacity-60"
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
