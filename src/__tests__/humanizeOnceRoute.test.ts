import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/humanize/once/route";

function makeReq(body: unknown): Request {
  return new Request("http://test/api/humanize/once", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("/api/humanize/once · validation", () => {
  // The validation paths short-circuit before touching Qwen, so we don't
  // need to mock the OpenAI client to cover them.
  beforeEach(() => {
    delete process.env.DASHSCOPE_API_KEY;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 400 on invalid JSON body", async () => {
    const res = await POST(makeReq("not json {{{") as never);
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

  it("returns 400 when text is whitespace only", async () => {
    const res = await POST(
      makeReq({
        text: "   \n  ",
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
        text: "正文",
        styleName: "x",
        styleProfile: "y",
        intent: "改写",
      }) as never
    );
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toMatch(/articleType required/);
    expect(body).toContain("产品介绍");
    expect(body).toContain("产品差异");
    expect(body).toContain("竞品对比");
    expect(body).toContain("时事热点");
  });

  it("returns 400 when articleType is unrecognized", async () => {
    const res = await POST(
      makeReq({
        text: "正文",
        articleType: "随便分类",
        styleName: "x",
        styleProfile: "y",
        intent: "改写",
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when Qwen client cannot be created (no API key)", async () => {
    // With valid input but no DASHSCOPE_API_KEY, humanize() throws QwenAuthError.
    // That should surface as a 500 (not crash the worker).
    const res = await POST(
      makeReq({
        text: "测试段落",
        intent: "改写",
        articleType: "产品介绍",
        styleName: "默认",
        styleProfile: "",
      }) as never
    );
    expect(res.status).toBe(500);
  });
});
