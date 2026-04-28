"use client";

import { Check, Users } from "lucide-react";
import type { WechatAccount } from "@/types";
import { cn } from "@/lib/utils";

interface AccountPickerProps {
  accounts: WechatAccount[];
  selectedId?: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function AccountPicker({
  accounts,
  selectedId,
  onSelect,
  disabled,
}: AccountPickerProps) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      role="radiogroup"
      aria-label="发布账号"
    >
      {accounts.map((a) => {
        const active = a.id === selectedId;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !disabled && onSelect(a.id)}
            disabled={disabled}
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-all",
              active
                ? "border-blue-500 ring-2 ring-blue-100"
                : "border-slate-200 hover:border-slate-300",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${a.avatarGradient[0]}, ${a.avatarGradient[1]})`,
              }}
              aria-hidden="true"
            >
              {a.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {a.name}
                </p>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {a.type}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">
                {a.audience}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {a.tonality}
              </p>
              <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Users className="h-3 w-3" aria-hidden="true" />
                {a.avgReaders.toLocaleString()} 平均阅读
              </div>
            </div>
            {active && (
              <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
