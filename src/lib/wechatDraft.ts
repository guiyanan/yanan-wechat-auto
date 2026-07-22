/**
 * WeChat Official Account API client — access_token caching + draft/add.
 *
 * Uses the stable 2.0 token endpoint:
 *   POST https://api.weixin.qq.com/cgi-bin/stable_token
 *
 * Then pushes a draft via:
 *   POST https://api.weixin.qq.com/cgi-bin/draft/add?access_token=xxx
 *
 * Env vars required: WECHAT_APPID, WECHAT_APPSECRET
 */

/* ---------- Types ---------- */

export interface WechatDraftArticle {
  /** Article title (required, max 64 chars) */
  title: string;
  /** Author name (optional, max 8 chars) */
  author?: string;
  /** Body HTML — inline-styled, ready for WeChat rendering */
  content: string;
  /** Article digest / summary (optional, max 120 chars) */
  digest?: string;
  /** Cover media_id from WeChat material library (optional) */
  thumb_media_id?: string;
  /** 1 = show cover in article body, 0 = hide */
  show_cover_pic?: 0 | 1;
  /** Original article URL for "阅读原文" link */
  content_source_url?: string;
  /** 1 = can be commented on, 0 = cannot */
  need_open_comment?: 0 | 1;
  /** 1 = only followers can comment, 0 = anyone */
  only_fans_can_comment?: 0 | 1;
}

export interface PushDraftResult {
  ok: boolean;
  /** WeChat media_id for the draft (on success) */
  mediaId?: string;
  /** Error message (on failure) */
  error?: string;
  /** WeChat errcode (on failure) */
  errcode?: number;
}

export interface UploadThumbResult {
  ok: boolean;
  /** WeChat media_id for the uploaded cover material */
  mediaId?: string;
  /** WeChat-hosted material URL, when returned by the API */
  url?: string;
  /** Error message (on failure) */
  error?: string;
  /** WeChat errcode (on failure) */
  errcode?: number;
}

export interface UploadArticleImageResult {
  ok: boolean;
  /** WeChat-hosted image URL for use inside article content */
  url?: string;
  /** Error message (on failure) */
  error?: string;
  /** WeChat errcode (on failure) */
  errcode?: number;
}

export interface WechatConfigStatus {
  ok: boolean;
  missing: string[];
  hasAppId: boolean;
  hasAppSecret: boolean;
  hasDefaultThumbMediaId: boolean;
  defaultAuthor?: string;
  defaultThumbMediaId?: string;
}

/* ---------- Token cache ---------- */

interface TokenEntry {
  token: string;
  expiresAt: number; // Date.now() ms
}

let cachedToken: TokenEntry | null = null;

export function getWechatConfigStatus(): WechatConfigStatus {
  const appId = process.env.WECHAT_APPID?.trim();
  const appSecret = process.env.WECHAT_APPSECRET?.trim();
  const defaultThumbMediaId =
    process.env.WECHAT_DEFAULT_THUMB_MEDIA_ID?.trim();
  const defaultAuthor = process.env.WECHAT_DEFAULT_AUTHOR?.trim();
  const missing: string[] = [];

  if (!appId) missing.push("WECHAT_APPID");
  if (!appSecret) missing.push("WECHAT_APPSECRET");

  return {
    ok: missing.length === 0,
    missing,
    hasAppId: Boolean(appId),
    hasAppSecret: Boolean(appSecret),
    hasDefaultThumbMediaId: Boolean(defaultThumbMediaId),
    defaultAuthor,
    defaultThumbMediaId,
  };
}

export function getDefaultAuthor(): string {
  return process.env.WECHAT_DEFAULT_AUTHOR?.trim() || "JOTO";
}

export function getOptionalDefaultThumbMediaId(): string | undefined {
  return process.env.WECHAT_DEFAULT_THUMB_MEDIA_ID?.trim() || undefined;
}

export function describeWechatError(errcode: number, errmsg?: string): string {
  const details = errmsg ? `：${errmsg}` : "";
  const known: Record<number, string> = {
    40001: "access_token 无效或已过期，系统已尝试刷新",
    40007: "封面素材 media_id 无效，请重新生成封面或检查素材 ID",
    40013: "AppID 无效，请检查 WECHAT_APPID",
    40164: "当前服务器 IP 未加入公众号后台 IP 白名单",
    41005: "缺少上传素材文件，请重试封面上传",
    41006: "缺少封面素材 media_id，请重新上传封面后再推送",
    45009: "公众号 API 调用次数已达上限，请稍后重试",
    48001: "公众号未开通该 API 权限或账号类型不支持",
  };
  return `${known[errcode] ?? `微信接口错误 ${errcode}`}${details}`;
}

/**
 * Get a valid access_token, refreshing if expired or missing.
 * Caches in memory with a 90-minute effective TTL (WeChat tokens last 2h).
 */
