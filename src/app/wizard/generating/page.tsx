"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useWizardStore } from "@/store/wizardStore";
import { useArticleStore } from "@/store/articleStore";
import type { PipelineStageId } from "@/types";
import { cn } from "@/lib/utils";

const STAGES: Array<{
  id: PipelineStageId;
  label: string;
  hint: string;
}> = [
  { id: "outline", label: "大纲生成", hint: "基于角度 + 产品知识库" },
  { id: "body", label: "撰写正文", hint: "按选定风格流式输出" },
  { id: "titles", label: "候选标题", hint: "5 个不同结构" },
  { id: "covers", label: "候选封面", hint: "4 种风格(mock)" },
  { id: "factcheck", label: "事实核查", hint: "mock · 1/10 概率警告" },
];

type StageStatus = "pending" | "running" | "done" | "failed";

interface StageState {
  status: StageStatus;
  elapsedMs?: number;
  error?: string;
}

interface GenerationResult {
  outline: string;
  body: string;
  titles: string[];
  covers: Array<{ url: string; styleLabel: string }>;
  factcheck: { passed: boolean; warning: string | null };
}

const INITIAL_STATES: Record<PipelineStageId, StageState> = {
  outline: { status: "pending" },
  body: { status: "pending" },
  titles: { status: "pending" },
  covers: { status: "pending" },
  factcheck: { status: "pending" },
};

