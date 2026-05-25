import { NextRequest, NextResponse } from "next/server";
import type { LearnedWritingStyle } from "@/types";
import { completeChat, QwenAuthError } from "@/lib/qwen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LearnStyleRequest {
  urls?: string[];
  pastedText?: string;
}

function genId(): string {
  return `style-learned-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchUrlText(url: string, signal: AbortSignal): Promise<string> {
  const parsed = new URL(url);
  if (parsed.hostname.includes("mp.weixin.qq.com")) {
    throw new Error("微信公众号链接通常无法稳定抓取,请粘贴正文兜底。");
  }
  const res = await fetch(url, {
    signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; JOTOContentFactory/1.0; +https://joto.ai)",
    },
  });
  if (!res.ok) throw new Error(`抓取失败: HTTP ${res.status}`);
  const html = await res.text();
  const text = stripHtml(html);
  if (text.length < 300) {
    throw new Error("链接正文过短,请粘贴文章正文兜底。");
  }
  return text.slice(0, 12000);
}

function fallbackStyle(text: string, urls: string[]): LearnedWritingStyle {
  const compact = text.replace(/\s+/g, " ").trim();
  return {
    id: genId(),
    name: "学习风格",
    sourceUrls: urls,
    toneProfile: "基于范文提炼:表达克制,段落清晰,先写场景和问题,再进入观点和产品价值。",
    titlePattern: "标题偏向问题式或观点式,用一个明确场景承载主题。",
    openingPattern: "开头先写一个具体工作场景或读者正在面对的矛盾,不直接堆产品概念。",
    paragraphPattern: "段落中等长度,每段围绕一个动作或判断展开,避免连续术语。",
    keySentencePattern: "用短句做阶段性总结,强调业务改变和选择理由。",
    sampleDigest: compact.slice(0, 220),
    createdAt: new Date().toISOString(),
  };
}

function parseStyle(raw: string, text: string, urls: string[]): LearnedWritingStyle {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallbackStyle(text, urls);
  try {
    const row = JSON.parse(match[0]) as Partial<LearnedWritingStyle>;
    return {
      id: genId(),
      name: row.name?.trim() || "学习风格",
      sourceUrls: urls,
      toneProfile: row.toneProfile?.trim() || fallbackStyle(text, urls).toneProfile,
      titlePattern: row.titlePattern?.trim() || fallbackStyle(text, urls).titlePattern,
      openingPattern:
        row.openingPattern?.trim() || fallbackStyle(text, urls).openingPattern,
      paragraphPattern:
        row.paragraphPattern?.trim() || fallbackStyle(text, urls).paragraphPattern,
      keySentencePattern:
        row.keySentencePattern?.trim() ||
        fallbackStyle(text, urls).keySentencePattern,
      sampleDigest: row.sampleDigest?.trim() || text.replace(/\s+/g, " ").slice(0, 220),
      createdAt: new Date().toISOString(),
    };
  } catch {
    return fallbackStyle(text, urls);
  }
}

export async function POST(req: NextRequest) {
  let body: LearnStyleRequest;
  try {
    body = (await req.json()) as LearnStyleRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const urls = (body.urls ?? []).map((u) => u.trim()).filter(Boolean).slice(0, 2);
  const pastedText = body.pastedText?.trim() ?? "";
  const chunks: string[] = [];
  const failures: string[] = [];

  for (const url of urls) {
    try {
      chunks.push(await fetchUrlText(url, req.signal));
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (pastedText) chunks.push(pastedText);

  const text = chunks.join("\n\n---\n\n").trim();
  if (text.length < 300) {
    return NextResponse.json(
      {
        ok: false,
        needsPaste: true,
        error:
          failures[0] ??
          "范文正文不足 300 字,请粘贴 1-2 篇文章正文后再学习。",
      },
      { status: 422 }
    );
  }

  try {
    const raw = await completeChat({
      model: "qwen-plus",
      temperature: 0.5,
      maxTokens: 1200,
      messages: [
        {
          role: "system",
          content: [
            "你是公众号写作风格分析师。",
            "任务:从用户提供的范文中提炼可复用写作风格,不是提炼文章角度,也不能照抄原文。",
            "输出严格 JSON 对象,不要解释文字。",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "请提炼以下范文的写作风格,字段:",
            "- name: 8 字以内中文风格名",
            "- toneProfile: 语气特征",
            "- titlePattern: 标题结构",
            "- openingPattern: 开头方式",
            "- paragraphPattern: 段落节奏",
            "- keySentencePattern: 金句/总结句方式",
            "- sampleDigest: 120 字以内范文摘要",
            "",
            "【范文】",
            text.slice(0, 12000),
          ].join("\n"),
        },
      ],
      signal: req.signal,
    });
    return NextResponse.json({
      ok: true,
      style: parseStyle(raw, text, urls),
      source: "qwen",
      warnings: failures,
    });
  } catch (err) {
    const style = fallbackStyle(text, urls);
    const reason =
      err instanceof QwenAuthError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return NextResponse.json({
      ok: true,
      style,
      source: "fallback",
      warnings: [...failures, reason],
    });
  }
}
