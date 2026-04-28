"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { aiScoreMeta } from "@/lib/aiScore";
import { cn } from "@/lib/utils";

interface AiScoreGaugeProps {
  score: number;
  iterations: number;
  checking: boolean;
  humanizing: boolean;
  onRefresh: () => void;
  onRunHumanize: () => void;
  disabled?: boolean;
}

export function AiScoreGauge({
  score,
  iterations,
  checking,
  humanizing,
  onRefresh,
  onRunHumanize,
  disabled,
}: AiScoreGaugeProps) {
  const meta = aiScoreMeta(score || 0);
  const pct = Math.max(0, Math.min(100, score || 0));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          AI 浓度
        </h3>
        <span className="text-xs text-slate-400">
          迭代 {iterations} 次
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={cn("text-4xl font-bold tabular-nums", meta.textColor)}
          aria-label={`AI 浓度 ${score || 0} 分,${meta.label}`}
        >
          {score || 0}
        </span>
        <span className="text-sm text-slate-400">/ 100</span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            meta.bgColor,
            meta.textColor
          )}
        >
          <span aria-hidden="true">{meta.emoji}</span>
          {meta.label}
        </span>
      </div>

      <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
        <div
          className={cn(
            "h-2 rounded-full transition-[width] duration-500",
            meta.barColor
          )}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={score || 0}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled || checking || humanizing}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          重新检测
        </button>
        <button
          type="button"
          onClick={onRunHumanize}
          disabled={disabled || checking || humanizing}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {humanizing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          再去一轮
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-4 text-slate-400">
        演示数据:真实朱雀 API 接入前,分数按 articleId 种子稳定复现。
      </p>
    </div>
  );
}
