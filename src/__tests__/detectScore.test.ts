import { describe, it, expect } from "vitest";
import { detectScore, detectScoreTotal } from "@/lib/humanize/detectScore";

// ─── Test fixtures ───────────────────────────────────────────────────

/**
 * Typical AI-generated paragraph:
 * - Full of PHRASE_BLACKLIST entries (赋能/综上所述/值得注意的是...)
 * - Very uniform sentence lengths (~20 chars each)
 * - Passive fillers (实现了/进行了)
 */
const AI_TEXT = [
  "值得注意的是，赋能企业是当今最重要的议题。",
  "综上所述，我们实现了显著的效益提升。",
  "不得不说，进行了全面的分析之后，结论不言而喻。",
  "众所周知，底层逻辑决定了顶层设计的方向。",
  "毋庸置疑，这一举措至关重要，前所未有。",
].join("");

/**
 * Human-like paragraph:
 * - No AI phrases
 * - Mix of short (5-10 chars) and long (30-50 chars) sentences
 * - No repeated openers
 */
const HUMAN_TEXT = [
  "对账从四小时压到了二十分钟。",
  "这不是什么魔法，就是换了工具——浏览器原生 Agent 直接操作网页，跳过了所有中间层。",
  "我们用了两天。",
  "IT 那边配合了半天，业务侧自己录了一遍流程，然后就跑起来了，没出什么意外。",
  "效果不错。",
].join("");

// ─── Suite: detectScore breakdown ────────────────────────────────────

