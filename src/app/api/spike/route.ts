import { NextRequest } from "next/server";
import { sseFromGenerator, streamChat } from "@/lib/qwen";
import { getDeepSeekChatOptions } from "@/lib/deepseek";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const prompt =
    typeof body.prompt === "string" && body.prompt.trim().length > 0
      ? body.prompt
      : "请用不超过 200 字介绍一下你是谁。";

  const generator = streamChat({
    ...getDeepSeekChatOptions(),
    messages: [
      {
        role: "system",
        content:
          "你是 JOTO 内容工厂的 AI 助手。回复使用简体中文,语气克制专业。",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    maxTokens: 800,
    signal: req.signal,
  });

  const stream = sseFromGenerator(generator);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
