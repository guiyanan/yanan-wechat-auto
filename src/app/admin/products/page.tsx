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
  ImageIcon,
  Loader2,
  PackagePlus,
  Save,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/nav/TopNav";
import { getAllProducts } from "@/lib/articles";
import {
  hasProductMaterial,
  mergeProducts,
  productSourceToArticleContext,
} from "@/lib/productCatalog";
import { extractPdfTextSnippet } from "@/lib/pdfExtract";
import { PRODUCT_IMAGE_KIND_OPTIONS } from "@/lib/productImages";
import { useProductStore } from "@/store/productStore";
import { useWizardStore } from "@/store/wizardStore";
import type {
  Product,
  ProductDocument,
  ProductImageAsset,
  ProductImageKind,
  ProductSourceMediaAsset,
  ProductUnderstanding,
} from "@/types";
import { cn } from "@/lib/utils";

const DEFAULT_GRADIENT: Product["iconGradient"] = ["#1268FF", "#5B8CFF"];
const MAX_EVIDENCE_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_EVIDENCE_VIDEO_BYTES = 500 * 1024 * 1024;

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
      competitorNotes: "",
      trendNotes: "",
      imageRefs: "",
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
    understanding: product.understanding
      ? {
          ...product.understanding,
          targetUsers: [...product.understanding.targetUsers],
          coreCapabilities: [...product.understanding.coreCapabilities],
          contentAngles: [...product.understanding.contentAngles],
          missingInfo: [...product.understanding.missingInfo],
        }
      : undefined,
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
    `${asset.fileType === "video" ? "视频" : "截图"}素材：${
      asset.caption || asset.fileName
    }`,
    asset.analysis ? `系统理解：${asset.analysis}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return [current?.trim(), note].filter(Boolean).join("\n\n");
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
    sourceMediaAssets: product.sourceMediaAssets?.map((asset) => [
      asset.fileName,
      asset.caption,
      asset.analysis,
    ]),
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
  const [parsingWebsite, setParsingWebsite] = useState(false);
  const [readingPdf, setReadingPdf] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [analyzingEvidence, setAnalyzingEvidence] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<ProductImageAsset | null>(
    null
  );
  const lastParsedWebsiteRef = useRef<string>("");
  const lastAutoUnderstandingRef = useRef<string>("");

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setDraft(copyProduct(selected));
    setTagInput(tagString(selected));
    lastParsedWebsiteRef.current = selected.sourcePack?.websiteNotes
      ? selected.website ?? ""
      : "";
    lastAutoUnderstandingRef.current = selected.understanding?.summary
      ? understandingFingerprint(selected)
      : "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  function patchDraft(patch: Partial<Product>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
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

  const applyUnderstanding = useCallback((understanding: ProductUnderstanding) => {
    setDraft((prev) => (prev ? { ...prev, understanding } : prev));
  }, []);

  const generateUnderstandingFor = useCallback(
    async (product: Product, options: { silent?: boolean } = {}) => {
      if (!product.name.trim()) {
        if (!options.silent) toast.error("请先填写产品名称");
        return;
      }
      const fingerprint = understandingFingerprint(product);
      if (options.silent && lastAutoUnderstandingRef.current === fingerprint) {
        return;
      }
      lastAutoUnderstandingRef.current = fingerprint;
      setGenerating(true);
      try {
        const pdfText = product.knowledgeDocs
          .map((doc) => doc.extractedText)
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 6000);
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
        applyUnderstanding(data.understanding);
        toast.success(
          options.silent
            ? "资料解析完成,产品理解简介已自动生成"
            : "产品理解简介已重新生成"
        );
      } catch (err) {
        if (!options.silent) {
          toast.error(err instanceof Error ? err.message : "生成失败");
        }
      } finally {
        setGenerating(false);
      }
    },
    [applyUnderstanding]
  );

  const parseWebsiteFor = useCallback(
    async (product: Product) => {
      const website = product.website?.trim();
      if (!website) return;
      if (!/^https?:\/\//i.test(website) && !website.includes(".")) return;
      if (lastParsedWebsiteRef.current === website) return;
      lastParsedWebsiteRef.current = website;

      setParsingWebsite(true);
      try {
        const res = await fetch("/api/products/parse-website", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: website }),
        });
        const data = (await res.json()) as {
          notes?: string;
          title?: string;
          description?: string;
          error?: string;
        };
        if (!res.ok || !data.notes) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const nextProduct: Product = {
          ...product,
          description: product.description.trim()
            ? product.description
            : data.description || product.description,
          sourcePack: {
            ...product.sourcePack,
            websiteNotes: data.notes,
          },
        };
        setDraft(nextProduct);
        await generateUnderstandingFor(nextProduct, { silent: true });
      } catch (err) {
        patchSource({
          websiteNotes: `官网链接：${website}\n官网暂时无法自动解析。请手动补充官网定位、核心页面、产品模块、客户角色和文章要强调的卖点。`,
        });
        toast.error(err instanceof Error ? err.message : "官网解析失败");
      } finally {
        setParsingWebsite(false);
      }
    },
    [generateUnderstandingFor]
  );

  useEffect(() => {
    if (!draft?.website?.trim()) return;
    const timer = window.setTimeout(() => {
      void parseWebsiteFor(draft);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [draft, draft?.website, parseWebsiteFor]);

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
        extractedText ? "PDF 片段已读取,正在生成产品理解" : "PDF 已记录,请手动补充重点"
      );
      await generateUnderstandingFor(nextProduct, { silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF 读取失败");
    } finally {
      setReadingPdf(false);
    }
  }

  function validateEvidenceFile(file: File): string | null {
    if (
      !/^(?:image\/(?:png|jpe?g|webp)|video\/(?:mp4|webm|quicktime))$/i.test(
        file.type
      )
    ) {
      return "只支持 PNG、JPG、JPEG、WebP、MP4、WebM、MOV";
    }
    const isVideo = file.type.startsWith("video/");
    const maxBytes = isVideo ? MAX_EVIDENCE_VIDEO_BYTES : MAX_EVIDENCE_IMAGE_BYTES;
    if (file.size > maxBytes) {
      return `${isVideo ? "演示视频" : "网页截图"}不能超过 ${formatFileSize(maxBytes)}`;
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
          ? "素材已加入产品理解"
          : `${validFiles.length} 个素材已加入产品理解`
      );
      await generateUnderstandingFor(nextProduct, { silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "素材上传失败");
    } finally {
      setUploadingEvidence(false);
      setAnalyzingEvidence(false);
    }
  }

  async function handleEvidenceUpload(file: File | null) {
    await handleEvidenceFiles(file ? [file] : []);
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

  async function handleImageUpload(file: File | null) {
    if (!file || !draft) return;
    if (!/^image\/(?:png|jpe?g|webp)$/i.test(file.type)) {
      toast.error("只支持 PNG、JPG、JPEG、WebP 图片");
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.set("productId", draft.id);
      formData.set("file", file);
      const res = await fetch("/api/products/assets/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        asset?: ProductImageAsset;
        error?: string;
      };
      if (!res.ok || !data.asset) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      patchDraft({
        imageAssets: [...(draft.imageAssets ?? []), data.asset],
      });
      toast.success("图片已加入当前产品素材库");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "图片上传失败");
    } finally {
      setUploadingImage(false);
    }
  }

  function patchImageAsset(
    assetId: string,
    patch: Partial<ProductImageAsset>
  ) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            imageAssets: (prev.imageAssets ?? []).map((asset) =>
              asset.id === assetId ? { ...asset, ...patch } : asset
            ),
          }
        : prev
    );
  }

  function removeImageAsset(assetId: string) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            imageAssets: (prev.imageAssets ?? []).filter(
              (asset) => asset.id !== assetId
            ),
          }
        : prev
    );
    setPreviewAsset((prev) => (prev?.id === assetId ? null : prev));
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
      sourceMediaAssets: draft.sourceMediaAssets ?? [],
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
                lastParsedWebsiteRef.current = "";
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
                      lastParsedWebsiteRef.current = product.sourcePack?.websiteNotes
                        ? product.website ?? ""
                        : "";
                      lastAutoUnderstandingRef.current = product.understanding?.summary
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
                            {(product.imageAssets ?? []).length} 张图片素材
                          </span>
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {(product.sourceMediaAssets ?? []).length} 个理解素材
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
                      官网链接、PDF、网页截图和演示视频会一起参与产品理解。
                    </p>
                  </div>
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

                {draft.knowledgeDocs.length > 0 && (
                  <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {draft.knowledgeDocs.map((doc) => (
                      <li
                        key={doc.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                      >
                        <span className="font-medium text-slate-900">
                          {doc.fileName}
                        </span>
                        <span className="ml-2 text-slate-400">{doc.sizeKb} KB</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-800">
                        网页截图 / 智能体演示视频
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        适合没有稳定登录页、只有智能体或演示流程的产品。截图可批量上传或直接批量粘贴,视频最高支持 500MB。
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
                      <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-blue-200 hover:text-blue-700">
                        {uploadingEvidence || analyzingEvidence ? (
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Video className="h-4 w-4" aria-hidden="true" />
                        )}
                        上传演示视频
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          className="hidden"
                          onChange={(e) => {
                            void handleEvidenceUpload(e.target.files?.[0] ?? null);
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

                  {(draft.sourceMediaAssets ?? []).length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
                      <Camera
                        className="mx-auto h-7 w-7 text-slate-300"
                        aria-hidden="true"
                      />
                      <p className="mt-2 text-xs font-medium text-slate-600">
                        还没有截图或视频理解素材
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        可以上传产品页面、智能体对话、演示录屏,也可以把截图直接粘贴到上方区域。它们用于理解产品,不会自动当作正文插图。
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {(draft.sourceMediaAssets ?? []).map((asset) => (
                        <article
                          key={asset.id}
                          className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                        >
                          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                            <div className="relative aspect-video overflow-hidden rounded-md border border-slate-100 bg-slate-50">
                              {asset.fileType === "image" ? (
                                <Image
                                  src={asset.url}
                                  alt={asset.caption || asset.fileName}
                                  fill
                                  sizes="180px"
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : (
                                <video
                                  src={asset.url}
                                  controls
                                  className="h-full w-full bg-black object-contain"
                                />
                              )}
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
                                  placeholder="这张图/视频展示了什么"
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
                                {asset.fileType === "video" ? "视频" : "截图"} ·{" "}
                                {asset.fileName} · {asset.sizeKb} KB
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  <label className="mt-4 block">
                    <span className="text-xs font-semibold text-slate-700">
                      截图/视频理解摘要
                    </span>
                    <textarea
                      value={draft.sourcePack?.mediaNotes ?? ""}
                      onChange={(e) => patchSource({ mediaNotes: e.target.value })}
                      rows={4}
                      placeholder="这里会汇总截图和视频的理解结果。你可以改得更准确,例如：这是智能体对话页,面向网络工程师,用于一句话定位告警根因。"
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
                      placeholder="填写官网链接后会自动解析；你也可以在这里补充：定位、核心页面、产品模块、客户角色、希望文章强调的卖点。"
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      图片素材库
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      只属于当前产品。生成产品文章时,系统会从这里挑选你上传的真实图片插入正文。
                    </p>
                  </div>
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 hover:bg-blue-100">
                    {uploadingImage ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ImageIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                    上传产品图
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        void handleImageUpload(e.target.files?.[0] ?? null);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                {(draft.imageAssets ?? []).length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <ImageIcon
                      className="mx-auto h-8 w-8 text-slate-300"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      还没有图片素材
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      上传产品首页、功能截图、流程图、架构图或视频封面。没有素材时,生成文章不会乱插图。
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {(draft.imageAssets ?? []).map((asset) => (
                      <article
                        key={asset.id}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewAsset(asset)}
                          className="relative block aspect-[16/10] w-full overflow-hidden bg-white"
                        >
                          <Image
                            src={asset.url}
                            alt={asset.caption || asset.fileName}
                            fill
                            sizes="(min-width: 1280px) 240px, (min-width: 640px) 45vw, 90vw"
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        </button>
                        <div className="space-y-2 p-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={asset.kind}
                              onChange={(e) =>
                                patchImageAsset(asset.id, {
                                  kind: e.target.value as ProductImageKind,
                                })
                              }
                              className="h-8 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {PRODUCT_IMAGE_KIND_OPTIONS.map((kind) => (
                                <option key={kind} value={kind}>
                                  {kind}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeImageAsset(asset.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              aria-label="删除图片素材"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                          <input
                            value={asset.caption}
                            onChange={(e) =>
                              patchImageAsset(asset.id, {
                                caption: e.target.value,
                              })
                            }
                            placeholder="图片说明/图注"
                            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <input
                            value={asset.tags.join("、")}
                            onChange={(e) =>
                              patchImageAsset(asset.id, {
                                tags: e.target.value
                                  .split(/[、,，\n]/)
                                  .map((tag) => tag.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="标签,如 首页、权限、流程"
                            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <p className="truncate text-[11px] text-slate-400">
                            {asset.fileName}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      产品理解简介
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      官网或 PDF 解析完成后会自动生成。请浏览一遍,把不准确的地方改掉,再补充缺失信息。
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
                    {draft.understanding ? "重新生成产品理解" : "生成产品理解简介"}
                  </button>
                </div>

                <textarea
                  value={draft.understanding?.summary ?? ""}
                  onChange={(e) =>
                    patchDraft({
                      understanding: {
                        summary: e.target.value,
                        targetUsers: draft.understanding?.targetUsers ?? [],
                        coreCapabilities:
                          draft.understanding?.coreCapabilities ?? [],
                        contentAngles: draft.understanding?.contentAngles ?? [],
                        missingInfo: draft.understanding?.missingInfo ?? [],
                        generatedAt:
                          draft.understanding?.generatedAt ??
                          new Date().toISOString(),
                        source: draft.understanding?.source ?? "manual",
                      },
                    })
                  }
                  rows={5}
                  placeholder="上传 PDF 或填写官网链接后,这里会自动出现系统对产品的理解。你可以直接编辑。"
                  className="mt-4 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />

                {draft.understanding && (
                  <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <InfoList title="核心能力" items={draft.understanding.coreCapabilities} />
                    <InfoList title="建议补充" items={draft.understanding.missingInfo} />
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">
                  写作额外上下文
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      竞品/传统方案
                    </span>
                    <textarea
                      value={draft.sourcePack?.competitorNotes ?? ""}
                      onChange={(e) =>
                        patchSource({ competitorNotes: e.target.value })
                      }
                      rows={4}
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      热点/行业事件
                    </span>
                    <textarea
                      value={draft.sourcePack?.trendNotes ?? ""}
                      onChange={(e) => patchSource({ trendNotes: e.target.value })}
                      rows={4}
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      截图/视频说明
                    </span>
                    <textarea
                      value={draft.sourcePack?.imageRefs ?? ""}
                      onChange={(e) => patchSource({ imageRefs: e.target.value })}
                      rows={4}
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
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
      {previewAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 py-8"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="relative max-h-full w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewAsset(null)}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm hover:text-slate-900"
              aria-label="关闭图片预览"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="relative h-[78vh] w-full bg-slate-100">
              <Image
                src={previewAsset.url}
                alt={previewAsset.caption || previewAsset.fileName}
                fill
                sizes="90vw"
                unoptimized
                className="object-contain"
              />
            </div>
            <div className="border-t border-slate-200 px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">
                {previewAsset.caption || previewAsset.fileName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {previewAsset.kind} · {previewAsset.fileName}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-500">
        {items.length ? (
          items.map((item) => <li key={item}>· {item}</li>)
        ) : (
          <li>暂无</li>
        )}
      </ul>
    </div>
  );
}
