import juice from "juice";
import {
  aigcMetaTag,
  buildAigcMetadata,
  AIGC_EXPLICIT_NOTICE_HTML,
  type AigcMetadata,
} from "./aigcMeta";
import { type WechatTheme, getThemeCss } from "./wechatThemes";
import { decorateHtml } from "./wechatDecorate";

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
  /** Named theme — overrides `css` when provided. */
  theme?: WechatTheme;
  /** Run decoration pass (SVG list icons, callout promotion). Default false. */
  decorate?: boolean;
  /**
   * Optional captured official-account furniture. These are trusted snippets
   * collected from the user's own WeChat/Xiumi template and already sanitized
   * on capture. They override the built-in JOTO header/footer.
   */
  jotoFollowHeaderHtml?: string;
  jotoContactFooterHtml?: string;
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
  const css = args.theme ? getThemeCss(args.theme) : (args.css ?? DEFAULT_CSS);
  const useJotoFurniture = args.theme === "joto" && Boolean(args.decorate);
  const bodyContent = args.decorate
    ? decorateHtml(args.bodyHtml, {
        theme: args.theme ?? "minimal",
        imagePlaceholders: args.theme === "joto",
      })
    : args.bodyHtml;

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
  const jotoFollowHeader = useJotoFurniture
    ? args.jotoFollowHeaderHtml?.trim() || buildJotoFollowHeader()
    : "";
  const jotoContactFooter = useJotoFurniture
    ? args.jotoContactFooterHtml?.trim() || buildJotoContactFooter()
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
<section class="joto-article-shell">
${cover}
<h1>${title}</h1>
${byline}
${jotoFollowHeader}
${bodyContent}
${jotoContactFooter}
${notice}
</section>
</body>
</html>`;

  return juice(raw, {
    removeStyleTags: true,
    preserveMediaQueries: false,
  });
}

function buildJotoFollowHeader(): string {
  return `
<section class="joto-follow-header" style="margin: 28px auto 34px; text-align: center; box-sizing: border-box;">
  <section style="display: table; margin: 0 auto 14px; text-align: center; box-sizing: border-box;">
    <span style="display: table-cell; vertical-align: middle; width: 90px;">${buildChevronSvg("right")}</span>
    <span style="display: table-cell; vertical-align: middle; padding: 0 18px; color: #456BB0; font-size: 22px; font-weight: 700; line-height: 1.4; white-space: nowrap;">点击蓝字 关注我们</span>
    <span style="display: table-cell; vertical-align: middle; width: 90px;">${buildChevronSvg("left")}</span>
  </section>
  <section style="margin: 0 auto 28px; text-align: center; line-height: 1;">
    ${buildHeartCircle("#3F75DE")}
    ${buildHeartCircle("#62A0F2")}
    ${buildHeartCircle("#C8E4F6")}
  </section>
  <section style="display: table; margin: 0 auto; padding: 16px 18px; background: #FFFFFF; text-align: center; box-sizing: border-box;">
    <span style="display: table-cell; vertical-align: middle; color: #111111; font-size: 38px; font-weight: 900; line-height: 1; letter-spacing: 0;">D<span style="color: #174CFF;">i</span>fy</span>
    <span style="display: table-cell; vertical-align: middle; width: 38px; text-align: center;"><span style="display: inline-block; width: 1px; height: 54px; background: #333333; vertical-align: middle;"></span></span>
    <span style="display: table-cell; vertical-align: middle; color: #1238FF; font-size: 34px; font-weight: 900; line-height: 1; letter-spacing: 0;">JOTO</span>
  </section>
</section>`;
}

function buildJotoContactFooter(): string {
  return `
