import { afterEach, describe, expect, it, vi } from "vitest";

const qwenMocks = vi.hoisted(() => ({
  completeChat: vi.fn(),
  streamChat: vi.fn(),
  generateTitles: vi.fn(),
  factcheck: vi.fn(),
  humanize: vi.fn(),
}));

vi.mock("@/lib/qwen", () => ({
  QwenAuthError: class QwenAuthError extends Error {},
  completeChat: (...args: unknown[]) => qwenMocks.completeChat(...args),
  streamChat: (...args: unknown[]) => qwenMocks.streamChat(...args),
  generateTitles: (...args: unknown[]) => qwenMocks.generateTitles(...args),
  parseTitles: (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  factcheck: (...args: unknown[]) => qwenMocks.factcheck(...args),
  humanize: (...args: unknown[]) => qwenMocks.humanize(...args),
}));

import { POST } from "@/app/api/generate/route";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function req(body: unknown): Request {
  return new Request("http://test/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function parseSse(text: string): unknown[] {
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => chunk.slice("data: ".length))
    .filter((payload) => payload !== "[DONE]")
    .map((payload) => JSON.parse(payload));
}

describe("/api/generate", () => {
  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_MODEL_GENERATE;
    delete process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.UNSPLASH_TREND_IMAGE_QUERY_MAP;
    qwenMocks.completeChat.mockReset();
    qwenMocks.streamChat.mockReset();
    qwenMocks.generateTitles.mockReset();
    qwenMocks.factcheck.mockReset();
    qwenMocks.humanize.mockReset();
    fetchMock.mockReset();
  });

  it("runs real factcheck on the generated body and streams its warning", async () => {
    qwenMocks.completeChat.mockResolvedValueOnce("## 大纲\n\n- 写产品如何介入");
    qwenMocks.streamChat.mockImplementationOnce(async function* () {
      yield "## 产品怎么介入\n\n这个工具可以让团队提效 30%，并在一天内完成上线。";
    });
    qwenMocks.generateTitles.mockResolvedValueOnce([
      "标题一",
      "标题二",
      "标题三",
      "标题四",
      "标题五",
    ]);
    qwenMocks.factcheck.mockResolvedValueOnce({
      ok: false,
      warnings: ["30% 提效和一天上线缺少素材依据"],
    });

    const res = await POST(
      req({
        productId: "prod-loop",
        angleId: "angle-product-intro",
        styleId: "style-joto",
        articleId: "art-real-factcheck",
      }) as never
    );

    expect(res.status).toBe(200);
    const events = parseSse(await res.text());

    expect(qwenMocks.factcheck).toHaveBeenCalledTimes(1);
    expect(qwenMocks.factcheck.mock.calls[0][0]).toMatchObject({
      product: "Loop RPA",
    });
    expect(qwenMocks.factcheck.mock.calls[0][0].productDesc).toContain(
      "浏览器原生 Agent，替代传统 RPA 的部署链路"
    );
    expect(qwenMocks.factcheck.mock.calls[0][0].body).toContain("30%");

    const factcheckStage = events.find(
      (event): event is { type: string; stage: string; status: string; data: unknown } =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "stage" &&
        "stage" in event &&
        event.stage === "factcheck" &&
        "status" in event &&
        event.status === "done"
    );
    expect(factcheckStage?.data).toEqual({
      passed: false,
      warning: "30% 提效和一天上线缺少素材依据",
    });

    const resultEvent = events.find(
      (event): event is { type: string; result: { factcheck: unknown } } =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "result" &&
        "result" in event
    );
    expect(resultEvent?.result.factcheck).toEqual({
      passed: false,
      warning: "30% 提效和一天上线缺少素材依据",
    });
  });

  it("fallback factcheck flags unsupported fictional personal names", async () => {
    qwenMocks.completeChat.mockResolvedValueOnce("## 大纲\n\n- 写匿名工作场景");
    qwenMocks.streamChat.mockImplementationOnce(async function* () {
      yield "## 工作场景\n\n陈敏打开十几个网页标签,把秀场图存进文件夹。";
    });
    qwenMocks.generateTitles.mockResolvedValueOnce([
      "标题一",
      "标题二",
      "标题三",
      "标题四",
      "标题五",
    ]);
    qwenMocks.factcheck.mockRejectedValueOnce(new Error("factcheck unavailable"));

    const res = await POST(
      req({
        productId: "prod-loop",
        angleId: "angle-product-intro",
        styleId: "style-joto",
        articleId: "art-fake-person",
      }) as never
    );

    expect(res.status).toBe(200);
    const events = parseSse(await res.text());
    const resultEvent = events.find(
      (event): event is { type: string; result: { factcheck: { passed: boolean; warning: string | null } } } =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "result" &&
        "result" in event
    );

    expect(resultEvent?.result.factcheck).toEqual({
      passed: false,
      warning: "出现未提供素材支撑的具体人名:陈敏",
    });
  });

  it("fallback factcheck uses V2 writing boundaries to block unconfirmed button paths", async () => {
    qwenMocks.completeChat.mockResolvedValueOnce("## 大纲\n\n- 写产品流程");
    qwenMocks.streamChat.mockImplementationOnce(async function* () {
      yield "## 使用方式\n\n用户点击「生成设计」按钮后,系统会自动跳转到设计结果页。";
    });
    qwenMocks.generateTitles.mockResolvedValueOnce([
      "标题一",
      "标题二",
      "标题三",
      "标题四",
      "标题五",
    ]);
    qwenMocks.factcheck.mockRejectedValueOnce(new Error("factcheck unavailable"));

    const res = await POST(
      req({
        productId: "prod-fasium",
        productSnapshot: {
          id: "prod-fasium",
          name: "Fasium AI",
          description: "面向服装设计团队的 AI 设计平台",
          tags: ["AI 设计"],
          iconGradient: ["#2563eb", "#7c3aed"],
          knowledgeDocs: [],
          understanding: {
            definition: "Fasium AI 是面向服装设计团队的 AI 设计平台。",
            coreFunctions: [
              {
                text: "用于趋势观察和设计生成",
                confidence: "explicit",
                basis: "官网",
              },
            ],
            targetCustomers: [
              {
                text: "服装设计团队",
                confidence: "explicit",
                basis: "官网",
              },
            ],
            painPoints: [],
            traditionalAlternatives: [],
            afterUseChanges: [],
            evidence: [
              {
                sourceType: "website",
                sourceLabel: "官网",
                text: "面向服装设计团队的 AI 设计平台。",
              },
            ],
            writingBoundaries: [
              "未提供真实流程或截图说明,不得写按钮名称、后台路径或具体点击步骤。",
            ],
            questionsToAsk: ["真实生成流程是什么?"],
            generatedAt: "2026-06-17T00:00:00.000Z",
            source: "manual",
          },
        },
        angleId: "angle-product-intro",
        styleId: "style-joto",
        articleId: "art-v2-boundary-button-path",
      }) as never
    );

    expect(res.status).toBe(200);
    const events = parseSse(await res.text());
    const resultEvent = events.find(
      (event): event is { type: string; result: { factcheck: { passed: boolean; warning: string | null } } } =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "result" &&
        "result" in event
    );

    expect(resultEvent?.result.factcheck).toEqual({
      passed: false,
      warning: "出现未提供素材支撑的具体操作或按钮路径:点击「生成设计」按钮",
    });
  });

  it("fallback factcheck uses V2 writing boundaries to block unconfirmed customer names", async () => {
    qwenMocks.completeChat.mockResolvedValueOnce("## 大纲\n\n- 写客户案例");
    qwenMocks.streamChat.mockImplementationOnce(async function* () {
      yield "## 客户案例\n\nZara 设计团队已经用它统一管理季度趋势图。";
    });
    qwenMocks.generateTitles.mockResolvedValueOnce([
      "标题一",
      "标题二",
      "标题三",
      "标题四",
      "标题五",
    ]);
    qwenMocks.factcheck.mockRejectedValueOnce(new Error("factcheck unavailable"));

    const res = await POST(
      req({
        productId: "prod-fasium",
        productSnapshot: {
          id: "prod-fasium",
          name: "Fasium AI",
          description: "面向服装设计团队的 AI 设计平台",
          tags: ["AI 设计"],
          iconGradient: ["#2563eb", "#7c3aed"],
          knowledgeDocs: [],
          understanding: {
            definition: "Fasium AI 是面向服装设计团队的 AI 设计平台。",
            coreFunctions: [],
            targetCustomers: [
              {
                text: "服装设计团队",
                confidence: "explicit",
                basis: "官网",
              },
            ],
            painPoints: [],
            traditionalAlternatives: [],
            afterUseChanges: [],
            evidence: [],
            writingBoundaries: [
              "未提供真实客户资料,不得写客户名称或客户案例。",
            ],
            questionsToAsk: ["是否有可确认客户案例?"],
            generatedAt: "2026-06-17T00:00:00.000Z",
            source: "manual",
          },
        },
        angleId: "angle-product-intro",
        styleId: "style-joto",
        articleId: "art-v2-boundary-customer",
      }) as never
    );

    expect(res.status).toBe(200);
    const events = parseSse(await res.text());
    const resultEvent = events.find(
      (event): event is { type: string; result: { factcheck: { passed: boolean; warning: string | null } } } =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "result" &&
        "result" in event
    );

    expect(resultEvent?.result.factcheck).toEqual({
      passed: false,
      warning: "出现未提供素材支撑的客户/公司:Zara",
    });
  });

  it("injects the unified V2 product material pack into outline and body prompts", async () => {
    qwenMocks.completeChat.mockResolvedValueOnce("## 大纲\n\n- 用真实素材写");
    qwenMocks.streamChat.mockImplementationOnce(async function* () {
      yield "## 正文\n\n只基于产品库里的真实素材写。";
    });
    qwenMocks.generateTitles.mockResolvedValueOnce([
      "标题一",
      "标题二",
      "标题三",
      "标题四",
      "标题五",
    ]);
    qwenMocks.factcheck.mockResolvedValueOnce({ ok: true, warnings: [] });

    const res = await POST(
      req({
        productId: "prod-loop",
        productSnapshot: {
          id: "prod-loop",
          name: "Loop RPA",
          description: "浏览器原生 Agent，替代传统 RPA 的部署链路",
          tags: ["RPA"],
          iconGradient: ["#6366f1", "#ec4899"],
          knowledgeDocs: [],
          understanding: {
            definition:
              "Loop RPA 是给企业运营和 IT 团队使用的浏览器原生自动化产品。",
            coreFunctions: [
              {
                text: "在浏览器里执行自动化任务",
                confidence: "explicit",
                basis: "PDF",
              },
            ],
            targetCustomers: [
              {
                text: "企业运营团队",
                confidence: "inferred",
                basis: "产品简介",
              },
            ],
            painPoints: [
              {
                text: "网页任务仍需要人工重复处理",
                confidence: "inferred",
                basis: "产品简介",
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
                confidence: "inferred",
                basis: "核心功能推导",
              },
            ],
            evidence: [
              {
                sourceType: "manual",
                sourceLabel: "人工备注",
                text: "真实素材：Loop RPA 只支持 Web 端注册登录后使用。",
              },
            ],
            writingBoundaries: ["未提供真实客户资料,不得写客户案例。"],
            questionsToAsk: ["是否有金融客户案例?"],
            generatedAt: "2026-06-16T00:00:00.000Z",
            source: "manual",
          },
          sourcePack: {
            productNotes: "旧 request/sourcePack productNotes 不应绕过 V2 卡进入生成 prompt。",
            competitorNotes: "传统 RPA 需要桌面客户端和脚本维护。",
            trendNotes: "旧 trendNotes 不应进入生成 prompt。",
            imageRefs: "旧 imageRefs 不应进入生成 prompt。",
          },
        },
        angleId: "angle-product-intro",
        styleId: "style-joto",
        articleId: "art-product-source-pack",
      }) as never
    );

    expect(res.status).toBe(200);
    await res.text();

    const outlineMessages = qwenMocks.completeChat.mock.calls[0][0].messages;
    const bodyMessages = qwenMocks.streamChat.mock.calls[0][0].messages;
    const outlinePrompt = JSON.stringify(outlineMessages);
    const bodyPrompt = JSON.stringify(bodyMessages);
    expect(outlinePrompt).toContain("【产品卡 V2 / 可写事实】");
    expect(outlinePrompt).toContain(
      "真实素材：Loop RPA 只支持 Web 端注册登录后使用。"
    );
    expect(outlinePrompt).toContain("【产品卡 V2 / 禁写边界】");
    expect(outlinePrompt).toContain("未提供真实客户资料,不得写客户案例。");
    expect(bodyPrompt).toContain("【产品卡 V2 / 可推导表达】");
    expect(bodyPrompt).not.toContain("旧 request/sourcePack productNotes");
    expect(bodyPrompt).not.toContain("传统 RPA 需要桌面客户端和脚本维护。");
    expect(bodyPrompt).not.toContain("旧 trendNotes");
    expect(bodyPrompt).not.toContain("旧 imageRefs");
    expect(qwenMocks.factcheck.mock.calls[0][0].productDesc).toContain(
      "【产品卡 V2 / 禁写边界】"
    );
    expect(qwenMocks.factcheck.mock.calls[0][0].productDesc).toContain(
      "未提供真实客户资料,不得写客户案例。"
    );
  });

  it("uses DeepSeek v4 pro for article outline/body/title generation", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    qwenMocks.completeChat
      .mockResolvedValueOnce("## 大纲\n\n- 写产品如何介入")
      .mockResolvedValueOnce('["标题一","标题二","标题三","标题四","标题五"]');
    qwenMocks.streamChat.mockImplementationOnce(async function* () {
      yield "## 正文\n\n这是一篇用 DeepSeek 生成的文章。";
    });
    qwenMocks.factcheck.mockResolvedValueOnce({ ok: true, warnings: [] });

    const res = await POST(
      req({
        productId: "prod-loop",
        angleId: "angle-product-intro",
        styleId: "style-joto",
        articleId: "art-deepseek-provider",
      }) as never
    );

    expect(res.status).toBe(200);
    await res.text();

    expect(qwenMocks.completeChat.mock.calls[0][0]).toMatchObject({
      model: "deepseek-v4-pro",
      apiKey: "sk-deepseek-test",
      baseURL: "https://api.deepseek.com",
    });
    expect(qwenMocks.streamChat.mock.calls[0][0]).toMatchObject({
      model: "deepseek-v4-pro",
      apiKey: "sk-deepseek-test",
      baseURL: "https://api.deepseek.com",
    });
    expect(qwenMocks.generateTitles.mock.calls[0][0]).toMatchObject({
      model: "deepseek-v4-pro",
      apiKey: "sk-deepseek-test",
      baseURL: "https://api.deepseek.com",
    });
  });

  it("adds 300x300 Unsplash cover candidates for trend-radar articles", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "unsplash-key";
    process.env.UNSPLASH_TREND_IMAGE_QUERY_MAP = JSON.stringify({
      products: {
        "prod-fasium": ["fashion atelier"],
      },
    });
    qwenMocks.completeChat
      .mockResolvedValueOnce("## 大纲\n\n- 写热点现象和产品团队回应")
      .mockResolvedValueOnce('["AI服装设计怎么突然火了","标题二","标题三","标题四","标题五"]');
    qwenMocks.streamChat.mockImplementationOnce(async function* () {
      yield "## 热点现象\n\nAI 服装设计被频繁讨论。\n\n## 我们的回应\n\nFasium AI 回应的是款式方向和修改动作。";
    });
    qwenMocks.factcheck.mockResolvedValueOnce({ ok: true, warnings: [] });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "photo-1",
            alt_description: "fashion atelier",
            width: 3000,
            height: 2000,
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
              name: "Cover Author",
              links: { html: "https://unsplash.com/@cover" },
            },
          },
        ],
      }),
    });

    const res = await POST(
      req({
        productId: "prod-fasium",
        productSnapshot: {
          id: "prod-fasium",
          name: "Fasium AI",
          description: "AI fashion design platform for apparel teams.",
          tags: ["服装", "设计"],
          iconGradient: ["#2563eb", "#7c3aed"],
          knowledgeDocs: [],
        },
        styleId: "style-joto",
        mode: "trend-radar",
        topicPlan: {
          id: "trend-plan-1",
          angleLabel: "AI服装设计怎么选",
          angleType: "trend",
          reason: "热点引流",
          promptInstruction: "写产品团队观察",
        },
        trendResults: [
          {
            id: "trend-1",
            title: "AI 服装设计工具最近为什么火了",
            snippet: "虚拟模特和版型预览被讨论。",
            url: "https://example.com/trend",
            categoryHook: "AI服装设计",
          },
        ],
      }) as never
    );

    expect(res.status).toBe(200);
    const events = parseSse(await res.text());
    expect(fetchMock).toHaveBeenCalled();
    const coversStage = events.find(
      (event): event is { type: string; stage: string; status: string; data: { covers: Array<{ url: string; styleLabel: string }> } } =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "stage" &&
        "stage" in event &&
        event.stage === "covers" &&
        "status" in event &&
        event.status === "done"
    );
    expect(coversStage?.data.covers[0]).toMatchObject({
      url: expect.stringContaining("w=300"),
      styleLabel: "Unsplash · Cover Author",
    });

    const resultEvent = events.find(
      (event): event is { type: string; result: { covers: Array<{ url: string }> } } =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "result" &&
        "result" in event
    );
    expect(resultEvent?.result.covers[0].url).toContain("h=300");
  });
});
