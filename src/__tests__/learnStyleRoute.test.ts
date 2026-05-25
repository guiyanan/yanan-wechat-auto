import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/styles/learn/route";

function req(body: unknown): Request {
  return new Request("http://test/api/styles/learn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/styles/learn", () => {
  beforeEach(() => {
    delete process.env.DASHSCOPE_API_KEY;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("asks for pasted text when WeChat URL cannot be fetched", async () => {
    const res = await POST(
      req({ urls: ["https://mp.weixin.qq.com/s/example"] }) as never
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, needsPaste: true });
  });

  it("learns a fallback writing style from pasted text without Qwen key", async () => {
    const text = "某团队早上九点打开后台,发现流程又卡在审批节点。".repeat(20);
    const res = await POST(req({ pastedText: text }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.source).toBe("fallback");
    expect(json.style).toMatchObject({
      name: "学习风格",
      sourceUrls: [],
    });
    expect(json.style.id).toMatch(/^style-learned-/);
  });
});
