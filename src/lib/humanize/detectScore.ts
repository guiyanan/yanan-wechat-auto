/**
 * L3 detection scoring — 4-dimensional Chinese AI-tone assessment.
 *
 * Score: 0 – 100
 *   0   = sounds completely human
 *   100 = clearly AI-generated
 *
 * Dimension weights:
 *   1. AI phrase density       40 pts — hits from PHRASE_BLACKLIST per 100 chars
 *   2. Sentence-length uniformity 30 pts — low stddev signals AI cadence
 *   3. Repeated sentence openers  15 pts — same 2-char prefix on consecutive sentences
 *   4. Passive / filler ratio  15 pts — stock passive patterns AI overuses
 *   5. Corporate / whitepaper cliche 20 pts — official-sounding market prose
 *   6. Template structure smell 12 pts — 产品概述/价值分析-style outlines
 *   7. Unsupported fact risk 15 pts — invented metrics / pseudo customer proof
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

const CORPORATE_WHITEPAPER_CLICHES: readonly string[] = [
  "价值分析",
  "需求概述",
  "产品概述",
  "效果分析",
  "核心能力",
  "全面赋能",
  "显著提升",
  "场景闭环",
  "全流程闭环",
  "生态协同",
  "解决方案",
  "落地实践",
  "智能化升级",
  "业务创新",
  "可复制",
  "组织效率",
  "系统化",
  "一体化",
  "全生命周期",
  "可持续",
  "高质量发展",
  "数字化转型",
] as const;

const TEMPLATE_STRUCTURE_LABELS: readonly string[] = [
  "产品概述",
  "需求概述",
  "价值分析",
  "效果分析",
  "功能分析",
  "技术架构",
  "应用场景",
  "客户实证",
  "案例分析",
] as const;

const UNSUPPORTED_FACT_PATTERNS: readonly RegExp[] = [
  /(?:提升|提高|降低|减少|缩短|节省|压缩|增长|覆盖|达到).{0,12}\d+(?:\.\d+)?%/g,
  /(?:年营收|营收|收入|融资|估值).{0,12}(?:¥|￥)?\d+(?:\.\d+)?\s*(?:万|亿|百万|千万)/g,
  /(?:某|一家|多家)[\u4e00-\u9fffA-Za-z0-9]{2,18}(?:公司|企业|集团|品牌|客户)/g,
  /(?:上线|部署|落地|接入).{0,12}\d+\s*(?:天|周|月|小时|分钟)/g,
] as const;

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

// ─── Dimension 5: Corporate / Whitepaper Cliche (0–20) ──────────────

function corporateClicheScore(text: string): number {
  const clean = stripHtml(text);
  const charCount = clean.length;
  if (charCount === 0) return 0;

  let hits = 0;
  for (const phrase of CORPORATE_WHITEPAPER_CLICHES) {
    let pos = 0;
    while ((pos = clean.indexOf(phrase, pos)) !== -1) {
      hits++;
      pos += phrase.length;
    }
  }

  const hitsPerHundred = (hits / charCount) * 100;
  return Math.min(20, Math.round((hitsPerHundred / 1.8) * 20));
}

// ─── Dimension 6: Template Structure Smell (0–12) ───────────────────

function templateStructureScore(text: string): number {
  const clean = stripHtml(text);
  const hits = TEMPLATE_STRUCTURE_LABELS.filter((label) =>
    clean.includes(label)
  ).length;
  if (hits < 2) return 0;
  return Math.min(12, (hits - 1) * 4);
}

// ─── Dimension 7: Unsupported Fact Risk (0–15) ──────────────────────

function unsupportedFactRiskScore(text: string): number {
  const clean = stripHtml(text);
  let hits = 0;
  for (const pattern of UNSUPPORTED_FACT_PATTERNS) {
    hits += clean.match(pattern)?.length ?? 0;
  }
  return Math.min(15, hits * 5);
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
  /** Corporate / whitepaper cliche contribution (0–20). */
  corporateCliche: number;
  /** Template structure smell contribution (0–12). */
  templateStructure: number;
  /** Unsupported metrics / pseudo-proof risk contribution (0–15). */
  unsupportedFactRisk: number;
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
  const corporateCliche = corporateClicheScore(text);
  const templateStructure = templateStructureScore(text);
  const unsupportedFactRisk = unsupportedFactRiskScore(text);
  const total = Math.min(
    100,
    phraseDensity +
      sentenceUniformity +
      repeatedOpeners +
      passiveFiller +
      corporateCliche +
      templateStructure +
      unsupportedFactRisk
  );

  return {
    phraseDensity,
    sentenceUniformity,
    repeatedOpeners,
    passiveFiller,
    corporateCliche,
    templateStructure,
    unsupportedFactRisk,
    total,
  };
}

/**
 * Convenience wrapper — returns only the total score (0–100).
 * Higher = more AI-like.
 */
export function detectScoreTotal(text: string): number {
  return detectScore(text).total;
}
