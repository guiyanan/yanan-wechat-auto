/**
 * Lightweight Markdown ↔ HTML converters.
 *
 * Pure functions, no third-party dependencies. Covers the subset of
 * Markdown that Qwen actually emits for WeChat article bodies:
 *
 *   - Headings: # / ## / ###
 *   - Paragraphs (blank-line separated)
 *   - Inline: **bold**, *italic*
 *   - Lists: `- item` (ul) and `1. item` (ol)
 *   - Blockquote: `> line`
 *   - Horizontal rule: `---`
 *   - Hard line break: trailing `  ` (two spaces) + newline → <br>
 *
 * Intentionally omits: tables, fenced code blocks, links, images, HTML
 * passthrough — they don't appear in the body pipeline output and would
 * bloat the implementation for no real-world coverage gain.
 */

// ─── Shared HTML escaping ────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Inline transformer ─────────────────────────────────────────────

/**
 * Apply inline transformations (**bold**, *italic*) to already-escaped text.
 * Operates per-paragraph so unclosed markers cannot swallow content across
 * blank-line boundaries.
 */
function renderInline(text: string): string {
  let out = text;
  // Bold first (greedier syntax: **…**)
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  // Italic (single * or _) — only match when there's actual content and no
  // surrounding word chars (avoids munging "5*6").
  out = out.replace(/(?<![\w*])\*([^*\n]+?)\*(?!\w)/g, "<em>$1</em>");
  // Hard line breaks: "  \n" within a paragraph
  out = out.replace(/ {2,}\n/g, "<br>");
  return out;
}

// ─── markdownToHtml ──────────────────────────────────────────────────

/**
 * Convert a Markdown string into HTML.
 *
 * Parses block by block, grouping consecutive list items and blockquote
 * lines together so each `<ul>` / `<ol>` / `<blockquote>` wraps all
 * adjacent siblings.
 */
export function markdownToHtml(md: string): string {
  // Normalise CRLF
  let normalised = md.replace(/\r\n/g, "\n");

  // Qwen sometimes glues a heading onto the end of the previous paragraph,
  // e.g. "...前段结尾。 ## 下一标题" with just one space. Promote those
  // inline `#{1,3} ` markers to block-level by injecting a blank line
  // before them. The `#{1,3}\s` form (with the trailing space) ensures we
  // don't break tokens like `C#` or `#1` that have no space after.
  normalised = normalised.replace(
    /([^\n])[ \t]+(#{1,3}[ \t])/g,
    "$1\n\n$2"
  );

  // Tokenise into blocks separated by blank lines
  const blocks = normalised.split(/\n{2,}/);
  const html: string[] = [];

  for (const block of blocks) {
    // NOTE: don't strip trailing whitespace globally here — paragraph
    // handling below uses the markdown convention of "2 trailing spaces +
    // newline = <br>". Each non-paragraph block type does its own .trim()
    // before consuming the content, so leftover ws in headings/lists is
    // harmless.
    if (!block.trim()) continue;

    const lines = block.split("\n");
    const first = lines[0].trim();

    // Horizontal rule
    if (/^---+$/.test(first) && lines.length === 1) {
      html.push("<hr>");
      continue;
    }

    // Heading
    if (first.startsWith("### ")) {
      html.push(`<h3>${renderInline(escapeHtml(first.slice(4).trim()))}</h3>`);
      continue;
    }
    if (first.startsWith("## ")) {
      html.push(`<h2>${renderInline(escapeHtml(first.slice(3).trim()))}</h2>`);
      continue;
    }
    if (first.startsWith("# ")) {
      html.push(`<h1>${renderInline(escapeHtml(first.slice(2).trim()))}</h1>`);
      continue;
    }

    // Unordered list — every line in block starts with "- " or "* "
    if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
      const items = lines
        .map((l) => l.trim().replace(/^[-*]\s+/, ""))
        .map((item) => `<li>${renderInline(escapeHtml(item))}</li>`)
        .join("");
      html.push(`<ul>${items}</ul>`);
      continue;
    }

    // Ordered list — every line starts with "N. "
    if (lines.every((l) => /^\d+\.\s+/.test(l.trim()))) {
      const items = lines
        .map((l) => l.trim().replace(/^\d+\.\s+/, ""))
        .map((item) => `<li>${renderInline(escapeHtml(item))}</li>`)
        .join("");
      html.push(`<ol>${items}</ol>`);
      continue;
    }

    // Blockquote — every line starts with "> "
    if (lines.every((l) => /^>\s?/.test(l.trim()))) {
      const inner = lines
        .map((l) => l.trim().replace(/^>\s?/, ""))
        .join(" ");
      html.push(
        `<blockquote><p>${renderInline(escapeHtml(inner))}</p></blockquote>`
      );
      continue;
    }

    // Default: paragraph. Preserve internal soft line breaks as <br> by
    // joining with explicit \n, then letting renderInline turn "  \n"
    // into <br>. Lines without the 2-space marker stay separated by space.
    const para = lines
      .map((l) => l.replace(/[ \t]+$/, "  ")) // canonicalise — if line has trailing ws, keep as br marker
      .map((l, i) => (i === lines.length - 1 ? l.trimEnd() : l))
      .join("\n");
    // Lines that don't end in 2-spaces get joined with a single space below
    // (after escape), the bare "\n" then turned into " "
    const escaped = escapeHtml(para);
    const withBreaks = renderInline(escaped).replace(/\n/g, " ");
    html.push(`<p>${withBreaks}</p>`);
  }

  return html.join("\n");
}

