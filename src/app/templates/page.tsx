"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ImageOff,
  ClipboardPaste,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/nav/TopNav";
import {
  type WechatTemplateSlot,
  useWechatTemplateStore,
} from "@/store/wechatTemplateStore";

const SLOT_META: Record<
  WechatTemplateSlot,
  { label: string; desc: string; empty: string }
> = {
  followHeader: {
    label: "文章开头关注模块",
    desc: "适合采集“点击蓝字 关注我们 + 品牌 Logo”这类开头模块。",
    empty: "当前会使用系统内置 JOTO 开头模块。",
  },
  contactFooter: {
    label: "文末联系模块",
    desc: "适合采集二维码、波形爱心、联系方式这类文末模块。",
    empty: "当前会使用系统内置 JOTO 联系模块。",
  },
};

const LOCAL_ENTERPRISE_QR_SRC = "/joto-enterprise-wechat-qr.jpg";

interface CapturedImageReport {
  blockedWechatImages: number;
  likelyQrImages: number;
}

const EMPTY_IMAGE_REPORT: CapturedImageReport = {
  blockedWechatImages: 0,
  likelyQrImages: 0,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin: 0 0 14px; color: #444; font-size: 16px; line-height: 1.8;">${escapeHtml(
          line
        ).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

function isWechatImageUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return (
    lower.includes("mmbiz.qpic.cn") ||
    lower.includes("mmbiz.qlogo.cn") ||
    lower.includes("wx.qlogo.cn") ||
    lower.includes("mp.weixin.qq.com") ||
    lower.includes("wx_fmt=") ||
    lower.includes("mmbiz")
  );
}

