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
      makeReq({ articleType: "产品介绍", styleName: "x", styleProfile: "y" }) as never
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("text required");
  });

  it("returns 400 when text is whitespace-only", async () => {
    const res = await POST(
      makeReq({
        text: "   \n   ",
        articleType: "产品介绍",
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

  it("returns a clear error when no DEEPSEEK_API_KEY instead of fake-passing humanize", async () => {
    const res = await POST(
      makeReq({
        text: "## 测试\n\n这是一段需要 humanize 的中文正文。",
        articleType: "产品介绍",
        styleName: "默认",
        styleProfile: "",
      }) as never
    );
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("DEEPSEEK_API_KEY");
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
          beforeScoreBreakdown: {
            phraseDensity: 1,
            sentenceUniformity: 2,
            repeatedOpeners: 0,
            passiveFiller: 0,
            corporateCliche: 0,
            templateStructure: 0,
            unsupportedFactRisk: 0,
            total: 3,
          },
          similarity: 0.45,
          mode: "two-pass-strong",
          passed: true,
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
        articleType: "产品介绍",
        styleName: "默认",
        styleProfile: "",
      }) as never
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("text");
    expect(json).toHaveProperty("scoreBreakdown");
    expect(json).toHaveProperty("beforeScoreBreakdown");
    expect(json).toHaveProperty("similarity");
    expect(json).toHaveProperty("mode");
    expect(json).toHaveProperty("passed");
    expect(json).toHaveProperty("totalRounds");
    expect(typeof json.text).toBe("string");
    expect(json.scoreBreakdown.total).toBe(18);
    expect(json.totalRounds).toBe(1);
    vi.doUnmock("@/lib/humanize/pipeline");
  });
});