// ─── Block-level parser (for structure-preserving humanize) ─────────

export type MdBlockType =
  | "heading"
  | "paragraph"
  | "list"
  | "blockquote"
  | "hr";

export interface MdBlock {
  type: MdBlockType;
  /** Original markdown text of the block (loss-less, suitable for re-emit). */
  raw: string;
}

/**
 * Split a markdown document into typed blocks while preserving original
 * source per block.
 *
 * Used by the humanize pipeline's structure-preserving mode: paragraph
 * blocks get sent to the LLM for rewrite, every other block type passes
 * through untouched so headings / lists / blockquotes / hrs stay exactly
 * as they were when the user generated the article.
 */
export function parseMarkdownBlocks(md: string): MdBlock[] {
  // Apply the same inline-heading promotion as `markdownToHtml` so a
  // run-on `... ## 标题` gets split into its own heading block instead of
  // being misclassified as part of the previous paragraph.
  const normalised = md
    .replace(/\r\n/g, "\n")
    .replace(/([^\n])[ \t]+(#{1,3}[ \t])/g, "$1\n\n$2");

  const result: MdBlock[] = [];
  for (const rawBlock of normalised.split(/\n{2,}/)) {
    if (!rawBlock.trim()) continue;
    const lines = rawBlock.split("\n");
    const firstTrimmed = lines[0].trim();

    if (/^---+$/.test(firstTrimmed) && lines.length === 1) {
      result.push({ type: "hr", raw: rawBlock });
      continue;
    }
    if (/^#{1,3}\s/.test(firstTrimmed)) {
      result.push({ type: "heading", raw: rawBlock });
      continue;
    }
    if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
      result.push({ type: "list", raw: rawBlock });
      continue;
    }
    if (lines.every((l) => /^\d+\.\s+/.test(l.trim()))) {
      result.push({ type: "list", raw: rawBlock });
      continue;
    }
    if (lines.every((l) => /^>\s?/.test(l.trim()))) {
      result.push({ type: "blockquote", raw: rawBlock });
      continue;
    }
    result.push({ type: "paragraph", raw: rawBlock });
  }
  return result;
}

/**
 * Reassemble blocks into a markdown string, separating each with a blank
 * line. Effectively the inverse of `parseMarkdownBlocks`.
 */
export function joinMarkdownBlocks(blocks: readonly MdBlock[]): string {
  return blocks.map((b) => b.raw).join("\n\n");
}

// ─── htmlToMarkdown ──────────────────────────────────────────────────

/**
 * Convert HTML back into Markdown.
 *
 * Only handles the inverse of what `markdownToHtml` produces (h1-h3, p,
 * strong/b, em/i, ul/ol/li, blockquote, br, hr). Anything unrecognised
 * is unwrapped — the inner text survives, the tag is dropped.
 *
 * This is the bridge used by the humanize pipeline so we can run the
 * LLM rewrite on Markdown (preserving structure) instead of stripping
 * the HTML to plain text and losing formatting.
 */
export function htmlToMarkdown(html: string): string {
  let out = html;

  // Normalise self-closing variants and casing
  out = out.replace(/<br\s*\/?>/gi, "  \n");
  out = out.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  // Inline emphasis
  out = out.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**");
  out = out.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*");

  // Headings
  out = out.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n");
  out = out.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n");
  out = out.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n");

  // Lists — handle ul/ol with their li children
  out = out.replace(
    /<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    (_match, inner: string) => {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(
        (m) => `- ${m[1].trim()}`
      );
      return "\n\n" + items.join("\n") + "\n\n";
    }
  );
  out = out.replace(
    /<ol[^>]*>([\s\S]*?)<\/ol>/gi,
    (_match, inner: string) => {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(
        (m, i) => `${i + 1}. ${m[1].trim()}`
      );
      return "\n\n" + items.join("\n") + "\n\n";
    }
  );

  // Blockquote
  out = out.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_match, inner: string) => {
      // Strip inner <p> tags before splitting lines
      const text = inner
        .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
        .replace(/<p[^>]*>|<\/p>/gi, "")
        .trim();
      const quoted = text
        .split("\n")
        .map((l) => `> ${l.trim()}`)
        .join("\n");
      return "\n\n" + quoted + "\n\n";
    }
  );

  // Paragraphs
  out = out.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n");

  // Strip any leftover tags
  out = out.replace(/<\/?[a-z][^>]*>/gi, "");

  // Decode common entities
  out = out
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Collapse 3+ consecutive newlines down to 2
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}
