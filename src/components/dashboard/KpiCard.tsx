import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string | number;
  hint?: string;
  hintColor?: string;
}

export function KpiCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  hint,
  hintColor = "text-slate-500",
}: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          {hint && (
            <p className={`mt-2 text-xs ${hintColor}`}>{hint}</p>
          )}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
