import { describe, it, expect, vi, beforeEach } from "vitest";
import OpenAI from "openai";
import {
  QwenAuthError,
  QwenRateLimitError,
  completeChat,
  createQwenClient,
  generateOutline,
  generateTitles,
  humanize,
  parseTitles,
  sseFromGenerator,
  streamChat,
} from "@/lib/qwen";

// -------- Minimal fake OpenAI client factory --------
// We don't want to hit the real API. We stub only the shapes used by our code.

interface FakeCreateCall {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens: number;
  stream: boolean;
}

interface FakeOpenAI {
  chat: {
    completions: {
      create: ReturnType<typeof vi.fn>;
    };
  };
}

function makeFakeClient(
  handler: (call: FakeCreateCall) => unknown
): FakeOpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn(async (call: FakeCreateCall) => handler(call)),
      },
    },
  };
}

// Helpers to construct stream-shaped async iterables
async function* chunks(parts: string[]): AsyncGenerator<unknown, void, unknown> {
  for (const p of parts) {
    yield { choices: [{ delta: { content: p } }] };
  }
}

beforeEach(() => {
  delete process.env.DASHSCOPE_API_KEY;
});

describe("qwen · createQwenClient", () => {
  it("throws QwenAuthError when no key and no client", () => {
    expect(() => createQwenClient()).toThrow(QwenAuthError);
  });

  it("returns provided client as-is", () => {
    const fake = makeFakeClient(() => null) as unknown as OpenAI;
    expect(createQwenClient({ client: fake })).toBe(fake);
  });

  it("reads DASHSCOPE_API_KEY from env (does not throw QwenAuthError)", () => {
    process.env.DASHSCOPE_API_KEY = "sk-test";
    try {
      createQwenClient();
    } catch (e) {
      // OpenAI SDK may refuse to run in jsdom without dangerouslyAllowBrowser;
      // that's fine — we just need to assert it's not a QwenAuthError.
      expect(e).not.toBeInstanceOf(QwenAuthError);
    }
  });
});

describe("qwen · streamChat", () => {
  it("yields deltas in order", async () => {
    const fake = makeFakeClient(() => chunks(["Hel", "lo ", "world"]));
    const out: string[] = [];
    for await (const d of streamChat({
      messages: [{ role: "user", content: "hi" }],
      client: fake as unknown as OpenAI,
    })) {
      out.push(d);
    }
    expect(out.join("")).toBe("Hello world");
  });

  it("maps 401 to QwenAuthError", async () => {
    const fake = makeFakeClient(() => {
      const err = new OpenAI.APIError(401, { message: "bad key" }, "bad key", {});
      throw err;
    });
    const gen = streamChat({
      messages: [{ role: "user", content: "x" }],
      client: fake as unknown as OpenAI,
    });
    await expect(gen.next()).rejects.toBeInstanceOf(QwenAuthError);
  });

  it("maps 429 to QwenRateLimitError", async () => {
    const fake = makeFakeClient(() => {
      throw new OpenAI.APIError(429, { message: "slow down" }, "slow", {});
    });
    const gen = streamChat({
      messages: [{ role: "user", content: "x" }],
      client: fake as unknown as OpenAI,
    });
    await expect(gen.next()).rejects.toBeInstanceOf(QwenRateLimitError);
  });
});

describe("qwen · completeChat", () => {
  it("returns message content", async () => {
    const fake = makeFakeClient(() => ({
      choices: [{ message: { content: "hello" } }],
    }));
    const out = await completeChat({
      messages: [{ role: "user", content: "x" }],
      client: fake as unknown as OpenAI,
    });
    expect(out).toBe("hello");
  });

  it("returns empty string when model returns no content", async () => {
    const fake = makeFakeClient(() => ({ choices: [{ message: {} }] }));
    const out = await completeChat({
      messages: [{ role: "user", content: "x" }],
      client: fake as unknown as OpenAI,
    });
    expect(out).toBe("");
  });
});

describe("qwen · sseFromGenerator", () => {
  it("emits data: lines for each delta then [DONE]", async () => {
    async function* gen() {
      yield "A";
      yield "B";
    }
    const stream = sseFromGenerator(gen());
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toContain('data: {"delta":"A"}');
    expect(text).toContain('data: {"delta":"B"}');
    expect(text).toContain("data: [DONE]");
  });

  it("emits error payload then closes when generator throws", async () => {
    async function* gen() {
      yield "ok";
      throw new QwenAuthError("nope");
    }
    const stream = sseFromGenerator(gen());
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toContain('"error":{"name":"QwenAuthError"');
  });
});

describe("qwen · parseTitles", () => {
  it("parses JSON array", () => {
    expect(parseTitles('["a","b","c","d","e"]')).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("tolerates leading/trailing text around JSON", () => {
    expect(
      parseTitles('这里是结果:["t1","t2","t3","t4","t5"]  end')
    ).toEqual(["t1", "t2", "t3", "t4", "t5"]);
  });

  it("pads to target count when short", () => {
    expect(parseTitles('["a","b"]', 5)).toHaveLength(5);
  });

  it("falls back to line split", () => {
    expect(
      parseTitles(
        "1. First\n2. Second\n3. Third\n- Fourth\n* Fifth"
      )
    ).toHaveLength(5);
  });
});

describe("qwen · generateOutline", () => {
  it("calls openai with outline model and temperature 0.8", async () => {
    let captured: FakeCreateCall | null = null;
    const fake = makeFakeClient((call) => {
      captured = call;
      return { choices: [{ message: { content: "## 大纲\n- 一点" } }] };
    });
    const out = await generateOutline({
      product: "P",
      productDesc: "D",
      angle: "A",
      angleInstruction: "I",
      client: fake as unknown as OpenAI,
    });
    expect(out).toContain("## 大纲");
    expect(captured!.model).toBe("qwen-plus");
    expect(captured!.temperature).toBe(0.8);
    expect(captured!.stream).toBe(false);
  });
});

describe("qwen · generateTitles", () => {
  it("returns 5 titles", async () => {
    const fake = makeFakeClient(() => ({
      choices: [
        {
          message: {
            content: '["a","b","c","d","e"]',
          },
        },
      ],
    }));
    const titles = await generateTitles({
      product: "P",
      angle: "A",
      styleName: "S",
      body: "B",
      client: fake as unknown as OpenAI,
    });
    expect(titles).toHaveLength(5);
    expect(titles).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("qwen · humanize", () => {
  it("streams through humanize prompt node", async () => {
    let captured: FakeCreateCall | null = null;
    const fake = makeFakeClient((call) => {
      captured = call;
      return chunks(["改", "写后"]);
    });
    const out: string[] = [];
    for await (const d of humanize({
      intent: "扩写",
      text: "原文",
      styleName: "卡兹克",
      styleProfile: "口语",
      articleType: "产品介绍",
      client: fake as unknown as OpenAI,
    })) {
      out.push(d);
    }
    expect(out.join("")).toBe("改写后");
    expect(captured!.stream).toBe(true);
    expect(captured!.temperature).toBe(1.0);
  });
});
