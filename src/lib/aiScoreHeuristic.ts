/**
 * Heuristic AI-likeness scorer for Chinese editorial text.
 *
 * Returns 0-100 where higher = more AI-like. Six dimensions are computed
 * independently from a short blacklist + simple statistics over the text,
 * then combined with weighted average.
 *
 * Designed as a *signal* for the auto-humanize loop, not a definitive
 * classifier. When real 朱雀 / DashScope detection is wired up, the API
 * layer will route to that provider via AI_SCORE_PROVIDER.
 *
 * All thresholds and word lists live at the top of the file so they can
 * be tuned without touching scoring logic.
 */

// ---------- Tunable constants ----------

/** AI-like cliché phrases — each occurrence boosts the cliche dimension. */
const CLICHE_BLACKLIST: readonly string[] = [
  "在当今", "在这个时代", "在如今", "在数字化时代",
  "无疑", "毋庸置疑", "不言而喻", "众所周知",
  "不仅...而且", "不仅如此", "与此同时", "随之而来",
  "赋能", "抓手", "闭环", "生态", "链路", "落地", "打通", "提效",
  "综上所述", "总而言之", "归根结底",
  "助力", "驱动", "引领", "推动",
];

/** Transition / connector words — high frequency = AI scaffold. */
const TRANSITION_WORDS: readonly string[] = [
  "首先", "其次", "再次", "然后", "接着", "最后",
  "此外", "另外", "而且", "并且", "因此", "所以",
  "总之", "综上", "由此可见",
];

/** First-person markers — presence pulls the score down. */
const FIRST_PERSON_MARKERS: readonly string[] = ["我", "我们", "咱们", "咱"];

/** Concrete-token regex — Arabic digits, percentages, time markers, units. */
const CONCRETE_REGEX =
  /(\d+(\.\d+)?\s*[%‰]?|\d+\s*(年|月|日|天|小时|分钟|秒|周|个|次|轮|位|名|人|元|万|亿|kb|mb|gb|tb|ms|s|min|h)|早\s*\d+点|下午\s*\d+点|凌晨\s*\d+点)/gi;

/** Per-1000-char saturation thresholds — once you reach these, the dimension caps at 1.0. */
const THRESHOLDS = {
  clichePer1000: 6,
  transitionPer1000: 8,
  concretePer1000: 25,
  firstPersonPer1000: 12,
  // Sentence-length stddev: 12+ chars = very human, 0 = robotic
  sentenceStddevHigh: 14,
  // Paragraph-length coefficient of variation: 0.6+ = uneven (human), 0 = uniform (AI)
  paragraphCvHigh: 0.6,
} as const;

const WEIGHTS = {
  cliche: 0.30,
  transitionWords: 0.20,
  sentenceVariance: 0.15,
  concreteness: 0.15,
  firstPerson: 0.10,
  paragraphBalance: 0.10,
} as const;

// ---------- Public types ----------

export type HeuristicDimensionKey =
  | "cliche"
  | "transitionWords"
  | "sentenceVariance"
  | "concreteness"
  | "firstPerson"
  | "paragraphBalance";

export interface HeuristicBreakdown {
  /** 0-100, higher = more AI-like. */
  score: number;
  /** Each dimension normalized to [0, 1] in the AI-positive direction. */
  dimensions: Record<HeuristicDimensionKey, number>;
  /** Weights actually applied. Useful for transparency in UI. */
  weights: Record<HeuristicDimensionKey, number>;
  /** Raw text length in characters (after trim). */
  charCount: number;
}

// ---------- Scorer ----------

export function scoreText(rawText: string): HeuristicBreakdown {
  const text = rawText?.trim() ?? "";
  const charCount = text.length;

  const empty: HeuristicBreakdown = {
    score: 0,
    dimensions: {
      cliche: 0,
      transitionWords: 0,
      sentenceVariance: 0,
      concreteness: 0,
      firstPerson: 0,
      paragraphBalance: 0,
    },
    weights: { ...WEIGHTS },
    charCount,
  };

  if (charCount < 20) {
    // Too short to meaningfully score; treat as neutral-low.
    return empty;
  }

  const per1000 = (count: number): number => (count / charCount) * 1000;
  const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

  // 1. Cliche density (positive = AI)
  const clicheHits = countOccurrences(text, CLICHE_BLACKLIST);
  const cliche = clamp01(per1000(clicheHits) / THRESHOLDS.clichePer1000);

  // 2. Transition word density (positive = AI)
  const transitionHits = countOccurrences(text, TRANSITION_WORDS);
  const transitionWords = clamp01(
    per1000(transitionHits) / THRESHOLDS.transitionPer1000
  );

  // 3. Sentence-length stddev (high = human → invert)
  const sentences = splitSentences(text);
  const sentenceLengths = sentences.map((s) => s.length).filter((n) => n > 0);
  const stddev = standardDeviation(sentenceLengths);
  const sentenceVariance = clamp01(
    1 - stddev / THRESHOLDS.sentenceStddevHigh
  );

  // 4. Concreteness — numbers + units (high = human → invert)
  const concreteHits = (text.match(CONCRETE_REGEX) ?? []).length;
  const concreteness = clamp01(
    1 - per1000(concreteHits) / THRESHOLDS.concretePer1000
  );

  // 5. First-person markers (high = human → invert)
  const firstPersonHits = countOccurrences(text, FIRST_PERSON_MARKERS);
  const firstPerson = clamp01(
    1 - per1000(firstPersonHits) / THRESHOLDS.firstPersonPer1000
  );

  // 6. Paragraph balance — uniform paragraph lengths look AI-generated.
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const paragraphLengths = paragraphs.map((p) => p.length);
  const cv = coefficientOfVariation(paragraphLengths);
  // Lower CV = more uniform = more AI. Map: cv=0 → 1, cv=THRESHOLD → 0.
  const paragraphBalance = clamp01(1 - cv / THRESHOLDS.paragraphCvHigh);

  const dimensions: Record<HeuristicDimensionKey, number> = {
    cliche,
    transitionWords,
    sentenceVariance,
    concreteness,
    firstPerson,
    paragraphBalance,
  };

  let weighted = 0;
  for (const key of Object.keys(WEIGHTS) as HeuristicDimensionKey[]) {
    weighted += dimensions[key] * WEIGHTS[key];
  }

  return {
    score: Math.round(weighted * 100),
    dimensions,
    weights: { ...WEIGHTS },
    charCount,
  };
}

// ---------- Helpers ----------

function countOccurrences(text: string, needles: readonly string[]): number {
  let total = 0;
  for (const needle of needles) {
    if (!needle) continue;
    let from = 0;
    while (true) {
      const idx = text.indexOf(needle, from);
      if (idx === -1) break;
      total += 1;
      from = idx + needle.length;
    }
  }
  return total;
}

function splitSentences(text: string): string[] {
  // Split on Chinese + Western terminators, keeping non-empty trims.
  return text
    .split(/[。!?!?\n]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function coefficientOfVariation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  return standardDeviation(values) / mean;
}
