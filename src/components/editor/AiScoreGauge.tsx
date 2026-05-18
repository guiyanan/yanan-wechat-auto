"use client";

import { Loader2, RefreshCw, Sparkles, Wand2, StopCircle } from "lucide-react";
import { aiScoreMeta } from "@/lib/aiScore";
import { cn } from "@/lib/utils";

interface AiScoreGaugeProps {
  score: number;
  iterations: number;
  checking: boolean;
  humanizing: boolean;
  onRefresh: () => void;
  onRunHumanize: () => void;
  /** Auto-converge loop entry — runs detect → humanize → detect, up to max iterations. */
  onAutoLoop: () => void;
  /** Cancel an in-flight auto-loop. */
  onCancelAutoLoop: () => void;
  /** True while the auto-loop is iterating. */
  autoLoopRunning: boolean;
  /** Current iteration (1-indexed) shown to the user when autoLoopRunning. */
  autoLoopIter: number;
  /** Hard cap on auto-loop iterations — surfaced in the button label. */
  autoLoopMaxIters: number;
  /** Target score the auto-loop tries to reach. */
  autoLoopTarget: number;
  disabled?: boolean;
  /**
   * L3 detectScore result (0–100). When provided, shown alongside the
   * heuristic score so users can compare the two signals.
   * undefined = not yet computed.
   */
  l3Score?: number;
  /**
   * L3 score from BEFORE the last pipeline run — used to show the delta.
   */
  l3ScoreBefore?: number;
}

export function AiScoreGauge({
  score,
  iterations,
  checking,
  humanizing,
  onRefresh,
  onRunHumanize,
  onAutoLoop,
  onCancelAutoLoop,
  autoLoopRunning,
  autoLoopIter,
  autoLoopMaxIters,
  autoLoopTarget,
  disabled,
  l3Score,
  l3ScoreBefore,
}: AiScoreGaugeProps) {
  const meta = aiScoreMeta(score || 0);
  const pct = Math.max(0, Math.min(100, score || 0));
  const otherDisabled = disabled || checking || humanizing || autoLoopRunning;

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

      {/* L3 pipeline score row */}
      {l3Score !== undefined && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5">
          <span className="text-[11px] text-slate-500">L3 检测评分</span>
          <span className="flex items-center gap-1.5 text-xs font-medium tabular-nums">
            {l3ScoreBefore !== undefined && l3ScoreBefore !== l3Score && (
              <span className="text-slate-400 line-through">{l3ScoreBefore}</span>
            )}
            <span
              className={cn(
                l3Score <= 40 ? "text-emerald-600" : l3Score <= 65 ? "text-amber-600" : "text-red-600"
              )}
            >
              {l3Score}
            </span>
            <span className="text-slate-400">/ 100</span>
          </span>
        </div>
      )}

      {/* Primary action: auto-pipeline (L1+L2+L3) */}
      {autoLoopRunning ? (
        <button
          type="button"
          onClick={onCancelAutoLoop}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-red-700"
        >
          <StopCircle className="h-3.5 w-3.5" aria-hidden="true" />
          停止 · 第 {autoLoopIter} / {autoLoopMaxIters} 轮
        </button>
      ) : (
        <button
          type="button"
          onClick={onAutoLoop}
          disabled={otherDisabled}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          title={`L1 Qwen 改写 + L2 后处理 + L3 评分门控，目标 < ${autoLoopTarget}`}
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
          一键降 AI（目标 &lt; {autoLoopTarget}）
        </button>
      )}

      {/* Secondary actions row */}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRefresh}
          disabled={otherDisabled}
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
          disabled={otherDisabled}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {humanizing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          单轮改写
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-4 text-slate-400">
        启发式评分（六维加权）· L3 评分（4维 AI 痕迹检测）。&ldquo;一键降 AI&rdquo; 运行完整 L1+L2+L3 流水线。
      </p>
    </div>
  );
}
