/**
 * Three-layer humanize pipeline.
 *
 * Layer 1 (L1) — LLM rewrite: Qwen humanize node, segment by segment.
 * Layer 2 (L2) — Post-processing: deterministic vocab + sentence-length fix.
 * Layer 3 (L3) — Detection score: 4-dimensional AI-tone scoring.
 *
 * Flow per segment:
 *   input → L1 (Qwen) → L2 (postProcess) → L3 (detectScore)
 *   if score > threshold → one more L1+L2 round (maxRounds total)
 *
 * Segments are split on markdown H2 headings (`\n## `).
 * Up to `concurrency` segments can be processed in parallel.
 *
 * The `humanizeFn` dependency is injected so this module stays
 * unit-testable without a live Qwen connection.
 */

import { postProcess } from "./postProcess";
import { detectScore, type ScoreBreakdown } from "./detectScore";
import {
  parseMarkdownBlocks,
  joinMarkdownBlocks,
  type MdBlock,
} from "../markdown";

// ─── Types ───────────────────────────────────────────────────────────

/**
 * A function that takes plain text and returns humanized plain text.
 * In production this wraps `humanize()` from `@/lib/qwen`.
 * In tests this is a lightweight mock.
 */
export type HumanizeFn = (
  text: string,
  signal?: AbortSignal
) => Promise<string>;

export interface PipelineOptions {
  /**
   * L3 score threshold. If the final score exceeds this value,
   * the pipeline retries up to `maxRounds` total.
   * Default: 40
   */
  threshold?: number;
  /**
   * Maximum number of L1 rounds per segment.
   * Default: 2
   */
  maxRounds?: number;
  /**
   * Maximum number of segments processed concurrently.
   * Default: 3
   */
  concurrency?: number;
  /**
   * In structure-preserving mode, also rewrite the visible microcopy inside
   * headings, list items, and blockquotes while preserving markdown markers.
   * Default: true
   */
  rewriteMicrocopy?: boolean;
  /** AbortSignal to cancel in-flight Qwen calls. */
  signal?: AbortSignal;
}

export interface PipelineResult {
  /** Processed plain text (all segments reassembled). */
  text: string;
  /** Final L3 score breakdown (scored on the full reassembled text). */
  scoreBreakdown: ScoreBreakdown;
  /** Total L1 rounds run across all segments. */
  totalRounds: number;
}

// ─── Segment splitting ───────────────────────────────────────────────

interface TextSegment {
  /** Heading line ("## 钩子"), or empty string for the preamble. */
  heading: string;
  /** Paragraph body text following the heading. */
  body: string;
}

/**
 * Split plain text into logical sections by markdown H2 headings.
 * The preamble (text before the first heading) is kept as segment 0
 * with an empty heading.
 */
export function splitSections(text: string): TextSegment[] {
  const lines = text.split("\n");
  const segments: TextSegment[] = [];
  let currentHeading = "";
  let bodyLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      // Flush the previous segment
      if (currentHeading || bodyLines.some((l) => l.trim())) {
        segments.push({ heading: currentHeading, body: bodyLines.join("\n") });
      }
      currentHeading = line;
      bodyLines = [];
    } else {
      bodyLines.push(line);
    }
  }

  // Flush the last segment
  if (currentHeading || bodyLines.some((l) => l.trim())) {
    segments.push({ heading: currentHeading, body: bodyLines.join("\n") });
  }

  return segments;
}

/**
 * Reassemble segments into a single text string, preserving heading lines.
 */
export function joinSections(segments: TextSegment[]): string {
  return segments
    .map((s) => (s.heading ? s.heading + "\n" + s.body : s.body))
    .join("\n");
}

// ─── Concurrency helper ──────────────────────────────────────────────

/**
 * Run an array of async tasks with a maximum concurrency limit.
 * Returns results in the same order as the input tasks array.
 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ─── Per-segment processing ──────────────────────────────────────────

/**
 * Process a single text segment through L1 → L2 → (L3 gate → L1 → L2).
 */
async function processSegment(
  body: string,
  humanizeFn: HumanizeFn,
  threshold: number,
  maxRounds: number,
  signal?: AbortSignal
): Promise<{ text: string; rounds: number }> {
  if (!body.trim()) {
    return { text: body, rounds: 0 };
  }

  let current = body;
  let rounds = 0;

  for (let round = 0; round < maxRounds; round++) {
    if (signal?.aborted) break;

    // L1: LLM rewrite
    const rewritten = await humanizeFn(current, signal);
    rounds++;

    // L2: deterministic post-processing
    const processed = postProcess(rewritten);

    current = processed;

    // L3: check if score is already below threshold → done early
    const { total } = detectScore(current);
    if (total <= threshold) break;
  }

  return { text: current, rounds };
}

