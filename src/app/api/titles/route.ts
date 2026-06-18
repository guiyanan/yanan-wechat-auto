import { NextRequest } from "next/server";
import { generateTitles, parseTitles, QwenAuthError } from "@/lib/qwen";
import { getDeepSeekChatOptions } from "@/lib/deepseek";

export const runtime = "nodejs";

interface Req {
  product: string;
  angle: string;
  styleName: string;
  body: string;
}

export async function POST(req: NextRequest) {
  let input: Req;
  try {
    input = (await req.json()) as Req;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  try {
    const titles = await generateTitles({
      ...input,
      ...getDeepSeekChatOptions(),
      signal: req.signal,
    });
    return Response.json({ titles });
  } catch (err) {
    if (err instanceof QwenAuthError) {
      return Response.json({
        titles: parseTitles(
          `[${JSON.stringify(`${input.product} · 观察笔记`)},${JSON.stringify(
            `${input.product}:${input.angle}`
          )},${JSON.stringify(
            `我们为什么谈 ${input.product}`
          )},${JSON.stringify(`${input.product} 的三个侧面`)},${JSON.stringify(
            `${input.product} 的一次实测`
          )}]`
        ),
        note: "fallback",
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    return new Response(message, { status: 502 });
  }
}
