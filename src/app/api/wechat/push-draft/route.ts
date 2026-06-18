import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  getDefaultAuthor,
  getOptionalDefaultThumbMediaId,
  pushDraft,
  uploadArticleImage,
  uploadThumbMaterial,
  WechatConfigError,
  WechatApiError,
} from "@/lib/wechatDraft";
import { generateWechatCoverPng } from "@/lib/wechatCover";
import { exportWechatHtml } from "@/lib/wechatHtml";
import { buildAigcMetadata } from "@/lib/aigcMeta";
import { rewriteLocalImagesForWechat } from "@/lib/wechatImageRewrite";
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
  /** Selected cover image URL, such as a 300x300 Unsplash CDN image. */
  coverImageUrl?: string;
  /** Product name for auto-generated cover */
  productName?: string;
  /** Cover style label for auto-generated cover */
  coverStyleLabel?: string;
  /** Article summary/digest */
  digest?: string;
  /** Captured JOTO official-account header/footer snippets */
  jotoFollowHeaderHtml?: string;
  jotoContactFooterHtml?: string;
}

function sanitizeFilename(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return cleaned || `joto-cover-${Date.now()}`;
}

async function replaceLocalJotoImagesForWechat(html: string): Promise<{
  html: string;
  uploadedContentImages: string[];
}> {
  const result = await rewriteLocalImagesForWechat(html, {
    readLocalFile: async (publicPath) => {
      const filePath = path.join(process.cwd(), "public", publicPath);
      const bytes = await readFile(filePath);
      return {
        bytes,
        fileName: path.basename(publicPath),
        mimeType: inferImageMimeType(publicPath),
      };
    },
    uploadImage: async (bytes, fileName, mimeType) => {
      const upload = await uploadArticleImage(bytes, fileName, mimeType);
      if (!upload.ok || !upload.url) {
        throw new WechatApiError(
          upload.error ?? `正文图片上传微信失败：${fileName}`,
          upload.errcode
        );
      }
      return upload;
    },
  });

  return {
    html: result.html,
    uploadedContentImages: result.uploadedUrls,
  };
}

async function fetchRemoteCoverPng(url: string): Promise<Buffer | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return await sharp(bytes)
      .resize(300, 300, { fit: "cover", position: "attention" })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

function inferImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
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
    const rawHtml = exportWechatHtml({
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
      jotoFollowHeaderHtml: body.jotoFollowHeaderHtml,
      jotoContactFooterHtml: body.jotoContactFooterHtml,
    });
    const { html, uploadedContentImages } =
      await replaceLocalJotoImagesForWechat(rawHtml);

    const author = body.author?.trim() || getDefaultAuthor();
    let thumbMediaId =
      body.thumbMediaId?.trim() || getOptionalDefaultThumbMediaId();
    let generatedCover = false;
    let remoteCover = false;

    if (!thumbMediaId) {
      const remoteCoverPng = body.coverImageUrl?.trim()
        ? await fetchRemoteCoverPng(body.coverImageUrl.trim())
        : null;
      const coverPng =
        remoteCoverPng ??
        (await generateWechatCoverPng({
          title: body.title,
          productName: body.productName,
          styleLabel: body.coverStyleLabel,
        }));
      const upload = await uploadThumbMaterial(
        coverPng,
        `${sanitizeFilename(body.articleId || body.title)}.png`
      );

      if (!upload.ok || !upload.mediaId) {
        return NextResponse.json(
          {
            ok: false,
            error: upload.error ?? "自动封面上传失败",
            errcode: upload.errcode,
          },
          { status: 502 }
        );
      }

      thumbMediaId = upload.mediaId;
      remoteCover = Boolean(remoteCoverPng);
      generatedCover = !remoteCover;
    }

    // Push to WeChat draft box
    const result = await pushDraft({
      title: body.title,
      author,
      content: html,
      digest: body.digest,
      thumb_media_id: thumbMediaId,
      show_cover_pic: 0,
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
      thumbMediaId,
      generatedCover,
      remoteCover,
      uploadedContentImages,
      author,
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
