import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/format-joto/route";

const completeChatMock = vi.fn();

vi.mock("@/lib/qwen", () => ({
  QwenAuthError: class QwenAuthError extends Error {},
  completeChat: (...args: unknown[]) => completeChatMock(...args),
}));

function req(body: unknown): Request {
  return new Request("http://test/api/format-joto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/format-joto", () => {
  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    completeChatMock.mockReset();
  });

  it("requires rawText", async () => {
    const res = await POST(req({ rawText: "" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns Qwen enhanced html when the model responds", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    completeChatMock.mockResolvedValueOnce(
      JSON.stringify({
        title: "AI 画得美，为什么还不够？",
        markdown:
          "## 先把问题说清楚\n\n设计师真正卡住的，不是不会画，而是信息散在不同工具里。\n\n> AI 不替代设计师，只是把上下文收回来。",
        summary: "围绕服装设计流程解释 JOTO 如何整理上下文。",
      })
    );

    const res = await POST(
      req({
        rawText: "设计师真正卡住的，不是不会画，而是信息散在不同工具里。",
        productSnapshot: {
          id: "prod-fasium",
          name: "Fasium AI",
          description: "AI 服装设计协作产品",
          tags: ["服装设计"],
          iconGradient: ["#0071e3", "#6e6e73"],
          knowledgeDocs: [],
        },
      }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("deepseek");
    expect(json.title).toBe("AI 画得美，为什么还不够？");
    expect(json.contentHtml).toContain("<h2>先把问题说清楚</h2>");
    expect(json.contentHtml).not.toContain("**");
    expect(completeChatMock.mock.calls[0][0]).toMatchObject({
      model: "deepseek-v4-pro",
      apiKey: "sk-deepseek-test",
      baseURL: "https://api.deepseek.com",
    });
  });

  it("falls back to local formatting when Qwen fails", async () => {
    completeChatMock.mockRejectedValueOnce(new Error("DASHSCOPE_API_KEY is not set"));

    const res = await POST(
      req({
        title: "设计时间去哪儿了？",
        rawText: "- ⭐ 找文件\n- ✅ 改尺码\n\n不用再输 **15cm**。",
      }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("fallback");
    expect(json.warnings.join(" ")).toContain("基础排版");
    expect(json.contentHtml).not.toContain("⭐");
    expect(json.contentHtml).not.toContain("**");
  });

  it("cleans over-eager model emphasis and inline markdown heading residue", async () => {
    completeChatMock.mockResolvedValueOnce(
      JSON.stringify({
        title: "Pharaoh Command：让网络运维从背锅变成对话",
        markdown:
          "**先问一个问题：** 你们公司网络出问题的时候，谁先被 @？\n## 不是再给你加一个平台\n\n**业务卡了，** 赖网络；**网络工程师，** 可能是最常背锅的人。",
        summary: "讲清网络运维为什么需要对话式中枢。",
      })
    );

    const res = await POST(
      req({
        rawText: "你们公司网络出问题的时候，谁先被 @？",
      }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("deepseek");
    expect(json.contentHtml).not.toContain("<strong>");
    expect(json.contentHtml).not.toContain("**");
    expect(json.contentHtml).not.toContain("##");
    expect(json.contentHtml).toContain("<h2>不是再给你加一个平台</h2>");
  });
});
