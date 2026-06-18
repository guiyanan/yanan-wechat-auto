"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/nav/TopNav";
import { WechatArticleFrame } from "@/components/wechat/WechatArticleFrame";
import { useArticleStore } from "@/store/articleStore";
import { useProductStore } from "@/store/productStore";
import { getAllProducts } from "@/lib/articles";
import {
  GENERIC_JOTO_PRODUCT_ID,
  productSourceToArticleContext,
  mergeProducts,
  withGenericProduct,
} from "@/lib/productCatalog";
import {
  basicFormatJotoPaste,
  type FormatJotoResult,
} from "@/lib/jotoFormatter";

const JOTO_STYLE_ID = "style-joto";

function emptyResult(): FormatJotoResult {
  return {
    title: "JOTO 公众号排版稿",
    contentHtml: "<p>把已经打磨好的文字粘贴到左侧，右侧会显示 JOTO 官方白底公众号版式。</p>",
    summary: "",
    warnings: [],
    mode: "fallback",
  };
}

export default function FormatPage() {
  const router = useRouter();
  const customProducts = useProductStore((s) => s.products);
  const loadProducts = useProductStore((s) => s.loadFromServer);
  const createDraft = useArticleStore((s) => s.createDraft);
  const patchArticle = useArticleStore((s) => s.patch);

  const [hydrated, setHydrated] = useState(false);
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [author, setAuthor] = useState("当前用户");
  const [productId, setProductId] = useState(GENERIC_JOTO_PRODUCT_ID);
  const [result, setResult] = useState<FormatJotoResult | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const products = useMemo(
    () =>
      withGenericProduct(
        mergeProducts(getAllProducts(), Object.values(customProducts))
      ),
    [customProducts]
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) ?? products[0],
    [productId, products]
  );

  const livePreview = useMemo(() => {
    if (result) return result;
    if (rawText.trim()) {
      return basicFormatJotoPaste({
        title,
        rawText,
        product: selectedProduct,
        author,
      });
    }
    return emptyResult();
  }, [author, rawText, result, selectedProduct, title]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  async function handleFormat() {
    if (!rawText.trim()) {
      toast.error("先粘贴正文内容");
      return;
    }
    setIsFormatting(true);
    try {
      const payload = {
        title: title.trim() || undefined,
        rawText,
        productId,
        productSnapshot:
          productId === GENERIC_JOTO_PRODUCT_ID ? undefined : selectedProduct,
        author: author.trim() || "当前用户",
      };
      const res = await fetch("/api/format-joto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as FormatJotoResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setResult(data);
      if (data.warnings.length > 0) {
        toast.warning(data.warnings.join(" "));
      } else {
        toast.success("已生成 JOTO 官方排版预览");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "排版失败");
    } finally {
      setIsFormatting(false);
    }
  }

  function handleRawTextChange(value: string) {
    setRawText(value);
    setResult(null);
  }

  async function handleSave() {
    if (!result) {
      toast.error("请先生成排版预览");
      return;
    }
    setIsSaving(true);
    try {
      const product = selectedProduct;
      const article = createDraft({
        productId: product.id,
        customAngle: "粘贴文字排版",
        styleId: JOTO_STYLE_ID,
        createdBy: author.trim() || "当前用户",
        stage: "main",
        layoutTheme: "joto",
        sourceContext: productSourceToArticleContext(product),
        generationMeta: {
          mode: "paste-format",
          angleLabel: "粘贴文字排版",
          angleReason: "用户粘贴已打磨文本后自动整理成 JOTO 官方公众号排版。",
          styleSource: "official",
        },
      });
      patchArticle(article.id, {
        title: result.title,
        contentHtml: result.contentHtml,
        titleCandidates: [result.title],
        aiScore: {
          value: 8,
          checkedAt: new Date().toISOString(),
          iterations: result.mode !== "fallback" ? 1 : 0,
        },
        compliance: {
          limitWords: [],
          sensitiveTopics: [],
          aigcMetaEmbedded: false,
          coverSelected: false,
          factCheckPassed: true,
          factCheckWarning:
            result.warnings.length > 0 ? result.warnings.join(" ") : undefined,
        },
      });
      toast.success("已保存到 Dashboard 草稿箱");
      router.push("/");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <TopNav />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.25fr)] lg:py-10">
        <section className="space-y-5">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回 Dashboard
            </Link>
            <p className="mt-6 text-xs font-medium text-[#0071e3]">
              JOTO小信 · 粘贴排版
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              把打磨好的文字变成公众号版式
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              保留原文事实，只清理 Markdown、整理层级和重点句，生成 JOTO 官方白底排版。
            </p>
          </div>

          <div className="rounded-lg border border-[#d2d2d7]/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-900">文章标题</span>
                <input
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setResult(null);
                  }}
                  placeholder="可留空，系统会从正文第一行识别"
                  className="h-11 rounded-lg border border-[#d2d2d7] bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/15"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-900">绑定产品</span>
                  <select
                    value={productId}
                    onChange={(event) => {
                      setProductId(event.target.value);
                      setResult(null);
                    }}
                    className="h-11 rounded-lg border border-[#d2d2d7] bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/15"
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-900">作者</span>
                  <input
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                    className="h-11 rounded-lg border border-[#d2d2d7] bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/15"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-900">正文</span>
                <textarea
                  value={rawText}
                  onChange={(event) => handleRawTextChange(event.target.value)}
                  placeholder="把已经打磨好的文章粘贴到这里。支持普通段落、## 小标题、- 列表、> 重点句。"
                  className="min-h-[360px] resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/15"
                />
              </label>

              {result?.warnings.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {result.warnings.join(" ")}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleFormat}
                  disabled={!rawText.trim() || isFormatting}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white shadow-[0_2px_10px_rgba(0,113,227,0.2)] transition-colors hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isFormatting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                  生成 JOTO 排版
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!result || isSaving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-[#fbfbfd] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4 text-[#0071e3]" aria-hidden="true" />
                  )}
                  保存到 Dashboard 草稿箱
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#0071e3]">JOTO 公众号预览</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                {livePreview.title}
              </h2>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#d2d2d7] bg-white px-2.5 py-1.5 text-xs text-slate-500">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {result ? "增强预览" : hydrated && rawText.trim() ? "基础预览" : "待输入"}
            </div>
          </div>
          <WechatArticleFrame
            title={livePreview.title}
            contentHtml={livePreview.contentHtml}
            author={author}
            theme="joto"
            decorate
            minHeight={780}
          />
        </aside>
      </main>
    </div>
  );
}
