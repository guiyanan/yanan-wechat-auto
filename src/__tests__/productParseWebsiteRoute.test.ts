import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/products/parse-website/route";

function req(body: unknown): Request {
  return new Request("http://test/api/products/parse-website", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/products/parse-website", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts title, description, and readable text into notes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        text: async () =>
          `<html><head><title>Fasium AI</title><meta name="description" content="AI 产品官网"></head><body><main><h1>Fasium AI</h1><p>面向企业内容生产的 AI 工具。</p></main></body></html>`,
      }))
    );

    const res = await POST(req({ url: "https://fasium.jotoai.com/" }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      title: "Fasium AI",
      description: "AI 产品官网",
    });
    expect(json.notes).toContain("面向企业内容生产的 AI 工具");
  });

  it("returns manual-fill notes when website fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network blocked");
      })
    );

    const res = await POST(req({ url: "https://fasium.jotoai.com/" }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false });
    expect(json.notes).toContain("请手动补充官网定位");
  });
});
