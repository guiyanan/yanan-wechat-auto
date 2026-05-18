import { NextRequest } from "next/server";
import { humanize, QwenAuthError } from "@/lib/qwen";
import {
  buildQwenHumanizeFn,
  runHumanizePipeline,
  runStructurePreservingPipeline,
  type HumanizeFn,
  type PipelineResult,
} from "@/lib/humanize/pipeline";
import { ARTICLE_TYPES, type ArticleType } from "@/lib/articleType";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PipelineReq {
  /** Plain-text body to humanize. May contain markdown H2 (`## ...`). */
  text: string;
  articleType: ArticleType;
  styleName: string;
  styleProfile: string;
  /** Override Qwen rewrite intent. Optional — sensible default below. */
  intent?: string;
  /**
   * When true, route the request through `runStructurePreservingPipeline`
   * which only sends paragraph blocks to the LLM. Headings, lists,
   * blockquotes, and horizontal rules pass through untouched so the
   * article's original visual layout (h2 / h3 / `- list` / `> quote`)
   * is guaranteed to survive the rewrite.
   *
   * Default: false (use the original section-splitting pipeline).
   */
  preserveStructure?: boolean;
}

/**
 * Run the full three-layer humanize pipeline on a body of text.
 *
 *   L1 — Qwen humanize per H2 section (concurrent, max 3)
 *   L2 — Deterministic post-processing (vocab + sentence-length variation)
 *   L3 — 4-dimensional detection scoring with threshold gating
 *
 * If L3 score > 40, each section is retried (up to 2 rounds total).
 *
 * Used by the batch preview page's "Humanize" button. Returns the
 * processed text plus the final score breakdown — the caller patches
 * the article and promotes it from stage="batch" to stage="main".
 */
export async function POST(req: NextRequest) {
  let input: PipelineReq;
  try {
    input = (await req.json()) as PipelineReq;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (!input.text || !input.text.trim()) {
    return new Response("text required", { status: 400 });
  }
  if (!input.articleType || !ARTICLE_TYPES.includes(input.articleType)) {
    return new Response(
      `articleType required (one of: ${ARTICLE_TYPES.join(" | ")})`,
      { status: 400 }
    );
  }

  try {
    const baseHumanizeFn = buildQwenHumanizeFn({
      intent:
        input.intent ??
        "在保持主要观点与事实的前提下，用更接近人手写作的语气逐段重写，降低 AI 痕迹。不口语化，不过度学术，业务视角。",
      styleName: input.styleName ?? "默认",
      styleProfile: input.styleProfile ?? "",
      articleType: input.articleType,
      humanize,
    });

    // Graceful degradation: when DASHSCOPE_API_KEY is not configured (demo
    // environments, local dev without keys), the underlying Qwen call
    // throws QwenAuthError. Catch it per-section and return the section
    // text unchanged — L2 post-processing + L3 scoring still run, so the
    // pipeline produces a useful result instead of failing the whole batch.
    const humanizeFn: HumanizeFn = async (text, signal) => {
      try {
        return await baseHumanizeFn(text, signal);
      } catch (err) {
        if (err instanceof QwenAuthError) return text;
        throw err;
      }
    };

    const pipeline = input.preserveStructure
      ? runStructurePreservingPipeline
      : runHumanizePipeline;
    const result: PipelineResult = await pipeline(input.text, humanizeFn, {
      threshold: 40,
      maxRounds: 2,
      concurrency: 3,
      signal: req.signal,
    });

    return Response.json(result);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return new Response("aborted", { status: 499 });
    }
    const message = err instanceof Error ? err.message : "pipeline failed";
    return new Response(message, { status: 500 });
  }
}