function imageText(img: HTMLImageElement): string {
  return [
    img.getAttribute("src"),
    img.getAttribute("data-src"),
    img.getAttribute("data-original"),
    img.getAttribute("alt"),
    img.getAttribute("title"),
    img.getAttribute("class"),
    img.getAttribute("style"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function imageDimension(img: HTMLImageElement, key: "width" | "height"): number {
  const attr = Number.parseFloat(img.getAttribute(key) ?? "");
  if (Number.isFinite(attr) && attr > 0) return attr;
  const style = img.getAttribute("style") ?? "";
  const match = style.match(new RegExp(`${key}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`, "i"));
  if (!match) return 0;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isWechatBlockedImage(img: HTMLImageElement): boolean {
  const text = imageText(img);
  return (
    isWechatImageUrl(img.getAttribute("src")) ||
    isWechatImageUrl(img.getAttribute("data-src")) ||
    text.includes("此图片来自微信公众平台") ||
    text.includes("未经允许不可引用")
  );
}

function isLikelyQrImage(img: HTMLImageElement): boolean {
  const text = imageText(img);
  if (
    text.includes("二维码") ||
    text.includes("qrcode") ||
    text.includes("qr") ||
    text.includes("企业微信") ||
    text.includes("公众号") ||
    text.includes("联系")
  ) {
    return true;
  }

  const width = imageDimension(img, "width");
  const height = imageDimension(img, "height");
  if (!width || !height) return false;
  const max = Math.max(width, height);
  const ratio = width > height ? width / height : height / width;
  return max >= 120 && ratio <= 1.3;
}

function parseTemplateFragment(input: string): Document {
  return new DOMParser().parseFromString(
    `<section data-joto-root>${input}</section>`,
    "text/html"
  );
}

function getTemplateRoot(doc: Document): HTMLElement | null {
  return doc.querySelector("[data-joto-root]");
}

function analyzeCapturedImages(input: string): CapturedImageReport {
  if (typeof window === "undefined" || !input.trim()) return EMPTY_IMAGE_REPORT;
  const doc = parseTemplateFragment(input);
  const blockedImages = Array.from(doc.querySelectorAll("img")).filter((img) =>
    isWechatBlockedImage(img as HTMLImageElement)
  ) as HTMLImageElement[];
  return {
    blockedWechatImages: blockedImages.length,
    likelyQrImages: blockedImages.filter(isLikelyQrImage).length,
  };
}

function replaceLikelyQrImage(input: string): {
  html: string;
  report: CapturedImageReport;
  replaced: boolean;
} {
  const doc = parseTemplateFragment(input);
  const blockedImages = Array.from(doc.querySelectorAll("img")).filter((img) =>
    isWechatBlockedImage(img as HTMLImageElement)
  ) as HTMLImageElement[];
  const target =
    blockedImages.find(isLikelyQrImage) ??
    blockedImages
      .map((img) => ({
        img,
        area: imageDimension(img, "width") * imageDimension(img, "height"),
      }))
      .sort((a, b) => b.area - a.area)[0]?.img;

  if (!target) {
    return { html: input, report: analyzeCapturedImages(input), replaced: false };
  }

  target.setAttribute("src", LOCAL_ENTERPRISE_QR_SRC);
  target.setAttribute("data-src", LOCAL_ENTERPRISE_QR_SRC);
  target.setAttribute("alt", "JOTO 企业微信二维码");
  target.removeAttribute("data-original");
  target.removeAttribute("crossorigin");

  const root = getTemplateRoot(doc);
  const html = root?.innerHTML.trim().replace(/\sdata-joto-root=""/g, "") ?? input;
  return { html, report: analyzeCapturedImages(html), replaced: true };
}

function sanitizeCapturedHtml(input: string): string {
  if (typeof window === "undefined") return input;
  const doc = parseTemplateFragment(input);

  doc
    .querySelectorAll("script, iframe, object, embed, link, meta, base, form")
    .forEach((node) => node.remove());

  doc.querySelectorAll("*").forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith("on")) {
        node.removeAttribute(attr.name);
        continue;
      }
      if (
        ["href", "src", "data-src", "poster"].includes(name) &&
        /^\s*javascript:/i.test(value)
      ) {
        node.removeAttribute(attr.name);
        continue;
      }
      if (name === "style" && /javascript:/i.test(value)) {
        node.setAttribute(
          "style",
          value.replace(/url\((['"]?)javascript:[^)]+\)/gi, "")
        );
      }
    }
  });

  return (
    getTemplateRoot(doc)?.innerHTML.trim().replace(/\sdata-joto-root=""/g, "") ??
    ""
  );
}

function previewDocument(html: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
  body { padding: 28px; }
  .shell { max-width: 720px; min-height: 420px; margin: 0 auto; padding: 32px 24px; background: #fff; border: 1px solid #d2d2d7; box-sizing: border-box; }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
  <section class="shell">${
    html ||
    '<p style="color:#86868b;font-size:15px;line-height:1.8;text-align:center;margin:120px 0;">从秀米或公众号编辑器复制模块后，粘贴到左侧。</p>'
  }</section>
</body>
</html>`;
}

function formatCapturedAt(value?: string): string {
  if (!value) return "尚未保存";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "已保存";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TemplatesPage() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<WechatTemplateSlot>("contactFooter");
  const [capturedHtml, setCapturedHtml] = useState("");
  const [pasteMode, setPasteMode] = useState<"rich" | "plain" | null>(null);
  const [imageReport, setImageReport] =
    useState<CapturedImageReport>(EMPTY_IMAGE_REPORT);
  const followHeader = useWechatTemplateStore((s) => s.followHeader);
  const contactFooter = useWechatTemplateStore((s) => s.contactFooter);
  const setTemplate = useWechatTemplateStore((s) => s.setTemplate);
  const clearTemplate = useWechatTemplateStore((s) => s.clearTemplate);
  const currentTemplate = slot === "followHeader" ? followHeader : contactFooter;
  const meta = SLOT_META[slot];
  const displayedImageReport = useMemo(() => {
    if (capturedHtml) return imageReport;
    return analyzeCapturedImages(currentTemplate?.html ?? "");
  }, [capturedHtml, currentTemplate?.html, imageReport]);

  const previewHtml = useMemo(
    () => previewDocument(capturedHtml || currentTemplate?.html || ""),
    [capturedHtml, currentTemplate?.html]
  );

  function applyCapturedHtml(html: string, mode: "rich" | "plain") {
    const sanitized = sanitizeCapturedHtml(html);
    if (!sanitized) {
      toast.error("没有读到可用内容，请确认复制的是编辑器里的模块");
      return;
    }
    const report = analyzeCapturedImages(sanitized);
    setCapturedHtml(sanitized);
    setImageReport(report);
    setPasteMode(mode);
    if (editorRef.current) {
      editorRef.current.innerHTML = sanitized;
    }
    if (report.blockedWechatImages > 0) {
      toast.warning(
        `检测到 ${report.blockedWechatImages} 张微信外链图片，预览或草稿箱里可能不可见`
      );
    } else {
      toast.success(mode === "rich" ? "已读取富文本格式" : "已读取纯文本内容");
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    if (html) {
      applyCapturedHtml(html, "rich");
      return;
    }
    if (text) {
      applyCapturedHtml(plainTextToHtml(text), "plain");
    }
  }

  async function handleReadClipboard() {
    if (!navigator.clipboard) {
      toast.error("当前浏览器不支持直接读取剪贴板，请点输入框后粘贴");
      return;
    }
    try {
      if ("read" in navigator.clipboard) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes("text/html")) {
            const blob = await item.getType("text/html");
            applyCapturedHtml(await blob.text(), "rich");
            return;
          }
        }
      }
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("剪贴板里没有可读取文字");
      applyCapturedHtml(plainTextToHtml(text), "plain");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `读取失败：${err.message}。也可以直接点输入框后粘贴。`
          : "读取失败。也可以直接点输入框后粘贴。"
      );
    }
  }

  function handleReplaceQrImage() {
    const sourceHtml = capturedHtml || currentTemplate?.html || "";
    const result = replaceLikelyQrImage(sourceHtml);
    if (!result.replaced) {
      toast.error("没有找到可替换的疑似二维码图片");
      return;
    }
    setCapturedHtml(result.html);
    setImageReport(result.report);
    if (editorRef.current) {
      editorRef.current.innerHTML = result.html;
    }
    toast.success("已用本地企业微信二维码替换疑似二维码");
  }

  function handleSave() {
    const html = capturedHtml.trim();
    if (!html) {
      toast.error("请先粘贴并读取一个公众号模块");
      return;
    }
    if (displayedImageReport.blockedWechatImages > 0) {
      toast.warning("模板里仍有微信外链图片，保存后这些图片可能不可见");
    }
    setTemplate(slot, {
      html,
      capturedAt: new Date().toISOString(),
      sourceLabel: meta.label,
    });
    toast.success(`已保存为${meta.label}`);
  }

  function handleReset() {
    clearTemplate(slot);
    if (editorRef.current) editorRef.current.innerHTML = "";
    setCapturedHtml("");
    setPasteMode(null);
    toast.success(`已恢复系统默认${meta.label}`);
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
              JOTO小信 · 公众号模板采集
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              复制秀米模块，保存成官方排版
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              从秀米或公众号编辑器里复制一整块模块，粘贴到这里。系统会尽量保留原始 HTML、动效、二维码和内联样式。
            </p>
          </div>

          <div className="rounded-lg border border-[#d2d2d7]/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-900">保存位置</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(Object.keys(SLOT_META) as WechatTemplateSlot[]).map(
                    (item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setSlot(item);
                          setCapturedHtml("");
                          setPasteMode(null);
                          setImageReport(EMPTY_IMAGE_REPORT);
                          if (editorRef.current) editorRef.current.innerHTML = "";
                        }}
                        className={
                          slot === item
                            ? "rounded-lg border border-[#0071e3] bg-[#f5faff] px-4 py-3 text-left shadow-[0_0_0_3px_rgba(0,113,227,0.12)]"
                            : "rounded-lg border border-[#d2d2d7] bg-white px-4 py-3 text-left transition hover:border-slate-400 hover:bg-[#fbfbfd]"
                        }
                      >
                        <span className="block text-sm font-semibold text-slate-950">
                          {SLOT_META[item].label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {item === "followHeader"
                            ? formatCapturedAt(followHeader?.capturedAt)
                            : formatCapturedAt(contactFooter?.capturedAt)}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-800">
                <div className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>
                    {meta.desc}
                    <br />
                    {currentTemplate ? "已有自定义模板，保存后会覆盖。" : meta.empty}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-900">
                    粘贴采集区
                  </span>
                  <button
                    type="button"
                    onClick={handleReadClipboard}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-[#fbfbfd]"
                  >
                    <ClipboardPaste className="h-4 w-4 text-[#0071e3]" />
                    读取剪贴板
                  </button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onPaste={handlePaste}
                  onInput={(event) => {
                    const html = event.currentTarget.innerHTML;
                    const sanitized = sanitizeCapturedHtml(html);
                    setCapturedHtml(sanitized);
                    setImageReport(analyzeCapturedImages(sanitized));
                    setPasteMode("rich");
                  }}
                  className="min-h-[300px] overflow-auto rounded-lg border border-dashed border-[#b8c6d9] bg-white px-4 py-4 text-sm leading-6 text-slate-800 outline-none transition empty:before:text-slate-400 focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/15"
                  aria-label="粘贴公众号富文本模块"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  推荐方式：在秀米/公众号编辑器里选中整块模块，复制，然后点这里粘贴。
                  {pasteMode === "plain" ? " 当前只读到纯文本，格式会少很多。" : null}
                </p>
                {displayedImageReport.blockedWechatImages > 0 ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
                    <div className="flex gap-2">
                      <ImageOff className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="space-y-2">
                        <p>
                          检测到 {displayedImageReport.blockedWechatImages} 张微信外链图片。
                          这类图片离开微信编辑器后会显示“未经允许不可引用”，不是排版坏了。
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleReplaceQrImage}
                            className="rounded-md border border-amber-300 bg-white px-2.5 py-1.5 font-medium text-amber-900 transition hover:border-amber-400 hover:bg-amber-100"
                          >
                            替换疑似二维码
                          </button>
                          <span className="py-1.5 text-amber-800">
                            装饰图建议从秀米重新复制 SVG/HTML，或用系统默认 SVG 模块。
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!capturedHtml.trim()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white shadow-[0_2px_10px_rgba(0,113,227,0.2)] transition-colors hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  保存为当前官方模板
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d2d2d7] bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:border-slate-400 hover:bg-[#fbfbfd]"
                >
                  <RotateCcw className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  恢复系统默认
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#0071e3]">模块预览</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                {meta.label}
              </h2>
            </div>
            <span className="rounded-lg border border-[#d2d2d7] bg-white px-2.5 py-1.5 text-xs text-slate-500">
              {capturedHtml ? "待保存预览" : currentTemplate ? "已保存模板" : "系统默认"}
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <iframe
              title="公众号模板预览"
              srcDoc={previewHtml}
              className="block h-[620px] w-full bg-white"
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
