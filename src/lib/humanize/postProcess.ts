/**
 * L2 post-processing layer — pure functions, no LLM calls.
 *
 * Exported pipeline entry:
 *   postProcess(text) — applies vocab replacements → collocation
 *   simplifications → sentence-length variation in sequence.
 *
 * Each sub-function is also exported individually for testing and
 * selective use in other parts of the pipeline.
 *
 * Sources: StealthHumanizer (MIT) patterns + custom Chinese additions.
 */

import { applyAllReplacements } from "./zhDictionary";

// ─── Internal helpers ────────────────────────────────────────────────

interface Segment {
  /** Sentence body (everything before the terminator). */
  body: string;
  /** Sentence-ending punctuation char, or "" for the last fragment. */
  term: string;
}

/** Split a single line into sentence segments. */
function splitSegments(line: string): Segment[] {
  const result: Segment[] = [];
  const re = /([^。！？；]*)([。！？；])/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(line)) !== null) {
    result.push({ body: m[1], term: m[2] });
    lastIndex = re.lastIndex;
  }

  // Trailing text without a sentence terminator
  if (lastIndex < line.length) {
    const tail = line.slice(lastIndex);
    if (tail.trim()) {
      result.push({ body: tail, term: "" });
    }
  }

  return result;
}

/** Reconstruct a line from segments. */
function joinSegments(segs: Segment[]): string {
  return segs.map((s) => s.body + s.term).join("");
}

/** Count display characters, stripping HTML tags. */
function displayLen(text: string): number {
  return text.replace(/<[^>]+>/g, "").length;
}

/**
 * Find the best comma/pause split point (，、) near the middle of `text`.
 * Both sides must be at least `minSideLen` display characters.
 * Returns the index of the split character, or -1 if none found.
 */
function findSplitPoint(text: string, minSideLen = 8): number {
  const mid = Math.floor(text.length / 2);
  const re = /[，、]/g;
  let best = -1;
  let bestDist = Infinity;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const idx = m.index;
    const leftLen = displayLen(text.slice(0, idx));
    const rightLen = displayLen(text.slice(idx + 1));
    if (leftLen >= minSideLen && rightLen >= minSideLen) {
      const dist = Math.abs(idx - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
    }
  }

  return best;
}

/**
 * Process a single line: find runs of ≥3 uniform-length sentences and
 * split the longest one at a natural pause point.
 */
function processLine(line: string): string {
  // Skip markdown headings, list items, and very short lines
  if (
    line.length < 30 ||
    line.startsWith("#") ||
    line.startsWith("-") ||
    line.startsWith("*") ||
    /^\d+\./.test(line)
  ) {
    return line;
  }

  const segs = splitSegments(line);
  if (segs.length < 3) return line;

  // Only look at long sentences (≥12 display chars)
  const longSegs = segs.filter((s) => displayLen(s.body) >= 12);
  if (longSegs.length < 3) return line;

  // Check whether all long sentences are within ±40% of their mean length
  const lengths = longSegs.map((s) => displayLen(s.body));
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const allSimilar = lengths.every(
    (l) => Math.abs(l - mean) / Math.max(mean, 1) <= 0.4
  );
  if (!allSimilar) return line;

  // Find the longest segment that has a valid split point
  let bestIdx = -1;
  let bestLen = 0;

  for (let i = 0; i < segs.length; i++) {
    const len = displayLen(segs[i].body);
    if (len > bestLen && findSplitPoint(segs[i].body) !== -1) {
      bestLen = len;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) return line;

  const modified = [...segs];
  const seg = modified[bestIdx];
  const splitAt = findSplitPoint(seg.body);
  const first = seg.body.slice(0, splitAt);
  const second = seg.body.slice(splitAt + 1); // skip the comma char

  modified.splice(
    bestIdx,
    1,
    { body: first, term: "。" },
    { body: second, term: seg.term }
  );

  return joinSegments(modified);
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Break up runs of 3+ consecutive sentences with similar character counts.
 *
 * AI models tend to write paragraphs where every sentence is 20-30 chars,
 * producing a monotonous cadence. This function finds such runs within each
 * line/paragraph and splits the longest sentence at an inner comma/pause
 * point to increase sentence-length variance — a natural human writing trait.
 *
 * Input: plain Chinese text (may contain inline HTML like `<strong>`).
 * Processes each line independently; does not cross paragraph boundaries.
 */
export function varySentenceLength(text: string): string {
  return text
    .split("\n")
    .map(processLine)
    .join("\n");
}

/**
 * Full L2 post-processing pass.
 *
 * Applies three layers in order:
 *   1. `applyAllReplacements` — AI vocabulary substitution + collocation
 *      simplification (from zhDictionary)
 *   2. `varySentenceLength` — break up uniform sentence-length runs
 *
 * Pure function — no LLM calls, no side effects.
 */
export function postProcess(text: string): string {
  return varySentenceLength(applyAllReplacements(text));
}
