/**
 * AIGC 元数据 (国家法规 2025/3 强制要求)
 * - 隐式标识:HTML 文件 <head> 里嵌入含 "AIGC" 字段名的 meta
 * - 显式标识:用户可选在文末添加"本文由 AI 辅助创作"声明
 */

export interface AigcMetadata {
  producer: string;
  type: "aigc";
  generatedAt: string; // ISO 8601
  model: string;
  articleId?: string;
  humanReviewed: boolean;
  version: string;
}

export interface BuildAigcArgs {
  articleId?: string;
  model?: string;
  generatedAt?: Date | string;
  humanReviewed?: boolean;
}

export const AIGC_VERSION = "1.0";
export const AIGC_PRODUCER = "JOTO 内容工厂";

export function buildAigcMetadata(args: BuildAigcArgs = {}): AigcMetadata {
  const now = args.generatedAt ?? new Date();
  const iso =
    typeof now === "string" ? now : new Date(now).toISOString();
  return {
    producer: AIGC_PRODUCER,
    type: "aigc",
    generatedAt: iso,
    model: args.model ?? "qwen-plus",
    articleId: args.articleId,
    humanReviewed: args.humanReviewed ?? false,
    version: AIGC_VERSION,
  };
}

export const AIGC_META_TAG_NAME = "AIGC";

/**
 * Serialize metadata into an HTML <meta> tag suitable for <head>.
 * The tag name MUST contain the literal string "AIGC" (regulatory requirement).
 */
export function aigcMetaTag(meta: AigcMetadata): string {
  const escaped = JSON.stringify(meta).replace(/"/g, "&quot;");
  return `<meta name="${AIGC_META_TAG_NAME}" content="${escaped}">`;
}

/**
 * Inject the AIGC meta tag into an HTML string.
 * - If <head>...</head> exists, insert just before </head>.
 * - Otherwise, prepend the tag (caller is responsible for wrapping in a full doc).
 * If a previous AIGC meta tag exists, replace it.
 */
export function injectAigcMeta(html: string, meta: AigcMetadata): string {
  const tag = aigcMetaTag(meta);
  // Replace existing
  const existingRegex = /<meta[^>]*name=["']AIGC["'][^>]*>/i;
  if (existingRegex.test(html)) {
    return html.replace(existingRegex, tag);
  }
  // Insert before </head>
  const headCloseRegex = /<\/head>/i;
  if (headCloseRegex.test(html)) {
    return html.replace(headCloseRegex, `${tag}\n</head>`);
  }
  return `${tag}\n${html}`;
}

/**
 * The optional human-readable disclosure appended to article body
 * when user opts in at Review step.
 */
export const AIGC_EXPLICIT_NOTICE_HTML = `<p class="joto-ai-notice" style="margin-top:32px;padding:12px 16px;border-radius:6px;background:#f1f5f9;color:#64748b;font-size:13px;">本文由 AI 辅助创作,经编辑审核后发布。</p>`;
