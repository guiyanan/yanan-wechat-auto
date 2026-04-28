import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/ai-score/route";

function makeReq(body: unknown): Request {
  return new Request("http://test/api/ai-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/ai-score (seeded mock)", () => {
  it("returns same score for same articleId on repeated calls", async () => {
    const a = (await (
      await POST(
        makeReq({ text: "some body text", articleId: "art-abc" }) as never
      )
    ).json()) as { score: number };
    const b = (await (
      await POST(
        makeReq({ text: "completely different text", articleId: "art-abc" }) as never
      )
    ).json()) as { score: number };
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(28);
    expect(a.score).toBeLessThanOrEqual(45);
  });

  it("different articleIds produce different scores usually", async () => {
    const scores = new Set<number>();
    // Run in parallel so the 250ms artificial jitter doesn't serialize
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        POST(makeReq({ text: "x", articleId: `art-${i}` }) as never).then(
          (r) => r.json() as Promise<{ score: number }>
        )
      )
    );
    for (const r of results) scores.add(r.score);
    expect(scores.size).toBeGreaterThan(3);
  }, 10_000);

  it("afterHumanize drops between 5 and 10 seeded by iteration", async () => {
    const r1 = (await (
      await POST(
        makeReq({
          text: "body",
          articleId: "art-xyz",
          afterHumanize: true,
          previousScore: 45,
          iteration: 1,
        }) as never
      )
    ).json()) as { score: number; drop: number };
    expect(r1.drop).toBeGreaterThanOrEqual(5);
    expect(r1.drop).toBeLessThanOrEqual(10);
    expect(r1.score).toBe(45 - r1.drop);

    const r1b = (await (
      await POST(
        makeReq({
          text: "body",
          articleId: "art-xyz",
          afterHumanize: true,
          previousScore: 45,
          iteration: 1,
        }) as never
      )
    ).json()) as { score: number; drop: number };
    expect(r1b.drop).toBe(r1.drop);
  });

  it("returns 0 for empty text", async () => {
    const res = await POST(makeReq({ text: "" }) as never);
    const json = (await res.json()) as { score: number };
    expect(json.score).toBe(0);
  });
});
