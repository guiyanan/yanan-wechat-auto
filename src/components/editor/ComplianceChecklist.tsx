"use client";

import { AlertTriangle, CheckCircle2, Circle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckStatus = "ok" | "warn" | "fail" | "pending";

interface CheckItem {
  key: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}

interface ComplianceChecklistProps {
  aiScore: number;
  limitWords: string[];
  sensitiveTopics: string[];
  coverSelected: boolean;
  factCheckPassed: boolean;
  factCheckWarning?: string;
  scanning: boolean;
}

export function ComplianceChecklist({
  aiScore,
  limitWords,
  sensitiveTopics,
  coverSelected,
  factCheckPassed,
  factCheckWarning,
  scanning,
}: ComplianceChecklistProps) {
  const items: CheckItem[] = [
    {
      key: "ai-score",
      label: "AI 浓度 < 40",
      status: aiScore === 0 ? "pending" : aiScore < 40 ? "ok" : aiScore < 70 ? "warn" : "fail",
      detail:
        aiScore === 0
          ? "尚未检测"
          : aiScore < 40
            ? `当前 ${aiScore} 分,可安全发布`
            : aiScore < 70
              ? `当前 ${aiScore} 分,建议「再去一轮」`
              : `当前 ${aiScore} 分,发布风险较高`,
    },
    {
      key: "limit",
      label: "极限词扫描",
      status: scanning ? "pending" : limitWords.length === 0 ? "ok" : "fail",
      detail:
        limitWords.length === 0
          ? "未命中广告法极限词"
          : `命中 ${limitWords.length} 个:${limitWords.slice(0, 6).join("、")}${limitWords.length > 6 ? "…" : ""}`,
    },
    {
      key: "sensitive",
      label: "敏感话题",
      status: scanning ? "pending" : sensitiveTopics.length === 0 ? "ok" : "warn",
      detail:
        sensitiveTopics.length === 0
          ? "未触发敏感话题关键词"
          : `触发 ${sensitiveTopics.length} 类:${sensitiveTopics.join("、")}`,
    },
    {
      key: "cover",
      label: "封面已选",
      status: coverSelected ? "ok" : "warn",
      detail: coverSelected ? "已选封面" : "请在左侧选一张封面",
    },
    {
      key: "factcheck",
      label: "事实核查",
      status: factCheckPassed ? "ok" : "warn",
      detail: factCheckPassed
        ? "通过"
        : factCheckWarning ?? "请人工复核",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          合规清单
        </h3>
        <span className="text-xs text-slate-400">
          {okCount} / {items.length} 通过
        </span>
      </div>

      <ul className="mt-3 space-y-2.5">
        {items.map((i) => (
          <li key={i.key} className="flex items-start gap-2.5">
            <StatusIcon status={i.status} />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  i.status === "ok" && "text-slate-700",
                  i.status === "warn" && "text-amber-700",
                  i.status === "fail" && "text-red-700",
                  i.status === "pending" && "text-slate-400"
                )}
              >
                {i.label}
              </p>
              {i.detail && (
                <p className="mt-0.5 text-xs text-slate-500">{i.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusIcon({ status }: { status: CheckStatus }) {
  const cls = "mt-0.5 h-4 w-4 flex-shrink-0";
  if (status === "ok")
    return <CheckCircle2 className={cn(cls, "text-emerald-500")} aria-label="通过" />;
  if (status === "warn")
    return <AlertTriangle className={cn(cls, "text-amber-500")} aria-label="警告" />;
  if (status === "fail")
    return <XCircle className={cn(cls, "text-red-500")} aria-label="失败" />;
  return <Circle className={cn(cls, "text-slate-300")} aria-label="未检测" />;
}
