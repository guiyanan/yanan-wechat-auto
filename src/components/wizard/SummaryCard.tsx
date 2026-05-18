"use client";

import { FileText, Lightbulb, PenLine, Layers } from "lucide-react";
import type { Product, WritingStyle, Angle } from "@/types";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  product: Product | null;
  angles: Angle[];
  customAngle: string;
  styles: WritingStyle[];
}

export function SummaryCard({
  product,
  angles,
  customAngle,
  styles,
}: SummaryCardProps) {
  const hasCustom = customAngle.trim().length > 0;
  const hasAngle = angles.length > 0 || hasCustom;
  const hasStyle = styles.length > 0;

  // Batch size: each angle × each style produces one article. customAngle
  // counts as a single angle slot.
  const angleCount = hasCustom ? 1 : angles.length;
  const batchCount = angleCount * styles.length;

  return (
    <aside className="sticky top-20 w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        当前选择
      </h2>
      <ul className="mt-4 space-y-4">
        {/* Product */}
        <li>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                product
                  ? "bg-blue-50 text-blue-600"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                产品
              </p>
              <p
                className={cn(
                  "mt-0.5 truncate text-sm font-medium",
                  product ? "text-slate-900" : "text-slate-400"
                )}
              >
                {product?.name ?? "未选择"}
              </p>
              {product && (
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {product.description}
                </p>
              )}
            </div>
          </div>
        </li>

        {/* Angles (multi) */}
        <li>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                hasAngle
                  ? "bg-blue-50 text-blue-600"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                角度{hasAngle && angles.length > 0 ? ` · ${angles.length}` : ""}
              </p>
              {!hasAngle && (
                <p className="mt-0.5 text-sm font-medium text-slate-400">
                  未选择
                </p>
              )}
              {hasCustom && (
                <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">
                  自定义:{customAngle.trim()}
                </p>
              )}
              {!hasCustom && angles.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {angles.map((a) => (
                    <li
                      key={a.id}
                      className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                    >
                      {a.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </li>

        {/* Styles (multi) */}
        <li>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                hasStyle
                  ? "bg-blue-50 text-blue-600"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                风格{hasStyle ? ` · ${styles.length}` : ""}
              </p>
              {!hasStyle && (
                <p className="mt-0.5 text-sm font-medium text-slate-400">
                  未选择
                </p>
              )}
              {hasStyle && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {styles.map((s) => (
                    <li
                      key={s.id}
                      className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                    >
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </li>

        {/* Batch preview — only shown once both angle & style are picked */}
        {batchCount > 0 && (
          <li className="rounded-lg bg-emerald-50 p-3">
            <div className="flex items-center gap-2">
              <Layers
                className="h-4 w-4 text-emerald-600"
                aria-hidden="true"
              />
              <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-700">
                本次批次
              </p>
            </div>
            <p className="mt-1 text-sm font-medium text-emerald-900">
              将生成 {batchCount} 篇独立文章
            </p>
            <p className="mt-0.5 text-xs text-emerald-700">
              {angleCount} 角度 × {styles.length} 风格
            </p>
          </li>
        )}
      </ul>
    </aside>
  );
}
