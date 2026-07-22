import { describe, expect, it, vi } from "vitest";
import {
  buildUnsplashCoverUrl,
  buildUnsplashImageQueries,
  parseUnsplashImageConfig,
  searchUnsplashCoverCandidates,
} from "@/lib/trends/unsplash";
import type { Product, TrendSearchResult } from "@/types";

function product(patch: Partial<Product> = {}): Product {
  return {
    id: "fasium",
    name: "Fasium AI",
    description:
      "AI fashion design platform for apparel teams, supports trend observation, virtual model preview and garment design.",
    tags: ["服装", "设计", "版型", "面料"],
    iconGradient: ["#1268FF", "#5B8CFF"],
    knowledgeDocs: [],
    ...patch,
  };
}

const trends: TrendSearchResult[] = [
  {
    id: "trend-1",
    title: "AI 服装设计工具最近为什么火了",
    snippet: "设计师在讨论虚拟模特、版型预览和 Tech Pack。",
    url: "https://example.com/fashion-ai",
    categoryHook: "AI服装设计",
    mainstreamAnchor: "Midjourney",
    featureHint: "虚拟模特和服装设计生成",
  },
];

describe("Unsplash trend image helper", () => {
  it("builds a compliant 300x300 cover URL from Unsplash raw image URLs", () => {
    const url = buildUnsplashCoverUrl(
      "https://images.unsplash.com/photo-123?ixid=abc&foo=bar"
    );

    expect(url).toContain("ixid=abc");
    expect(url).toContain("w=300");
    expect(url).toContain("h=300");
    expect(url).toContain("fit=crop");
    expect(url).toContain("crop=entropy");
    expect(url).toContain("auto=format");
    expect(url).toContain("q=80");
  });

  it("uses configured product queries before inferred generic queries", () => {
    const config = parseUnsplashImageConfig(
      JSON.stringify({
        products: {
          fasium: ["fashion atelier", "garment studio"],
          "Lumen 营销云": ["crm dashboard"],
        },
        defaultQueries: ["modern office"],
      })
    );

    const queries = buildUnsplashImageQueries({
      product: product(),
      trends,
      config,
    });

    expect(queries.slice(0, 2)).toEqual(["fashion atelier", "garment studio"]);
    expect(queries).toContain("fashion design");
    expect(queries).toContain("garment design");
    expect(queries).not.toContain("NotebookLM");
  });

  it("searches Unsplash with high content filter and returns attribution metadata", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "photo-1",
            alt_description: "fashion designer moodboard",
            description: null,
            width: 4000,
            height: 3000,
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
              name: "A Photographer",
              links: { html: "https://unsplash.com/@photo" },
            },
          },
        ],
      }),
    });

    const candidates = await searchUnsplashCoverCandidates({
      accessKey: "unsplash-key",
      product: product(),
      trends,
      count: 1,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("https://api.unsplash.com/search/photos?"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Client-ID unsplash-key",
          "Accept-Version": "v1",
        }),
      })
    );
    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain("content_filter=high");
    expect(calledUrl).toContain("per_page=6");
    expect(candidates).toEqual([
      expect.objectContaining({
        id: "photo-1",
        url: expect.stringContaining("w=300"),
        url300: expect.stringContaining("h=300"),
        styleLabel: "Unsplash · A Photographer",
        attribution: "Photo by A Photographer on Unsplash",
        sourceUrl: "https://unsplash.com/photos/photo-1",
        downloadLocation: "https://api.unsplash.com/photos/photo-1/download",
      }),
    ]);
  });
});
