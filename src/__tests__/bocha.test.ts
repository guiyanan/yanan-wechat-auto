import { describe, expect, it } from "vitest";
import { normalizeBochaResults } from "@/lib/trends/bocha";

describe("bocha trend adapter", () => {
  it("normalizes Bocha webPages payload", () => {
    const results = normalizeBochaResults({
      data: {
        webPages: {
          value: [
            {
              name: "AI 运维成为企业 IT 热点",
              url: "https://example.com/a",
              snippet: "企业开始关注用 AI 降低运维沟通成本。",
              siteName: "行业观察",
              datePublished: "2026-05-20",
            },
          ],
        },
      },
    });

    expect(results[0]).toMatchObject({
      title: "AI 运维成为企业 IT 热点",
      url: "https://example.com/a",
      snippet: "企业开始关注用 AI 降低运维沟通成本。",
      source: "行业观察",
      publishedAt: "2026-05-20",
    });
  });
});
