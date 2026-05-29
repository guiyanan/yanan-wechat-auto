"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useLearnedStyleStore } from "@/store/learnedStyleStore";
import { useProductStore } from "@/store/productStore";
import { getAllProducts } from "@/lib/articles";
import { mergeProducts } from "@/lib/productCatalog";
import { markdownToHtml } from "@/lib/markdown";
import { applyProductImagesToHtml } from "@/lib/productImages";
import { cleanGeneratedMarkdown } from "@/lib/generatedMarkdown";
import {
  BatchGeneratingProgress,
  type BatchJob,
} from "@/components/wizard/BatchGeneratingProgress";
import { WechatArticleFrame } from "@/components/wechat/WechatArticleFrame";
import anglesData from "@/data/angles.json";
import stylesData from "@/data/styles.json";
import type {
  Angle,
  LearnedWritingStyle,
  PipelineStageId,
  TopicPlan,
  WritingStyle,
} from "@/types";

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
  topicPlan?: TopicPlan;
  styleOverride?: Pick<WritingStyle, "id" | "name" | "promptProfile" | "sampleText">;
  styleSource: "official" | "learned";
  learnedStyleId?: string;
}

function learnedToWritingStyle(style: LearnedWritingStyle): Pick<WritingStyle, "id" | "name" | "promptProfile" | "sampleText"> {
  return {
    id: style.id,
    name: style.name,
    promptProfile: [
      style.toneProfile,
      `标题结构:${style.titlePattern}`,
      `开头方式:${style.openingPattern}`,
      `段落节奏:${style.paragraphPattern}`,
      `金句方式:${style.keySentencePattern}`,
      "必须学习表达方式,不得照抄来源文章内容。",
    ].join("\n"),
    sampleText: style.sampleDigest,
  };
}

function pickStyleForIndex(
  idx: number,
  learnedStyles: LearnedWritingStyle[]
): {
  styleId: string;
  styleName: string;
  styleOverride?: Pick<WritingStyle, "id" | "name" | "promptProfile" | "sampleText">;
  styleSource: "official" | "learned";
  learnedStyleId?: string;
} {
  const official = STYLES.find((s) => s.id === "style-joto") ?? STYLES[0];
  if (learnedStyles.length === 0 || idx % 2 === 0) {
    return {
      styleId: official.id,
      styleName: official.name,
      styleSource: "official",
    };
  }
  const learned = learnedStyles[idx % learnedStyles.length];
  return {
    styleId: learned.id,
    styleName: learned.name,
    styleOverride: learnedToWritingStyle(learned),
    styleSource: "learned",
    learnedStyleId: learned.id,
  };
}

