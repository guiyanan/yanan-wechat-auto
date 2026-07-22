import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
};

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  return serveUpload(context, true);
}

export async function HEAD(_req: NextRequest, context: RouteContext) {
  return serveUpload(context, false);
}

async function serveUpload(context: RouteContext, includeBody: boolean) {
  try {
    const { path: segments } = await context.params;
    const filePath = uploadPath(segments);
    const info = await stat(filePath);
    if (!info.isFile()) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const contentType =
      MIME_BY_EXT[path.extname(filePath).toLowerCase()] ??
      "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "Content-Length": String(info.size),
      "Cache-Control": "public, max-age=0",
    };

    if (!includeBody) return new NextResponse(null, { headers });
    const bytes = await readFile(filePath);
    return new NextResponse(bytes, { headers });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

function uploadPath(segments: string[]): string {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error("missing path");
  }
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("/") ||
        segment.includes("\\")
    )
  ) {
    throw new Error("invalid path");
  }

  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const candidate = path.normalize(path.join(uploadsRoot, ...segments));
  const relative = path.relative(uploadsRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("invalid path");
  }
  return candidate;
}
