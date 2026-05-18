"use client";

import { Check, Upload } from "lucide-react";
import type { WritingStyle } from "@/types";
import { cn } from "@/lib/utils";

interface StylePickerProps {
  styles: WritingStyle[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onRequestTrain: () => void;
}

export function StylePicker({
  styles,
  selectedIds,
  onToggle,
  onRequestTrain,
}: StylePickerProps) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        勾选一个或多个风格。每勾一个,会按「角度 × 风格」组合各产出一篇独立文章。
      </p>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {styles.map((style) => {
          const selected = selectedIds.includes(style.id);
          return (
            <li key={style.id}>
              <button
                type="button"
                onClick={() => onToggle(style.id)}
                role="checkbox"
                aria-checked={selected}
                className={cn(
                  "relative flex w-full flex-col gap-3 rounded-xl border bg-white p-5 text-left shadow-sm transition-all",
                  selected
                    ? "border-blue-500 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-md"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 text-xs font-semibold transition-colors",
                      selected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-400"
                    )}
                    aria-hidden="true"
                  >
                    {selected ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-slate-900">
                      {style.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {style.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "relative rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 transition-colors",
                    selected && "bg-blue-50/60"
                  )}
                >
                  <span
                    className={cn(
                      "absolute inset-y-3 left-0 w-1 rounded-full transition-colors",
                      selected ? "bg-blue-500" : "bg-slate-300"
                    )}
                    aria-hidden="true"
                  />
                  <p className="pl-3 italic">{style.sampleText}</p>
                </div>

                <p className="text-xs text-slate-500">{style.scopeDesc}</p>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onRequestTrain}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white/60 px-5 py-4 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-white"
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        用我自己上传的范文训练一个新风格(联系管理员)
      </button>
    </div>
  );
}
