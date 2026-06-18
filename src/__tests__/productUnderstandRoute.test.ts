import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/products/understand/route";

function understandingJson() {
  return JSON.stringify({
      definition:
        "Loop RPA 是给企业运营和 IT 团队使用的浏览器原生自动化产品,用于把网页里的重复操作交给 Agent 执行。",
      coreFunctions: [
        {
          text: "在浏览器里执行自动化任务",
          confidence: "explicit",
          basis: "PDF 文本",
        },
      ],
      targetCustomers: [
        {
          text: "运营经理",
          confidence: "inferred",
          basis: "根据企业运营场景推测",
        },
        {
          text: "IT 管理员",
          confidence: "inferred",
          basis: "根据部署和权限控制需求推测",
        },
      ],
      painPoints: [
        {
          text: "传统 RPA 部署链路重,网页任务仍需要人工重复处理",
          confidence: "inferred",
          basis: "产品简介和 PDF 文本",
        },
      ],
      traditionalAlternatives: [
        {
          text: "传统 RPA",
          confidence: "explicit",
          basis: "产品简介",
        },
      ],
      afterUseChanges: [
        {
          text: "把部分浏览器重复操作交给 Agent 处理",
          confidence: "explicit",
          basis: "PDF 文本",
        },
      ],
      evidence: [
        {
          sourceType: "pdf",
          sourceLabel: "PDF 文本",
          text: "产品支持在浏览器里执行自动化任务。",
        },
      ],
      writingBoundaries: [
        "没有真实客户资料,不得写客户案例。",
        "没有效果数据,不得写百分比、金额或节省时间。",
      ],
      questionsToAsk: ["是否有真实金融客户或行业客户案例?"],
    });
}

const completeChatMock = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<string>>()
);

vi.mock("@/lib/qwen", () => ({
  QwenAuthError: class QwenAuthError extends Error {},
  completeChat: (...args: unknown[]) => completeChatMock(...args),
}));

