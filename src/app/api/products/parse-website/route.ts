import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ParseWebsiteRequest {
  url: string;
}

function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractMeta(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  return pattern.exec(html)?.[1]?.trim() ?? "";
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHtml(html: string): string {
  return /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  let body: ParseWebsiteRequest;
  try {
    body = (await req.json()) as ParseWebsiteRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const url = normalizeUrl(body.url);
  if (!url) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; JOTOContentFactory/1.0; +https://joto.ai)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const html = await res.text();
    const text = htmlToText(html).slice(0, 5000);
    const title = titleFromHtml(html);
    const description =
      extractMeta(html, "description") || extractMeta(html, "og:description");
    const notes = [
      `官网链接：${url}`,
      title ? `页面标题：${title}` : "",
      description ? `页面描述：${description}` : "",
      text ? `页面可读文本片段：${text.slice(0, 2600)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return NextResponse.json({
      ok: true,
      url,
      title,
      description,
      notes:
        notes ||
        `官网链接：${url}\n页面已响应,但未解析出稳定文本。请手动补充官网定位、核心页面和产品模块。`,
      status: res.status,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        url,
        error: err instanceof Error ? err.message : String(err),
        notes: `官网链接：${url}\n官网暂时无法自动访问或解析。请手动补充官网定位、核心页面、产品模块、客户角色和文章要强调的卖点。`,
      },
      { status: 200 }
    );
  } finally {
    clearTimeout(timer);
  }
}
