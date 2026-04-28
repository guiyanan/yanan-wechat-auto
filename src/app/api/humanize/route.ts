import { NextRequest } from "next/server";
import { humanize, sseFromGenerator } from "@/lib/qwen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Req {
  intent: string;
  text: string;
  styleName: string;
  styleProfile: string;
}

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

  const gen = humanize({ ...input, signal: req.signal });
  const stream = sseFromGenerator(gen);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
