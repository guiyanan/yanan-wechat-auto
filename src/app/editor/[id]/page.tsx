"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { useArticleStore } from "@/store/articleStore";
import { getAllAccounts, getAllProducts } from "@/lib/articles";
import anglesData from "@/data/angles.json";
import stylesData from "@/data/styles.json";
import type { Angle, Article, WritingStyle } from "@/types";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { RichEditor, type RichEditorHandle } from "@/components/editor/RichEditor";
import { EditorSkeleton } from "@/components/editor/EditorSkeleton";
import { AiScoreGauge } from "@/components/editor/AiScoreGauge";
import { ComplianceChecklist } from "@/components/editor/ComplianceChecklist";
import {
  ParagraphMenu,
  type HumanizeIntent,
} from "@/components/editor/ParagraphMenu";
import { GlobalAdjust } from "@/components/editor/GlobalAdjust";
import { TitleCandidates } from "@/components/editor/TitleCandidates";
import { CoverPicker } from "@/components/editor/CoverPicker";
import { scanLimitWords, uniqueMatchedWords } from "@/lib/limitWords";
import { scanSensitive, uniqueTopics } from "@/lib/sensitiveTopics";
import { streamSseDeltas } from "@/lib/sseClient";
import type { HighlightState } from "@/components/editor/highlightExtension";

const ANGLES = anglesData as Angle[];
const STYLES = stylesData as WritingStyle[];

export default function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ readonly?: string }>;
}) {
  const { id } = use(params);
  const { readonly } = use(searchParams);
  const isReadonly = readonly === "1";

  const [hydrated, setHydrated] = useState(false);
  const article = useArticleStore((s) => s.getById(id));

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <EditorSkeleton />;
  }

  if (!article) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">文章不存在</h1>
          <p className="mt-2 text-sm text-slate-500">
            可能已被删除,或者这条草稿从未持久化到本设备。
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            回 Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return <EditorView article={article} isReadonly={isReadonly} />;
}

