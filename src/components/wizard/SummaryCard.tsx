"use client";

import { FileText, Lightbulb, PenLine, Layers, Ruler } from "lucide-react";
import type { Product } from "@/types";
import {
  ANGLE_STRATEGY_OPTIONS,
  CONTENT_LENGTH_OPTIONS,
  getAngleStrategyOption,
  getContentLengthOption,
} from "@/lib/contentSettings";
import { cn } from "@/lib/utils";
import { useWizardStore } from "@/store/wizardStore";

interface SummaryCardProps {
  product: Product | null;
}

export function SummaryCard({ product }: SummaryCardProps) {
  const contentLength = useWizardStore((s) => s.contentLength);
  const setContentLength = useWizardStore((s) => s.setContentLength);
  const angleStrategy = useWizardStore((s) => s.angleStrategy);
  const setAngleStrategy = useWizardStore((s) => s.setAngleStrategy);
  const lengthOption = getContentLengthOption(contentLength);
  const strategyOption = getAngleStrategyOption(angleStrategy);

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

        <li>
          <div className="flex items-start gap-3">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"
            >
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                角度 · {strategyOption.shortLabel}
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">
                {strategyOption.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {strategyOption.description}
              </p>
              <div className="mt-3 grid gap-1.5">
                {ANGLE_STRATEGY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAngleStrategy(option.id)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                      angleStrategy === option.id
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </li>

        <li>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Ruler className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                长度 · {lengthOption.shortLabel}
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">
                {lengthOption.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {lengthOption.wordRange} · {lengthOption.description}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {CONTENT_LENGTH_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setContentLength(option.id)}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors",
                      contentLength === option.id
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    {option.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </li>

        <li>
          <div className="flex items-start gap-3">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                风格 · 随机
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">
                官方风格 + 学习风格随机混用
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                UI 排版固定使用 JOTO 白底公众号模板。
              </p>
            </div>
          </div>
        </li>

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
            将生成 5 篇独立文章
          </p>
          <p className="mt-0.5 text-xs text-emerald-700">
            {lengthOption.label} × {strategyOption.label}
          </p>
        </li>
      </ul>
    </aside>
  );
}
