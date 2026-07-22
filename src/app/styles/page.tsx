"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Check,
  ClipboardCheck,
  Compass,
  Eye,
  FileText,
  Layers3,
  Loader2,
  MessageSquareText,
  Plus,
  Save,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/nav/TopNav";
import { buildPromptProfileFromStyle } from "@/lib/learnedStyles";
import {
  readStyleHtmlDocuments,
  type StyleHtmlDocument,
} from "@/lib/styleHtmlDocuments";
import { useLearnedStyleStore } from "@/store/learnedStyleStore";
import type { LearnedWritingStyle, LearnedWritingStyleScope } from "@/types";

const PRESENTATION_STYLES = [
  {
    id: "scene-observation",
    name: "JOTO 风格",
    intent: "从一个具体工作卡点切入,让读者先看到自己的处境。",
    bestFor: "产品种草 / 需求教育",
    title: "标题像一个正在发生的问题",
    opening: "先写人、动作和阻塞点,再引出产品判断。",
    rhythm: "短段落推进,每段只拆一个麻烦。",
    accent: "bg-blue-600",
    tint: "bg-blue-50",
    text: "text-blue-700",
    icon: Eye,
  },
  {
    id: "data-judgement",
    name: "卡兹克风格",
    intent: "用事实、对比和推理建立可信度,少煽情。",
    bestFor: "B 端决策 / 专业汇报",
    title: "标题强调变量、代价或选择标准",
    opening: "先摆观察结果,再解释为什么这个变化重要。",
    rhythm: "结论先行,证据跟进,最后落到选择理由。",
    accent: "bg-emerald-600",
    tint: "bg-emerald-50",
    text: "text-emerald-700",
    icon: ChartNoAxesCombined,
  },
  {
    id: "industry-trend",
    name: "苹果风格",
    intent: "把产品放进更大的行业变化里,但不空喊趋势。",
    bestFor: "品牌背书 / 热点承接",
    title: "标题呈现行业正在发生的转向",
    opening: "先写行业现象,再指出旧流程为什么撑不住。",
    rhythm: "现象、原因、影响、产品入口四段式。",
    accent: "bg-cyan-600",
    tint: "bg-cyan-50",
    text: "text-cyan-700",
    icon: Compass,
  },
  {
    id: "founder-note",
    name: "随笔风格",
    intent: "用产品团队视角解释取舍,显得真诚而不销售。",
    bestFor: "公众号长期经营",
    title: "标题像一次内部观察或阶段复盘",
    opening: "从团队最近反复遇到的一件小事写起。",
    rhythm: "克制叙述,少口号,多解释为什么这样做。",
    accent: "bg-slate-800",
    tint: "bg-slate-100",
    text: "text-slate-700",
    icon: BookOpen,
  },
  {
    id: "customer-review",
    name: "小米风格",
    intent: "围绕一个匿名客户流程,写清前后变化。",
    bestFor: "案例包装 / 销售材料",
    title: "标题突出一个业务环节的前后差异",
    opening: "先写客户原来的流程,不急着夸产品。",
    rhythm: "旧做法、卡点、介入、变化、可复用经验。",
    accent: "bg-amber-500",
    tint: "bg-amber-50",
    text: "text-amber-700",
    icon: BriefcaseBusiness,
  },
  {
    id: "tool-review",
    name: "少数派风格",
    intent: "像编辑测工具一样拆能力,避免变成产品说明书。",
    bestFor: "竞品对比 / 功能教育",
    title: "标题围绕试用感受或判断标准",
    opening: "先交代测试任务,再写实际体验和边界。",
    rhythm: "任务、表现、限制、适用人群、结论。",
    accent: "bg-indigo-600",
    tint: "bg-indigo-50",
    text: "text-indigo-700",
    icon: ClipboardCheck,
  },
  {
    id: "expert-explain",
    name: "36氪风格",
    intent: "把复杂产品讲成清楚的方法论,更适合高客单价客户。",
    bestFor: "方案型产品 / 知识型服务",
    title: "标题直接点出一个误区或关键判断",
    opening: "先定义问题,再拆解背后的工作机制。",
    rhythm: "概念少、结构清楚,每节回答一个为什么。",
    accent: "bg-teal-600",
    tint: "bg-teal-50",
    text: "text-teal-700",
    icon: Layers3,
  },
  {
    id: "opinion-commentary",
    name: "虎嗅风格",
    intent: "对一个行业现象给出鲜明判断,适合热点转产品。",
    bestFor: "热点文章 / 认知占位",
    title: "标题带判断,但不靠情绪吓人",
    opening: "先承认现象,再提出一个反直觉看法。",
    rhythm: "观点、例子、反面误区、产品提供的解法。",
    accent: "bg-rose-600",
    tint: "bg-rose-50",
    text: "text-rose-700",
    icon: MessageSquareText,
  },
  {
    id: "landing-checklist",
    name: "清单风格",
    intent: "把产品价值变成可执行步骤,客户最容易转发给团队。",
    bestFor: "转化页 / 会后跟进",
    title: "标题承诺一个清晰可用的行动框架",
    opening: "先写目标,再列出判断标准和执行顺序。",
    rhythm: "少形容词,多动词,每段对应一个动作。",
    accent: "bg-orange-500",
    tint: "bg-orange-50",
    text: "text-orange-700",
    icon: Target,
  },
];

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
  const [selectedPresentationStyleId, setSelectedPresentationStyleId] =
    useState(PRESENTATION_STYLES[0].id);
  const [activeScope, setActiveScope] =
    useState<LearnedWritingStyleScope>("product");
  const selectedPresentationStyle =
    PRESENTATION_STYLES.find((style) => style.id === selectedPresentationStyleId) ??
    PRESENTATION_STYLES[0];
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
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header>
          <p className="text-xs font-medium text-blue-600">JOTO小信</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            风格库
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            粘贴文章或链接后,小信会反推出一段可编辑的固定提示词。后续批量生成会从对应风格库里轮换抽取提示词。
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-600">
                可选写作风格
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                选择一类公众号表达方式
              </h2>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="text-xs font-medium text-blue-500">当前选中</div>
              <div className="mt-1 text-base font-semibold text-blue-800">
                {selectedPresentationStyle.name}
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {PRESENTATION_STYLES.map((style, index) => {
              const Icon = style.icon;
              const selected = selectedPresentationStyleId === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setSelectedPresentationStyleId(style.id)}
                  aria-pressed={selected}
                  aria-label={`选择风格：${style.name}`}
                  className={`group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md ${
                    selected
                      ? "border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-100"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        selected ? "bg-blue-600 text-white" : `${style.tint} ${style.text}`
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        selected
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {selected ? <Check className="h-3 w-3" /> : null}
                      {selected ? "已选" : String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-950">
                    {style.name}
                  </h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">
                    {style.intent}
                  </p>
                  <div className="mt-4 space-y-2 text-xs leading-5 text-slate-500">
                    <p>
                      <span className={`font-semibold ${style.text}`}>适合：</span>
                      {style.bestFor}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">标题：</span>
                      {style.title}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">开头：</span>
                      {style.opening}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">节奏：</span>
                      {style.rhythm}
                    </p>
                  </div>
                  <div
                    className={`mt-4 flex h-9 items-center justify-center rounded-lg border text-xs font-semibold ${
                      selected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-500 group-hover:border-blue-200 group-hover:bg-white group-hover:text-blue-700"
                    }`}
                  >
                    {selected ? "已选择此风格" : "选择此风格"}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            客户可以先选风格,再进入范文学习。系统会把选定风格沉淀成可编辑提示词,用于产品文章、热点观察和行业稿。
          </div>
        </section>

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