export async function getAccessToken(): Promise<string> {
  const appId = process.env.WECHAT_APPID;
  const appSecret = process.env.WECHAT_APPSECRET;

  if (!appId || !appSecret) {
    throw new WechatConfigError(
      "Missing WECHAT_APPID or WECHAT_APPSECRET in environment"
    );
  }

  // Return cached token if still valid (with 5-minute buffer)
  if (cachedToken && cachedToken.expiresAt - Date.now() > 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const res = await fetch(
    "https://api.weixin.qq.com/cgi-bin/stable_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credential",
        appid: appId,
        secret: appSecret,
      }),
    }
  );

  if (!res.ok) {
    throw new WechatApiError(
      `Token request failed: HTTP ${res.status}`,
      res.status
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (data.errcode && data.errcode !== 0) {
    throw new WechatApiError(
      describeWechatError(data.errcode, data.errmsg),
      data.errcode
    );
  }

  if (!data.access_token || !data.expires_in) {
    throw new WechatApiError("Invalid token response: missing access_token");
  }

  cachedToken = {
    token: data.access_token,
    // Cache for 90 minutes (WeChat gives 7200s = 2h)
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

/** Clear the cached token (useful for tests or forced refresh) */
export function clearTokenCache(): void {
  cachedToken = null;
}

/* ---------- Upload cover material ---------- */

function toBlob(bytes: Uint8Array | Buffer, type: string): Blob {
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  return new Blob([arrayBuffer], { type });
}

/**
 * Upload an article cover as a permanent "thumb" material.
 *
 * WeChat draft/add requires a thumb_media_id. If the user has not configured a
 * default cover media_id, the push route generates a cover image and calls this
 * helper before creating the draft.
 */
export async function uploadThumbMaterial(
  bytes: Uint8Array | Buffer,
  filename = "joto-cover.png"
): Promise<UploadThumbResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getAccessToken();
    const form = new FormData();
    form.append("media", toBlob(bytes, "image/png"), filename);

    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=thumb`,
      {
        method: "POST",
        body: form,
      }
    );

    if (!res.ok) {
      return {
        ok: false,
        error: `Cover upload failed: HTTP ${res.status}`,
        errcode: res.status,
      };
    }

    const data = (await res.json()) as {
      media_id?: string;
      url?: string;
      errcode?: number;
      errmsg?: string;
    };

    if (data.errcode && data.errcode !== 0) {
      if ((data.errcode === 40001 || data.errcode === 42001) && attempt === 0) {
        clearTokenCache();
        continue;
      }
      return {
        ok: false,
        error: describeWechatError(data.errcode, data.errmsg),
        errcode: data.errcode,
      };
    }

    if (!data.media_id) {
      return {
        ok: false,
        error: "微信封面素材上传失败：响应缺少 media_id",
      };
    }

    return {
      ok: true,
      mediaId: data.media_id,
      url: data.url,
    };
  }

  return {
    ok: false,
    error: "微信封面上传失败，请稍后重试",
  };
}

/**
 * Upload an inline image for WeChat article content.
 *
 * Images referenced inside draft HTML must be reachable by WeChat. Local paths
 * such as /joto-enterprise-wechat-qr.jpg render in our preview but disappear in
 * the MP backend, so push routes should upload them first and replace the src.
 */
export async function uploadArticleImage(
  bytes: Uint8Array | Buffer,
  filename = "joto-inline-image.jpg",
  mimeType = "image/jpeg"
): Promise<UploadArticleImageResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getAccessToken();
    const form = new FormData();
    form.append("media", toBlob(bytes, mimeType), filename);

    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${token}`,
      {
        method: "POST",
        body: form,
      }
    );

    if (!res.ok) {
      return {
        ok: false,
        error: `Inline image upload failed: HTTP ${res.status}`,
        errcode: res.status,
      };
    }

    const data = (await res.json()) as {
      url?: string;
      errcode?: number;
      errmsg?: string;
    };

    if (data.errcode && data.errcode !== 0) {
      if ((data.errcode === 40001 || data.errcode === 42001) && attempt === 0) {
        clearTokenCache();
        continue;
      }
      return {
        ok: false,
        error: describeWechatError(data.errcode, data.errmsg),
        errcode: data.errcode,
      };
    }

    if (!data.url) {
      return {
        ok: false,
        error: "微信正文图片上传失败：响应缺少 url",
      };
    }

    return {
      ok: true,
      url: data.url,
    };
  }

  return {
    ok: false,
    error: "微信正文图片上传失败，请稍后重试",
  };
}

/* ---------- Push draft ---------- */

/**
 * Push an article to the WeChat Official Account's draft box.
 *
 * The article appears in the 草稿箱 of the MP backend.
 * The operator then manually publishes from there — zero risk of ban.
 */
export async function pushDraft(
  article: WechatDraftArticle
): Promise<PushDraftResult> {
  const body = {
    articles: [
      {
        title: article.title.substring(0, 64),
        author: (article.author ?? "").substring(0, 8),
        content: article.content,
        digest: (article.digest ?? "").substring(0, 120),
        thumb_media_id: article.thumb_media_id ?? "",
        show_cover_pic: article.show_cover_pic ?? 0,
        content_source_url: article.content_source_url ?? "",
        need_open_comment: article.need_open_comment ?? 0,
        only_fans_can_comment: article.only_fans_can_comment ?? 0,
      },
    ],
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getAccessToken();
    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      return {
        ok: false,
        error: `Draft push failed: HTTP ${res.status}`,
        errcode: res.status,
      };
    }

    const data = (await res.json()) as {
      media_id?: string;
      errcode?: number;
      errmsg?: string;
    };

    if (data.errcode && data.errcode !== 0) {
      if ((data.errcode === 40001 || data.errcode === 42001) && attempt === 0) {
        clearTokenCache();
        continue;
      }
      return {
        ok: false,
        error: describeWechatError(data.errcode, data.errmsg),
        errcode: data.errcode,
      };
    }

    return {
      ok: true,
      mediaId: data.media_id,
    };
  }

  return {
    ok: false,
    error: "微信草稿推送失败，请稍后重试",
  };
}

/* ---------- Error classes ---------- */

export class WechatConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WechatConfigError";
  }
}

export class WechatApiError extends Error {
  public readonly code: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "WechatApiError";
    this.code = code ?? 0;
  }
}
