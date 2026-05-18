"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useWizardStore } from "@/store/wizardStore";
import { useArticleStore } from "@/store/articleStore";
import {
  BatchGeneratingProgress,
  type BatchJob,
} from "@/components/wizard/BatchGeneratingProgress";
import anglesData from "@/data/angles.json";
import stylesData from "@/data/styles.json";
import type { Angle, WritingStyle, PipelineStageId } from "@/types";

const ANGLES = anglesData as Angle[];
const STYLES = stylesData as WritingStyle[];
const TOTAL_STAGES = 5;
const MAX_CONCURRENCY = 3;

const STAGE_ORDER: PipelineStageId[] = [
  "outline",
  "body",
  "titles",
  "covers",
  "factcheck",
];

interface GenerationResult {
  outline: string;
  body: string;
  titles: string[];
  covers: Array<{ url: string; styleLabel: string }>;
  factcheck: { passed: boolean; warning: string | null };
}

interface JobSpec {
  key: string;
  angleId: string | null;
  angleName: string;
  customAngle: string;
  styleId: string;
  styleName: string;
}

export default function GeneratingPage() {
  const router = useRouter();
  const productId = useWizardStore((s) => s.productId);
  const angleIds = useWizardStore((s) => s.angleIds);
  const customAngle = useWizardStore((s) => s.customAngle);
  const styleIds = useWizardStore((s) => s.styleIds);
  const createDraft = useArticleStore((s) => s.createDraft);
  const patch = useArticleStore((s) => s.patch);

  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [allDone, setAllDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const hasCustomAngle = customAngle.trim().length > 0;
  const hasAngle = angleIds.length > 0 || hasCustomAngle;
  const ready = !!productId && hasAngle && styleIds.length > 0;

  const buildJobSpecs = useCallback((): JobSpec[] => {
    const specs: JobSpec[] = [];
    const effectiveAngles: Array<{
      id: string | null;
      name: string;
      custom: string;
    }> = hasCustomAngle
      ? [{ id: null, name: "自定义角度", custom: customAngle.trim() }]
      : angleIds.map((aid) => {
          const a = ANGLES.find((x) => x.id === aid);
          return { id: aid, name: a?.name ?? aid, custom: "" };
        });

    for (const angle of effectiveAngles) {
      for (const sid of styleIds) {
        const s = STYLES.find((x) => x.id === sid);
        specs.push({
          key: `${angle.id ?? "custom"}-${sid}`,
          angleId: angle.id,
          angleName: angle.name,
          customAngle: angle.custom,
          styleId: sid,
          styleName: s?.name ?? sid,
        });
      }
    }
    return specs;
  }, [angleIds, customAngle, hasCustomAngle, styleIds]);

  const updateJob = useCallback(
    (key: string, update: Partial<BatchJob>) => {
      setJobs((prev) =>
        prev.map((j) => (j.key === key ? { ...j, ...update } : j))
      );
    },
    []
  );

  const runSingleJob = useCallback(
    async (spec: JobSpec, signal: AbortSignal): Promise<void> => {
      updateJob(spec.key, { status: "running", currentStage: "outline" });

      const draft = createDraft({
        productId: productId!,
        angleId: spec.angleId ?? undefined,
        customAngle: spec.customAngle || undefined,
        styleId: spec.styleId,
      });

      updateJob(spec.key, { articleId: draft.id });

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            angleId: spec.angleId ?? undefined,
            customAngle: spec.customAngle || undefined,
            styleId: spec.styleId,
            articleId: draft.id,
          }),
          signal,
        });

        if (!res.ok || !res.body) {
          updateJob(spec.key, {
            status: "failed",
            error: `HTTP ${res.status} ${res.statusText}`,
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let bodyText = "";
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
                const stageId = e.stage as PipelineStageId;
                if (e.status === "running") {
                  updateJob(spec.key, { currentStage: stageId });
                }
                if (e.status === "done") {
                  const stageIdx = STAGE_ORDER.indexOf(stageId);
                  updateJob(spec.key, {
                    completedStages: stageIdx + 1,
                  });
                }
                if (stageId === "factcheck" && e.status === "done" && e.data) {
                  result.factcheck = e.data as GenerationResult["factcheck"];
                }
                if (stageId === "outline" && e.status === "done" && e.data) {
                  result.outline =
                    (e.data as { outline: string }).outline ?? "";
                }
                if (stageId === "titles" && e.status === "done" && e.data) {
                  result.titles =
                    (e.data as { titles: string[] }).titles ?? [];
                }
                if (stageId === "covers" && e.status === "done" && e.data) {
                  result.covers =
                    (
                      e.data as { covers: GenerationResult["covers"] }
                    ).covers ?? [];
                }
              } else if (e.type === "body-delta") {
                bodyText += e.delta;
              } else if (e.type === "result") {
                Object.assign(result, e.result);
              } else if (e.type === "error") {
                updateJob(spec.key, {
                  status: "failed",
                  error: e.error?.message ?? "生成失败",
                });
                return;
              }
            } catch {
              // ignore malformed SSE
            }
          }
        }

        result.body = bodyText || result.body;

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

        updateJob(spec.key, {
          status: "done",
          completedStages: TOTAL_STAGES,
          currentStage: null,
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        updateJob(spec.key, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [createDraft, patch, productId, updateJob]
  );

  const runBatch = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;

    const specs = buildJobSpecs();
    const initialJobs: BatchJob[] = specs.map((s) => ({
      key: s.key,
      angleName: s.angleName,
      styleName: s.styleName,
      status: "queued",
      currentStage: null,
      completedStages: 0,
      totalStages: TOTAL_STAGES,
    }));
    setJobs(initialJobs);
    setAllDone(false);

    // Save batch info to sessionStorage for Dashboard banner
    const batchLabels = specs.map((s) => `${s.angleName}×${s.styleName}`);
    sessionStorage.setItem(
      "joto-last-batch",
      JSON.stringify({ count: specs.length, labels: batchLabels, ts: Date.now() })
    );

    const queue = [...specs];
    const running = new Set<string>();

    async function startNext(): Promise<void> {
      if (controller.signal.aborted) return;
      if (queue.length === 0) return;
      if (running.size >= MAX_CONCURRENCY) return;

      const spec = queue.shift()!;
      running.add(spec.key);

      try {
        await runSingleJob(spec, controller.signal);
      } finally {
        running.delete(spec.key);
        await startNext();
      }
    }

    const starters = Array.from(
      { length: Math.min(MAX_CONCURRENCY, specs.length) },
      () => startNext()
    );
    await Promise.all(starters);

    if (!controller.signal.aborted) {
      setAllDone(true);
    }
  }, [buildJobSpecs, runSingleJob]);

  useEffect(() => {
    if (!ready) return;
    if (startedRef.current) return;
    startedRef.current = true;
    runBatch();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!allDone) return;
    const timer = setTimeout(() => {
      router.push("/");
    }, 1500);
    return () => clearTimeout(timer);
  }, [allDone, router]);

  function cancelAndBack() {
    abortRef.current?.abort();
    router.push("/wizard/style");
  }

  function retry() {
    abortRef.current?.abort();
    startedRef.current = false;
    setTimeout(() => {
      startedRef.current = true;
      runBatch();
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

  const jobCount = jobs.length;
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const hasFailures = jobs.some((j) => j.status === "failed");

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            批量生成 · {jobCount} 篇文章
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            正在批量生成文章
          </h1>
          <p className="text-sm text-slate-500">
            每篇文章经过 5 阶段 pipeline:大纲 → 正文 → 标题 → 封面 → 事实核查。同时最多并行 3 篇。
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <BatchGeneratingProgress jobs={jobs} />
        </section>

        {allDone && !hasFailures && (
          <section className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <Sparkles className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                全部 {doneCount} 篇文章生成完成
              </p>
              <p className="text-xs text-emerald-700">
                即将跳转到 Dashboard,你可以在那里挑选和编辑文章
              </p>
            </div>
          </section>
        )}

        {allDone && hasFailures && (
          <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {doneCount}/{jobCount} 篇完成,部分失败
                </p>
                <p className="text-xs text-amber-700">
                  成功的文章已保存到草稿箱。你可以重试或返回 Dashboard 查看已生成的文章。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={retry}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-amber-700"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                全部重试
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                返回 Dashboard
              </button>
            </div>
          </section>
        )}

        {!allDone && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={cancelAndBack}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              取消返回 Wizard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function markdownToHtml(md: string): string {
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
