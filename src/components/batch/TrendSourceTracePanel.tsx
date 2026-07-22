"use client";

import { ExternalLink, Newspaper } from "lucide-react";
import type { TrendSearchResult } from "@/types/trend";

interface TrendSourceTracePanelProps {
  sources?: TrendSearchResult[];
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function sourceHost(url: string): string | null {
  if (!isExternalUrl(url)) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function formatSourceMeta(source: TrendSearchResult): string {
  const name = source.source || sourceHost(source.url) || "系统兜底素材";
  return [name, source.publishedAt].filter(Boolean).join(" · ");
}

export function TrendSourceTracePanel({ sources }: TrendSourceTracePanelProps) {
  const visibleSources = (sources ?? [])
    .filter((source) => source.title.trim() || source.snippet.trim())
    .slice(0, 4);

  if (visibleSources.length === 0) return null;

  return (
    <aside
      aria-label="热点来源素材"
      className="mb-3 shrink-0 rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
            <Newspaper className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">热点原文 / 来源素材</h3>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              生成时参考的外部话题
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-400">
          {visibleSources.length} 条
        </span>
      </div>

      <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
        {visibleSources.map((source) => {
          const canOpen = isExternalUrl(source.url);
          return (
            <article
              key={source.id}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-500">
                    {formatSourceMeta(source)}
                  </p>
                  <h4 className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-slate-100">
                    {source.title || "未命名热点素材"}
                  </h4>
                </div>
                {canOpen && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 text-slate-300 transition-colors hover:border-blue-400 hover:text-blue-300"
                    aria-label={`打开原文：${source.title}`}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </div>
              {source.snippet && (
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">
                  {source.snippet}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
