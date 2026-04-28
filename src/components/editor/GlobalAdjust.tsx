"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";

interface GlobalAdjustProps {
  running: boolean;
  onRun: (instruction: string) => void;
  disabled?: boolean;
}

export function GlobalAdjust({ running, onRun, disabled }: GlobalAdjustProps) {
  const [value, setValue] = useState("");

  function submit() {
    const v = value.trim();
    if (!v || running || disabled) return;
    onRun(v);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        全局调整
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        用自然语言描述想要的变化,对全文执行一次改写。
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={running || disabled}
        placeholder="例如:把整体语气改得更克制一些,少用感叹号。"
        className="mt-3 min-h-[80px] w-full resize-y rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        type="button"
        onClick={submit}
        disabled={running || disabled || value.trim().length === 0}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        执行
      </button>
    </div>
  );
}
