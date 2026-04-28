import { describe, it, expect } from "vitest";
import { aiScoreMeta, classifyAiScore } from "@/lib/aiScore";

describe("aiScore · classifyAiScore (WCAG tri-level)", () => {
  it("< 40 is safe", () => {
    expect(classifyAiScore(0)).toBe("safe");
    expect(classifyAiScore(39)).toBe("safe");
  });

  it("40-69 is caution", () => {
    expect(classifyAiScore(40)).toBe("caution");
    expect(classifyAiScore(69)).toBe("caution");
  });

  it(">= 70 is danger", () => {
    expect(classifyAiScore(70)).toBe("danger");
    expect(classifyAiScore(100)).toBe("danger");
  });
});

describe("aiScore · aiScoreMeta", () => {
  it("emoji + label differ across levels (a11y)", () => {
    const levels = [aiScoreMeta(20), aiScoreMeta(50), aiScoreMeta(80)];
    const emojis = new Set(levels.map((m) => m.emoji));
    const labels = new Set(levels.map((m) => m.label));
    // Distinct visual cues beyond color alone
    expect(emojis.size).toBe(3);
    expect(labels.size).toBe(3);
  });

  it("safe uses emerald classes", () => {
    const m = aiScoreMeta(25);
    expect(m.level).toBe("safe");
    expect(m.barColor).toContain("emerald");
  });

  it("danger uses red classes", () => {
    const m = aiScoreMeta(90);
    expect(m.level).toBe("danger");
    expect(m.barColor).toContain("red");
  });
});