<section class="joto-contact-footer" style="margin: 38px auto 6px; padding: 4px 0 0; text-align: center; box-sizing: border-box;">
  <section style="width: 100%; margin: 0 auto 8px; text-align: center; line-height: 1; box-sizing: border-box;">
    ${buildAnimatedDotDivider()}
  </section>
  <section style="margin: 0 auto 10px; text-align: center; line-height: 1;">
    ${buildAnimatedWaveSvg()}
  </section>
  <section style="display: table; width: 78%; max-width: 520px; margin: 0 auto 14px; box-sizing: border-box;">
    <section style="display: table-cell; width: 46%; vertical-align: top; text-align: center;">
      <section style="display: block; width: 180px; margin: 0 auto 16px; line-height: 1;">${buildEnterpriseWechatQrImage()}</section>
      <section style="display: table; width: 180px; margin: 0 auto 8px;">
        <span style="display: table-cell; width: 18px; vertical-align: middle;">${buildTriangleSvg("#4B79D9")}</span>
        <span style="display: table-cell; vertical-align: middle; border-top: 1px solid #C9C9C9; line-height: 0;">&nbsp;</span>
      </section>
      <span style="display: inline-block; padding: 2px 11px; background: #4B79D9; color: #FFFFFF; font-size: 20px; font-weight: 700; line-height: 1.35;">联系我们</span>
    </section>
    <section style="display: table-cell; width: 54%; vertical-align: middle; text-align: center; color: #3B3B3B;">
      <span style="display: inline-block; padding: 2px 8px; margin-bottom: 6px; background: #4B79D9; color: #FFFFFF; font-size: 20px; font-weight: 700; line-height: 1.35;">企业微信</span>
      <span style="display: block; margin-bottom: 14px; color: #3B3B3B; font-size: 20px; font-weight: 700; line-height: 1.35;">JOTO AI</span>
      <span style="display: inline-block; padding: 2px 8px; margin-bottom: 6px; background: #FFC44D; color: #FFFFFF; font-size: 20px; font-weight: 700; line-height: 1.35;">官方网站</span>
      <span style="display: block; margin-bottom: 26px; color: #3B3B3B; font-size: 18px; font-weight: 600; line-height: 1.35;">jotoai.com</span>
      <span style="display: block; color: #3B3B3B; font-size: 18px; line-height: 1.35;">jotoai@jototech.cn</span>
    </section>
  </section>
  <p style="margin: 20px 0 0; color: #5E9BF2; font-size: 22px; font-weight: 700; line-height: 1.5; text-align: center;">长按识别二维码 联系我们</p>
</section>`;
}

function buildChevronSvg(direction: "left" | "right"): string {
  const path =
    direction === "right"
      ? `<path d="M8 6 L28 28 L8 50"/><path d="M28 6 L48 28 L28 50"/><path d="M48 6 L68 28 L48 50"/>`
      : `<path d="M68 6 L48 28 L68 50"/><path d="M48 6 L28 28 L48 50"/><path d="M28 6 L8 28 L28 50"/>`;
  return `<svg width="78" height="56" viewBox="0 0 78 56" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;"><g stroke="#456BB0" stroke-width="6" stroke-linecap="square" stroke-linejoin="miter">${path}</g></svg>`;
}

function buildHeartCircle(color: string): string {
  return `<span style="display: inline-block; width: 40px; height: 40px; margin: 0 4px; border-radius: 50%; background: ${color}; text-align: center; line-height: 40px; vertical-align: middle;">
    <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; margin-top: 9px; vertical-align: top;">
      <path d="M12 20.2C7.9 16.6 5 14 5 10.8C5 8.6 6.7 7 8.8 7C10 7 11.2 7.6 12 8.6C12.8 7.6 14 7 15.2 7C17.3 7 19 8.6 19 10.8C19 14 16.1 16.6 12 20.2Z" fill="#FFFFFF"/>
    </svg>
  </span>`;
}