export default function GeneratingPage() {
  const router = useRouter();
  const productId = useWizardStore((s) => s.productId);
  const angleId = useWizardStore((s) => s.angleId);
  const customAngle = useWizardStore((s) => s.customAngle);
  const styleId = useWizardStore((s) => s.styleId);
  const createDraft = useArticleStore((s) => s.createDraft);
  const patch = useArticleStore((s) => s.patch);

  const [stages, setStages] = useState<Record<PipelineStageId, StageState>>(
    INITIAL_STATES
  );
  const [bodyPreview, setBodyPreview] = useState("");
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [factcheckWarning, setFactcheckWarning] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const ready = !!productId && !!styleId && (!!angleId || customAngle.trim());

  useEffect(() => {
    if (!ready) return;
    if (startedRef.current) return;
    startedRef.current = true;
    runPipeline();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function runPipeline() {
    const controller = new AbortController();
    abortRef.current = controller;
    setStages(INITIAL_STATES);
    setBodyPreview("");
    setFatalError(null);
    setFactcheckWarning(null);

    const draft = createDraft({
      productId: productId!,
      angleId: angleId ?? undefined,
      customAngle: customAngle || undefined,
      styleId: styleId!,
    });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          angleId: angleId ?? undefined,
          customAngle: customAngle || undefined,
          styleId,
          articleId: draft.id,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        setFatalError(`生成服务错误:HTTP ${res.status} ${res.statusText}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let body = "";
      const result: GenerationResult = {
        outline: "",
        body: "",
        titles: [],
        covers: [],
        factcheck: { passed: true, warning: null },
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep = buffer.indexOf("\n\n");
        while (sep !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          sep = buffer.indexOf("\n\n");
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") break;
          try {
            const e = JSON.parse(payload);
            if (e.type === "stage") {
              setStages((prev) => ({
                ...prev,
                [e.stage as PipelineStageId]: {
                  status: e.status,
                  elapsedMs: e.elapsedMs,
                  error: e.error,
                },
              }));
              if (e.stage === "factcheck" && e.status === "done" && e.data) {
                const w = (e.data as { warning?: string | null }).warning;
                setFactcheckWarning(w ?? null);
                result.factcheck = e.data as GenerationResult["factcheck"];
              }
              if (e.stage === "outline" && e.status === "done" && e.data) {
                result.outline = (e.data as { outline: string }).outline ?? "";
              }
              if (e.stage === "titles" && e.status === "done" && e.data) {
                result.titles =
                  (e.data as { titles: string[] }).titles ?? [];
              }
              if (e.stage === "covers" && e.status === "done" && e.data) {
                result.covers =
                  (e.data as { covers: GenerationResult["covers"] }).covers ?? [];
              }
            } else if (e.type === "body-delta") {
              body += e.delta;
              setBodyPreview(body);
            } else if (e.type === "result") {
              Object.assign(result, e.result);
            } else if (e.type === "error") {
              setFatalError(e.error?.message ?? "生成失败");
            }
          } catch {
            // Ignore malformed event
          }
        }
      }

      if (fatalError) return;

      // Persist to articleStore
      patch(draft.id, {
        title: result.titles[0] ?? draft.title,
        titleCandidates: result.titles,
        contentHtml: markdownToHtml(result.body),
        coverImageUrl: result.covers[0]?.url,
        coverCandidates: result.covers.map((c) => c.url),
        aiScore: {
          value: 0,
          checkedAt: new Date().toISOString(),
          iterations: 0,
        },
        compliance: {
          ...draft.compliance,
          factCheckPassed: result.factcheck.passed,
          factCheckWarning: result.factcheck.warning ?? undefined,
        },
      });

      setTimeout(() => {
        router.push(`/editor/${draft.id}`);
      }, 800);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setFatalError(err instanceof Error ? err.message : String(err));
    }
  }

  function cancelAndBack() {
    abortRef.current?.abort();
    router.push("/wizard/style");
  }

  function retry() {
    abortRef.current?.abort();
    startedRef.current = false;
    setFatalError(null);
    setFactcheckWarning(null);
    setStages(INITIAL_STATES);
    setBodyPreview("");
    // useEffect will restart
    setTimeout(() => {
      startedRef.current = true;
      runPipeline();
    }, 50);
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-20">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle
            className="mx-auto h-10 w-10 text-amber-500"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-lg font-semibold text-slate-900">
            缺少前置选项
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            请先完成 Wizard 前三步(产品 / 角度 / 风格)。
          </p>
          <Link
            href="/wizard/product"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            回到第一步
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            生成中 · 5 阶段 pipeline
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            正在生成文章
          </h1>
          <p className="text-sm text-slate-500">
            每个阶段都对你透明:产品知识库 → 大纲 → 正文(流式) → 标题 → 封面 → 事实核查
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ol
            className="space-y-3"
            aria-live="polite"
            aria-label="生成阶段列表"
          >
            {STAGES.map((stage, idx) => (
              <StageRow
                key={stage.id}
                index={idx + 1}
                label={stage.label}
                hint={stage.hint}
                state={stages[stage.id]}
              />
            ))}
          </ol>
        </section>

        {bodyPreview && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                正文预览(流式)
              </h2>
              <span className="text-xs text-slate-400">
                {bodyPreview.length} 字
              </span>
            </div>
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-7 text-slate-800">
              {bodyPreview}
            </pre>
          </section>
        )}

        {factcheckWarning && !fatalError && (
          <section className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-800">
                事实核查警告(不阻塞发布,建议人工复核)
              </p>
              <p className="text-sm text-amber-700">{factcheckWarning}</p>
            </div>
          </section>
        )}

        {fatalError && (
          <section
            role="alert"
            className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-5"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-red-800">生成失败</p>
                <p className="text-sm text-red-700">{fatalError}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={retry}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-red-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-red-700"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                从头重新生成
              </button>
              <button
                type="button"
                onClick={cancelAndBack}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                取消返回 Wizard
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

interface StageRowProps {
  index: number;
  label: string;
  hint: string;
  state: StageState;
}

function StageRow({ index, label, hint, state }: StageRowProps) {
  return (
    <li className="flex items-center gap-4">
      <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center">
        {state.status === "pending" && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-400">
            {index}
          </span>
        )}
        {state.status === "running" && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white ring-4 ring-blue-100">
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            <span
              className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-30"
              aria-hidden="true"
            />
          </span>
        )}
        {state.status === "done" && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-emerald-100">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        {state.status === "failed" && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white ring-4 ring-red-100">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-sm font-medium",
              state.status === "pending" && "text-slate-400",
              state.status === "running" && "text-slate-900",
              state.status === "done" && "text-slate-700",
              state.status === "failed" && "text-red-700"
            )}
          >
            {label}
          </p>
          {state.elapsedMs !== undefined && (
            <span className="text-xs text-slate-400">
              {(state.elapsedMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {state.error ?? hint}
        </p>
      </div>
    </li>
  );
}

function markdownToHtml(md: string): string {
  // Minimal markdown → HTML for Phase 3b. Phase 4+5 will replace with TipTap.
  return md
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim();
      if (!b) return "";
      if (b.startsWith("### ")) return `<h3>${escape(b.slice(4))}</h3>`;
      if (b.startsWith("## ")) return `<h2>${escape(b.slice(3))}</h2>`;
      if (b.startsWith("# ")) return `<h1>${escape(b.slice(2))}</h1>`;
      return `<p>${escape(b)}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
