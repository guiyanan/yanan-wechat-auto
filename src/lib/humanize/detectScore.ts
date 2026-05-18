/**
 * L3 detection scoring — 4-dimensional Chinese AI-tone assessment.
 *
 * Score: 0 – 100
 *   0   = sounds completely human
 *   100 = clearly AI-generated
 *
 * Dimension weights (summing to 100):
 *   1. AI phrase density       40 pts — hits from PHRASE_BLACKLIST per 100 chars
 *   2. Sentence-length uniformity 30 pts — low stddev signals AI cadence
 *   3. Repeated sentence openers  15 pts — same 2-char prefix on consecutive sentences
 *   4. Passive / filler ratio  15 pts — stock passive patterns AI overuses
 *
 * Pure function — no LLM calls, no side effects.
 */

import { PHRASE_BLACKLIST } from "./chineseAntiPatterns";

// ─── Passive / filler patterns ───────────────────────────────────────
// These are shorter-form passives / stock phrases NOT in PHRASE_BLACKLIST
// so they don't double-count with dimension 1.

const PASSIVE_FILLERS: readonly string[] = [
  "据了解",
  "据悉",
  "据报道",
  "经了解",
  "经过分析",
  "经由",
  "通过此举",
  "实现了",
  "进行了",
  "完成了",
  "做到了",
  "对此",
  "为此",
  "由此",
  "在此基础上进行",
  "在这一背景下",
  "基于此",
];

// ─── Internal helpers ────────────────────────────────────────────────

/** Strip HTML tags and return clean text. */
function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

/**
 * Split text into sentences (split at 。！？；).
 * Returns non-empty sentence body strings (without the terminator).
 */
function getSentences(text: string): string[] {
  return (stripHtml(text).match(/[^。！？；\n]+/g) ?? []).filter(
    (s) => s.trim().length > 2
  );
}

// ─── Dimension 1: AI Phrase Density (0–40) ──────────────────────────

/**
 * Count how many PHRASE_BLACKLIST entries appear in the text,
 * normalised per 100 display chars.
 *
 * Calibration:
 *   ≥ 3 hits per 100 chars → 40 pts (clear AI)
 *   0 hits                 → 0 pts
 */
function phraseDensityScore(text: string): number {
  const clean = stripHtml(text);
  const charCount = clean.length;
  if (charCount === 0) return 0;

  let hits = 0;
  for (const phrase of PHRASE_BLACKLIST) {
    let pos = 0;
    while ((pos = clean.indexOf(phrase, pos)) !== -1) {
      hits++;
      pos += phrase.length;
    }
  }

  // Scale: 3 hits/100 chars → full 40 pts
  const hitsPerHundred = (hits / charCount) * 100;
  return Math.min(40, Math.round((hitsPerHundred / 3) * 40));
}

// ─── Dimension 2: Sentence-Length Uniformity (0–30) ─────────────────

/**
 * AI models write paragraphs where every sentence is ~20-30 chars,
 * producing a uniform cadence. Low coefficient of variation (CV) → high score.
 *
 * Calibration:
 *   CV < 0.15 (very uniform) → 30 pts
 *   CV > 0.65 (natural mix)  → 0 pts
 */
function sentenceUniformityScore(text: string): number {
  const sentences = getSentences(text);
  if (sentences.length < 3) return 0;

  const lengths = sentences.map((s) => s.length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean === 0) return 0;

  const variance =
    lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / mean; // coefficient of variation

  if (cv >= 0.65) return 0;
  return Math.round(((0.65 - cv) / 0.65) * 30);
}

// ─── Dimension 3: Repeated Sentence Openers (0–15) ──────────────────

/**
 * Count consecutive sentence pairs that share the same 2-char prefix.
 * AI frequently starts multiple sentences with the same opener.
 *
 * Calibration:
 *   ≥ 30% of consecutive pairs share a prefix → 15 pts
 *   0%                                         → 0 pts
 */
function repeatedOpenersScore(text: string): number {
  const sentences = getSentences(text);
  if (sentences.length < 2) return 0;

  let repeatedPairs = 0;
  for (let i = 1; i < sentences.length; i++) {
    const prevPrefix = sentences[i - 1].slice(0, 2);
    const currPrefix = sentences[i].slice(0, 2);
    // Only count if prefix is genuinely 2 Chinese chars (not punctuation/whitespace)
    if (
      prevPrefix === currPrefix &&
      prevPrefix.trim().length === 2 &&
      /[一-鿿]/.test(prevPrefix)
    ) {
      repeatedPairs++;
    }
  }

  const ratio = repeatedPairs / (sentences.length - 1);
  return Math.min(15, Math.round(ratio * 50));
}

// ─── Dimension 4: Passive / Filler Ratio (0–15) ─────────────────────

/**
 * Count PASSIVE_FILLERS hits per 100 chars.
 *
 * Calibration:
 *   ≥ 2 hits per 100 chars → 15 pts
 *   0                      → 0 pts
 */
function passiveFillerScore(text: string): number {
  const clean = stripHtml(text);
  const charCount = clean.length;
  if (charCount === 0) return 0;

  let hits = 0;
  for (const phrase of PASSIVE_FILLERS) {
    let pos = 0;
    while ((pos = clean.indexOf(phrase, pos)) !== -1) {
      hits++;
      pos += phrase.length;
    }
  }

  const hitsPerHundred = (hits / charCount) * 100;
  return Math.min(15, Math.round((hitsPerHundred / 2) * 15));
}

// ─── Public API ──────────────────────────────────────────────────────

export interface ScoreBreakdown {
  /** AI phrase density contribution (0–40). */
  phraseDensity: number;
  /** Sentence-length uniformity contribution (0–30). */
  sentenceUniformity: number;
  /** Repeated sentence openers contribution (0–15). */
  repeatedOpeners: number;
  /** Passive / filler ratio contribution (0–15). */
  passiveFiller: number;
  /** Sum of all dimensions, capped at 100. */
  total: number;
}

/**
 * Compute a full 4-dimensional AI detection score for Chinese text.
 *
 * @param text  Plain text or HTML string. HTML tags are stripped before analysis.
 * @returns     Breakdown by dimension plus capped total (0–100).
 */
export function detectScore(text: string): ScoreBreakdown {
  const phraseDensity = phraseDensityScore(text);
  const sentenceUniformity = sentenceUniformityScore(text);
  const repeatedOpeners = repeatedOpenersScore(text);
  const passiveFiller = passiveFillerScore(text);
  const total = Math.min(
    100,
    phraseDensity + sentenceUniformity + repeatedOpeners + passiveFiller
  );

  return { phraseDensity, sentenceUniformity, repeatedOpeners, passiveFiller, total };
}

/**
 * Convenience wrapper — returns only the total score (0–100).
 * Higher = more AI-like.
 */
export function detectScoreTotal(text: string): number {
  return detectScore(text).total;
}
