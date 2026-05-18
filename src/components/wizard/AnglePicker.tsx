"use client";

import { Check, Pencil, Plus } from "lucide-react";
import type { Angle } from "@/types";
import { cn } from "@/lib/utils";

const MAX_CUSTOM_LENGTH = 200;

interface AnglePickerProps {
  angles: Angle[];
  selectedIds: string[];
  customAngle: string;
  onToggle: (id: string) => void;
  onCustomChange: (text: string) => void;
}

export function AnglePicker({
  angles,
  selectedIds,
  customAngle,
  onToggle,
  onCustomChange,
}: AnglePickerProps) {
  const hasCustom = customAngle.trim().length > 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        勾选一个或多个角度。每勾一个,生成时会按「角度 × 风格」组合各产出一篇独立文章。
      </p>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {angles.map((angle) => {
          const selected = selectedIds.includes(angle.id);
          return (
            <li key={angle.id}>
              <button
                type="button"
                onClick={() => onToggle(angle.id)}
                role="checkbox"
                aria-checked={selected}
                className={cn(
                  "group relative flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-all",
                  selected
                    ? "border-blue-500 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-md",
                  hasCustom && !selected && "opacity-60"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border-2 text-xs font-semibold transition-colors",
                    selected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 bg-white text-slate-400"
                  )}
                  aria-hidden="true"
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {angle.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {angle.sceneDesc}
                  </p>
                  <p className="mt-2 text-[12px] italic text-slate-400">
                    例:{angle.exampleTitle}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div
        className={cn(
          "rounded-xl border-2 border-dashed bg-white/60 p-4 transition-colors",
          hasCustom
            ? "border-blue-400 bg-blue-50/60"
            : "border-slate-300 hover:border-slate-400"
        )}
      >
        <label
          htmlFor="custom-angle"
          className="flex items-center gap-2 text-sm font-medium text-slate-700"
        >
          {hasCustom ? (
            <Pencil className="h-4 w-4 text-blue-600" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4 text-slate-400" aria-hidden="true" />
          )}
          自己写一个角度(告诉 AI 你想怎么写)
        </label>
        <textarea
          id="custom-angle"
          value={customAngle}
          onChange={(e) =>
            onCustomChange(e.target.value.slice(0, MAX_CUSTOM_LENGTH))
          }
          placeholder="例:面向 CFO 的 ROI 测算视角;或者:把产品故事和某个真实行业场景结合起来讲"
          rows={3}
          className="mt-3 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
          <span>
            {hasCustom
              ? "自定义角度将覆盖上面的预置选择,且批次只产出 1 篇"
              : "留空则使用上面勾选的预置角度"}
          </span>
          <span
            className={cn(
              customAngle.length > MAX_CUSTOM_LENGTH - 20 &&
                "text-amber-600"
            )}
          >
            {customAngle.length}/{MAX_CUSTOM_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
}
