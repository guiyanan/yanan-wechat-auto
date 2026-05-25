import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET as checkWechat } from "@/app/api/wechat/check/route";
import { POST as pushWechatDraft } from "@/app/api/wechat/push-draft/route";
import { clearTokenCache } from "@/lib/wechatDraft";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("wechat API routes", () => {
  beforeEach(() => {
    clearTokenCache();
    mockFetch.mockReset();
    vi.stubEnv("WECHAT_APPID", "wx_test_appid");
    vi.stubEnv("WECHAT_APPSECRET", "test_secret_123");
    vi.stubEnv("WECHAT_DEFAULT_AUTHOR", "JOTO");
    vi.stubEnv("WECHAT_DEFAULT_THUMB_MEDIA_ID", "THUMB_MEDIA_123");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("check route reports missing config without creating a draft", async () => {
    vi.stubEnv("WECHAT_APPID", "");
    vi.stubEnv("WECHAT_DEFAULT_THUMB_MEDIA_ID", "");

    const res = await checkWechat();
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("WECHAT_APPID");
    expect(data.error).not.toContain("WECHAT_DEFAULT_THUMB_MEDIA_ID");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("check route fetches access_token when config is complete", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "TOKEN_OK", expires_in: 7200 }),
    });

    const res = await checkWechat();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.message).toContain("access_token");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("stable_token");
  });

  it("push draft route uses default author and default thumb media id", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "TOKEN_OK", expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://mmbiz.qpic.cn/qr.jpg" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ media_id: "DRAFT_MEDIA_123" }),
      });

    const res = await pushWechatDraft(
      new Request("http://localhost/api/wechat/push-draft", {
        method: "POST",
        body: JSON.stringify({
          title: "测试文章",
          bodyHtml: "<p>正文</p>",
          theme: "joto",
          articleId: "art-test",
        }),
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.mediaId).toBe("DRAFT_MEDIA_123");
    expect(data.thumbMediaId).toBe("THUMB_MEDIA_123");
    expect(data.uploadedContentImages).toEqual([
      "https://mmbiz.qpic.cn/qr.jpg",
    ]);
    expect(data.author).toBe("JOTO");

    expect(mockFetch.mock.calls[1][0]).toContain("media/uploadimg");

    const draftBody = JSON.parse(mockFetch.mock.calls[2][1].body);
    expect(draftBody.articles[0].thumb_media_id).toBe("THUMB_MEDIA_123");
    expect(draftBody.articles[0].author).toBe("JOTO");
    expect(draftBody.articles[0].content).toContain(
      "https://mmbiz.qpic.cn/qr.jpg"
    );
    expect(draftBody.articles[0].content).not.toContain(
      "/joto-enterprise-wechat-qr.jpg"
    );
  });

  it("push draft route auto-generates and uploads a cover when default thumb media id is missing", async () => {
    vi.stubEnv("WECHAT_DEFAULT_THUMB_MEDIA_ID", "");
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "TOKEN_OK", expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://mmbiz.qpic.cn/qr.jpg" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ media_id: "AUTO_THUMB_123" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ media_id: "DRAFT_MEDIA_456" }),
      });

    const res = await pushWechatDraft(
      new Request("http://localhost/api/wechat/push-draft", {
        method: "POST",
        body: JSON.stringify({
          title: "测试文章",
          bodyHtml: "<p>正文</p>",
          theme: "joto",
          productName: "Fasium AI",
        }),
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.mediaId).toBe("DRAFT_MEDIA_456");
    expect(data.thumbMediaId).toBe("AUTO_THUMB_123");
    expect(data.generatedCover).toBe(true);
    expect(mockFetch.mock.calls[1][0]).toContain("media/uploadimg");
    expect(mockFetch.mock.calls[2][0]).toContain("material/add_material");

    const draftBody = JSON.parse(mockFetch.mock.calls[3][1].body);
    expect(draftBody.articles[0].thumb_media_id).toBe("AUTO_THUMB_123");
    expect(draftBody.articles[0].content).toContain(
      "https://mmbiz.qpic.cn/qr.jpg"
    );
  });
});
