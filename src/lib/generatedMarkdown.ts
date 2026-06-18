import type { ContentLength } from "@/types";

const EMOJI_LIST_MARKER =
  /^(\s*(?:[-*•]\s*)?)(?:[\u{1F000}-\u{1FFFF}☀-➿⭐✅📌💡🔹🔸▪️▫️]\s*)+/u;

const PREFACE_LINE =
  /^(?:(?:好的|以下是|下面是|当然可以|我来为你写).{0,60}|这是(?:一篇|为你生成的).{0,30})$/;
const GENERATED_TITLE_LINE = /^\s*(?:#{1,6}\s*)?标题\s*[：:].{1,80}$/;
const GENERATED_BARE_TITLE_LINE =
  /^\s*(?:#{1,6}\s*)?【[^】\n]{2,16}】[^\n]{8,120}$/;
const TITLE_PREFIX = /^\s*(?:#{1,6}\s*)?标题\s*[：:]\s*/;

function stripEmojiListMarker(line: string): string {
  return line.replace(EMOJI_LIST_MARKER, "$1");
}

const INTERNAL_PLANNING_LABEL =
  /^(\s*(?:#{1,6}\s*)?(?:(?:\d{1,2}|[一二三四五六七八九十]+)(?:[.、]\s*|\s+))?)(?:开头钩子|开篇钩子|开场钩子|钩子|开场|第一章|第二章|角度|事实点|图片建议|风险提示|写作方向|金句)\s*[：:]\s*/;

function stripInternalPlanningLabel(line: string): string {
  return line.replace(INTERNAL_PLANNING_LABEL, "$1");
}

function stripMarkdownNoise(line: string): string {
  return stripInternalPlanningLabel(stripEmojiListMarker(line))
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
    .replace(/__([^_\n]+?)__/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .trimEnd();
}

function normalizeGeneratedMarkdownLines(markdown: string): string[] {
  const withoutFence = markdown
    .replace(/^\s*```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  return withoutFence
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => stripMarkdownNoise(line.replace(/\t/g, "  ")));
}

function trimLeadingEmptyLines(lines: string[]): void {
  while (lines.length > 0 && !lines[0].trim()) lines.shift();
}

function trimPreface(lines: string[]): void {
  trimLeadingEmptyLines(lines);

  if (lines[0] && PREFACE_LINE.test(lines[0].trim())) {
    lines.shift();
    trimLeadingEmptyLines(lines);
  }
}

function normalizeGeneratedBodyTitle(line: string): string {
  return cleanGeneratedTitle(line.replace(TITLE_PREFIX, "")).trim();
}

function isGeneratedBodyTitleLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    GENERATED_TITLE_LINE.test(trimmed) ||
    GENERATED_BARE_TITLE_LINE.test(trimmed)
  );
}

function isPlaceholderTitle(title: string): boolean {
  const cleaned = cleanGeneratedTitle(title)
    .replace(/[()（）]/g, "")
    .trim();
  return cleaned === "" || cleaned === "未命名标题" || cleaned === "草稿 · 待生成";
}

export function extractGeneratedBodyTitle(markdown: string): string | null {
  const lines = normalizeGeneratedMarkdownLines(markdown);
  trimPreface(lines);

  if (!lines[0] || !isGeneratedBodyTitleLine(lines[0])) return null;

  const title = normalizeGeneratedBodyTitle(lines[0]);
  return title && !isPlaceholderTitle(title) ? title : null;
}

export function resolveGeneratedArticleTitle({
  titles,
  bodyMarkdown,
  fallbackTitle,
}: {
  titles: string[];
  bodyMarkdown: string;
  fallbackTitle?: string;
}): { title: string; titleCandidates: string[] } {
  const cleanedTitles = titles
    .map((title) => cleanGeneratedTitle(title))
    .filter((title) => !isPlaceholderTitle(title));
  const bodyTitle = extractGeneratedBodyTitle(bodyMarkdown);
  const cleanedFallback = fallbackTitle ? cleanGeneratedTitle(fallbackTitle) : "";
  const fallback =
    cleanedFallback && !isPlaceholderTitle(cleanedFallback) ? cleanedFallback : "";
  const title = cleanedTitles[0] ?? bodyTitle ?? fallback ?? "未命名标题";
  const titleCandidates =
    cleanedTitles.length > 0 ? cleanedTitles : bodyTitle ? [bodyTitle] : title ? [title] : [];

  return { title, titleCandidates };
}

export function cleanGeneratedMarkdown(markdown: string): string {
  const lines = normalizeGeneratedMarkdownLines(markdown);
  trimPreface(lines);

  if (lines[0] && isGeneratedBodyTitleLine(lines[0])) {
    lines.shift();
    trimLeadingEmptyLines(lines);
  }

  return lines
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanGeneratedTitle(title: string): string {
  return stripInternalPlanningLabel(
    title
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
      .replace(/__([^_\n]+?)__/g, "$1")
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .trim()
  ).trim();
}

function visibleText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/[`*_~#>-]/g, "")
    .replace(/\s/g, "");
}

function isStructuralBlock(block: string): boolean {
  const trimmed = block.trim();
  return (
    /^#{1,6}\s+/.test(trimmed) ||
    /^!\[[^\]]*]\([^)]+\)/.test(trimmed) ||
    /^\[产品截图\/视频/.test(trimmed) ||
    /^<figure[\s>]/i.test(trimmed) ||
    /^```/.test(trimmed)
  );
}

function isHeadingBlock(block: string): boolean {
  return /^#{1,6}\s+/.test(block.trim());
}

function normalizeForSimilarity(block: string): string {
  return visibleText(block)
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）《》「」『』,.!?;:'"()[\]{}]/g, "");
}

function bigrams(value: string): Set<string> {
  const result = new Set<string>();
  for (let index = 0; index < value.length - 1; index += 1) {
    result.add(value.slice(index, index + 2));
  }
  return result;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (shorter.length >= 32 && longer.includes(shorter)) return 0.95;

  const left = bigrams(a);
  const right = bigrams(b);
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  left.forEach((item) => {
    if (right.has(item)) intersection += 1;
  });
  return intersection / (left.size + right.size - intersection);
}

function removeRepeatedBlocks(blocks: string[]): string[] {
  const seen: string[] = [];

  return blocks.filter((block) => {
    if (isStructuralBlock(block)) {
      if (isHeadingBlock(block)) seen.length = 0;
      return true;
    }

    const normalized = normalizeForSimilarity(block);
    if (normalized.length < 36) return true;

    const duplicate = seen.some((item) => similarity(item, normalized) >= 0.82);
    if (!duplicate) seen.push(normalized);
    return !duplicate;
  });
}

function isHeadingOnlyBlock(block: string): boolean {
  const lines = block
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length === 1 && /^#{1,6}\s+/.test(lines[0]);
}

function removeDanglingTrailingHeading(blocks: string[]): string[] {
  const result = [...blocks];
  while (result.length > 0 && isHeadingOnlyBlock(result[result.length - 1])) {
    result.pop();
  }
  return result;
}

export function postProcessGeneratedMarkdown(
  markdown: string,
  _contentLength: ContentLength = "standard"
): string {
  void _contentLength;
  const clean = cleanGeneratedMarkdown(markdown);
  const blocks = clean.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  const withoutRepeats = removeRepeatedBlocks(blocks);
  const finalBlocks = removeDanglingTrailingHeading(withoutRepeats);

  return finalBlocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