function cleanMicrocopy(text: string): string {
  return text
    .replace(/\r?\n+/g, " ")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
}

function isValidMicrocopyRewrite(
  original: string,
  rewritten: string,
  kind: MdBlock["type"]
): boolean {
  const cleanOriginal = cleanMicrocopy(original);
  const cleanRewritten = cleanMicrocopy(rewritten);
  if (!cleanRewritten) return false;

  const maxLength =
    kind === "heading" ? Math.max(28, cleanOriginal.length + 12) : 72;
  if (cleanRewritten.length > maxLength) return false;

  // Headings should read like labels, not paragraph prose.
  if (kind === "heading" && /[。！？；]/.test(cleanRewritten)) return false;

  // Avoid accepting outputs that accidentally include markdown block markers.
  if (/^#{1,6}\s|^[-*]\s|^>\s?/.test(cleanRewritten)) return false;

  return true;
}

async function rewriteMicrocopyText(
  text: string,
  humanizeFn: HumanizeFn,
  threshold: number,
  maxRounds: number,
  signal: AbortSignal | undefined,
  kind: MdBlock["type"]
): Promise<{ text: string; rounds: number }> {
  const result = await processSegment(
    text,
    humanizeFn,
    threshold,
    maxRounds,
    signal
  );
  const original = cleanMicrocopy(text);
  const rewritten = cleanMicrocopy(result.text);
  return {
    text: isValidMicrocopyRewrite(original, rewritten, kind)
      ? rewritten
      : original,
    rounds: result.rounds,
  };
}

async function processMicrocopyBlock(
  block: MdBlock,
  humanizeFn: HumanizeFn,
  threshold: number,
  maxRounds: number,
  signal?: AbortSignal
): Promise<{ block: MdBlock; rounds: number }> {
  if (block.type === "heading") {
    const match = block.raw.match(/^(#{1,3}\s+)([\s\S]+)$/);
    if (!match) return { block, rounds: 0 };
    const rewritten = await rewriteMicrocopyText(
      match[2],
      humanizeFn,
      threshold,
      maxRounds,
      signal,
      block.type
    );
    return {
      block: { ...block, raw: `${match[1]}${rewritten.text}` },
      rounds: rewritten.rounds,
    };
  }

  if (block.type === "list") {
    let rounds = 0;
    const lines: string[] = [];
    for (const line of block.raw.split("\n")) {
      const match = line.match(/^(\s*(?:[-*]|\d+\.)\s+)([\s\S]+)$/);
      if (!match) {
        lines.push(line);
        continue;
      }
      const rewritten = await rewriteMicrocopyText(
        match[2],
        humanizeFn,
        threshold,
        maxRounds,
        signal,
        block.type
      );
      rounds += rewritten.rounds;
      lines.push(`${match[1]}${rewritten.text}`);
    }
    return { block: { ...block, raw: lines.join("\n") }, rounds };
  }

  if (block.type === "blockquote") {
    const content = block.raw
      .split("\n")
      .map((line) => line.replace(/^>\s?/, ""))
      .join(" ")
      .trim();
    if (!content) return { block, rounds: 0 };
    const rewritten = await rewriteMicrocopyText(
      content,
      humanizeFn,
      threshold,
      maxRounds,
      signal,
      block.type
    );
    return {
      block: { ...block, raw: `> ${rewritten.text}` },
      rounds: rewritten.rounds,
    };
  }

  return { block, rounds: 0 };
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Run the three-layer humanize pipeline on plain text.
 *
 * @param text        Input plain text (may contain markdown H2 headings).
 * @param humanizeFn  L1 rewrite function (inject `buildQwenHumanizeFn` in prod).
 * @param options     Pipeline configuration (threshold, maxRounds, concurrency).
 * @returns           Processed text + final score breakdown + total rounds run.
 */
export async function runHumanizePipeline(
  text: string,
  humanizeFn: HumanizeFn,
  options?: PipelineOptions
): Promise<PipelineResult> {
  const {
    threshold = 40,
    maxRounds = 2,
    concurrency = 3,
    signal,
  } = options ?? {};

  const sections = splitSections(text);

  // Build one task per section body
  const tasks = sections.map(
    (section) => () =>
      processSegment(section.body, humanizeFn, threshold, maxRounds, signal)
  );

  // Run with concurrency limit
  const sectionResults = await runWithConcurrency(tasks, concurrency);

  // Reassemble sections with their (now-processed) bodies
  const processedSections: TextSegment[] = sections.map((sec, i) => ({
    heading: sec.heading,
    body: sectionResults[i].text,
  }));

  const finalText = joinSections(processedSections);
  const totalRounds = sectionResults.reduce((sum, r) => sum + r.rounds, 0);

  // L3 on the full reassembled text
  const scoreBreakdown = detectScore(finalText);

  return { text: finalText, scoreBreakdown, totalRounds };
}

/**
 * Run the humanize pipeline while **strictly preserving the markdown
 * document's block structure**.
 *
 * Unlike `runHumanizePipeline` (which splits on `## ` and sends an entire
 * section's body to the LLM — including any sub-headings, lists, and
 * blockquotes inside it), this variant parses the markdown into typed
 * blocks and only sends `paragraph` blocks to the LLM. Heading, list,
 * blockquote, and hr blocks pass through **untouched**, so the article's
 * original visual layout (h2 / h3 / `- list` / `> quote`) is guaranteed
 * to survive the rewrite.
 *
 * Use this for the batch-preview humanize button where the user has
 * already approved the article's structure and only wants the prose
 * polished without losing formatting.
 *
 * L2 post-processing (vocab + sentence-length variation) and L3 detect
 * scoring still run as in the standard pipeline.
 */
export async function runStructurePreservingPipeline(
  markdown: string,
  humanizeFn: HumanizeFn,
  options?: PipelineOptions
): Promise<PipelineResult> {
  const {
    threshold = 40,
    maxRounds = 2,
    concurrency = 3,
    rewriteMicrocopy = true,
    signal,
  } = options ?? {};

  const blocks = parseMarkdownBlocks(markdown);

  // Index every block whose `raw` text we'll actually send to the LLM.
  const paragraphIndices: number[] = [];
  blocks.forEach((b, i) => {
    if (b.type === "paragraph") paragraphIndices.push(i);
  });

  if (paragraphIndices.length === 0 && !rewriteMicrocopy) {
    // Nothing to humanize — still score so callers get a consistent shape
    const finalText = joinMarkdownBlocks(blocks);
    return {
      text: finalText,
      scoreBreakdown: detectScore(finalText),
      totalRounds: 0,
    };
  }

  // Build one task per paragraph block. Each task runs the per-segment
  // L1→L2→L3 loop on a single paragraph in isolation.
  const tasks = paragraphIndices.map(
    (idx) => () =>
      processSegment(blocks[idx].raw, humanizeFn, threshold, maxRounds, signal)
  );

  const results = await runWithConcurrency(tasks, concurrency);

  // Rebuild the document with rewritten paragraphs and untouched structure.
  let finalBlocks: MdBlock[] = blocks.map((b, i) => {
    const paragraphRank = paragraphIndices.indexOf(i);
    if (paragraphRank === -1) return b;
    return { type: "paragraph", raw: results[paragraphRank].text.trim() };
  });

  let microcopyRounds = 0;
  if (rewriteMicrocopy) {
    const microcopyIndices: number[] = [];
    finalBlocks.forEach((b, i) => {
      if (b.type === "heading" || b.type === "list" || b.type === "blockquote") {
        microcopyIndices.push(i);
      }
    });

    const microcopyTasks = microcopyIndices.map(
      (idx) => () =>
        processMicrocopyBlock(
          finalBlocks[idx],
          humanizeFn,
          threshold,
          maxRounds,
          signal
        )
    );
    const microcopyResults = await runWithConcurrency(
      microcopyTasks,
      concurrency
    );
    finalBlocks = [...finalBlocks];
    microcopyResults.forEach((result, rank) => {
      finalBlocks[microcopyIndices[rank]] = result.block;
      microcopyRounds += result.rounds;
    });
  }

  const finalText = joinMarkdownBlocks(finalBlocks);
  const totalRounds =
    results.reduce((sum, r) => sum + r.rounds, 0) + microcopyRounds;
  const scoreBreakdown = detectScore(finalText);

  return { text: finalText, scoreBreakdown, totalRounds };
}

/**
 * Build a production-ready `HumanizeFn` that wraps the Qwen `humanize`
 * streaming generator, collecting all chunks.
 *
 * Called by route handlers — not by tests (which inject mocks instead).
 *
 * @param args  Shared args for every segment call (articleType, style, intent).
 */
export function buildQwenHumanizeFn(args: {
  intent: string;
  styleName: string;
  styleProfile: string;
  articleType: import("@/lib/articleType").ArticleType;
  // We accept `humanize` as a param to avoid a circular import when mocking
  humanize: (
    a: import("@/lib/qwen").HumanizeArgs
  ) => AsyncGenerator<string, void, unknown>;
}): HumanizeFn {
  return async (text: string, signal?: AbortSignal): Promise<string> => {
    const chunks: string[] = [];
    for await (const delta of args.humanize({
      intent: args.intent,
      text,
      styleName: args.styleName,
      styleProfile: args.styleProfile,
      articleType: args.articleType,
      signal,
    })) {
      chunks.push(delta);
    }
    return chunks.join("");
  };
}
