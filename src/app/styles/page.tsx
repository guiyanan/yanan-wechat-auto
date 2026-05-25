"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/nav/TopNav";
import { useLearnedStyleStore } from "@/store/learnedStyleStore";
import type { LearnedWritingStyle } from "@/types";

export default function StylesPage() {
  const styles = useLearnedStyleStore((s) => s.styles);
  const upsertStyle = useLearnedStyleStore((s) => s.upsertStyle);
  const removeStyle = useLearnedStyleStore((s) => s.removeStyle);
  const [urls, setUrls] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [learning, setLearning] = useState(false);

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
      upsertStyle(data.style);
      setUrls("");
      setPastedText("");
      toast.success(`已学习新风格：${data.style.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "学习失败");
    } finally {
      setLearning(false);
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
            输入 1-2 篇范文链接或正文,系统会学习写作风格。后续自动生成 5 篇时会随机混用这些风格。
          </p>
        </header>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">学习新风格</h2>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            文章链接
          </label>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="每行或空格分隔一个链接,最多 2 个。公众号链接抓取失败时请粘贴正文。"
            className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
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
            disabled={learning || (!urls.trim() && !pastedText.trim())}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {learning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {learning ? "学习中…" : "学习写作风格"}
          </button>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-900">
            已学习风格 · {styles.length}
          </h2>
          {styles.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              还没有学习风格。自动生成会先使用 JOTO 官方风格。
            </div>
          ) : (
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {styles.map((style) => (
                <li
                  key={style.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{style.name}</h3>
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
