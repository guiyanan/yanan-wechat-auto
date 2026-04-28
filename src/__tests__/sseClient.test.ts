import { describe, expect, it } from "vitest";
import { SseError, streamSseDeltas } from "@/lib/sseClient";

function responseOf(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream);
}

describe("streamSseDeltas", () => {
  it("yields delta strings in order", async () => {
    const res = responseOf([
      'data: {"delta":"你好"}\n\n',
      'data: {"delta":",世界"}\n\n',
      "data: [DONE]\n\n",
    ]);
    const out: string[] = [];
    for await (const d of streamSseDeltas(res)) out.push(d);
    expect(out).toEqual(["你好", ",世界"]);
  });

  it("ignores empty delta frames", async () => {
    const res = responseOf([
      'data: {"delta":""}\n\n',
      'data: {"delta":"x"}\n\n',
      "data: [DONE]\n\n",
    ]);
    const out: string[] = [];
    for await (const d of streamSseDeltas(res)) out.push(d);
    expect(out).toEqual(["x"]);
  });

  it("throws SseError on error frame", async () => {
    const res = responseOf([
      'data: {"error":{"name":"QwenAuthError","message":"no key"}}\n\n',
    ]);
    await expect(async () => {
      for await (const _ of streamSseDeltas(res)) {
        void _;
      }
    }).rejects.toMatchObject({
      originalName: "QwenAuthError",
      message: "no key",
    });
  });

  it("handles frames split across reads", async () => {
    const res = responseOf([
      'data: {"delta":"h',
      'ello"}\n\n',
      'data: {"delta":"!"}\n\n',
      "data: [DONE]\n\n",
    ]);
    const out: string[] = [];
    for await (const d of streamSseDeltas(res)) out.push(d);
    expect(out).toEqual(["hello", "!"]);
  });

  it("SseError has name 'SseError' and preserves original name", () => {
    const e = new SseError("QwenRateLimitError", "429");
    expect(e.name).toBe("SseError");
    expect(e.originalName).toBe("QwenRateLimitError");
    expect(e.message).toBe("429");
  });
});
