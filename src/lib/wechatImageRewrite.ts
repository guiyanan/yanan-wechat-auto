export interface LocalImageFile {
  bytes: Uint8Array | Buffer;
  fileName: string;
  mimeType: string;
}

export interface WechatInlineImageUpload {
  ok?: boolean;
  url?: string;
  error?: string;
  errcode?: number;
}

export interface RewriteLocalImagesOptions {
  readLocalFile: (publicPath: string) => Promise<LocalImageFile>;
  uploadImage: (
    bytes: Uint8Array | Buffer,
    fileName: string,
    mimeType: string
  ) => Promise<WechatInlineImageUpload>;
}

export interface RewriteLocalImagesResult {
  html: string;
  uploadedUrls: string[];
}

const IMAGE_ATTR_RE = /\b(?:src|data-src)=["']([^"']+)["']/gi;

export async function rewriteLocalImagesForWechat(
  html: string,
  options: RewriteLocalImagesOptions
): Promise<RewriteLocalImagesResult> {
  const localUrls = Array.from(extractLocalImageUrls(html));
  if (!localUrls.length) {
    return { html, uploadedUrls: [] };
  }

  let nextHtml = html;
  const uploadedUrls: string[] = [];

  for (const localUrl of localUrls) {
    const publicPath = toPublicPath(localUrl);
    const file = await options.readLocalFile(publicPath);
    const upload = await options.uploadImage(
      file.bytes,
      file.fileName,
      file.mimeType
    );

    if (!upload.ok || !upload.url) {
      throw new Error(upload.error ?? `微信正文图片上传失败：${file.fileName}`);
    }

    nextHtml = nextHtml.split(localUrl).join(upload.url);
    uploadedUrls.push(upload.url);
  }

  return { html: nextHtml, uploadedUrls };
}

function extractLocalImageUrls(html: string): Set<string> {
  const urls = new Set<string>();
  for (const match of html.matchAll(IMAGE_ATTR_RE)) {
    const url = match[1]?.trim();
    if (isLocalImageUrl(url)) {
      urls.add(url);
    }
  }
  return urls;
}

function isLocalImageUrl(url: string | undefined): url is string {
  if (!url) return false;
  if (!url.startsWith("/") || url.startsWith("//")) return false;
  if (url.startsWith("/_next/")) return false;
  return /\.(?:png|jpe?g|webp)(?:[?#].*)?$/i.test(url);
}

function toPublicPath(localUrl: string): string {
  const withoutQuery = localUrl.split(/[?#]/)[0] ?? localUrl;
  const publicPath = withoutQuery.replace(/^\/+/, "");
  if (!publicPath || publicPath.includes("..")) {
    throw new Error(`不安全的本地图片路径：${localUrl}`);
  }
  return decodeURIComponent(publicPath);
}
