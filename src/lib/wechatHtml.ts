import juice from "juice";
import {
  aigcMetaTag,
  buildAigcMetadata,
  AIGC_EXPLICIT_NOTICE_HTML,
  type AigcMetadata,
} from "./aigcMeta";

/**
 * Phase 6 will call exportWechatHtml() to produce a copy-pasteable HTML
 * blob for the WeChat Official Account editor. Responsibilities:
 *
 * 1. Take TipTap's getHTML() output (body fragment, no <html>/<head>)
 * 2. Inline all styles via juice (WeChat strips external <style> tags)
 * 3. Wrap in a minimal document with <head> containing the AIGC meta tag
 * 4. Optionally append the explicit AIGC disclosure paragraph
 *
 * For Phase 3a we ship the core functions + unit tests.
 * Phase 6 will add image URL rewriting and the UI surface.
 */

export interface ExportWechatHtmlArgs {
  bodyHtml: string;
  title: string;
  /** Optional cover image URL — rendered as a banner above the title. */
  coverUrl?: string;
  /** Byline author name — rendered as muted text below title. */
  author?: string;
  /** ISO timestamp — rendered next to author. */
  publishedAt?: string;
  meta?: AigcMetadata;
  addExplicitNotice?: boolean;
  /**
   * CSS to inline into the body. Caller can pass a theme stylesheet.
   * If omitted, a conservative default style is used.
   */
  css?: string;
}

const DEFAULT_CSS = `
body { font-family: -apple-system, "PingFang SC", sans-serif; line-height: 1.75; color: #222; margin: 0; padding: 24px; max-width: 720px; }
.joto-cover { width: 100%; height: auto; border-radius: 8px; margin-bottom: 18px; display: block; }
h1 { font-size: 22px; margin: 0 0 8px; line-height: 1.4; }
.joto-byline { color: #888; font-size: 13px; margin: 0 0 20px; }
h2 { font-size: 18px; margin: 28px 0 12px; }
h3 { font-size: 16px; margin: 20px 0 8px; }
p { margin: 0 0 14px; font-size: 15px; }
ul, ol { margin: 0 0 14px; padding-left: 24px; }
li { margin-bottom: 6px; }
blockquote { border-left: 3px solid #ddd; padding-left: 12px; margin: 14px 0; color: #555; }
img { max-width: 100%; height: auto; border-radius: 4px; }
`;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function exportWechatHtml(args: ExportWechatHtmlArgs): string {
  const meta = args.meta ?? buildAigcMetadata();
  const title = escapeHtml(args.title);
  const notice = args.addExplicitNotice ? AIGC_EXPLICIT_NOTICE_HTML : "";
  const css = args.css ?? DEFAULT_CSS;

  const cover = args.coverUrl
    ? `<img class="joto-cover" src="${escapeAttr(args.coverUrl)}" alt="${title}">`
    : "";

  const bylineParts: string[] = [];
  if (args.author) bylineParts.push(escapeHtml(args.author));
  if (args.publishedAt) {
    const formatted = formatDate(args.publishedAt);
    if (formatted) bylineParts.push(formatted);
  }
  const byline =
    bylineParts.length > 0
      ? `<p class="joto-byline">${bylineParts.join(" · ")}</p>`
      : "";

  const raw = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
${aigcMetaTag(meta)}
<style>${css}</style>
</head>
<body>
${cover}
<h1>${title}</h1>
${byline}
${args.bodyHtml}
${notice}
</body>
</html>`;

  return juice(raw, {
    removeStyleTags: true,
    preserveMediaQueries: false,
  });
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
