"use client";

import {
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";
import type { PipelineStageId } from "@/types";
import { cn } from "@/lib/utils";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface BatchJob {
  key: string;
  angleName: string;
  styleName: string;
  status: JobStatus;
  currentStage: PipelineStageId | null;
  completedStages: number;
  totalStages: number;
  error?: string;
  articleId?: string;
}

interface BatchGeneratingProgressProps {
  jobs: BatchJob[];
}

const STAGE_LABELS: Record<PipelineStageId, string> = {
  outline: "大纲",
  body: "正文",
  titles: "标题",
  covers: "封面",
  factcheck: "核查",
};

export function BatchGeneratingProgress({
  jobs,
}: BatchGeneratingProgressProps) {
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          批量生成进度:{doneCount}/{jobs.length} 篇完成
          {failedCount > 0 && (
            <span className="ml-2 text-red-600">
              ({failedCount} 篇失败)
            </span>
          )}
        </p>
        <p className="text-xs text-slate-400">
          同时并发上限 3 篇
        </p>
      </div>

      <div className="space-y-2">
        {jobs.map((job) => (
          <JobRow key={job.key} job={job} />
        ))}
      </div>
    </section>
  );
}

function JobRow({ job }: { job: BatchJob }) {
  const progress =
    job.totalStages > 0
      ? Math.round((job.completedStages / job.totalStages) * 100)
      : 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        job.status === "done" && "border-emerald-200 bg-emerald-50/50",
        job.status === "failed" && "border-red-200 bg-red-50/50",
        job.status === "running" && "border-blue-200 bg-blue-50/50",
        job.status === "queued" && "border-slate-200 bg-slate-50/50"
      )}
    >
      <div className="flex items-center gap-3">
        <StatusIcon status={job.status} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900">
              {job.angleName}
            </span>
            <span className="text-xs text-slate-400">×</span>
            <span className="text-sm font-medium text-slate-900">
              {job.styleName}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  job.status === "done" && "bg-emerald-500",
                  job.status === "failed" && "bg-red-400",
                  job.status === "running" && "bg-blue-500",
                  job.status === "queued" && "bg-slate-300"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-16 text-right text-xs text-slate-500">
              {job.status === "queued"
                ? "排队中"
                : job.status === "done"
                  ? "完成"
                  : job.status === "failed"
                    ? "失败"
                    : job.currentStage
                      ? STAGE_LABELS[job.currentStage]
                      : "准备中"}
            </span>
          </div>
        </div>
      </div>

      {job.error && (
        <p className="mt-2 text-xs text-red-600">{job.error}</p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: JobStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-400">
      <span className="h-2 w-2 rounded-full bg-slate-400" />
    </span>
  );
}
