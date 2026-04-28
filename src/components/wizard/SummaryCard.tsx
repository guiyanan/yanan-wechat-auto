"use client";

import { FileText, Lightbulb, PenLine } from "lucide-react";
import type { Product, WritingStyle, Angle } from "@/types";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  product: Product | null;
  angle: Angle | null;
  customAngle: string;
  style: WritingStyle | null;
}

export function SummaryCard({
  product,
  angle,
  customAngle,
  style,
}: SummaryCardProps) {
  const items: Array<{
    label: string;
    icon: typeof FileText;
    value: string | null;
    hint?: string;
  }> = [
    {
      label: "产品",
      icon: FileText,
      value: product?.name ?? null,
      hint: product?.description,
    },
    {
      label: "角度",
      icon: Lightbulb,
      value: angle?.name ?? (customAngle.trim() ? "自定义角度" : null),
      hint: angle?.exampleTitle ?? (customAngle.trim() || undefined),
    },
    {
      label: "风格",
      icon: PenLine,
      value: style?.name ?? null,
      hint: style?.tags.join(" · "),
    },
  ];

  return (
    <aside className="sticky top-20 w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        当前选择
      </h2>
      <ul className="mt-4 space-y-4">
        {items.map((item) => {
          const Icon = item.icon;
          const filled = !!item.value;
          return (
            <li key={item.label}>
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                    filled
                      ? "bg-blue-50 text-blue-600"
                      : "bg-slate-100 text-slate-400"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 truncate text-sm font-medium",
                      filled ? "text-slate-900" : "text-slate-400"
                    )}
                  >
                    {item.value ?? "未选择"}
                  </p>
                  {filled && item.hint && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {item.hint}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
