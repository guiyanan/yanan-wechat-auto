import { NextRequest } from "next/server";
import { scanLimitWords, uniqueMatchedWords } from "@/lib/limitWords";
import { scanSensitive, uniqueTopics } from "@/lib/sensitiveTopics";

export const runtime = "nodejs";

interface Req {
  text: string;
}

export async function POST(req: NextRequest) {
  let input: Req;
  try {
    input = (await req.json()) as Req;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const text = input.text ?? "";
  const limitMatches = scanLimitWords(text);
  const sensitiveMatches = scanSensitive(text);
  return Response.json({
    limitWords: uniqueMatchedWords(limitMatches),
    sensitiveTopics: uniqueTopics(sensitiveMatches),
    limitMatches,
    sensitiveMatches,
  });
}
