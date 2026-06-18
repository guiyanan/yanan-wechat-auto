"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { FileText, Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/nav/TopNav";
import { buildPromptProfileFromStyle } from "@/lib/learnedStyles";
import {
  readStyleHtmlDocuments,
  type StyleHtmlDocument,
} from "@/lib/styleHtmlDocuments";
import { useLearnedStyleStore } from "@/store/learnedStyleStore";
import type { LearnedWritingStyle, LearnedWritingStyleScope } from "@/types";

export default function StylesPage() {
  const styles = useLearnedStyleStore((s) => s.styles);
  const upsertStyle = useLearnedStyleStore((s) => s.upsertStyle);
  const removeStyle = useLearnedStyleStore((s) => s.removeStyle);
  const [urls, setUrls] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [htmlDocuments, setHtmlDocuments] = useState<StyleHtmlDocument[]>([]);
  const [ignoredHtmlCount, setIgnoredHtmlCount] = useState(0);
  const [readingHtml, setReadingHtml] = useState(false);
  const [learning, setLearning] = useState(false);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [savingTitleIds, setSavingTitleIds] = useState<
    Record<string, boolean>
  >({});
  const [savingPromptIds, setSavingPromptIds] = useState<
    Record<string, boolean>
  >({});
  const [activeScope, setActiveScope] =
    useState<LearnedWritingStyleScope>("product");
  const visibleStyles = useMemo(
    () =>
      styles.filter((style) => (style.scope ?? "product") === activeScope),
    [activeScope, styles]
  );
  const productCount = styles.filter(
    (style) => (style.scope ?? "product") === "product"
  ).length;
  const trendCount = styles.filter((style) => style.scope === "trend").length;

  useEffect(() => {
    setPromptDrafts((current) => {
      let changed = false;
      const next = { ...current };
      for (const style of visibleStyles) {
        if (next[style.id] === undefined) {
          next[style.id] =
            style.promptProfile?.trim() || buildPromptProfileFromStyle(style);
          changed = true;
        }
      }
      for (const id of Object.keys(next)) {
        if (!styles.some((style) => style.id === id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [styles, visibleStyles]);

  async function handleLearn() {
    setLearning(true);
    try {
      const res = await fetch("/api/styles/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: urls
            .split(/\s+/)
            .map((u) => u.trim())
            .filter(Boolean)
            .slice(0, 2),
          pastedText,
          htmlDocuments,
          scope: activeScope,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        needsPaste?: boolean;
        error?: string;
        style?: LearnedWritingStyle;
      };
      if (!res.ok || !data.ok || !data.style) {
        toast.error(data.error ?? "学习失败", {
          description: data.needsPaste ? "请把公众号正文粘贴到文本框后重试。" : undefined,
        });
        return;
      }
      await upsertStyle(data.style);
      setUrls("");
      setPastedText("");
      setHtmlDocuments([]);
      setIgnoredHtmlCount(0);
      toast.success(
        `已学习${activeScope === "trend" ? "热点" : "产品"}风格：${data.style.name}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "学习失败");
    } finally {
      setLearning(false);
    }
  }

  async function handleHtmlFilesChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = event.currentTarget.files;
    if (!files?.length) return;

    setReadingHtml(true);
    try {
      const result = await readStyleHtmlDocuments(files);
      setHtmlDocuments(result.documents);
      setIgnoredHtmlCount(result.ignoredCount);
      if (result.documents.length === 0) {
        toast.error("没有读到可用的 HTML 文件");
        return;
      }
      toast.success(`已读取 ${result.documents.length} 个 HTML 文件`);
      if (result.ignoredCount > 0) {
        toast.info(`最多同时上传 5 个 HTML，已忽略 ${result.ignoredCount} 个`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "读取 HTML 文件失败");
    } finally {
      setReadingHtml(false);
      event.currentTarget.value = "";
    }
  }

  function clearHtmlDocuments() {
    setHtmlDocuments([]);
    setIgnoredHtmlCount(0);
  }

  async function handleSavePrompt(style: LearnedWritingStyle) {
    const promptProfile = promptDrafts[style.id]?.trim();
    if (!promptProfile) {
      toast.error("提示词不能为空");
      return;
    }
    setSavingPromptIds((current) => ({ ...current, [style.id]: true }));
    try {
      await upsertStyle({ ...style, promptProfile });
      setPromptDrafts((current) => ({
        ...current,
        [style.id]: promptProfile,
      }));
      toast.success(`已保存提示词：${style.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存提示词失败");
    } finally {
      setSavingPromptIds((current) => {
        const next = { ...current };
        delete next[style.id];
        return next;
      });
    }
  }

  function beginTitleEdit(style: LearnedWritingStyle) {
    setTitleDrafts((current) => ({ ...current, [style.id]: style.name }));
    setEditingTitleId(style.id);
  }

  async function handleSaveTitle(style: LearnedWritingStyle) {
    const name = (titleDrafts[style.id] ?? style.name).trim();
    if (!name) {
      toast.error("风格名称不能为空");
      setTitleDrafts((current) => ({ ...current, [style.id]: style.name }));
      setEditingTitleId(null);
      return;
    }
    if (name === style.name) {
      setEditingTitleId(null);
      return;
    }
    setSavingTitleIds((current) => ({ ...current, [style.id]: true }));
    try {
      await upsertStyle({ ...style, name });
      setTitleDrafts((current) => ({ ...current, [style.id]: name }));
      toast.success(`已重命名风格：${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存风格名称失败");
      setTitleDrafts((current) => ({ ...current, [style.id]: style.name }));
    } finally {
      setSavingTitleIds((current) => {
        const next = { ...current };
        delete next[style.id];
        return next;
      });
      setEditingTitleId(null);
    }
  }

  function handleTitleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    style: LearnedWritingStyle
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setTitleDrafts((current) => ({ ...current, [style.id]: style.name }));
      setEditingTitleId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <header>
          <p className="text-xs font-medium text-blue-600">JOTO小信</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            风格库
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            粘贴文章或链接后,小信会反推出一段可编辑的固定提示词。后续批量生成会从对应风格库里轮换抽取提示词。
          </p>
        </header>

        <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1 text-sm font-medium text-slate-600">
          {[
            { id: "product", label: `产品风格库 ${productCount}` },
            { id: "trend", label: `热点风格库 ${trendCount}` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveScope(tab.id as LearnedWritingStyleScope)}
              className={`rounded-lg px-4 py-2 transition ${
                activeScope === tab.id
                  ? "bg-white text-blue-700 shadow-sm"
                  : "hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            学习{activeScope === "trend" ? "热点" : "产品"}新风格
          </h2>
          {activeScope === "trend" ? (
            <p className="mt-1 text-sm text-slate-500">
              热点风格只影响标题、开头、语气、段落节奏和收尾,不会学习范文里的事实、数据和观点结论。
            </p>
          ) : null}
          <label className="mt-4 block text-sm font-medium text-slate-700">
            文章链接
          </label>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="每行或空格分隔一个链接,最多 2 个。公众号链接抓取失败时请粘贴正文。"
            className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-slate-700">
              上传 HTML 范文
            </label>
            {htmlDocuments.length > 0 ? (
              <button
                type="button"
                onClick={clearHtmlDocuments}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                清空
              </button>
            ) : null}
          </div>
          <label className="mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
            {readingHtml ? (
              <Loader2 className="mb-2 h-5 w-5 animate-spin" />
            ) : (
              <Upload className="mb-2 h-5 w-5" />
            )}
            <span className="font-medium text-slate-700">
              {readingHtml ? "读取 HTML 中…" : "选择 HTML 文件"}
            </span>
            <span className="mt-1 text-xs">最多 5 个，会合并沉淀成一个风格</span>
            <input
              type="file"
              accept=".html,.htm,text/html"
              multiple
              disabled={readingHtml || learning}
              onChange={(event) => void handleHtmlFilesChange(event)}
              className="sr-only"
            />
          </label>
          {htmlDocuments.length > 0 ? (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>已选择 {htmlDocuments.length} 个 HTML</span>
                {ignoredHtmlCount > 0 ? (
                  <span>已忽略 {ignoredHtmlCount} 个</span>
                ) : null}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {htmlDocuments.map((doc, index) => (
                  <li key={`${doc.name}-${index}`} className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    <span className="truncate">{doc.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <label className="mt-4 block text-sm font-medium text-slate-700">
            正文兜底
          </label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="粘贴范文正文。正文越完整,提炼出的风格越稳定。"
            className="mt-2 min-h-40 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleLearn}
            disabled={
              learning ||
              readingHtml ||
              (!urls.trim() && !pastedText.trim() && htmlDocuments.length === 0)
            }
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {learning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {learning ? "学习中…" : "学习写作风格"}
          </button>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-900">
            {activeScope === "trend" ? "热点风格库" : "产品风格库"} ·{" "}
            {visibleStyles.length}
          </h2>
          {visibleStyles.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              {activeScope === "trend"
                ? "还没有热点风格。抓热点生成会使用系统兜底写法。"
                : "还没有产品风格。自动生成会先使用 JOTO 官方风格。"}
            </div>
          ) : (
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {visibleStyles.map((style) => {
                const storedPrompt =
                  style.promptProfile ?? buildPromptProfileFromStyle(style);
                const draftPrompt = promptDrafts[style.id] ?? storedPrompt;
                const promptChanged = draftPrompt.trim() !== storedPrompt.trim();
                const savingPrompt = Boolean(savingPromptIds[style.id]);
                const editingTitle = editingTitleId === style.id;
                const savingTitle = Boolean(savingTitleIds[style.id]);

                return (
                  <li
                    key={style.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {editingTitle ? (
                        <input
                          type="text"
                          aria-label="风格名称"
                          autoFocus
                          value={titleDrafts[style.id] ?? style.name}
                          disabled={savingTitle}
                          onChange={(e) =>
                            setTitleDrafts((current) => ({
                              ...current,
                              [style.id]: e.target.value,
                            }))
                          }
                          onBlur={() => void handleSaveTitle(style)}
                          onKeyDown={(event) => handleTitleKeyDown(event, style)}
                          className="h-7 w-full rounded-md border border-blue-200 bg-blue-50 px-2 text-base font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-70"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => beginTitleEdit(style)}
                          aria-label={`编辑风格名称：${style.name}`}
                          className="block max-w-full truncate rounded-md px-1 py-0.5 text-left font-semibold text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {style.name}
                        </button>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(style.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStyle(style.id)}
                      aria-label={`删除 ${style.name}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {style.toneProfile}
                  </p>
                  <dl className="mt-3 space-y-1 text-xs text-slate-500">
                    <div>
                      <dt className="inline font-medium text-slate-700">标题：</dt>
                      <dd className="inline">{style.titlePattern}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-slate-700">开头：</dt>
                      <dd className="inline">{style.openingPattern}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-slate-700">金句：</dt>
                      <dd className="inline">{style.keySentencePattern}</dd>
                    </div>
                  </dl>
                  <label className="mt-4 block text-xs font-medium text-slate-700">
                    反推提示词
                  </label>
                  <textarea
                    value={draftPrompt}
                    onChange={(e) =>
                      setPromptDrafts((current) => ({
                        ...current,
                        [style.id]: e.target.value,
                      }))
                    }
                    className="mt-2 min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSavePrompt(style)}
                    disabled={savingPrompt || !promptChanged}
                    className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {savingPrompt ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {savingPrompt
                      ? "保存中…"
                      : promptChanged
                        ? "保存提示词"
                        : "已保存"}
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
