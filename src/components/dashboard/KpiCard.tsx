import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string | number;
  hint?: string;
  hintColor?: string;
  eyebrow?: string;
}

export function KpiCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  hint,
  hintColor = "text-slate-500",
  eyebrow,
}: KpiCardProps) {
  return (
    <div className="rounded-lg border border-[#d2d2d7]/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-[#b9b9c0]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
              {eyebrow}
            </p>
          )}
          <p className="text-[13px] font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {value}
          </p>
          {hint && <p className={`mt-2 text-xs ${hintColor}`}>{hint}</p>}
        </div>
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
