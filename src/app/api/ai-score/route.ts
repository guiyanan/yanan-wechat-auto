import { NextRequest } from "next/server";
import { scoreMock } from "@/lib/aiScoreMock";
import { scoreText, type HeuristicBreakdown } from "@/lib/aiScoreHeuristic";

export const runtime = "nodejs";

interface Req {
  text: string;
  articleId?: string;
  previousScore?: number;
  afterHumanize?: boolean;
  iteration?: number;
}

export type AiScoreProvider = "mock" | "heuristic" | "zhuque";

interface AiScoreSuccess {
  score: number;
  drop?: number;
  note?: string;
  breakdown?: HeuristicBreakdown;
  provider: AiScoreProvider;
}

/**
 * AI-likeness score endpoint with provider abstraction.
 *
 *   AI_SCORE_PROVIDER=heuristic (default) — local six-dimension heuristic
 *   AI_SCORE_PROVIDER=mock                 — articleId-seeded deterministic mock
 *                                            (pinned by tests that need stable numbers)
 *   AI_SCORE_PROVIDER=zhuque               — placeholder, returns 501 Not Implemented
 *
 * Default flipped from mock to heuristic so the Editor + auto-humanize loop
 * see real signal in dev/prod. Tests that depend on the seeded mock must
 * pin the provider via vi.stubEnv("AI_SCORE_PROVIDER", "mock").
 */
export async function POST(req: NextRequest) {
  let input: Req;
  try {
    input = (await req.json()) as Req;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const provider = resolveProvider();

  if (provider === "zhuque") {
    return new Response("zhuque provider not implemented", { status: 501 });
  }

  if (provider === "mock") {
    return Response.json(runMock(input));
  }

  return Response.json(runHeuristic(input));
}

function resolveProvider(): AiScoreProvider {
  const raw = (process.env.AI_SCORE_PROVIDER ?? "heuristic").toLowerCase();
  if (raw === "mock" || raw === "heuristic" || raw === "zhuque") return raw;
  return "heuristic";
}

function runMock(input: Req): AiScoreSuccess {
  const out = scoreMock({
    text: input.text,
    articleId: input.articleId,
    previousScore: input.previousScore,
    afterHumanize: input.afterHumanize,
    iteration: input.iteration,
  });
  return { ...out, provider: "mock" };
}

function runHeuristic(input: Req): AiScoreSuccess {
  if (!input.text?.trim()) {
    return { score: 0, note: "empty text", provider: "heuristic" };
  }
  const breakdown = scoreText(input.text);

  // Mirror the mock contract: when called with afterHumanize + previousScore,
  // surface the drop so the UI can render the same "AI 浓度 -N" toast.
  const drop =
    input.afterHumanize && typeof input.previousScore === "number"
      ? Math.max(0, input.previousScore - breakdown.score)
      : undefined;

  return {
    score: breakdown.score,
    drop,
    breakdown,
    provider: "heuristic",
  };
}
