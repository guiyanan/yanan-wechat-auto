import { aiScoreMeta } from "@/lib/aiScore";
import { cn } from "@/lib/utils";

interface AiScoreBarProps {
  score: number;
  compact?: boolean;
}

export function AiScoreBar({ score, compact = false }: AiScoreBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const meta = aiScoreMeta(clamped);
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compact ? "min-w-[132px]" : "min-w-[180px]"
      )}
      role="group"
      aria-label={`AI 浓度 ${clamped} 分, ${meta.label}`}
    >
      <span
        className={cn(
          "h-2 w-2 flex-shrink-0 rounded-full",
          meta.barColor
        )}
        aria-hidden="true"
      />
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("text-xs font-medium", meta.textColor)}>
            {clamped}
          </span>
          {!compact && (
            <span className={cn("text-[11px]", meta.textColor)}>
              {meta.label}
            </span>
          )}
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all", meta.barColor)}
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    </div>
  );
}
