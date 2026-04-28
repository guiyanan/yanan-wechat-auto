import { NextRequest } from "next/server";
import { hashString, seededInt } from "@/lib/seed";

export const runtime = "nodejs";

interface Req {
  text: string;
  articleId?: string;
  previousScore?: number;
  afterHumanize?: boolean;
  iteration?: number;
}

/**
 * Mock 朱雀 AI score endpoint (PRD 6.3.4).
 *
 * Deterministic by design: same articleId + iteration always yields the same
 * score. This lets demos reproduce exactly. Real 朱雀 integration is P1.
 *
 * Contract:
 *   - first check (afterHumanize=false): score in 28-45, seeded by articleId
 *   - after humanize (afterHumanize=true): drops 5-10 points from previousScore,
 *     seeded by `${articleId}:humanize:${iteration}`
 */
export async function POST(req: NextRequest) {
  let input: Req;
  try {
    input = (await req.json()) as Req;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (!input.text?.trim()) {
    return Response.json({ score: 0, note: "empty text" });
  }

  // Simulate network jitter — NOT seeded (real API has real latency)
  await new Promise((r) => setTimeout(r, 250));

  const previous = Number.isFinite(input.previousScore)
    ? Math.max(0, Math.min(100, input.previousScore as number))
    : null;

  const seedBase = input.articleId ?? hashFromText(input.text);

  if (input.afterHumanize && previous !== null) {
    const iter = input.iteration ?? 1;
    const drop = seededInt(`${seedBase}:humanize:${iter}`, 5, 10);
    const next = Math.max(12, previous - drop);
    return Response.json({ score: next, drop });
  }

  // Fresh check: 28-45 inclusive, deterministic per article
  const score = seededInt(`${seedBase}:fresh`, 28, 45);
  return Response.json({ score });
}

// Fallback seed when articleId is not provided — hash the text so callers
// who forget to send articleId still get reproducibility for identical text.
function hashFromText(text: string): string {
  return `text-${hashString(text.slice(0, 200)).toString(16)}`;
}
