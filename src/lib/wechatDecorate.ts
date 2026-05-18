import {
  type WechatTheme,
  type ThemePalette,
  getThemePalette,
} from "./wechatThemes";

export const LIST_EMOJIS = ["✅", "📌", "💡", "🔹", "⭐"];

export const CALLOUT_KEYWORDS = [
  "重点",
  "核心",
  "关键",
  "注意",
  "提示",
  "总结",
  "亮点",
];

/* ---------- 1. Section heading transform ---------- */

/**
 * Replace `<h2>Title</h2>` with a themed banner block.
 *
 * - polished: Blue gradient banner with "PART 01" badge + title
 * - vibrant:  Orange gradient banner with "PART 01" badge + title
 * - minimal:  Left-border block (no structural change, CSS handles it)
 */
export function decorateHeadings(
  html: string,
  theme: WechatTheme
): string {
  if (theme === "minimal") return html;

  const p = getThemePalette(theme);
  let idx = 0;

  return html.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_match, title: string) => {
    idx++;
    const num = String(idx).padStart(2, "0");
    return buildSectionBanner(num, title.trim(), p);
  });
}

function buildSectionBanner(
  num: string,
  title: string,
  p: ThemePalette
): string {
  // Table-cell layout for the PART badge + title — confirmed working in WeChat
  return `<section style="margin: 36px 0 18px; padding: 0; box-sizing: border-box;">
<section style="margin: 0; padding: 0; box-sizing: border-box; background: linear-gradient(135deg, ${p.accent}, ${p.accentEnd}); border-radius: 12px; overflow: hidden; display: table; width: 100%;">
<section style="margin: 0; padding: 14px 16px; box-sizing: border-box; display: table-cell; width: 66px; white-space: nowrap; vertical-align: middle; text-align: center; border-right: 1px solid rgba(255,255,255,0.22);">
<span style="margin: 0; padding: 0; font-size: 9px; font-weight: 800; letter-spacing: 2.5px; color: rgba(255,255,255,0.7); text-transform: uppercase; display: block; line-height: 1;">PART</span>
<span style="margin: 2px 0 0; padding: 0; font-size: 22px; font-weight: 900; color: #fff; line-height: 1.1; letter-spacing: -1px; display: block;">${num}</span>
</section>
<section style="margin: 0; padding: 14px 18px; box-sizing: border-box; display: table-cell; vertical-align: middle;">
<h2 style="margin: 0; padding: 0; font-size: 18px; font-weight: 900; color: #fff; letter-spacing: -0.2px; line-height: 1.35; background: none;">${title}</h2>
</section>
</section>
</section>`;
}

/* ---------- 2. Keyword highlight ---------- */

/**
 * Wrap `<strong>text</strong>` in a themed inline highlight span.
 * Mimics the style seen in real WeChat articles:
 * colored text + semi-transparent gradient background + border-radius.
 */
export function highlightStrong(
  html: string,
  theme: WechatTheme
): string {
  if (theme === "minimal") return html;

  const p = getThemePalette(theme);
  const bg =
    theme === "vibrant"
      ? p.highlightBg // already a gradient string
      : p.highlightBg; // solid color for polished

  return html.replace(
    /<strong>([\s\S]*?)<\/strong>/gi,
    (_match, text: string) =>
      `<span style="padding: 2px 8px; color: ${p.highlightText}; background: ${bg}; border-radius: 4px; font-weight: 700; letter-spacing: 0.3px;">${text}</span>`
  );
}

/* ---------- 3. List emoji injection ---------- */

export function injectListEmojis(html: string): string {
  let idx = 0;
  return html.replace(/<li>(?!\s*[\u{1F000}-\u{1FFFF}☀-➿⭐✅\u{1F4CC}\u{1F4A1}\u{1F539}])/gu, () => {
    const emoji = LIST_EMOJIS[idx % LIST_EMOJIS.length];
    idx++;
    return `<li>${emoji} `;
  });
}

/* ---------- 4. Callout promotion ---------- */

