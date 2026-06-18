import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/trends/images/route";
import type { Product } from "@/types";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function req(body: unknown): Request {
  return new Request("http://test/api/trends/images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function product(): Product {
  return {
    id: "lumen",
    name: "Lumen 营销云",
    description: "私域运营自动化 + SCRM,帮助销售团队做客户跟进。",
    tags: ["私域", "营销", "SCRM"],
    iconGradient: ["#1268FF", "#5B8CFF"],
    knowledgeDocs: [],
  };
}

describe("/api/trends/images", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    vi.stubEnv("UNSPLASH_TREND_IMAGE_QUERY_MAP", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns an empty candidate list when Unsplash is not configured", async () => {
    const res = await POST(req({ productSnapshot: product() }) as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      source: "not_configured",
      candidates: [],
    });
    expect(json.warning).toContain("UNSPLASH_ACCESS_KEY");
  });

  it("returns 300x300 Unsplash cover candidates with configured product queries", async () => {
    vi.stubEnv("UNSPLASH_ACCESS_KEY", "unsplash-key");
    vi.stubEnv(
      "UNSPLASH_TREND_IMAGE_QUERY_MAP",
      JSON.stringify({
        products: {
          lumen: ["sales dashboard"],
        },
      })
    );
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "photo-1",
            alt_description: "sales dashboard",
            width: 3000,
            height: 2000,
            urls: {
              raw: "https://images.unsplash.com/photo-1?ixid=abc",
              small: "https://images.unsplash.com/photo-1-small?ixid=abc",
            },
            links: {
              html: "https://unsplash.com/photos/photo-1",
              download_location:
                "https://api.unsplash.com/photos/photo-1/download",
            },
            user: {
              name: "Unsplash Author",
              links: { html: "https://unsplash.com/@author" },
            },
          },
        ],
      }),
    });

    const res = await POST(
      req({
        productSnapshot: product(),
        trends: [
          {
            id: "trend-1",
            title: "AI 协作工具越来越火",
            snippet: "销售团队讨论客户跟进和 SCRM。",
            url: "https://example.com/trend",
          },
        ],
      }) as never
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.source).toBe("unsplash");
    expect(json.queries[0]).toBe("sales dashboard");
    expect(json.candidates[0]).toMatchObject({
      id: "photo-1",
      url: expect.stringContaining("w=300"),
      url300: expect.stringContaining("h=300"),
      attribution: "Photo by Unsplash Author on Unsplash",
    });
  });
});