function req(body: unknown): Request {
  return new Request("http://test/api/products/understand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/products/understand", () => {
  beforeEach(() => {
    completeChatMock.mockReset();
    completeChatMock.mockImplementation(async () => understandingJson());
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("returns an editable fallback card when model analysis fails", async () => {
    completeChatMock.mockRejectedValueOnce(new Error("DEEPSEEK_API_KEY is not set"));
    const res = await POST(
      req({
        product: {
          id: "prod-fasium",
          name: "Fasium AI",
          description: "AI fashion design platform",
          tags: [],
          iconGradient: ["#1268FF", "#5B8CFF"],
          knowledgeDocs: [],
        },
        websiteNotes: "官网写到趋势洞察、灵感筛选、花型生成、版型预览和 Tech Pack 输出。",
      }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe("fallback");
    expect(json.reason).toContain("DEEPSEEK_API_KEY");
    expect(json.understanding.definition).toContain("Fasium AI");
    expect(json.understanding.source).toBe("fallback");
  });

  it("uses parsed website material when model output is not JSON", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    completeChatMock.mockResolvedValueOnce("我无法判断这个产品。");

    const res = await POST(
      req({
        product: {
          id: "prod-fasium",
          name: "Fasium AI",
          description: "AI fashion design platform",
          tags: [],
          iconGradient: ["#1268FF", "#5B8CFF"],
          knowledgeDocs: [],
        },
        websiteNotes:
          "官网写到 FasiumAI 是专为服装品牌和设计团队打造的 AI 设计平台。问题所在 服装设计，不该这么慢。设计主管的困境 靠经验，推未来。设计师的困境 被工具拖慢。核心功能包括趋势观察、灵感筛选、花型生成、版型预览、虚拟试穿、三视图生成、Tech Pack 输出和广告图生成。应用场景包括快时尚品牌、独立设计师品牌、代工厂/ODM 和电商服装卖家。",
      }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe("fallback");
    expect(json.reason).toContain("模型未返回可解析的产品理解卡 JSON");
    expect(json.understanding.definition).toContain("服装品牌");
    expect(json.understanding.coreFunctions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("趋势观察") }),
        expect.objectContaining({ text: expect.stringContaining("Tech Pack") }),
      ])
    );
    expect(json.understanding.targetCustomers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("服装品牌") }),
      ])
    );
    expect(json.understanding.source).toBe("fallback");
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("uses an editable fallback card when the model returns legacy V1 output", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    completeChatMock.mockResolvedValueOnce(
      JSON.stringify({
        summary: "Fasium AI 是 AI 设计平台。",
        targetUsers: ["设计师"],
        coreCapabilities: ["生成设计图"],
        contentAngles: ["产品介绍"],
        missingInfo: ["客户案例"],
      })
    );

    const res = await POST(
      req({
        product: {
          id: "prod-fasium",
          name: "Fasium AI",
          description: "AI fashion design platform",
          tags: [],
          iconGradient: ["#1268FF", "#5B8CFF"],
          knowledgeDocs: [],
        },
        websiteNotes: "官网写到趋势洞察、灵感筛选、花型生成。",
      }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe("fallback");
    expect(json.reason).toContain("模型未返回 V2 产品理解卡字段");
    expect(json.understanding.source).toBe("fallback");
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("rejects sparse cards when rich website material is available", async () => {
    completeChatMock.mockResolvedValueOnce(
      JSON.stringify({
        definition: "Fasium AI 是一款 AI 时尚设计平台。",
        coreFunctions: [
          {
            text: "实时趋势观察",
            confidence: "explicit",
            basis: "官网",
          },
        ],
        targetCustomers: [],
        painPoints: [],
        traditionalAlternatives: [],
        afterUseChanges: [],
        evidence: [],
        writingBoundaries: [],
        questionsToAsk: [],
      })
    );
    const res = await POST(
      req({
        product: {
          id: "prod-fasium",
          name: "Fasium AI",
          description: "AI fashion design platform",
          tags: [],
          iconGradient: ["#1268FF", "#5B8CFF"],
          knowledgeDocs: [],
        },
        websiteNotes:
          "官网写到趋势洞察、灵感筛选、花型生成、版型预览、Tech Pack 输出、虚拟试穿、三视图生成、广告图生成、设计语言库、品牌风格一致性、动态知识库和闭环系统。".repeat(8),
      }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reason).toContain("产品理解卡内容太少");
    expect(json.understanding.source).toBe("fallback");
    expect(json.understanding.coreFunctions.length).toBeGreaterThanOrEqual(4);
  });

  it("returns a product understanding card", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
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
      definition: expect.stringContaining("Loop RPA"),
      targetCustomers: [
        expect.objectContaining({ text: "运营经理", confidence: "inferred" }),
        expect.objectContaining({ text: "IT 管理员", confidence: "inferred" }),
      ],
      writingBoundaries: expect.arrayContaining([
        "没有真实客户资料,不得写客户案例。",
      ]),
      source: "deepseek",
    });
    expect(json.understanding).not.toHaveProperty("contentAngles");
    expect(completeChatMock.mock.calls[0][0]).toMatchObject({
      model: "deepseek-v4-pro",
      apiKey: "sk-deepseek-test",
      baseURL: "https://api.deepseek.com",
    });
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("asks the model to build a rich product fact card before mapping V2 fields", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    await POST(
      req({
        product: {
          id: "prod-fasium",
          name: "Fasium AI",
          description: "AI fashion design platform",
          tags: [],
          iconGradient: ["#1268FF", "#5B8CFF"],
          knowledgeDocs: [],
        },
        websiteNotes:
          "问题所在 服装设计，不该这么慢。设计主管的困境 靠经验，推未来。设计师的困境 被工具拖慢。工作流程 观察趋势、筛选灵感、一键生成。核心功能 包括趋势观察、灵感筛选、爆款生成、虚拟试穿、三视图、Tech Pack。",
      }) as never
    );

    const call = completeChatMock.mock.calls[0][0] as {
      messages: Array<{ content: string }>;
    };
    const userPrompt = call.messages[1].content;
    expect(userPrompt).toContain("先整理一张产品内容资料库");
    expect(userPrompt).toContain("目标用户");
    expect(userPrompt).toContain("核心功能");
    expect(userPrompt).toContain("典型场景");
    expect(userPrompt).toContain("主流替代方案");
    expect(userPrompt).toContain("再把资料库映射为 V2 字段");
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("keeps longer PDF material in the product understanding prompt", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    const latePdfSection =
      "PDF后半段关键模块: 版型预览、三视图生成、Tech Pack 导出、品牌知识库。";
    await POST(
      req({
        product: {
          id: "prod-fasium",
          name: "Fasium AI",
          description: "AI fashion design platform",
          tags: [],
          iconGradient: ["#1268FF", "#5B8CFF"],
          knowledgeDocs: [],
        },
        pdfText: `${"PDF前半段通用介绍。".repeat(700)}${latePdfSection}`,
      }) as never
    );

    const call = completeChatMock.mock.calls[0][0] as {
      messages: Array<{ content: string }>;
    };
    expect(call.messages[1].content).toContain(latePdfSection);
    delete process.env.DEEPSEEK_API_KEY;
  });
});
