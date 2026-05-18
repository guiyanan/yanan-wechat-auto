import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAccessToken,
  pushDraft,
  clearTokenCache,
  WechatConfigError,
  WechatApiError,
} from "@/lib/wechatDraft";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("wechatDraft", () => {
  beforeEach(() => {
    clearTokenCache();
    mockFetch.mockReset();
    vi.stubEnv("WECHAT_APPID", "wx_test_appid");
    vi.stubEnv("WECHAT_APPSECRET", "test_secret_123");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getAccessToken", () => {
    it("throws WechatConfigError when env vars are missing", async () => {
      vi.stubEnv("WECHAT_APPID", "");
      vi.stubEnv("WECHAT_APPSECRET", "");

      await expect(getAccessToken()).rejects.toThrow(WechatConfigError);
      await expect(getAccessToken()).rejects.toThrow("Missing WECHAT_APPID");
    });

    it("fetches a new token from stable_token endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "TOKEN_ABC",
          expires_in: 7200,
        }),
      });

      const token = await getAccessToken();
      expect(token).toBe("TOKEN_ABC");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.weixin.qq.com/cgi-bin/stable_token",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("wx_test_appid"),
        })
      );
    });

    it("returns cached token on subsequent calls", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "CACHED_TOKEN",
          expires_in: 7200,
        }),
      });

      const first = await getAccessToken();
      const second = await getAccessToken();
      expect(first).toBe("CACHED_TOKEN");
      expect(second).toBe("CACHED_TOKEN");
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one fetch
    });

    it("throws WechatApiError on HTTP failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(getAccessToken()).rejects.toThrow(WechatApiError);
      await expect(
        // Need a fresh call since the first one already threw
        (async () => {
          mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
          return getAccessToken();
        })()
      ).rejects.toThrow("HTTP 500");
    });

    it("throws WechatApiError when WeChat returns errcode", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errcode: 40013,
          errmsg: "invalid appid",
        }),
      });

      await expect(getAccessToken()).rejects.toThrow("invalid appid");
    });
  });

  describe("pushDraft", () => {
    beforeEach(() => {
      // Pre-populate token cache so pushDraft doesn't need to fetch token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "MOCK_TOKEN",
          expires_in: 7200,
        }),
      });
    });

    it("sends article to draft/add endpoint and returns mediaId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          media_id: "DRAFT_MEDIA_123",
        }),
      });

      const result = await pushDraft({
        title: "Test Article",
        author: "JOTO",
        content: "<p>Hello WeChat</p>",
      });

      expect(result.ok).toBe(true);
      expect(result.mediaId).toBe("DRAFT_MEDIA_123");

      // Second call should be the draft/add
      const draftCall = mockFetch.mock.calls[1];
      expect(draftCall[0]).toContain("draft/add");
      expect(draftCall[0]).toContain("MOCK_TOKEN");

      const body = JSON.parse(draftCall[1].body);
      expect(body.articles).toHaveLength(1);
      expect(body.articles[0].title).toBe("Test Article");
      expect(body.articles[0].author).toBe("JOTO");
    });

    it("truncates title to 64 chars and author to 8 chars", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ media_id: "M1" }),
      });

      await pushDraft({
        title: "A".repeat(100),
        author: "Very Long Author Name",
        content: "<p>Body</p>",
      });

      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.articles[0].title).toHaveLength(64);
      expect(body.articles[0].author).toHaveLength(8);
    });

    it("returns error when WeChat API returns errcode", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errcode: 45009,
          errmsg: "reach max api daily quota limit",
        }),
      });

      const result = await pushDraft({
        title: "Test",
        content: "<p>Body</p>",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("reach max api");
      expect(result.errcode).toBe(45009);
    });

    it("clears token cache on 40001 (invalid token) error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errcode: 40001,
          errmsg: "invalid credential",
        }),
      });

      const result = await pushDraft({
        title: "Test",
        content: "<p>Body</p>",
      });

      expect(result.ok).toBe(false);

      // Next getAccessToken call should fetch a new token (cache was cleared)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "NEW_TOKEN",
          expires_in: 7200,
        }),
      });

      const newToken = await getAccessToken();
      expect(newToken).toBe("NEW_TOKEN");
    });

    it("returns error on HTTP failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await pushDraft({
        title: "Test",
        content: "<p>Body</p>",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("HTTP 503");
    });
  });

  describe("clearTokenCache", () => {
    it("forces a fresh token fetch after clearing", async () => {
      // First fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "T1", expires_in: 7200 }),
      });
      const t1 = await getAccessToken();
      expect(t1).toBe("T1");

      clearTokenCache();

      // Second fetch (new token)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "T2", expires_in: 7200 }),
      });
      const t2 = await getAccessToken();
      expect(t2).toBe("T2");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
