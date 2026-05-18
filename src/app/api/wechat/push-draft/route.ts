import { NextResponse } from "next/server";
import {
  pushDraft,
  WechatConfigError,
  WechatApiError,
} from "@/lib/wechatDraft";
import { exportWechatHtml } from "@/lib/wechatHtml";
import { buildAigcMetadata } from "@/lib/aigcMeta";
import type { WechatTheme } from "@/lib/wechatThemes";

export const runtime = "nodejs";

interface PushDraftRequest {
  /** Article title */
  title: string;
  /** TipTap body HTML */
  bodyHtml: string;
  /** Author name */
  author?: string;
  /** Theme for export rendering */
  theme?: WechatTheme;
  /** Whether to run decoration pass */
  decorate?: boolean;
  /** Whether to add explicit AIGC notice */
  addAigcNotice?: boolean;
  /** Article ID for metadata */
  articleId?: string;
  /** Cover media_id from WeChat material library */
  thumbMediaId?: string;
  /** Article summary/digest */
  digest?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PushDraftRequest;

    if (!body.title?.trim() || !body.bodyHtml?.trim()) {
      return NextResponse.json(
        { ok: false, error: "title and bodyHtml are required" },
        { status: 400 }
      );
    }

    // Render the full inline-styled HTML
    const html = exportWechatHtml({
      title: body.title,
      bodyHtml: body.bodyHtml,
      author: body.author,
      publishedAt: new Date().toISOString(),
      theme: body.theme ?? "minimal",
      decorate: body.decorate ?? true,
      addExplicitNotice: body.addAigcNotice ?? true,
      meta: buildAigcMetadata({
        articleId: body.articleId,
        humanReviewed: true,
      }),
    });

    // Push to WeChat draft box
    const result = await pushDraft({
      title: body.title,
      author: body.author,
      content: html,
      digest: body.digest,
      thumb_media_id: body.thumbMediaId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, errcode: result.errcode },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      mediaId: result.mediaId,
    });
  } catch (err: unknown) {
    if (err instanceof WechatConfigError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 500 }
      );
    }
    if (err instanceof WechatApiError) {
      return NextResponse.json(
        { ok: false, error: err.message, errcode: err.code },
        { status: 502 }
      );
    }
    const message =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
