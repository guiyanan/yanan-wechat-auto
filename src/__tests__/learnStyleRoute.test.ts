import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/styles/learn/route";

const completeChatMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/qwen", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/qwen")>();
  return {
    ...actual,
    completeChat: (...args: unknown[]) => completeChatMock(...args),
  };
});

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
    delete process.env.DEEPSEEK_API_KEY;
    completeChatMock.mockReset();
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
    completeChatMock.mockRejectedValueOnce(new Error("DEEPSEEK_API_KEY is not set"));
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
    expect(json.style.promptProfile).toContain("风格提示词");
    expect(json.style.promptProfile).toContain("不得照抄来源文章内容");
    expect(json.style.promptProfile).toContain("只作为表达节奏参考");
    expect(json.style.promptProfile).toContain("不得决定事实、选题入口或文章结构");
    expect(json.style.promptProfile).not.toContain("硬约束");
    expect(json.style.promptProfile).not.toContain("推进顺序");
    expect(json.style.promptProfile).not.toContain("产品出现位置");
    expect(json.style.id).toMatch(/^style-learned-/);
  });

  it("learns a fallback trend writing style from pasted text without Qwen key", async () => {
    completeChatMock.mockRejectedValueOnce(new Error("DEEPSEEK_API_KEY is not set"));
    const text =
      "今天这个热点看起来热闹,真正值得看的是背后的工作方式变化。".repeat(20);
    const res = await POST(req({ pastedText: text, scope: "trend" }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.source).toBe("fallback");
    expect(json.style.scope).toBe("trend");
    expect(json.style.name).toContain("热点");
    expect(json.style.promptProfile).toContain("热点");
    expect(json.style.promptProfile).toContain("不要学习范文里的事实");
    expect(json.style.promptProfile).toContain("只作为表达节奏参考");
    expect(json.style.promptProfile).toContain("不能改变文章身份");
    expect(json.style.promptProfile).toContain("不能改变任务骨架");
    expect(json.style.promptProfile).toContain("不能改变产品回应策略");
    expect(json.style.promptProfile).not.toContain("产品只能在末尾");
    expect(json.style.promptProfile).not.toContain("结尾轻点");
    expect(json.style.promptProfile).not.toContain("推进顺序");
  });

  it("sanitizes conflicting trend prompt profiles returned by the model", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    completeChatMock.mockResolvedValueOnce(
      JSON.stringify({
        name: "短评体",
        toneProfile: "语气像短评,不急着推产品",
        titlePattern: "标题抓热点矛盾",
        openingPattern: "第一段写大家最近刷到的现象",
        paragraphPattern: "短段推进,只用自然段落分行",
        keySentencePattern: "结尾轻点产品视角",
        promptProfile: [
          "风格提示词:用热点短评体写。",
          "【标题结构】标题抓热点。",
          "【开头方式】像第三方测评一样开场。",
          "【问题表达】前半段只聊热点。",
          "【段落节奏】只用自然段落分行,不要小标题。",
          "【句式和语气】语气像短评。",
          "【转场方式】不要转回产品观点。",
          "【总结句/收束方式】产品只能在末尾轻轻带出。",
          "【反例提醒】不要硬广。",
          "【硬性边界】产品只在结尾一句轻点。",
          "【生成时自检】是否像短评。",
          "补充说明。".repeat(80),
        ].join("\n"),
        sampleDigest: "范文摘要",
      })
    );

    const text =
      "这是一篇热点公众号文章,会先写现象,再写用户问题,最后收束判断。".repeat(40);
    const res = await POST(req({ pastedText: text, scope: "trend" }) as never);
    const json = await res.json();

    expect(json.style.promptProfile).toContain("风格只能影响表达方式");
    expect(json.style.promptProfile).toContain("不能改变文章身份");
    expect(json.style.promptProfile).toContain("不能改变任务骨架");
    expect(json.style.promptProfile).toContain("不能改变产品回应策略");
    expect(json.style.promptProfile).not.toContain("产品只能在末尾");
    expect(json.style.promptProfile).not.toContain("产品只在结尾");
    expect(json.style.promptProfile).not.toContain("像第三方测评");
    expect(json.style.promptProfile).not.toContain("不要小标题");
    expect(json.style.promptProfile).not.toContain("不要转回产品观点");
  });

  it("uses DeepSeek v4 pro when learning a writing style", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    completeChatMock.mockResolvedValueOnce(
      JSON.stringify({
        name: "短评体",
        toneProfile: "克制短评",
        titlePattern: "反问标题",
        openingPattern: "先写场景",
        paragraphPattern: "短段推进",
        keySentencePattern: "轻总结",
        promptProfile: "用克制短评体写,先场景后判断,不得照抄来源文章内容。",
        sampleDigest: "范文摘要",
      })
    );
    const text = "这是一篇用来学习风格的产品文章,会先写场景,再写判断。".repeat(20);
    const res = await POST(req({ pastedText: text }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.source).toBe("deepseek");
    expect(json.style.promptProfile).toContain("克制短评体");
    expect(completeChatMock.mock.calls[0][0]).toMatchObject({
      model: "deepseek-v4-pro",
      apiKey: "sk-deepseek-test",
      baseURL: "https://api.deepseek.com",
    });
  });

  it("expands a too-short model prompt profile into a stronger reusable prompt", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    completeChatMock.mockResolvedValueOnce(
      JSON.stringify({
        name: "场景产品体",
        toneProfile: "表达克制,先写工作现场再写判断",
        titlePattern: "用具体工作问题承载主题",
        openingPattern: "开头先写读者正在面对的麻烦",
        paragraphPattern: "中等长度段落,一段一个动作或判断",
        keySentencePattern: "用短句收束业务变化",
        promptProfile:
          "先写场景,再写观点,产品介入必须固定在第三段,这是硬约束,不得照抄来源文章内容。",
        sampleDigest: "范文摘要",
      })
    );
    const text = "某团队早上九点打开后台,发现流程又卡在审批节点。".repeat(30);
    const res = await POST(req({ pastedText: text }) as never);
    const json = await res.json();

    expect(json.style.promptProfile.length).toBeGreaterThan(1000);
    expect(json.style.promptProfile).toContain("【标题结构】");
    expect(json.style.promptProfile).toContain("【开头方式】");
    expect(json.style.promptProfile).toContain("【段落节奏】");
    expect(json.style.promptProfile).toContain("不得决定事实、选题入口或文章结构");
    expect(json.style.promptProfile).not.toContain("【产品介入】");
    expect(json.style.promptProfile).not.toContain("产品介入");
    expect(json.style.promptProfile).not.toContain("硬约束");
    expect(json.style.promptProfile).toContain("【反例提醒】");
    expect(json.style.promptProfile).toContain("【硬性边界】");
  });

  it("learns one writing style from up to five uploaded HTML documents", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
    completeChatMock.mockResolvedValueOnce(
      JSON.stringify({
        name: "多篇沉淀体",
        toneProfile: "从多篇样本归纳出的稳定语气",
        titlePattern: "标题抓共同问题",
        openingPattern: "开头先切具体场景",
        paragraphPattern: "短段累积观察",
        keySentencePattern: "用一句判断收束",
        promptProfile: "从多篇文章抽取共同写法,只学习标题、开头、段落和收尾。",
        sampleDigest: "多篇 HTML 范文摘要",
      })
    );
    const htmlDocuments = Array.from({ length: 6 }, (_, index) => ({
      name: `sample-${index + 1}.html`,
      html: `<html><head><style>.x{color:red}</style></head><body><script>window.bad=true</script><h1>第${index + 1}篇标题</h1><p>这是第${index + 1}篇微信公众号样本文字,它提供稳定写法而不是事实内容。</p>${"多篇文章共同沉淀风格。".repeat(20)}</body></html>`,
    }));

    const res = await POST(req({ htmlDocuments }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.source).toBe("deepseek");
    expect(json.style.name).toBe("多篇沉淀体");
    expect(json.style.sourceUrls).toEqual([
      "html:sample-1.html",
      "html:sample-2.html",
      "html:sample-3.html",
      "html:sample-4.html",
      "html:sample-5.html",
    ]);

    const userPrompt = completeChatMock.mock.calls[0][0].messages[1].content;
    const systemPrompt = completeChatMock.mock.calls[0][0].messages[0].content;
    expect(systemPrompt).toContain("风格只管表达节奏");
    expect(systemPrompt).toContain("不得决定事实、选题入口或文章结构");
    expect(systemPrompt).not.toContain("推进顺序");
    expect(userPrompt).toContain("2000 字以内");
    expect(userPrompt).toContain("建议 1200-1800 字");
    expect(userPrompt).toContain("每个维度必须写成可执行规则");
    expect(userPrompt).toContain("不得决定事实、选题入口或文章结构");
    expect(userPrompt).not.toContain("产品介入");
    expect(userPrompt).toContain("第1篇标题");
    expect(userPrompt).toContain("第5篇标题");
    expect(userPrompt).not.toContain("第6篇标题");
    expect(userPrompt).not.toContain("window.bad");
    expect(userPrompt).not.toContain(".x{color:red}");
  });
});
