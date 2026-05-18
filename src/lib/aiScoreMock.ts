import { hashString, seededInt } from "./seed";

/**
 * Mock AI score provider — deterministic by articleId, used for demos and
 * for tests that need stable numbers. Real signal comes from the heuristic
 * provider (see aiScoreHeuristic.ts) once Phase B1 lands.
 *
 * Contract preserved from the original /api/ai-score handler:
 *   - fresh check: score in [28, 45], seeded by articleId
 *   - after humanize: drops 5-10 points, seeded by `${articleId}:humanize:${iteration}`
 *   - empty text returns 0
 *   - missing articleId falls back to a hash of the text prefix
 */

export interface MockScoreInput {
  text: string;
  articleId?: string;
  previousScore?: number | null;
  afterHumanize?: boolean;
  iteration?: number;
}

export interface MockScoreOutput {
  score: number;
  drop?: number;
  note?: string;
}

export function scoreMock(input: MockScoreInput): MockScoreOutput {
  if (!input.text?.trim()) {
    return { score: 0, note: "empty text" };
  }

  const seedBase = input.articleId ?? hashFromText(input.text);
  const previous =
    typeof input.previousScore === "number" && Number.isFinite(input.previousScore)
      ? Math.max(0, Math.min(100, input.previousScore))
      : null;

  if (input.afterHumanize && previous !== null) {
    const iter = input.iteration ?? 1;
    const drop = seededInt(`${seedBase}:humanize:${iter}`, 5, 10);
    const next = Math.max(12, previous - drop);
    return { score: next, drop };
  }

  // Fresh check — same articleId always gives the same number for demos.
  const score = seededInt(`${seedBase}:fresh`, 28, 45);
  return { score };
}

function hashFromText(text: string): string {
  return `text-${hashString(text.slice(0, 200)).toString(16)}`;
}
