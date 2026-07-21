"use client";

import {
  type ClipboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Camera,
  ClipboardPaste,
  FileUp,
  Globe2,
  Loader2,
  PackagePlus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/nav/TopNav";
import { getAllProducts } from "@/lib/articles";
import {
  hasProductMaterial,
  mergeProducts,
  productSourceToArticleContext,
} from "@/lib/productCatalog";
import { cleanPdfTextSnippet, extractPdfTextSnippet } from "@/lib/pdfExtract";
import { removeProductDocument } from "@/lib/productDocuments";
import {
  entriesToText,
  evidenceToText,
  normalizeOptionalProductUnderstanding,
  stringsToText,
  textToEntries,
  textToEvidence,
  textToStrings,
} from "@/lib/productUnderstandingForm";
import { useProductStore } from "@/store/productStore";
import { useWizardStore } from "@/store/wizardStore";
import type {
  Product,
  ProductDocument,
  ProductSourceMediaAsset,
  ProductUnderstanding,
} from "@/types";
import { cn } from "@/lib/utils";

const DEFAULT_GRADIENT: Product["iconGradient"] = ["#1268FF", "#5B8CFF"];
const MAX_EVIDENCE_IMAGE_BYTES = 50 * 1024 * 1024;

function newProduct(): Product {
  const id = `prod-local-${Date.now().toString(36)}`;
  return {
    id,
    name: "未命名产品",
    description: "",
    tags: [],
    iconGradient: DEFAULT_GRADIENT,
    knowledgeDocs: [],
    imageAssets: [],
    sourceMediaAssets: [],
    sourcePack: {
      productNotes: "",
      websiteNotes: "",
      pdfNotes: "",
      mediaNotes: "",
    },
  };
}

function copyProduct(product: Product): Product {
  return {
    ...product,
    tags: [...product.tags],
    iconGradient: [...product.iconGradient] as Product["iconGradient"],
    knowledgeDocs: product.knowledgeDocs.map((doc) => ({ ...doc })),
    imageAssets: (product.imageAssets ?? []).map((asset) => ({
      ...asset,
      tags: [...asset.tags],
    })),
    sourceMediaAssets: (product.sourceMediaAssets ?? []).map((asset) => ({
      ...asset,
    })),
    sourcePack: { ...product.sourcePack },
    understanding: normalizeOptionalProductUnderstanding(product.understanding),
  };
}

function makeManualUnderstanding(
  definition: string,
  current?: ProductUnderstanding
): ProductUnderstanding {
  return {
    definition,
    coreFunctions: current?.coreFunctions ?? [],
    targetCustomers: current?.targetCustomers ?? [],
    painPoints: current?.painPoints ?? [],
    traditionalAlternatives: current?.traditionalAlternatives ?? [],
    afterUseChanges: current?.afterUseChanges ?? [],
    evidence: current?.evidence ?? [],
    writingBoundaries: current?.writingBoundaries ?? [],
    questionsToAsk: current?.questionsToAsk ?? [],
    generatedAt: current?.generatedAt ?? new Date().toISOString(),
    source: current?.source ?? "manual",
  };
}

function tagString(product: Product): string {
  return product.tags.join("、");
}

function appendMediaNote(
  current: string | undefined,
  asset: ProductSourceMediaAsset
): string {
  const note = [
    `截图素材：${asset.caption || asset.fileName}`,
    asset.analysis ? `系统理解：${asset.analysis}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return [current?.trim(), note].filter(Boolean).join("\n\n");
}

function understandingMediaAssets(product: Product): ProductSourceMediaAsset[] {
  return (product.sourceMediaAssets ?? []).filter(
    (asset) => asset.fileType === "image"
  );
}

function productUnderstandingErrorMessage(err: unknown): string {
  if (
    err instanceof TypeError &&
    /failed to fetch|load failed|networkerror/i.test(err.message)
  ) {
    return "本地小信服务连接失败。请确认开发服务还在运行,然后刷新页面重试。";
  }
  return err instanceof Error ? err.message : "生成失败";
}

function documentParseStatus(doc: ProductDocument): {
  label: string;
  className: string;
} {
  if (doc.extractedText?.trim()) {
    return {
      label: "已读取文本",
      className: "bg-emerald-50 text-emerald-700",
    };
  }
  if (doc.ragStatus === "failed") {
    return {
      label: "未读取到文本",
      className: "bg-red-50 text-red-700",
    };
  }
  return {
    label: "未读取到文本",
    className: "bg-amber-50 text-amber-700",
  };
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  }
  return `${Math.round(bytes / 1024)}KB`;
}

function understandingFingerprint(product: Product): string {
  return JSON.stringify({
    name: product.name,
    description: product.description,
    website: product.website,
    appUrl: product.appUrl,
    websiteNotes: product.sourcePack?.websiteNotes,
    productNotes: product.sourcePack?.productNotes,
    pdfNotes: product.sourcePack?.pdfNotes,
    mediaNotes: product.sourcePack?.mediaNotes,
    sourceMediaAssets: understandingMediaAssets(product).map((asset) => [
      asset.fileName,
      asset.caption,
      asset.analysis,
    ]),
    understanding: product.understanding
      ? {
          source: product.understanding.source,
          definition: product.understanding.definition,
          coreFunctions: entriesToText(product.understanding.coreFunctions),
          targetCustomers: entriesToText(product.understanding.targetCustomers),
          painPoints: entriesToText(product.understanding.painPoints),
          traditionalAlternatives: entriesToText(
            product.understanding.traditionalAlternatives
          ),
          afterUseChanges: entriesToText(product.understanding.afterUseChanges),
          evidence: evidenceToText(product.understanding.evidence),
          writingBoundaries: stringsToText(product.understanding.writingBoundaries),
        }
      : undefined,
    docs: product.knowledgeDocs.map((doc) => [
      doc.fileName,
      doc.sizeKb,
      doc.extractedText?.slice(0, 800),
    ]),
  });
}

export default function ProductLibraryPage() {
  const [hydrated, setHydrated] = useState(false);
  const customProducts = useProductStore((s) => s.products);
  const upsertProduct = useProductStore((s) => s.upsert);
  const setWizardProductId = useWizardStore((s) => s.setProductId);
  const setSourcePack = useWizardStore((s) => s.setSourcePack);
  const products = useMemo(
    () => mergeProducts(getAllProducts(), Object.values(customProducts)),
    [customProducts]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = products.find((p) => p.id === selectedId) ?? products[0] ?? null;
  const [draft, setDraft] = useState<Product | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [understandingStatus, setUnderstandingStatus] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const [parsingWebsite, setParsingWebsite] = useState(false);
  const [readingPdf, setReadingPdf] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [analyzingEvidence, setAnalyzingEvidence] = useState(false);
  const lastAutoUnderstandingRef = useRef<string>("");

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setDraft(copyProduct(selected));
    setTagInput(tagString(selected));
    setUnderstandingStatus(null);
    lastAutoUnderstandingRef.current = selected.understanding?.definition
      ? understandingFingerprint(selected)
      : "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  function patchDraft(patch: Partial<Product>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function patchUnderstanding(patch: Partial<ProductUnderstanding>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const current =
        prev.understanding ?? makeManualUnderstanding("", undefined);
      return {
        ...prev,
        understanding: {
          ...current,
          ...patch,
          generatedAt: current.generatedAt,
          source: current.source === "manual" ? "manual" : "manual",
        },
      };
    });
  }

  function patchSource(sourcePatch: NonNullable<Product["sourcePack"]>) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            sourcePack: {
              ...prev.sourcePack,
              ...sourcePatch,
            },
          }
        : prev
    );
  }

  const applyUnderstanding = useCallback(
    (productId: string, understanding: ProductUnderstanding) => {
      setDraft((prev) =>
        prev?.id === productId ? { ...prev, understanding } : prev
      );
    },
    []
  );

  const generateUnderstandingFor = useCallback(
    async (product: Product, options: { silent?: boolean } = {}) => {
      if (!product.name.trim()) {
        if (!options.silent) {
          setUnderstandingStatus({
            type: "error",
            message: "请先填写产品名称。",
          });
          toast.error("请先填写产品名称");
        }
        return;
      }
      const fingerprint = understandingFingerprint(product);
      if (options.silent && lastAutoUnderstandingRef.current === fingerprint) {
        return;
      }
      lastAutoUnderstandingRef.current = fingerprint;
      setGenerating(true);
      if (!options.silent) {
        setUnderstandingStatus({
          type: "info",
          message: "正在基于产品资料生成理解卡,这一步可能需要几十秒。",
        });
      }
      try {
        const pdfText = product.knowledgeDocs
          .map((doc) => doc.extractedText)
          .filter(Boolean)
          .join("\n\n")
          .split(/\n{2,}/)
          .map((text) => cleanPdfTextSnippet(text))
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 12_000);
        const res = await fetch("/api/products/understand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product,
            pdfText,
            websiteNotes: product.sourcePack?.websiteNotes,
            mediaNotes: product.sourcePack?.mediaNotes,
            extraNotes: product.sourcePack?.productNotes,
          }),
        });
        const data = (await res.json()) as {
          understanding?: ProductUnderstanding;
          reason?: string;
        };
        if (!res.ok || !data.understanding) {
          throw new Error(data.reason ?? `HTTP ${res.status}`);
        }
        applyUnderstanding(product.id, data.understanding);
        setUnderstandingStatus({
          type: "success",
          message: "产品理解卡已生成。请检查并手动保存产品库。",
        });
        toast.success(
          options.silent
            ? "产品理解卡已生成"
            : "产品理解简介已重新生成"
        );
      } catch (err) {
        const message = productUnderstandingErrorMessage(err);
        if (!options.silent) {
          setUnderstandingStatus({
            type: "error",
            message,
          });
        }
        if (!options.silent) {
          toast.error(message);
        }
      } finally {
        setGenerating(false);
      }
    },
    [applyUnderstanding]
  );

  async function parseWebsiteFor(product: Product) {
    const website = product.website?.trim();
    if (!website) return;
    if (!/^https?:\/\//i.test(website) && !website.includes(".")) return;

    setParsingWebsite(true);
    try {
      const res = await fetch("/api/products/parse-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: website }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        notes?: string;
        title?: string;
        description?: string;
        error?: string;
        quality?: "rich" | "metadata" | "shallow";
        readableTextLength?: number;
        productSignalCount?: number;
      };
      if (!res.ok || !data.ok || !data.notes) {
        const notes =
          data.notes ??
          `官网链接：${website}\n官网暂时无法自动解析。请手动补充官网定位、核心页面、产品模块、客户角色和文章要强调的卖点。`;
        setDraft((prev) =>
          prev?.id === product.id
            ? {
                ...prev,
                sourcePack: {
                  ...prev.sourcePack,
                  websiteNotes: notes,
                },
              }
            : prev
        );
        toast.error(
          data.quality === "shallow"
            ? "官网只解析到少量正文,请手动补充关键产品信息"
            : data.error ?? `HTTP ${res.status}`
        );
        return;
      }
      setDraft((prev) =>
        prev?.id === product.id
          ? {
              ...prev,
              description: prev.description.trim()
                ? prev.description
                : data.description || prev.description,
              sourcePack: {
                ...prev.sourcePack,
                websiteNotes: data.notes,
              },
            }
          : prev
      );
      const depth =
        typeof data.readableTextLength === "number" &&
        typeof data.productSignalCount === "number"
          ? data.quality === "metadata"
            ? `metadata 素材 ${data.readableTextLength} 字,${data.productSignalCount} 个产品线索`
            : `${data.readableTextLength} 字正文,${data.productSignalCount} 个产品线索`
          : "可手动生成产品理解卡";
      toast.success(`官网资料已解析: ${depth}`);
    } catch (err) {
      setDraft((prev) =>
        prev?.id === product.id
          ? {
              ...prev,
              sourcePack: {
                ...prev.sourcePack,
                websiteNotes: `官网链接：${website}\n官网暂时无法自动解析。请手动补充官网定位、核心页面、产品模块、客户角色和文章要强调的卖点。`,
              },
            }
          : prev
      );
      toast.error(err instanceof Error ? err.message : "官网解析失败");
    } finally {
      setParsingWebsite(false);
    }
  }

  async function handlePdfUpload(file: File | null) {
    if (!file || !draft) return;
    setReadingPdf(true);
    try {
      const extractedText = await extractPdfTextSnippet(file);
      const doc: ProductDocument = {
        id: `doc-${Date.now().toString(36)}`,
        fileName: file.name,
        fileType: "pdf",
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        ragStatus: extractedText ? "indexed" : "failed",
        uploadedAt: new Date().toISOString(),
        extractedText,
      };
      const nextProduct: Product = {
        ...draft,
        knowledgeDocs: [...draft.knowledgeDocs, doc],
        sourcePack: {
          ...draft.sourcePack,
          pdfNotes: [
            draft.sourcePack?.pdfNotes,
            extractedText
              ? `来自 ${file.name} 的可读片段：\n${extractedText.slice(0, 2000)}`
              : `${file.name} 未能读取出稳定文本,请手动补充 PDF 重点。`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      };
      setDraft(nextProduct);
      toast.success(
        extractedText ? "PDF 片段已读取,可手动生成产品理解卡" : "PDF 已记录,请手动补充重点"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF 读取失败");
    } finally {
      setReadingPdf(false);
    }
  }

  function handleRemoveDocument(docId: string) {
    setDraft((prev) => (prev ? removeProductDocument(prev, docId) : prev));
    toast.success("PDF 已删除,记得保存产品库");
  }

  function validateEvidenceFile(file: File): string | null {
    if (
      !/^image\/(?:png|jpe?g|webp)$/i.test(file.type)
    ) {
      return "只支持 PNG、JPG、JPEG、WebP 截图";
    }
    if (file.size > MAX_EVIDENCE_IMAGE_BYTES) {
      return `网页截图不能超过 ${formatFileSize(MAX_EVIDENCE_IMAGE_BYTES)}`;
    }
    return null;
  }

  async function uploadEvidenceFile(
    product: Product,
    file: File
  ): Promise<Product> {
    const formData = new FormData();
    formData.set("productId", product.id);
    formData.set("file", file);
    const res = await fetch("/api/products/evidence/upload", {
      method: "POST",
      body: formData,
    });
    const data = (await res.json()) as {
      asset?: ProductSourceMediaAsset;
      error?: string;
    };
    if (!res.ok || !data.asset) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }

    const withAsset: Product = {
      ...product,
      sourceMediaAssets: [...(product.sourceMediaAssets ?? []), data.asset],
    };

    const analysisRes = await fetch("/api/products/evidence/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product: withAsset, asset: data.asset }),
    });
    const analysisData = (await analysisRes.json()) as {
      analysis?: string;
      error?: string;
    };
    const analysis =
      analysisData.analysis ||
      analysisData.error ||
      "素材已保存,请手动补充它展示的页面、使用角色和解决的问题。";
    const analyzedAsset: ProductSourceMediaAsset = {
      ...data.asset,
      analysis,
    };

    return {
      ...withAsset,
      sourceMediaAssets: (withAsset.sourceMediaAssets ?? []).map((asset) =>
        asset.id === analyzedAsset.id ? analyzedAsset : asset
      ),
      sourcePack: {
        ...withAsset.sourcePack,
        mediaNotes: appendMediaNote(withAsset.sourcePack?.mediaNotes, analyzedAsset),
      },
    };
  }

  async function handleEvidenceFiles(files: File[]) {
    if (!draft || files.length === 0) return;
    const validFiles: File[] = [];
    const rejectedMessages: string[] = [];

    for (const file of files) {
      const validationError = validateEvidenceFile(file);
      if (validationError) {
        rejectedMessages.push(`${file.name}: ${validationError}`);
      } else {
        validFiles.push(file);
      }
    }

    if (rejectedMessages.length > 0) {
      toast.error(
        rejectedMessages.length === 1
          ? rejectedMessages[0]
          : `已跳过 ${rejectedMessages.length} 个不符合要求的文件`
      );
    }
    if (validFiles.length === 0) return;

    setUploadingEvidence(true);
    setAnalyzingEvidence(true);
    try {
      let nextProduct = draft;
      for (const file of validFiles) {
        nextProduct = await uploadEvidenceFile(nextProduct, file);
        setDraft(nextProduct);
      }
      toast.success(
        validFiles.length === 1
          ? "素材已加入产品资料,可手动生成产品理解卡"
          : `${validFiles.length} 个素材已加入产品资料,可手动生成产品理解卡`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "素材上传失败");
    } finally {
      setUploadingEvidence(false);
      setAnalyzingEvidence(false);
    }
  }

  function handleEvidencePaste(e: ClipboardEvent<HTMLDivElement>) {
    if (!draft) return;
    const imageItems = Array.from(e.clipboardData.items).filter(
      (item) =>
        item.kind === "file" && /^image\/(?:png|jpe?g|webp)$/i.test(item.type)
    );

    if (imageItems.length === 0) {
      toast.error("剪贴板里没有可用的 PNG、JPG 或 WebP 截图");
      return;
    }

    e.preventDefault();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const pastedFiles = imageItems
      .map((item, index) => {
        const file = item.getAsFile();
        if (!file) return null;
        const ext =
          file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : "jpg";
        return new File(
          [file],
          `粘贴网页截图-${timestamp}-${String(index + 1).padStart(2, "0")}.${ext}`,
          { type: file.type }
        );
      })
      .filter((file): file is File => Boolean(file));

    if (pastedFiles.length === 0) {
      toast.error("没有读取到剪贴板图片");
      return;
    }
    void handleEvidenceFiles(pastedFiles);
  }

  function patchSourceMediaAsset(
    assetId: string,
    patch: Partial<ProductSourceMediaAsset>
  ) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            sourceMediaAssets: (prev.sourceMediaAssets ?? []).map((asset) =>
              asset.id === assetId ? { ...asset, ...patch } : asset
            ),
          }
        : prev
    );
  }

  function removeSourceMediaAsset(assetId: string) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            sourceMediaAssets: (prev.sourceMediaAssets ?? []).filter(
              (asset) => asset.id !== assetId
            ),
          }
        : prev
    );
  }

  async function handleGenerateUnderstanding() {
    if (!draft) return;
    await generateUnderstandingFor(draft);
  }

  function handleSave() {
    if (!draft) return;
    const normalized: Product = {
      ...draft,
      name: draft.name.trim() || "未命名产品",
      description: draft.description.trim(),
      tags: tagInput
        .split(/[、,，\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      sourcePack: draft.sourcePack ?? {},
      imageAssets: draft.imageAssets ?? [],
      sourceMediaAssets: understandingMediaAssets(draft),
    };
    upsertProduct(normalized);
    setSelectedId(normalized.id);
    toast.success("产品库已更新");
  }

  function handleUseForGeneration() {
    if (!draft) return;
    handleSave();
    setWizardProductId(draft.id);
    setSourcePack(productSourceToArticleContext(draft));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600">JOTO 产品库</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                先完善产品,再生成文章
              </h1>
            </div>
            <button
              type="button"
              onClick={() => {
                const product = newProduct();
                setSelectedId(product.id);
                setDraft(product);
                setTagInput("");
                lastAutoUnderstandingRef.current = "";
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
            >
              <PackagePlus className="h-4 w-4" aria-hidden="true" />
              新产品
            </button>
          </div>

          <ul className="space-y-3">
            {products.map((product) => {
              const active = draft?.id === product.id;
              const ready = hasProductMaterial(product);
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(product.id);
                      setDraft(copyProduct(product));
                      setTagInput(tagString(product));
                      lastAutoUnderstandingRef.current = product.understanding?.definition
                        ? understandingFingerprint(product)
                        : "";
                    }}
                    className={cn(
                      "w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-all",
                      active
                        ? "border-blue-500 ring-2 ring-blue-100"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                        style={{
                          background: `linear-gradient(135deg,${product.iconGradient[0]},${product.iconGradient[1]})`,
                        }}
                      >
                        {product.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {product.name}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {product.description || "还没有产品简介"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                              ready
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            )}
                          >
                            {ready ? "资料已补充" : "待完善资料"}
                          </span>
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {understandingMediaAssets(product).length} 个理解素材
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="min-w-0">
          {!hydrated || !draft ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
              加载产品库…
            </div>
          ) : (
            <div className="space-y-5">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      产品名称
                    </span>
                    <input
                      value={draft.name}
                      onChange={(e) => patchDraft({ name: e.target.value })}
                      className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      Landing Page / 官网介绍页
                    </span>
                    <div className="relative mt-2">
                      <Globe2
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        value={draft.website ?? ""}
                        onChange={(e) => patchDraft({ website: e.target.value })}
                        placeholder="https://jotoai.com/product"
                        className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {parsingWebsite && (
                        <Loader2
                          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="text-xs font-semibold text-slate-700">
                    产品一句话简介
                  </span>
                  <textarea
                    value={draft.description}
                    onChange={(e) => patchDraft({ description: e.target.value })}
                    rows={3}
                    placeholder="先用你自己的话讲清楚：这个产品是什么、给谁用、解决什么问题。"
                    className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="text-xs font-semibold text-slate-700">
                    标签
                  </span>
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="RPA、Agent、自动化"
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      产品资料输入
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      官网链接、PDF 和网页截图会一起参与产品理解。解析和生成都需要手动触发。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (draft) void parseWebsiteFor(draft);
                      }}
                      disabled={parsingWebsite || !draft.website?.trim()}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {parsingWebsite ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Globe2 className="h-4 w-4" aria-hidden="true" />
                      )}
                      解析官网
                    </button>
                    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 hover:bg-blue-100">
                      {readingPdf ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <FileUp className="h-4 w-4" aria-hidden="true" />
                      )}
                      上传产品 PDF
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          void handlePdfUpload(e.target.files?.[0] ?? null);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>

                {draft.knowledgeDocs.length > 0 && (
                  <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {draft.knowledgeDocs.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-slate-900">
                            {doc.fileName}
                          </span>
                          <span className="ml-2 text-slate-400">
                            {doc.sizeKb} KB
                          </span>
                          {(() => {
                            const status = documentParseStatus(doc);
                            return (
                              <span
                                className={cn(
                                  "ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                                  status.className
                                )}
                              >
                                {status.label}
                              </span>
                            );
                          })()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDocument(doc.id)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          aria-label={`删除 ${doc.fileName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-800">
                        网页截图 / 智能体页面
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        适合没有稳定登录页、只有智能体页面或演示流程截图的产品。截图可批量上传或直接批量粘贴。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-blue-200 hover:text-blue-700">
                        {uploadingEvidence || analyzingEvidence ? (
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Camera className="h-4 w-4" aria-hidden="true" />
                        )}
                        上传网页截图
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            void handleEvidenceFiles(
                              Array.from(e.target.files ?? [])
                            );
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div
                    tabIndex={0}
                    onPaste={handleEvidencePaste}
                    className={cn(
                      "mt-4 flex min-h-20 cursor-text items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-left outline-none transition",
                      "focus:border-blue-400 focus:bg-blue-50/40 focus:ring-2 focus:ring-blue-100",
                      uploadingEvidence || analyzingEvidence
                        ? "pointer-events-none opacity-60"
                        : "hover:border-blue-300 hover:bg-slate-50"
                    )}
                    aria-label="点击后粘贴网页截图"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      {uploadingEvidence || analyzingEvidence ? (
                        <Loader2
                          className="h-5 w-5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <ClipboardPaste className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        点击这里后直接粘贴一张或多张截图
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        从浏览器、设计稿、聊天或 Finder 里复制图片后按 Cmd+V。只接收 PNG、JPG、WebP,单张不超过 50MB。
                      </p>
                    </div>
                  </div>

                  {understandingMediaAssets(draft).length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
                      <Camera
                        className="mx-auto h-7 w-7 text-slate-300"
                        aria-hidden="true"
                      />
                      <p className="mt-2 text-xs font-medium text-slate-600">
                        还没有截图理解素材
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        可以上传产品页面、智能体对话或演示流程截图,也可以把截图直接粘贴到上方区域。它们用于理解产品,不会自动当作正文插图。
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {understandingMediaAssets(draft).map((asset) => (
                        <article
                          key={asset.id}
                          className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                        >
                          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                            <div className="relative aspect-video overflow-hidden rounded-md border border-slate-100 bg-slate-50">
                              <Image
                                src={asset.url}
                                alt={asset.caption || asset.fileName}
                                fill
                                sizes="180px"
                                unoptimized
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0 space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  value={asset.caption}
                                  onChange={(e) =>
                                    patchSourceMediaAsset(asset.id, {
                                      caption: e.target.value,
                                    })
                                  }
                                  placeholder="这张截图展示了什么"
                                  className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSourceMediaAsset(asset.id)}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                  aria-label="删除理解素材"
                                >
                                  <Trash2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                </button>
                              </div>
                              <textarea
                                value={asset.analysis ?? ""}
                                onChange={(e) =>
                                  patchSourceMediaAsset(asset.id, {
                                    analysis: e.target.value,
                                  })
                                }
                                rows={3}
                                placeholder="系统识别或人工补充：页面/流程、使用者、解决的问题、文章可强调的点。"
                                className="w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs leading-5 text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <p className="truncate text-[11px] text-slate-400">
                                截图 · {asset.fileName} · {asset.sizeKb} KB
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  <label className="mt-4 block">
                    <span className="text-xs font-semibold text-slate-700">
                      截图理解摘要
                    </span>
                    <textarea
                      value={draft.sourcePack?.mediaNotes ?? ""}
                      onChange={(e) => patchSource({ mediaNotes: e.target.value })}
                      rows={4}
                      placeholder="这里会汇总截图理解结果。你可以改得更准确,例如：这是智能体对话页,面向网络工程师,用于一句话定位告警根因。"
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      官网自动解析/人工补充
                    </span>
                    <textarea
                      value={draft.sourcePack?.websiteNotes ?? ""}
                      onChange={(e) => patchSource({ websiteNotes: e.target.value })}
                      rows={5}
                      placeholder="点击“解析官网”后会写入这里；你也可以手动补充：定位、核心页面、产品模块、客户角色、希望文章强调的卖点。"
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      产品文章补充素材
                    </span>
                    <textarea
                      value={draft.sourcePack?.productNotes ?? ""}
                      onChange={(e) => patchSource({ productNotes: e.target.value })}
                      rows={5}
                      placeholder="补充不能编造的事实：目标用户、功能边界、典型场景、客户反馈、禁用说法。"
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      产品理解卡
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      基于上方资料手动生成 V2 产品卡。请浏览一遍,把不准确的地方改掉,再补充缺失信息。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateUnderstanding}
                    disabled={generating}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    )}
                    {generating
                      ? "正在生成..."
                      : draft.understanding
                        ? "重新生成产品理解"
                        : "生成产品理解卡"}
                  </button>
                </div>
                {understandingStatus && (
                  <div
                    className={cn(
                      "mt-3 rounded-lg border px-3 py-2 text-xs leading-5",
                      understandingStatus.type === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : understandingStatus.type === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-blue-200 bg-blue-50 text-blue-700"
                    )}
                  >
                    {understandingStatus.message}
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      产品定义
                    </span>
                    <textarea
                      value={draft.understanding?.definition ?? ""}
                      onChange={(e) =>
                        patchDraft({
                          understanding: makeManualUnderstanding(
                            e.target.value,
                            draft.understanding
                          ),
                        })
                      }
                      rows={4}
                      placeholder="给谁用,处理什么事情,最后产出什么。"
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <ProductCardTextarea
                      title="核心功能"
                      hint="一行一个具体能力,不要写泛泛的智能化、提效。"
                      value={entriesToText(draft.understanding?.coreFunctions ?? [])}
                      placeholder="例如: 在浏览器里执行自动化任务"
                      onChange={(value) =>
                        patchUnderstanding({
                          coreFunctions: textToEntries(value),
                        })
                      }
                    />
                    <ProductCardTextarea
                      title="目标客户/角色"
                      hint="资料明确写到的客户优先;不确定就写保守推测。"
                      value={entriesToText(draft.understanding?.targetCustomers ?? [])}
                      placeholder="例如: 企业运营团队"
                      onChange={(value) =>
                        patchUnderstanding({
                          targetCustomers: textToEntries(value),
                        })
                      }
                    />
                    <ProductCardTextarea
                      title="用户痛点"
                      hint="文章开头应该主要来自这里。"
                      value={entriesToText(draft.understanding?.painPoints ?? [])}
                      placeholder="例如: 网页里的重复操作仍需要人工处理"
                      onChange={(value) =>
                        patchUnderstanding({
                          painPoints: textToEntries(value),
                        })
                      }
                    />
                    <ProductCardTextarea
                      title="传统做法/替代方案"
                      hint="写清以前靠什么做,比如 Excel、PPT、人工整理、RPA。"
                      value={entriesToText(
                        draft.understanding?.traditionalAlternatives ?? []
                      )}
                      placeholder="例如: 传统 RPA 或人工复制粘贴"
                      onChange={(value) =>
                        patchUnderstanding({
                          traditionalAlternatives: textToEntries(value),
                        })
                      }
                    />
                    <ProductCardTextarea
                      title="产品介入后的变化"
                      hint="只写可确认的定性变化,不要补百分比或时间。"
                      value={entriesToText(draft.understanding?.afterUseChanges ?? [])}
                      placeholder="例如: 把部分浏览器重复操作交给 Agent 处理"
                      onChange={(value) =>
                        patchUnderstanding({
                          afterUseChanges: textToEntries(value),
                        })
                      }
                    />
                    <ProductCardTextarea
                      title="可用证据"
                      hint="格式建议: 来源: 事实。比如 PDF: 支持浏览器自动化。"
                      value={evidenceToText(draft.understanding?.evidence ?? [])}
                      placeholder="例如: PDF: 支持在浏览器里执行自动化任务"
                      onChange={(value) =>
                        patchUnderstanding({
                          evidence: textToEvidence(value),
                        })
                      }
                    />
                    <ProductCardTextarea
                      title="禁写边界"
                      hint="没有证据就不能写的内容。生成文章会优先尊重这里。"
                      value={stringsToText(
                        draft.understanding?.writingBoundaries ?? []
                      )}
                      placeholder="例如: 未提供真实客户资料,不得写客户名称或客户案例。"
                      onChange={(value) =>
                        patchUnderstanding({
                          writingBoundaries: textToStrings(value),
                        })
                      }
                    />
                    <ProductCardTextarea
                      title="需要追问"
                      hint="这些不是正文素材,是提醒你还缺哪些关键信息。"
                      value={stringsToText(draft.understanding?.questionsToAsk ?? [])}
                      placeholder="例如: 是否有真实金融客户或行业客户案例?"
                      onChange={(value) =>
                        patchUnderstanding({
                          questionsToAsk: textToStrings(value),
                        })
                      }
                    />
                  </div>
                </div>
              </section>

              <div className="sticky bottom-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  保存产品库
                </button>
                <Link
                  href="/wizard/product"
                  onClick={handleUseForGeneration}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                >
                  选择此产品生成文章
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ProductCardTextarea({
  title,
  hint,
  value,
  placeholder,
  onChange,
}: {
  title: string;
  hint: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-lg border border-slate-200 bg-slate-50 p-3">
      <span className="text-xs font-semibold text-slate-800">{title}</span>
      <span className="mt-1 block text-[11px] leading-4 text-slate-500">
        {hint}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder={placeholder}
        className="mt-3 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}