describe("detectScore · return shape", () => {
  it("returns all five keys", () => {
    const result = detectScore(AI_TEXT);
    expect(result).toHaveProperty("phraseDensity");
    expect(result).toHaveProperty("sentenceUniformity");
    expect(result).toHaveProperty("repeatedOpeners");
    expect(result).toHaveProperty("passiveFiller");
    expect(result).toHaveProperty("total");
  });

  it("all values are integers in [0, 100]", () => {
    const r = detectScore(AI_TEXT);
    for (const val of Object.values(r)) {
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it("total equals sum of dimensions (capped at 100)", () => {
    const r = detectScore(AI_TEXT);
    const rawSum =
      r.phraseDensity + r.sentenceUniformity + r.repeatedOpeners + r.passiveFiller;
    expect(r.total).toBe(Math.min(100, rawSum));
  });
});

// ─── Suite: discrimination ────────────────────────────────────────────

describe("detectScore · AI vs human discrimination", () => {
  it("scores dense AI text higher than 60", () => {
    expect(detectScoreTotal(AI_TEXT)).toBeGreaterThan(60);
  });

  it("scores human-like text lower than 30", () => {
    expect(detectScoreTotal(HUMAN_TEXT)).toBeLessThan(30);
  });

  it("AI score is substantially higher than human score", () => {
    const aiScore = detectScoreTotal(AI_TEXT);
    const humanScore = detectScoreTotal(HUMAN_TEXT);
    expect(aiScore - humanScore).toBeGreaterThan(30);
  });
});

// ─── Suite: phrase density ────────────────────────────────────────────

describe("detectScore · phraseDensity dimension", () => {
  it("is 0 for text with no blacklist phrases", () => {
    const result = detectScore(HUMAN_TEXT);
    expect(result.phraseDensity).toBe(0);
  });

  it("increases with more blacklist hits", () => {
    const few = "综上所述，结果不错。" + "b".repeat(200);
    const many = (
      "综上所述，值得注意的是，赋能企业，不得不说，众所周知，毋庸置疑。"
    ).repeat(3);
    expect(detectScore(many).phraseDensity).toBeGreaterThan(
      detectScore(few).phraseDensity
    );
  });

  it("caps at 40", () => {
    // Extreme case: solid blacklist phrase string
    const extreme = "综上所述值得注意的是赋能众所周知毋庸置疑不得不说综上所述".repeat(20);
    expect(detectScore(extreme).phraseDensity).toBe(40);
  });
});

// ─── Suite: sentence uniformity ──────────────────────────────────────

describe("detectScore · sentenceUniformity dimension", () => {
  it("is 0 for text with fewer than 3 sentences", () => {
    const short = "只有一句话。还有第二句。";
    expect(detectScore(short).sentenceUniformity).toBe(0);
  });

  it("is higher for highly uniform sentences", () => {
    // All sentences are exactly 15 chars
    const uniform =
      "这是十五个字。这也是十五个字。还有十五个字。继续十五字。又是十五字。";
    const varied = HUMAN_TEXT;
    expect(detectScore(uniform).sentenceUniformity).toBeGreaterThan(
      detectScore(varied).sentenceUniformity
    );
  });

  it("strips HTML tags before analysis", () => {
    const withHtml =
      "<p>这是第一句，有十五字。</p><p>这是第二句，有十五字。</p><p>这是第三句，有十五字。</p>";
    const without =
      "这是第一句，有十五字。这是第二句，有十五字。这是第三句，有十五字。";
    // Scores should be identical since we strip tags
    expect(detectScore(withHtml).sentenceUniformity).toBe(
      detectScore(without).sentenceUniformity
    );
  });
});

// ─── Suite: repeated openers ─────────────────────────────────────────

describe("detectScore · repeatedOpeners dimension", () => {
  it("is 0 when no consecutive sentences share a prefix", () => {
    const varied =
      "今天天气不错。明天可能下雨。系统运行正常。用户反馈良好。";
    expect(detectScore(varied).repeatedOpeners).toBe(0);
  });

  it("increases when consecutive sentences share the same 2-char opener", () => {
    // Many sentences start with 我们
    const sameOpener =
      "我们完成了配置。我们测试了系统。我们发布了结果。我们总结了经验。我们规划了下一步。";
    expect(detectScore(sameOpener).repeatedOpeners).toBeGreaterThan(0);
  });
});

// ─── Suite: passive filler ───────────────────────────────────────────

describe("detectScore · passiveFiller dimension", () => {
  it("is 0 for text with no passive fillers", () => {
    expect(detectScore(HUMAN_TEXT).passiveFiller).toBe(0);
  });

  it("increases with passive filler phrases", () => {
    const passive =
      "据了解，实现了目标。据悉，完成了任务。据报道，进行了测试。经了解，做到了结果。";
    expect(detectScore(passive).passiveFiller).toBeGreaterThan(0);
  });
});

// ─── Suite: edge cases ───────────────────────────────────────────────

describe("detectScore · edge cases", () => {
  it("returns all zeros for empty string", () => {
    const r = detectScore("");
    expect(r.phraseDensity).toBe(0);
    expect(r.sentenceUniformity).toBe(0);
    expect(r.repeatedOpeners).toBe(0);
    expect(r.passiveFiller).toBe(0);
    expect(r.total).toBe(0);
  });

  it("is a pure function (same input → same output)", () => {
    const first = detectScoreTotal(AI_TEXT);
    const second = detectScoreTotal(AI_TEXT);
    expect(first).toBe(second);
  });

  it("does not throw on long text", () => {
    const long = AI_TEXT.repeat(100);
    expect(() => detectScore(long)).not.toThrow();
  });
});

// ─── Suite: detectScoreTotal convenience wrapper ──────────────────────

describe("detectScoreTotal", () => {
  it("equals breakdown.total", () => {
    expect(detectScoreTotal(AI_TEXT)).toBe(detectScore(AI_TEXT).total);
    expect(detectScoreTotal(HUMAN_TEXT)).toBe(detectScore(HUMAN_TEXT).total);
  });

  it("returns a number in [0, 100]", () => {
    expect(detectScoreTotal(AI_TEXT)).toBeGreaterThanOrEqual(0);
    expect(detectScoreTotal(AI_TEXT)).toBeLessThanOrEqual(100);
  });
});
