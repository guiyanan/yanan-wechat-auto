import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/products/understand/route";

vi.mock("@/lib/qwen", () => ({
  QwenAuthError: class QwenAuthError extends Error {},
  completeChat: vi.fn(async () =>
    JSON.stringify({
      summary: "Loop RPA 是面向企业运营团队的浏览器原生自动化产品。",
      targetUsers: ["运营经理", "IT 管理员"],
      coreCapabilities: ["浏览器自动化", "权限控制"],
      contentAngles: ["为什么需要", "传统方案对比"],
      missingInfo: ["客户案例"],
    })
  ),
}));

function req(body: unknown): Request {
  return new Request("http://test/api/products/understand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/products/understand", () => {
  it("returns a product understanding card", async () => {
    const res = await POST(
      req({
        product: {
          id: "prod-loop",
          name: "Loop RPA",
          description: "浏览器原生 Agent",
          tags: ["RPA"],
          iconGradient: ["#1268FF", "#5B8CFF"],
          knowledgeDocs: [],
        },
        pdfText: "产品支持在浏览器里执行自动化任务。",
        websiteNotes: "官网强调轻量部署。",
      }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.understanding).toMatchObject({
      summary: expect.stringContaining("Loop RPA"),
      targetUsers: ["运营经理", "IT 管理员"],
      source: "qwen",
    });
  });
});
