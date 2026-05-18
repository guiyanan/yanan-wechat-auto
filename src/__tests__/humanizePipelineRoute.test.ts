import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/humanize/pipeline/route";

function makeReq(body: unknown): Request {
  return new Request("http://test/api/humanize/pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("/api/humanize/pipeline · validation", () => {
  beforeEach(() => {
    delete process.env.DASHSCOPE_API_KEY;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await POST(makeReq("{{not json") as never);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("invalid json");
  });

  it("returns 400 when text is missing", async () => {
    const res = await POST(
      makeReq({ articleType: "产品推广", styleName: "x", styleProfile: "y" }) as never
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("text required");
  });

  it("returns 400 when text is whitespace-only", async () => {
    const res = await POST(
      makeReq({
        text: "   \n   ",
        articleType: "产品推广",
        styleName: "x",
        styleProfile: "y",
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when articleType is missing", async () => {
    const res = await POST(
      makeReq({
        text: "正文测试",
        styleName: "x",
        styleProfile: "y",
      }) as never
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/articleType required/);
  });

  it("returns 400 when articleType is unrecognized", async () => {
    const res = await POST(
      makeReq({
        text: "正文",
        articleType: "什么乱七八糟",
        styleName: "x",
        styleProfile: "y",
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("degrades gracefully when no DASHSCOPE_API_KEY (skip L1, still run L2 + L3)", async () => {
    // Without a key, Qwen humanize throws QwenAuthError; the route is
    // expected to catch it per-section and return the original text
    // after L2 post-processing + L3 scoring. End result: HTTP 200 with
    // a valid pipeline payload, not a 500 that breaks the whole batch.
    const res = await POST(
      makeReq({
        text: "## 测试\n\n这是一段需要 humanize 的中文正文。",
        articleType: "产品推广",
        styleName: "默认",
        styleProfile: "",
      }) as never
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("text");
    expect(json).toHaveProperty("scoreBreakdown");
    expect(json).toHaveProperty("totalRounds");
  });

  it("response shape on success contains text + scoreBreakdown + totalRounds", async () => {
    // We can't easily test success without a real Qwen key. But we can
    // verify the route's contract by stubbing the pipeline module to
    // return a predictable result. Use vi.doMock since route imports
    // happen at module-load time.
    vi.resetModules();
    vi.doMock("@/lib/humanize/pipeline", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/humanize/pipeline")
      >("@/lib/humanize/pipeline");
      return {
        ...actual,
        runHumanizePipeline: vi.fn(async () => ({
          text: "humanized text",
          scoreBreakdown: {
            phraseDensity: 5,
            sentenceUniformity: 10,
            repeatedOpeners: 2,
            passiveFiller: 1,
            total: 18,
          },
          totalRounds: 1,
        })),
        // buildQwenHumanizeFn returns a no-op humanizer since pipeline is mocked
        buildQwenHumanizeFn: vi.fn(() => async (t: string) => t),
      };
    });
    const { POST: PostMocked } = await import(
      "@/app/api/humanize/pipeline/route"
    );
    const res = await PostMocked(
      makeReq({
        text: "## 段\n\n正文内容。",
        articleType: "产品推广",
        styleName: "默认",
        styleProfile: "",
      }) as never
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("text");
    expect(json).toHaveProperty("scoreBreakdown");
    expect(json).toHaveProperty("totalRounds");
    expect(typeof json.text).toBe("string");
    expect(json.scoreBreakdown.total).toBe(18);
    expect(json.totalRounds).toBe(1);
    vi.doUnmock("@/lib/humanize/pipeline");
  });
});