export function promoteCallouts(
  html: string,
  theme: WechatTheme = "minimal"
): string {
  const p = getThemePalette(theme);

  return html.replace(
    /<p>((?:重点|核心|关键|注意|提示|总结|亮点)[：:].+?)<\/p>/g,
    (_match, content: string) =>
      `<blockquote style="border-left: 4px solid ${p.quoteBorder}; padding: 12px 16px; margin: 16px 0; color: ${p.quoteText}; background-color: ${p.quoteBg}; font-style: normal; border-radius: 0 8px 8px 0;"><p style="margin: 0;">${content}</p></blockquote>`
  );
}

/* ---------- 5. Paragraph styling ---------- */

/**
 * Style plain `<p>` tags with proper line-height and spacing.
 * The first `<p>` immediately after a section banner or `<h2>` gets a
 * "lead paragraph" accent (left border + slightly larger text) to visually
 * separate it from subsequent body paragraphs.
 */
export function styleParagraphs(
  html: string,
  theme: WechatTheme
): string {
  if (theme === "minimal") return html;

  const p = getThemePalette(theme);

  const baseStyle = `margin: 16px 0; line-height: 2; font-size: 15px; color: ${p.text}; letter-spacing: 0.5px;`;
  const leadStyle = `margin: 16px 0; line-height: 2; font-size: 15px; color: ${p.text}; letter-spacing: 0.5px; padding-left: 14px; border-left: 3px solid ${p.accentLight};`;

  // Track whether the previous element was a heading/banner so we can
  // style the first <p> after it as a "lead" paragraph.
  let afterHeading = false;
  return html.replace(
    /(<(?:h2[^>]*>|section style="margin: 36px)[^]*?(?:<\/h2>|<\/section>\s*<\/section>\s*<\/section>))|(<p(?!\s+style)>)/gi,
    (match, headingBlock?: string) => {
      if (headingBlock) {
        afterHeading = true;
        return match; // pass through unchanged
      }
      // It's a plain <p> tag
      if (afterHeading) {
        afterHeading = false;
        return `<p style="${leadStyle}">`;
      }
      return `<p style="${baseStyle}">`;
    }
  );
}

/* ---------- 5b. Auto-highlight numbers/data ---------- */

/**
 * Automatically wrap standalone numbers, percentages, and data points
 * within `<p>` content in accent-colored spans.
 * Matches: "70%", "120 人日", "4.7 小时", "1,400 个", "98.2%", "11 秒"
 * Does NOT match numbers inside HTML attributes or already-styled spans.
 */
export function highlightNumbers(
  html: string,
  theme: WechatTheme
): string {
  if (theme === "minimal") return html;

  const p = getThemePalette(theme);

  // Only process text content inside <p> tags (not attributes)
  return html.replace(
    /(<p[^>]*>)([\s\S]*?)(<\/p>)/gi,
    (_match, open: string, content: string, close: string) => {
      const highlighted = content.replace(
        /(?<![#\w])(\d[\d,.]*\s*(?:%|％|人日|小时|分钟|秒|天|周|个|家|条|项|倍|万|亿|次|篇|位|步|张|元|美元))/g,
        `<span style="color: ${p.accent}; font-weight: 700;">$1</span>`
      );
      return open + highlighted + close;
    }
  );
}

/* ---------- 5c. Colon-prefix styling ---------- */

/**
 * Detect Chinese colon-prefixed items within paragraphs
 * (e.g. "行前：xxx", "机会：xxx", "第一步，xxx") and bold+color the prefix.
 * Only matches at the START of a paragraph's text content.
 */
export function styleColonPrefixes(
  html: string,
  theme: WechatTheme
): string {
  if (theme === "minimal") return html;

  const p = getThemePalette(theme);

  return html.replace(
    /(<p[^>]*>)([一-鿿\w]{2,8}[：:，])/g,
    (_match, open: string, prefix: string) =>
      `${open}<span style="color: ${p.accent}; font-weight: 700;">${prefix}</span>`
  );
}

/* ---------- 6. Subtitle (h3) decoration ---------- */

/**
 * Style `<h3>` elements with a themed accent indicator.
 * polished: blue left border + text
 * vibrant:  orange dot + colored text
 * minimal:  no change (CSS handles it)
 */
export function decorateSubtitles(
  html: string,
  theme: WechatTheme
): string {
  if (theme === "minimal") return html;

  const p = getThemePalette(theme);

  if (theme === "polished") {
    return html.replace(
      /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
      (_match, title: string) =>
        `<h3 style="margin: 24px 0 12px; font-size: 17px; font-weight: 800; color: ${p.subtitleColor}; padding-left: 12px; border-left: 3px solid ${p.accent}; line-height: 1.4;">${title.trim()}</h3>`
    );
  }

  // vibrant: colored dot prefix
  return html.replace(
    /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
    (_match, title: string) =>
      `<h3 style="margin: 24px 0 12px; font-size: 17px; font-weight: 800; color: ${p.subtitleColor}; line-height: 1.4;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${p.accent}; margin-right: 8px; vertical-align: middle;"></span>${title.trim()}</h3>`
  );
}

/* ---------- 7. Blockquote styling ---------- */

/**
 * Style existing `<blockquote>` elements that don't already have inline styles.
 * (promoteCallouts creates styled blockquotes from keyword paragraphs;
 * this handles blockquotes that came from the LLM's markdown `>` syntax.)
 */
export function styleBlockquotes(
  html: string,
  theme: WechatTheme
): string {
  if (theme === "minimal") return html;

  const p = getThemePalette(theme);

  return html.replace(
    /<blockquote(?!\s+style)>/g,
    `<blockquote style="border-left: 4px solid ${p.quoteBorder}; padding: 12px 16px; margin: 16px 0; color: ${p.quoteText}; background-color: ${p.quoteBg}; font-style: normal; border-radius: 0 8px 8px 0;">`
  );
}

/* ---------- 8. Section divider ---------- */

/**
 * Insert a styled divider `<hr>` before each `<h2` or section banner
 * (except the first one) to visually separate major sections.
 */
export function insertSectionDividers(
  html: string,
  theme: WechatTheme
): string {
  const p = getThemePalette(theme);
  const divider =
    theme === "minimal"
      ? `<hr style="border: none; border-top: 1px solid #eee; margin: 28px 0;">`
      : `<hr style="border: none; height: 3px; background: linear-gradient(to right, ${p.accent}, rgba(${hexToRgb(p.accent)},0.1)); margin: 32px 0; border-radius: 2px;">`;

  // Match either raw <h2 (without inline style — those are untransformed)
  // or the decorated outer <section with PART banner.
  // Excludes <h2 style="..."> inside banners (created by decorateHeadings).
  let first = true;
  return html.replace(
    /(?=<(?:h2(?!\s+style)|section style="margin: 36px))/gi,
    (match) => {
      if (first) {
        first = false;
        return match;
      }
      return divider + match;
    }
  );
}

/* ---------- 9. Image placeholders ---------- */

/**
 * Insert a styled image placeholder after the first block-level element
 * (paragraph, list, or blockquote) following each `<h2>` or section banner.
 * The placeholder is a dashed-border box with an icon and hint text,
 * designed for the operations team to replace with actual images.
 *
 * When `theme` is "minimal", a simpler gray placeholder is used.
 */
export function insertImagePlaceholders(
  html: string,
  theme: WechatTheme
): string {
  const p = getThemePalette(theme);

  const placeholder = theme === "minimal"
    ? `<section style="width: 100%; min-height: 100px; border: 2px dashed #ddd; border-radius: 8px; text-align: center; padding: 20px 16px; margin: 18px 0; color: #bbb; font-size: 13px; background-color: #fafafa; box-sizing: border-box;">🖼️ 配图占位 — 建议插入与本节相关的图片</section>`
    : `<section style="width: 100%; min-height: 100px; border: 2px dashed ${p.accentLight}; border-radius: 12px; text-align: center; padding: 20px 16px; margin: 18px 0; color: ${p.textMuted}; font-size: 13px; background: linear-gradient(135deg, ${p.accentLight}, rgba(255,255,255,0.6)); box-sizing: border-box;">🖼️ 配图占位 — 建议插入与本节相关的图片</section>`;

  // Strategy: find each section boundary (h2 or PART banner), then insert
  // the placeholder after the first block-level element that follows it.
  // We split at section boundaries and process each chunk.

  // Match section boundaries: either decorated PART banner or raw <h2>
  const sectionPattern = /(<(?:section style="margin: 36px)[^]*?<\/section>\s*<\/section>\s*<\/section>|<h2[^>]*>[^]*?<\/h2>)/gi;

  let matchResult: RegExpExecArray | null;

  // Collect all section heading positions
  const headings: Array<{ start: number; end: number; match: string }> = [];
  while ((matchResult = sectionPattern.exec(html)) !== null) {
    headings.push({
      start: matchResult.index,
      end: matchResult.index + matchResult[0].length,
      match: matchResult[0],
    });
  }

  if (headings.length === 0) return html;

  // For each heading, find the first block element after it and insert placeholder after that block
  let result = html;
  let offset = 0; // track insertion offset

  for (const heading of headings) {
    const afterHeading = heading.end + offset;
    const remaining = result.substring(afterHeading);

    // Find the end of the first block element after the heading
    const firstBlockEnd = remaining.match(
      /<\/(?:p|ul|ol|blockquote)>/i
    );

    if (firstBlockEnd && firstBlockEnd.index !== undefined) {
      const insertPos = afterHeading + firstBlockEnd.index + firstBlockEnd[0].length;
      result = result.substring(0, insertPos) + "\n" + placeholder + result.substring(insertPos);
      offset += placeholder.length + 1; // +1 for the newline
    }
  }

  return result;
}

/* ---------- 10. Main entry ---------- */

export interface DecorateOptions {
  theme?: WechatTheme;
  headings?: boolean;
  subtitles?: boolean;
  highlights?: boolean;
  numbers?: boolean;
  colonPrefixes?: boolean;
  emojis?: boolean;
  callouts?: boolean;
  blockquotes?: boolean;
  paragraphs?: boolean;
  dividers?: boolean;
  imagePlaceholders?: boolean;
}

const DEFAULT_OPTIONS: Required<DecorateOptions> = {
  theme: "minimal",
  headings: true,
  subtitles: true,
  highlights: true,
  numbers: true,
  colonPrefixes: true,
  emojis: true,
  callouts: true,
  blockquotes: true,
  paragraphs: true,
  dividers: true,
  imagePlaceholders: false,
};

export function decorateHtml(
  html: string,
  options?: DecorateOptions
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const theme = opts.theme ?? "minimal";
  let result = html;

  // Order matters: structural transforms first, then inline, then spacing
  if (opts.headings) result = decorateHeadings(result, theme);
  if (opts.subtitles) result = decorateSubtitles(result, theme);
  if (opts.highlights) result = highlightStrong(result, theme);
  if (opts.emojis) result = injectListEmojis(result);
  if (opts.callouts) result = promoteCallouts(result, theme);
  if (opts.blockquotes) result = styleBlockquotes(result, theme);
  if (opts.paragraphs) result = styleParagraphs(result, theme);
  // Number highlight + colon-prefix AFTER paragraph styling (they operate on <p> inner text)
  if (opts.numbers) result = highlightNumbers(result, theme);
  if (opts.colonPrefixes) result = styleColonPrefixes(result, theme);
  if (opts.dividers) result = insertSectionDividers(result, theme);
  // Image placeholders last — they insert after first block in each section
  if (opts.imagePlaceholders) result = insertImagePlaceholders(result, theme);

  return result;
}

/* ---------- Helpers ---------- */

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "0,0,0";
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}
