import { NextRequest } from "next/server";
import { humanize } from "@/lib/qwen";
import { getDeepSeekChatOptions } from "@/lib/deepseek";
import { ARTICLE_TYPES, type ArticleType } from "@/lib/articleType";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Req {
  intent: string;
  text: string;
  styleName: string;
  styleProfile: string;
  articleType: ArticleType;
}

interface OnceResponse {
  rewritten: string;
}

/**
 * Non-streaming variant of /api/humanize. Used by the auto-humanize loop in
 * the Editor: each iteration must finish completely (full rewritten text in
 * hand) before the next /api/ai-score + /api/humanize cycle starts. Mixing
 * SSE streamReplace with multi-iteration loops causes timing races where the
 * editor's getText() reads a half-streamed paragraph as input for the next
 * round.
 *
 * Same prompt, same model, same temperature as /api/humanize — only the
 * transport differs.
 */
export async function POST(req: NextRequest) {
  let input: Req;
  try {
    input = (await req.json()) as Req;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (!input.text?.trim()) {
    return new Response("text required", { status: 400 });
  }
  if (!input.articleType || !ARTICLE_TYPES.includes(input.articleType)) {
    return new Response(
      `articleType required (one of: ${ARTICLE_TYPES.join(" | ")})`,
      { status: 400 }
    );
  }

  try {
    const chunks: string[] = [];
    for await (const delta of humanize({
      ...input,
      ...getDeepSeekChatOptions(),
      signal: req.signal,
    })) {
      chunks.push(delta);
    }
    const body: OnceResponse = { rewritten: chunks.join("") };
    return Response.json(body);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return new Response("aborted", { status: 499 });
    }
    const message = err instanceof Error ? err.message : "humanize failed";
    return new Response(message, { status: 500 });
  }
}
