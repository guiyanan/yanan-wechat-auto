import { NextRequest } from "next/server";
import { humanize, QwenAuthError } from "@/lib/qwen";
import {
  buildQwenHumanizeFn,
  runHumanizePipeline,
  runStructurePreservingPipeline,
  type PipelineResult,
} from "@/lib/humanize/pipeline";
import { ARTICLE_TYPES, type ArticleType } from "@/lib/articleType";
import { detectScore } from "@/lib/humanize/detectScore";
import { textSimilarity } from "@/lib/humanize/similarity";

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
 * Run the full humanize pipeline on a body of text.
 *
 *   L1 — Qwen humanize per H2 section (concurrent, max 3)
 *   L2 — Deterministic post-processing (vocab + sentence-length variation)
 *   L3 — 4-dimensional detection scoring with threshold gating
 *
 * If L3 score > 40, each section is retried (up to 2 rounds total).
 *
 * Used by the batch preview page's "Humanize" button. Returns the
 * processed text plus quality metadata. The caller only marks the article
 * passed when this route's quality gate passes.
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
    const beforeScoreBreakdown = detectScore(input.text);
    const baseHumanizeFn = buildQwenHumanizeFn({
      intent:
        input.intent ??
        "两段强改:先保留事实和 JOTO 白底公众号版式,再把标题、金句、列表和段落节奏改成真人公众号编辑写给 IT、运营、办公室用户看的轻松产品故事。可以自然口语化,但不得网红化;不得新增客户、数据、百分比、金额或部署效果。",
      styleName: "JOTO 轻松公众号故事体",
      styleProfile: [
        "默认目标:公众号产品故事,轻松、具体、少官宣腔。",
        input.styleName ? `原文章参考风格:${input.styleName}` : "",
        input.styleProfile ? `参考风格说明:${input.styleProfile}` : "",
        "原风格只作节奏参考,不得覆盖 JOTO 轻松公众号故事体。",
      ]
        .filter(Boolean)
        .join("\n"),
      articleType: input.articleType,
      humanize,
    });

    const pipeline = input.preserveStructure
      ? runStructurePreservingPipeline
      : runHumanizePipeline;
    const result: PipelineResult = await pipeline(input.text, baseHumanizeFn, {
      threshold: 40,
      maxRounds: 2,
      concurrency: 3,
      rewriteMicrocopy: true,
      signal: req.signal,
    });

    const similarity = textSimilarity(input.text, result.text);
    const afterScore = result.scoreBreakdown.total;
    const beforeScore = beforeScoreBreakdown.total;
    const scoreLooksBetter = afterScore <= 35 || afterScore < beforeScore;
    const changedEnough = similarity <= 0.92 || beforeScore <= 25;
    const passed = scoreLooksBetter && changedEnough;

    const payload = {
      ...result,
      beforeScoreBreakdown,
      similarity,
      mode: "two-pass-strong" as const,
      passed,
    };

    if (!passed) {
      return Response.json(
        {
          ...payload,
          error:
            "Humanize 质量门禁未通过:改写幅度或 AI 味改善不足,请重试强改。",
        },
        { status: 422 }
      );
    }

    return Response.json(payload);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return new Response("aborted", { status: 499 });
    }
    if (err instanceof QwenAuthError) {
      return new Response(err.message, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "pipeline failed";
    return new Response(message, { status: 500 });
  }
}
