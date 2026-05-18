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

/* ---------- Token cache ---------- */

interface TokenEntry {
  token: string;
  expiresAt: number; // Date.now() ms
}

let cachedToken: TokenEntry | null = null;

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
      `Token error: ${data.errmsg ?? "unknown"} (${data.errcode})`,
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
  const token = await getAccessToken();

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
    // Token expired — clear cache and let caller retry
    if (data.errcode === 40001 || data.errcode === 42001) {
      clearTokenCache();
    }
    return {
      ok: false,
      error: data.errmsg ?? `errcode ${data.errcode}`,
      errcode: data.errcode,
    };
  }

  return {
    ok: true,
    mediaId: data.media_id,
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