function EditorView({
  article,
  isReadonly,
}: {
  article: Article;
  isReadonly: boolean;
}) {
  const patch = useArticleStore((s) => s.patch);
  const products = getAllProducts();
  const product = products.find((p) => p.id === article.productId);
  const angle = ANGLES.find((a) => a.id === article.angleId);
  const style = STYLES.find((s) => s.id === article.styleId);

  const editorRef = useRef<RichEditorHandle>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [title, setTitle] = useState(article.title);
  const [coverUrl, setCoverUrl] = useState<string | undefined>(
    article.coverImageUrl ?? article.coverCandidates[0]
  );
  const [aiScore, setAiScore] = useState(article.aiScore.value);
  const [iterations, setIterations] = useState(article.aiScore.iterations);
  const [limitWords, setLimitWords] = useState<string[]>(
    article.compliance.limitWords
  );
  const [sensitiveTopics, setSensitiveTopics] = useState<string[]>(
    article.compliance.sensitiveTopics
  );
  const [checkingScore, setCheckingScore] = useState(false);
  const [humanizing, setHumanizing] = useState(false);
  const [regeneratingTitles, setRegeneratingTitles] = useState(false);
  const [busyIntent, setBusyIntent] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(
    article.updatedAt ?? null
  );
  const [globalRunning, setGlobalRunning] = useState(false);

  // Cancel any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Run compliance scan whenever plain text changes
  const runComplianceScan = useCallback(
    (text: string) => {
      const limitMatches = scanLimitWords(text);
      const senseMatches = scanSensitive(text);
      setLimitWords(uniqueMatchedWords(limitMatches));
      setSensitiveTopics(uniqueTopics(senseMatches));
      const highlights: HighlightState = {
        limitWords: limitMatches.map((m) => ({
          start: m.index,
          length: m.length,
          label: m.word,
        })),
        sensitive: senseMatches.map((m) => ({
          start: m.index,
          length: m.length,
          label: m.label,
        })),
      };
      editorRef.current?.setHighlights(highlights);
    },
    []
  );

  // Schedule a throttled save + scan on editor update
  const onEditorUpdate = useCallback(
    (html: string, text: string) => {
      if (isReadonly) return;
      runComplianceScan(text);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        patch(article.id, {
          contentHtml: html,
          compliance: {
            ...article.compliance,
            limitWords: uniqueMatchedWords(scanLimitWords(text)),
            sensitiveTopics: uniqueTopics(scanSensitive(text)),
          },
        });
        setSavedAt(new Date().toISOString());
      }, 1500);
    },
    [article.id, article.compliance, isReadonly, patch, runComplianceScan]
  );

  // Kick off a scan once the editor is ready. `useEditor({immediatelyRender:false})`
  // initialises async, so we poll briefly until getText() returns non-empty.
  useEffect(() => {
    let cancelled = false;
    const tryScan = (attempt: number) => {
      if (cancelled) return;
      const t = editorRef.current?.getText() ?? "";
      if (t.length > 0) {
        runComplianceScan(t);
        return;
      }
      if (attempt < 10) setTimeout(() => tryScan(attempt + 1), 100);
    };
    tryScan(0);
    return () => {
      cancelled = true;
    };
  }, [runComplianceScan]);

  async function handleRefreshScore() {
    if (!editorRef.current) return;
    const text = editorRef.current.getText();
    if (!text.trim()) {
      toast.error("正文为空,无法检测");
      return;
    }
    setCheckingScore(true);
    try {
      const res = await fetch("/api/ai-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, articleId: article.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { score: number };
      setAiScore(json.score);
      persistAiScore(json.score, iterations);
      toast.success(`AI 浓度检测完成:${json.score}`);
    } catch (err) {
      toast.error(`检测失败:${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCheckingScore(false);
    }
  }

  function persistAiScore(next: number, iter: number) {
    patch(article.id, {
      aiScore: {
        value: next,
        checkedAt: new Date().toISOString(),
        iterations: iter,
      },
    });
    setSavedAt(new Date().toISOString());
  }

  async function handleRunHumanizeFull() {
    const handle = editorRef.current;
    const ed = handle?.editor;
    if (!handle || !ed) return;
    const docSize = ed.state.doc.content.size;
    const text = handle.getText();
    if (!text.trim()) {
      toast.error("正文为空");
      return;
    }
    await runHumanizeOnRange({
      from: 0,
      to: docSize,
      text,
      intent: "在保持主要观点与事实的前提下,用更接近人手写作的语气,逐段重写这篇文章",
      intentKey: "full",
    });

    // After humanize, ask AI score for the drop
    try {
      const newText = handle.getText();
      const res = await fetch("/api/ai-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newText,
          articleId: article.id,
          previousScore: aiScore,
          afterHumanize: true,
          iteration: iterations + 1,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { score: number; drop?: number };
        setAiScore(json.score);
        setIterations(iterations + 1);
        persistAiScore(json.score, iterations + 1);
        if (json.drop) toast.success(`AI 浓度 -${json.drop},当前 ${json.score}`);
      }
    } catch {
      // ignore — humanize itself succeeded
    }
  }

  async function runHumanizeOnRange({
    from,
    to,
    text,
    intent,
    intentKey,
  }: {
    from: number;
    to: number;
    text: string;
    intent: string;
    intentKey: string;
  }) {
    const handle = editorRef.current;
    if (!handle) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setBusyIntent(intentKey);
    setHumanizing(intentKey === "full");
    setGlobalRunning(intentKey === "full");

    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          text,
          styleName: style?.name ?? "默认",
          styleProfile: style?.promptProfile ?? "",
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`humanize HTTP ${res.status}`);
      }
      const deltas = streamSseDeltas(res, abortRef.current.signal);
      await handle.streamReplace(from, to, deltas);
      const newText = handle.getText();
      runComplianceScan(newText);
      // Persist new HTML
      patch(article.id, { contentHtml: handle.getHtml() });
      setSavedAt(new Date().toISOString());
      toast.success("改写完成");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(`改写失败:${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyIntent(null);
      setHumanizing(false);
      setGlobalRunning(false);
    }
  }

  async function handleParagraphAction(i: HumanizeIntent) {
    const handle = editorRef.current;
    const ed = handle?.editor;
    if (!handle || !ed) return;
    const { from, to } = ed.state.selection;
    const selText = ed.state.doc.textBetween(from, to).trim();
    if (!selText) {
      toast.error("请先选择要改写的段落");
      return;
    }
    await runHumanizeOnRange({
      from,
      to,
      text: selText,
      intent: i.intent,
      intentKey: i.key,
    });
  }

  async function handleRegenerateTitles() {
    const handle = editorRef.current;
    if (!handle) return;
    const text = handle.getText();
    if (!text.trim()) {
      toast.error("正文为空,无法再生成标题");
      return;
    }
    setRegeneratingTitles(true);
    try {
      const res = await fetch("/api/titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: product?.name ?? "",
          angle: angle?.name ?? article.customAngle ?? "",
          styleName: style?.name ?? "",
          body: text,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { titles: string[] };
      if (Array.isArray(json.titles) && json.titles.length > 0) {
        patch(article.id, { titleCandidates: json.titles });
        toast.success("已再生成 5 个候选标题");
      }
    } catch (err) {
      toast.error(`标题再生成失败:${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRegeneratingTitles(false);
    }
  }

  function handleSelectTitle(t: string) {
    setTitle(t);
    patch(article.id, { title: t });
    setSavedAt(new Date().toISOString());
  }

  function handleSelectCover(url: string) {
    setCoverUrl(url);
    patch(article.id, { coverImageUrl: url });
    setSavedAt(new Date().toISOString());
  }

  const coverSelected = !!coverUrl;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </Link>
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-400">文章 ID {article.id}</span>
          <div className="ml-auto flex items-center gap-3">
            <SavedIndicator savedAt={savedAt} />
            <StatusBadge status={article.status} />
            {isReadonly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                只读
              </span>
            )}
            {!isReadonly && (
              <Link
                href={`/review/${article.id}`}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                去审核 →
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ---- Left main column ---- */}
          <div className="space-y-6 min-w-0">
            <TitleCandidates
              title={title}
              candidates={article.titleCandidates}
              regenerating={regeneratingTitles}
              disabled={isReadonly}
              onSelect={handleSelectTitle}
              onRegenerate={handleRegenerateTitles}
            />

            <CoverPicker
              candidates={article.coverCandidates}
              selectedUrl={coverUrl}
              disabled={isReadonly}
              onSelect={handleSelectCover}
            />

            <section>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {title || "(未命名标题)"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  {product?.name ?? "未知产品"}
                </span>
                {angle && <span>· 角度:{angle.name}</span>}
                {article.customAngle && <span>· 自定义角度</span>}
                {style && <span>· 风格:{style.name}</span>}
              </div>
            </section>

            <RichEditor
              ref={editorRef}
              initialHtml={article.contentHtml}
              readonly={isReadonly}
              onUpdate={onEditorUpdate}
              placeholder="开始写作… 选中段落后会弹出改写菜单"
            />

            <ParagraphMenu
              editor={editorRef.current?.editor ?? null}
              disabled={isReadonly || humanizing || globalRunning}
              busyIntent={busyIntent && busyIntent !== "full" ? busyIntent : null}
              onAction={handleParagraphAction}
            />
          </div>

          {/* ---- Right sticky sidebar ---- */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <AiScoreGauge
              score={aiScore}
              iterations={iterations}
              checking={checkingScore}
              humanizing={humanizing}
              onRefresh={handleRefreshScore}
              onRunHumanize={handleRunHumanizeFull}
              disabled={isReadonly}
            />
            <ComplianceChecklist
              aiScore={aiScore}
              limitWords={limitWords}
              sensitiveTopics={sensitiveTopics}
              coverSelected={coverSelected}
              factCheckPassed={article.compliance.factCheckPassed}
              factCheckWarning={article.compliance.factCheckWarning}
              scanning={false}
            />
            {!isReadonly && (
              <GlobalAdjust
                running={globalRunning}
                onRun={async (instruction) => {
                  const handle = editorRef.current;
                  const ed = handle?.editor;
                  if (!handle || !ed) return;
                  const docSize = ed.state.doc.content.size;
                  const text = handle.getText();
                  await runHumanizeOnRange({
                    from: 0,
                    to: docSize,
                    text,
                    intent: instruction,
                    intentKey: "full",
                  });
                }}
              />
            )}
            {article.reviewAudit.length > 0 && (
              <ReviewAuditPanel article={article} />
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function ReviewAuditPanel({ article }: { article: Article }) {
  const accounts = getAllAccounts();
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
        审计记录(PRD 6.1.7)
      </h3>
      <ul className="mt-3 space-y-3">
        {article.reviewAudit.map((entry, i) => {
          const account = accounts.find((a) => a.id === entry.accountId);
          return (
            <li
              key={`${entry.agreedAt}-${i}`}
              className="rounded-lg border border-emerald-100 bg-white p-3 text-xs"
            >
              <p className="font-medium text-slate-900">
                {entry.actorName} · 已确认对真实性负责
              </p>
              <p className="mt-1 text-slate-500">
                {new Date(entry.agreedAt).toLocaleString("zh-CN", {
                  hour12: false,
                })}
              </p>
              <p className="mt-1 text-slate-500">
                发布到 · {account?.name ?? entry.accountId}
              </p>
              {entry.addedAigcNotice && (
                <p className="mt-1 text-emerald-700">✓ 已添加显式 AIGC 声明</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SavedIndicator({ savedAt }: { savedAt: string | null }) {
  const [tick, setTick] = useState(0);
  // Re-render every 30s so relative time updates
  useEffect(() => {
    const h = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(h);
  }, []);
  if (!savedAt) return null;
  const ms = Date.now() - new Date(savedAt).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  const label =
    s < 5 ? "已保存" : s < 60 ? `${s} 秒前已保存` : `${Math.floor(s / 60)} 分钟前已保存`;
  return (
    <span
      className="text-xs text-slate-400"
      aria-live="polite"
      data-tick={tick}
    >
      {label}
    </span>
  );
}
