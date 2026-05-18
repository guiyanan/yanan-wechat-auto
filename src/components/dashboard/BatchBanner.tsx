"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

interface BatchInfo {
  count: number;
  labels: string[];
  ts: number;
}

export function BatchBanner() {
  const [info, setInfo] = useState<BatchInfo | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("joto-last-batch");
      if (!raw) return;
      const parsed = JSON.parse(raw) as BatchInfo;
      if (Date.now() - parsed.ts > 30 * 60 * 1000) {
        sessionStorage.removeItem("joto-last-batch");
        return;
      }
      setInfo(parsed);
    } catch {
      // ignore
    }
  }, []);

  function dismiss() {
    setInfo(null);
    sessionStorage.removeItem("joto-last-batch");
  }

  if (!info) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <Sparkles
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-blue-800">
          刚生成 {info.count} 篇文章
        </p>
        <p className="mt-0.5 text-xs text-blue-700">
          {info.labels.join(" / ")}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="flex-shrink-0 rounded p-1 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-600"
        aria-label="关闭"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