function buildAnimatedDotDivider(): string {
  return `<svg width="760" height="24" viewBox="0 0 760 24" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; width: 92%; max-width: 760px; vertical-align: middle;">
    <line x1="0" y1="12" x2="330" y2="12" stroke="#4B79D9" stroke-width="2"/>
    <line x1="430" y1="12" x2="760" y2="12" stroke="#4B79D9" stroke-width="2"/>
    <circle cx="370" cy="12" r="5.5" fill="#4B79D9" opacity="0.72"/>
    <circle cx="382" cy="12" r="5.5" fill="#4B79D9" opacity="0.72"/>
    <circle cx="394" cy="12" r="5.5" fill="#4B79D9" opacity="0.72"/>
    <circle cx="382" cy="12" r="6.2" fill="#3F75DE">
      <animate attributeName="cx" dur="2.4s" values="370;394;370" repeatCount="indefinite"/>
      <animate attributeName="opacity" dur="2.4s" values="0.55;1;0.55" repeatCount="indefinite"/>
    </circle>
  </svg>`;
}

function buildAnimatedWaveSvg(): string {
  return `<svg width="560" height="58" viewBox="0 0 560 58" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; width: 58%; max-width: 560px; vertical-align: middle;">
    <g>
      <path d="M6 30 C18 24 26 37 36 30 S52 20 64 30 S82 42 96 30 S112 12 126 30 S146 46 160 30 S180 18 194 30 S214 39 232 30 S248 27 262 30" fill="none" stroke="#9F9F9F" stroke-width="2" stroke-linecap="round">
        <animate attributeName="d" dur="2.8s" repeatCount="indefinite" values="M6 30 C18 24 26 37 36 30 S52 20 64 30 S82 42 96 30 S112 12 126 30 S146 46 160 30 S180 18 194 30 S214 39 232 30 S248 27 262 30;M6 30 C18 39 26 22 36 30 S52 43 64 30 S82 16 96 30 S112 45 126 30 S146 14 160 30 S180 42 194 30 S214 20 232 30 S248 34 262 30;M6 30 C18 24 26 37 36 30 S52 20 64 30 S82 42 96 30 S112 12 126 30 S146 46 160 30 S180 18 194 30 S214 39 232 30 S248 27 262 30"/>
      </path>
      <path d="M298 30 C314 27 328 37 342 30 S360 17 376 30 S396 45 412 30 S430 14 446 30 S466 42 482 30 S500 22 516 30 S536 39 554 30" fill="none" stroke="#9F9F9F" stroke-width="2" stroke-linecap="round">
        <animate attributeName="d" dur="2.8s" repeatCount="indefinite" values="M298 30 C314 27 328 37 342 30 S360 17 376 30 S396 45 412 30 S430 14 446 30 S466 42 482 30 S500 22 516 30 S536 39 554 30;M298 30 C314 36 328 23 342 30 S360 44 376 30 S396 15 412 30 S430 46 446 30 S466 18 482 30 S500 42 516 30 S536 20 554 30;M298 30 C314 27 328 37 342 30 S360 17 376 30 S396 45 412 30 S430 14 446 30 S466 42 482 30 S500 22 516 30 S536 39 554 30"/>
      </path>
    </g>
    <g transform="translate(264 9) scale(0.92)">
      <animateTransform attributeName="transform" type="scale" additive="sum" dur="1.25s" values="1;1.08;1" repeatCount="indefinite"/>
      <path d="M20 4H28V12H36V28H28V36H20V44H12V36H4V28H-4V12H4V4H12V12H20V4Z" fill="#FF2E5F" stroke="#111111" stroke-width="3" shape-rendering="crispEdges"/>
    </g>
  </svg>`;
}

function buildEnterpriseWechatQrImage(): string {
  return `<img class="rich_pages wxw-img" src="/joto-enterprise-wechat-qr.jpg" data-src="/joto-enterprise-wechat-qr.jpg" alt="JOTO 企业微信二维码" width="180" height="180" style="display: block; width: 180px; height: 180px; max-width: 100%; border: 0; border-radius: 0; margin: 0 auto;">`;
}

function buildTriangleSvg(color: string): string {
  return `<svg width="22" height="24" viewBox="0 0 22 24" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;"><path d="M11 0L22 20H0L11 0Z" fill="${color}"/></svg>`;
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
