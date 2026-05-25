import { markdownToHtml } from "./markdown";
import type { Product } from "@/types";

export interface FormatJotoInput {
  title?: string;
  rawText: string;
  product?: Product | null;
  author?: string;
}

export interface FormatJotoResult {
  title: string;
  contentHtml: string;
  summary: string;
  warnings: string[];
  mode: "qwen" | "fallback";
}

const EMOJI_BULLET_PATTERN =
  /^(\s*(?:[-*•]\s*)?)(?:[\u{1F000}-\u{1FFFF}☀-➿⭐✅📌💡🔹🔸▪️▫️]\s*)+/u;

function stripEmojiListMarker(line: string): string {
  return line.replace(EMOJI_BULLET_PATTERN, "$1");
}

function cleanMarkdownText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => stripEmojiListMarker(line).replace(/\t/g, "  ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanTitleCandidate(line: string): string {
  return stripEmojiListMarker(line)
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.、]\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
}

function textSummary(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function basicFormatJotoPaste(input: FormatJotoInput): FormatJotoResult {
  const cleaned = cleanMarkdownText(input.rawText);
  const lines = cleaned.split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  const extractedTitle =
    firstContentIndex >= 0 ? cleanTitleCandidate(lines[firstContentIndex]) : "";
  const title = cleanTitleCandidate(input.title ?? "") || extractedTitle || "JOTO 公众号排版稿";

  const bodyLines =
    input.title || firstContentIndex < 0
      ? lines
      : lines.filter((_, index) => index !== firstContentIndex);

  const bodyMarkdown = bodyLines.join("\n").trim() || cleaned;
  const contentHtml = markdownToHtml(bodyMarkdown);

  return {
    title,
    contentHtml,
    summary: textSummary(contentHtml),
    warnings: [],
    mode: "fallback",
  };
}

export function normaliseEnhancedMarkdown(markdown: string): string {
  return cleanMarkdownText(markdown)
    .replace(/\n(#{1,6}\s+)/g, "\n\n$1")
    .replace(/^[ \t]*#{1,6}[ \t]+(.+)$/gm, (_match, heading: string) => {
      const clean = cleanTitleCandidate(heading);
      return clean ? `## ${clean}` : "";
    })
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
    .replace(/\*\*\s*$/gm, "")
    .trim();
}
