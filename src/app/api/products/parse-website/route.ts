import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBSITE_TEXT_CAPTURE_LIMIT = 24_000;
const WEBSITE_NOTES_TEXT_LIMIT = 20_000;
const MIN_RICH_WEBSITE_TEXT_LENGTH = 80;
const MIN_RICH_WEBSITE_SIGNAL_COUNT = 3;

const PRODUCT_SIGNAL_PATTERNS = [
  /AI/gi,
  /NetOps/gi,
  /网络/gi,
  /运维/gi,
  /配置/gi,
  /诊断/gi,
  /拓扑/gi,
  /自然语言/gi,
  /产品/gi,
  /平台/gi,
  /功能/gi,
  /模块/gi,
  /场景/gi,
  /痛点/gi,
  /问题/gi,
  /困境/gi,
  /流程/gi,
  /客户/gi,
  /用户/gi,
  /角色/gi,
  /适用/gi,
  /解决/gi,
  /生成/gi,
  /分析/gi,
  /管理/gi,
  /自动化/gi,
  /输出/gi,
  /workflow/gi,
  /feature/gi,
  /platform/gi,
  /customer/gi,
  /user/gi,
  /solution/gi,
  /generate/gi,
  /automation/gi,
];

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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  );
}

function titleFromHtml(html: string): string {
  return /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
}

function manualFillNotes(url: string, reason: string): string {
  return `官网链接：${url}\n${reason}。请手动补充官网定位、核心页面、产品模块、客户角色和文章要强调的卖点。`;
}

function collectJsonLdStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    const text = value.trim();
    if (text.length >= 2) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdStrings(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key.startsWith("@")) continue;
      collectJsonLdStrings(item, out);
    }
  }
  return out;
}

function extractJsonLdText(html: string): string {
  const matches = Array.from(
    html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  );
  const parts: string[] = [];
  for (const match of matches) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(match[1].trim()));
      parts.push(...collectJsonLdStrings(parsed));
    } catch {
      // Ignore malformed JSON-LD. Meta tags and visible text still carry signal.
    }
  }
  return Array.from(new Set(parts)).join(" ");
}

function buildMetadataText(html: string): string {
  const metadata = [
    titleFromHtml(html),
    extractMeta(html, "description"),
    extractMeta(html, "og:description"),
    extractMeta(html, "twitter:description"),
    extractMeta(html, "keywords"),
    extractJsonLdText(html),
  ]
    .map((part) => part.trim())
    .filter(Boolean);
  return Array.from(new Set(metadata)).join(" ");
}

function countProductSignals(text: string): number {
  return PRODUCT_SIGNAL_PATTERNS.reduce((total, pattern) => {
    pattern.lastIndex = 0;
    return total + (text.match(pattern)?.length ?? 0);
  }, 0);
}

function extractCoreClues(text: string): string[] {
  const clues: string[] = [];
  const seen = new Set<string>();
  const fragments = text
    .split(/[。！？!?；;]|(?<=\.)\s+/)
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length >= 12);

  for (const fragment of fragments) {
    if (!PRODUCT_SIGNAL_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(fragment);
    })) {
      continue;
    }
    const clue = fragment.slice(0, 220);
    if (!seen.has(clue)) {
      seen.add(clue);
      clues.push(clue);
    }
    if (clues.length >= 8) break;
  }
  return clues;
}

function websiteParseQuality(
  visibleText: string,
  metadataText: string
): "rich" | "metadata" | "shallow" {
  const text = [visibleText, metadataText].filter(Boolean).join(" ");
  if (
    text.length < MIN_RICH_WEBSITE_TEXT_LENGTH ||
    countProductSignals(text) < MIN_RICH_WEBSITE_SIGNAL_COUNT
  ) {
    return "shallow";
  }
  if (
    visibleText.length < MIN_RICH_WEBSITE_TEXT_LENGTH ||
    countProductSignals(visibleText) < MIN_RICH_WEBSITE_SIGNAL_COUNT
  ) {
    return "metadata";
  }
  return "rich";
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
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          url,
          error: `HTTP ${res.status}`,
          notes: manualFillNotes(url, "官网返回非成功状态"),
          status: res.status,
        },
        { status: 502 }
      );
    }
    const html = await res.text();
    const visibleText = htmlToText(html).slice(0, WEBSITE_TEXT_CAPTURE_LIMIT);
    const metadataText = buildMetadataText(html).slice(0, WEBSITE_TEXT_CAPTURE_LIMIT);
    const text = [visibleText, metadataText]
      .filter(Boolean)
      .join(" ")
      .slice(0, WEBSITE_TEXT_CAPTURE_LIMIT);
    const title = titleFromHtml(html);
    const description =
      extractMeta(html, "description") || extractMeta(html, "og:description");
    const signalCount = countProductSignals(text);
    const quality = websiteParseQuality(visibleText, metadataText);
    const coreClues = extractCoreClues(text);
    if (text.length < 40 && !description) {
      return NextResponse.json(
        {
          ok: false,
          url,
          error: "no readable text",
          notes: manualFillNotes(url, "页面已响应,但未解析出稳定文本"),
          status: res.status,
          quality: "shallow",
        },
        { status: 422 }
      );
    }
    if (quality === "shallow") {
      return NextResponse.json(
        {
          ok: false,
          url,
          title,
          description,
          error: "shallow website text",
          notes: manualFillNotes(url, "页面已响应,但只解析到少量官网正文或导航文本"),
          status: res.status,
          quality,
          readableTextLength: text.length,
          productSignalCount: signalCount,
        },
        { status: 422 }
      );
    }
    const notes = [
      `官网链接：${url}`,
      title ? `页面标题：${title}` : "",
      description ? `页面描述：${description}` : "",
      quality === "metadata"
        ? `页面解析质量：正文少,但解析到较完整 metadata,可读素材 ${text.length} 字，产品线索 ${signalCount} 个`
        : `页面解析质量：正文 ${text.length} 字，产品线索 ${signalCount} 个`,
      coreClues.length ? `页面核心线索：${coreClues.join(" / ")}` : "",
      text ? `页面可读文本片段：${text.slice(0, WEBSITE_NOTES_TEXT_LIMIT)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return NextResponse.json({
      ok: true,
      url,
      title,
      description,
      notes,
      status: res.status,
      quality,
      readableTextLength: text.length,
      productSignalCount: signalCount,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        url,
        error: err instanceof Error ? err.message : String(err),
        notes: manualFillNotes(url, "官网暂时无法自动访问或解析"),
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