export default function GeneratingPage() {
  const router = useRouter();
  const productId = useWizardStore((s) => s.productId);
  const mode = useWizardStore((s) => s.mode);
  const articleCount = useWizardStore((s) => s.articleCount);
  const angleIds = useWizardStore((s) => s.angleIds);
  const customAngle = useWizardStore((s) => s.customAngle);
  const styleIds = useWizardStore((s) => s.styleIds);
  const sourcePack = useWizardStore((s) => s.sourcePack);
  const contentLength = useWizardStore((s) => s.contentLength);
  const angleStrategy = useWizardStore((s) => s.angleStrategy);
  const customProducts = useProductStore((s) => s.products);
  const productServerLoaded = useProductStore((s) => s.serverLoaded);
  const loadProducts = useProductStore((s) => s.loadFromServer);
  const createDraft = useArticleStore((s) => s.createDraft);
  const patch = useArticleStore((s) => s.patch);
  const learnedStyles = useLearnedStyleStore((s) => s.styles);
  const styleServerLoaded = useLearnedStyleStore((s) => s.serverLoaded);
  const loadStyles = useLearnedStyleStore((s) => s.loadFromServer);
  const productSnapshot = useMemo(() => {
    const products = mergeProducts(getAllProducts(), Object.values(customProducts));
    return products.find((p) => p.id === productId) ?? null;
  }, [customProducts, productId]);

  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [selectedJobKey, setSelectedJobKey] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [planning, setPlanning] = useState(mode === "auto-five");
  const [topicPlans, setTopicPlans] = useState<TopicPlan[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);
  // Stable batch ID for the entire generation run. Generated once when
  // runBatch() starts; all articles in this run share it and the user
  // is redirected to /batch/<id> when complete.
  const batchIdRef = useRef<string>("");

  const hasCustomAngle = customAngle.trim().length > 0;
  const hasAngle = angleIds.length > 0 || hasCustomAngle;
  const ready =
    !!productId &&
    productServerLoaded &&
    styleServerLoaded &&
    (mode === "auto-five" || (hasAngle && styleIds.length > 0));

  useEffect(() => {
    void loadProducts();
    void loadStyles();
  }, [loadProducts, loadStyles]);

  const buildManualJobSpecs = useCallback((): JobSpec[] => {
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
          styleSource: "official",
        });
      }
    }
    return specs;
  }, [angleIds, customAngle, hasCustomAngle, styleIds]);

  const buildAutoJobSpecs = useCallback(
    (plans: TopicPlan[]): JobSpec[] => {
      return plans.slice(0, articleCount || 5).map((plan, idx) => {
        const picked = pickStyleForIndex(idx, learnedStyles);
        return {
          key: `${plan.id}-${picked.styleId}-${idx}`,
          angleId: null,
          angleName: plan.angleLabel,
          customAngle: plan.angleLabel,
          topicPlan: plan,
          ...picked,
        };
      });
    },
    [articleCount, learnedStyles]
  );

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
        batchId: batchIdRef.current,
        stage: "batch",
        layoutTheme: "joto",
        sourceContext: sourcePack,
        generationMeta: {
          mode: mode === "auto-five" ? "auto-five" : "manual",
          angleLabel: spec.topicPlan?.angleLabel ?? spec.angleName,
          angleReason: spec.topicPlan?.reason,
          topicPlan: spec.topicPlan,
          contentLength,
          angleStrategy,
          styleSource: spec.styleSource,
          learnedStyleId: spec.learnedStyleId,
          learnedStyleName:
            spec.styleSource === "learned" ? spec.styleName : undefined,
        },
      });

      updateJob(spec.key, { articleId: draft.id });

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            productSnapshot,
            angleId: spec.angleId ?? undefined,
            customAngle: spec.customAngle || undefined,
            styleId: spec.styleId,
            topicPlan: spec.topicPlan,
            styleOverride: spec.styleOverride,
            articleId: draft.id,
            sourcePack,
            contentLength,
            angleStrategy,
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
                updateJob(spec.key, {
                  previewHtml: markdownToHtml(cleanGeneratedMarkdown(bodyText)),
                  title: `${spec.angleName} · ${spec.styleName}`,
                });
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

        result.body = cleanGeneratedMarkdown(bodyText || result.body);

        const rawContentHtml = markdownToHtml(result.body);
        const imageResult = productSnapshot
          ? applyProductImagesToHtml(rawContentHtml, productSnapshot, {
              contentLength,
            })
          : { html: rawContentHtml, insertedAssets: [], missingSlots: 0 };

        patch(draft.id, {
          title: result.titles[0] ?? draft.title,
          titleCandidates: result.titles,
          contentHtml: imageResult.html,
          coverImageUrl: result.covers[0]?.url,
          coverCandidates: result.covers.map((c) => c.url),
          generationMeta: {
            ...draft.generationMeta,
            mode:
              draft.generationMeta?.mode ??
              (mode === "auto-five" ? "auto-five" : "manual"),
            angleLabel:
              draft.generationMeta?.angleLabel ??
              spec.topicPlan?.angleLabel ??
              spec.angleName,
            styleSource: draft.generationMeta?.styleSource ?? spec.styleSource,
            imageAssetIds: imageResult.insertedAssets.map((asset) => asset.id),
            imageSlotCount: imageResult.insertedAssets.length,
            missingImageSlots: imageResult.missingSlots,
          },
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
          previewHtml: imageResult.html,
          title: result.titles[0] ?? `${spec.angleName} · ${spec.styleName}`,
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        updateJob(spec.key, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [
      angleStrategy,
      contentLength,
      createDraft,
      mode,
      patch,
      productId,
      productSnapshot,
      sourcePack,
      updateJob,
    ]
  );

  const fetchTopicPlans = useCallback(
    async (signal: AbortSignal): Promise<TopicPlan[]> => {
      const res = await fetch("/api/topic-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          productSnapshot,
          sourcePack,
          contentLength,
          angleStrategy,
        }),
        signal,
      });
      if (!res.ok) throw new Error(`选题规划失败: HTTP ${res.status}`);
      const data = (await res.json()) as { plans?: TopicPlan[] };
      const plans = Array.isArray(data.plans) ? data.plans : [];
      if (plans.length < 5) throw new Error("选题规划少于 5 个");
      return plans.slice(0, 5);
    },
    [angleStrategy, contentLength, productId, productSnapshot, sourcePack]
  );

  const runBatch = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;

    // Generate a fresh batch ID for this run — shared by every article
    // produced below and used for the post-completion redirect.
    const tsPart = Date.now().toString(36);
    const randPart =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    batchIdRef.current = `batch-${tsPart}-${randPart}`;

    let specs: JobSpec[] = [];
    if (mode === "auto-five") {
      setPlanning(true);
      try {
        const plans = await fetchTopicPlans(controller.signal);
        setTopicPlans(plans);
        specs = buildAutoJobSpecs(plans);
      } finally {
        setPlanning(false);
      }
    } else {
      specs = buildManualJobSpecs();
      setTopicPlans([]);
      setPlanning(false);
    }
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
    setSelectedJobKey(initialJobs[0]?.key ?? null);
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
  }, [buildAutoJobSpecs, buildManualJobSpecs, fetchTopicPlans, mode, runSingleJob]);

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
      const target = batchIdRef.current
        ? `/batch/${batchIdRef.current}`
        : "/";
      router.push(target);
    }, 1500);
    return () => clearTimeout(timer);
  }, [allDone, router]);

  function cancelAndBack() {
    abortRef.current?.abort();
    router.push(batchIdRef.current ? `/batch/${batchIdRef.current}` : "/wizard/product");
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
  const selectedJob = jobs.find((j) => j.key === selectedJobKey) ?? jobs[0];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <button
            type="button"
            onClick={cancelAndBack}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 shadow-sm transition-colors hover:bg-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            返回批次文章
          </button>

          <header className="space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-500/20">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              并发生成 · {jobCount} 篇文章
            </div>
            <h1 className="text-xl font-semibold text-white">
              {mode === "auto-five"
                ? "系统智能选题,自动生成 5 篇"
                : "左侧切换任务,右侧看公众号排版"}
            </h1>
            <p className="text-sm leading-6 text-slate-400">
              {mode === "auto-five"
                ? "先根据产品资料规划 5 个不同角度,再随机混用官方风格和学习风格并发生成。"
                : "每篇文章经过大纲、正文、标题、封面、事实核查。正文流式返回时会同步渲染成 JOTO 公众号白底模板。"}
            </p>
          </header>

          {mode === "auto-five" && (
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-medium text-blue-300">
                {planning ? "正在判断最适合的 5 个角度…" : "智能选题"}
              </p>
              <div className="mt-3 space-y-2">
                {topicPlans.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    选题完成后会在这里显示每篇文章的写作方向。
                  </p>
                ) : (
                  topicPlans.map((plan, idx) => (
                    <div
                      key={plan.id}
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                    >
                      <p className="text-xs font-semibold text-slate-100">
                        {idx + 1}. {plan.angleLabel}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                        {plan.reason}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-slate-800 bg-white p-4 shadow-sm">
            <BatchGeneratingProgress
              jobs={jobs}
              selectedKey={selectedJob?.key}
              onSelect={setSelectedJobKey}
            />
          </section>

        {allDone && !hasFailures && (
          <section className="flex items-center gap-3 rounded-xl border border-emerald-800 bg-emerald-950 p-5">
            <Sparkles className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-emerald-200">
                全部 {doneCount} 篇文章生成完成
              </p>
              <p className="text-xs text-emerald-300">
                即将进入当前批次列表,继续比较多篇文章
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
                  成功的文章已保存到当前批次。你可以重试或查看已生成的文章。
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
                onClick={() =>
                  router.push(batchIdRef.current ? `/batch/${batchIdRef.current}` : "/")
                }
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                查看当前批次
              </button>
            </div>
          </section>
        )}

        {!allDone && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={cancelAndBack}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 text-xs font-medium text-slate-200 shadow-sm transition-colors hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              取消返回 Wizard
            </button>
          </div>
        )}
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-300">
                JOTO 公众号实时预览
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                {selectedJob
                  ? selectedJob.title ?? `${selectedJob.angleName} · ${selectedJob.styleName}`
                  : "等待生成"}
              </h2>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
              {selectedJob?.status === "done"
                ? "已完成"
                : selectedJob?.status === "running"
                  ? "生成中"
                  : selectedJob?.status === "failed"
                    ? "失败"
                    : "排队中"}
            </span>
          </div>
          <WechatArticleFrame
            title={selectedJob?.title ?? "JOTO 公众号预览"}
            contentHtml={selectedJob?.previewHtml ?? ""}
            theme="joto"
            decorate
            minHeight={920}
          />
        </section>
      </div>
    </main>
  );
}

// markdownToHtml is now imported from @/lib/markdown (supports headings,
// **bold**, lists, blockquote, and hard line breaks instead of the prior
// h1/h2/h3/p-only stub that left raw `**…**` markers in the article body).
