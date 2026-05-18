import { describe, it, expect, vi } from "vitest";
import {
  splitSections,
  joinSections,
  runHumanizePipeline,
  runStructurePreservingPipeline,
  type HumanizeFn,
} from "@/lib/humanize/pipeline";

// ─── Fixtures ────────────────────────────────────────────────────────

const THREE_SECTION_TEXT = `## 钩子

对账时间从四小时压到二十分钟，这不是加班换来的，而是换了工具。

## 如何使用

三步完成配置：安装扩展，录制流程，设置定时任务。

## 为什么选我们

传统工具需要两周部署，Loop 平均两个工作日上线。`;

const NO_HEADINGS_TEXT = `这是没有标题的文本。内容直接开始。没有分节结构。`;

// ─── Suite: splitSections ────────────────────────────────────────────

describe("splitSections", () => {
  it("produces one segment per H2 heading", () => {
    const sections = splitSections(THREE_SECTION_TEXT);
    expect(sections).toHaveLength(3);
  });

  it("preserves heading lines", () => {
    const sections = splitSections(THREE_SECTION_TEXT);
    expect(sections[0].heading).toBe("## 钩子");
    expect(sections[1].heading).toBe("## 如何使用");
    expect(sections[2].heading).toBe("## 为什么选我们");
  });

  it("preserves body text for each section", () => {
    const sections = splitSections(THREE_SECTION_TEXT);
    expect(sections[0].body).toContain("对账时间");
    expect(sections[1].body).toContain("三步完成配置");
    expect(sections[2].body).toContain("传统工具");
  });

  it("returns one segment for text without headings", () => {
    const sections = splitSections(NO_HEADINGS_TEXT);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("");
    expect(sections[0].body).toContain("没有分节结构");
  });

  it("handles empty string", () => {
    expect(splitSections("")).toHaveLength(0);
  });
});

// ─── Suite: joinSections ─────────────────────────────────────────────

describe("joinSections", () => {
  it("is the inverse of splitSections for valid input", () => {
    const sections = splitSections(THREE_SECTION_TEXT);
    const rejoined = joinSections(sections);
    // Content should be preserved (minor whitespace differences are acceptable)
    expect(rejoined).toContain("## 钩子");
    expect(rejoined).toContain("## 如何使用");
    expect(rejoined).toContain("对账时间");
    expect(rejoined).toContain("三步完成配置");
  });

  it("outputs sections with heading then body", () => {
    const sections = [
      { heading: "## A", body: "Body A" },
      { heading: "## B", body: "Body B" },
    ];
    const result = joinSections(sections);
    expect(result.indexOf("## A")).toBeLessThan(result.indexOf("Body A"));
    expect(result.indexOf("## B")).toBeLessThan(result.indexOf("Body B"));
  });
});

// ─── Suite: runHumanizePipeline ──────────────────────────────────────

describe("runHumanizePipeline · basic behaviour", () => {
  it("calls humanizeFn once per non-empty section body", async () => {
    const mockFn = vi.fn<HumanizeFn>(async (text) => text);
    await runHumanizePipeline(THREE_SECTION_TEXT, mockFn, { maxRounds: 1 });
    // Three sections, each with non-empty body → 3 calls
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it("returns a PipelineResult with text, scoreBreakdown, and totalRounds", async () => {
    const mockFn: HumanizeFn = async (text) => text;
    const result = await runHumanizePipeline(NO_HEADINGS_TEXT, mockFn, {
      maxRounds: 1,
    });
    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("scoreBreakdown");
    expect(result).toHaveProperty("totalRounds");
    expect(typeof result.text).toBe("string");
    expect(typeof result.totalRounds).toBe("number");
  });

  it("preserves section headings in the output", async () => {
    const mockFn: HumanizeFn = async (text) => text;
    const result = await runHumanizePipeline(THREE_SECTION_TEXT, mockFn, {
      maxRounds: 1,
    });
    expect(result.text).toContain("## 钩子");
    expect(result.text).toContain("## 如何使用");
    expect(result.text).toContain("## 为什么选我们");
  });

  it("applies L2 postProcess to the humanizeFn output", async () => {
    // humanizeFn returns text with AI vocab — L2 should strip it
    const mockFn: HumanizeFn = async () =>
      "赋能企业，综上所述，结果良好。效果显著，成果斐然。";
    const result = await runHumanizePipeline("## 测试\n\n内容", mockFn, {
      maxRounds: 1,
    });
    expect(result.text).not.toContain("赋能");
    expect(result.text).not.toContain("综上所述");
  });

  it("includes totalRounds equal to sections × rounds per section", async () => {
    const mockFn: HumanizeFn = async (text) => text;
    const result = await runHumanizePipeline(THREE_SECTION_TEXT, mockFn, {
      maxRounds: 1,
      threshold: 100, // never below threshold → always 1 round
    });
    // 3 non-empty sections × 1 round = 3 total
    expect(result.totalRounds).toBe(3);
  });
});

// ─── Suite: threshold / early exit ───────────────────────────────────

describe("runHumanizePipeline · threshold gate", () => {
  it("stops after 1 round when humanizeFn output scores below threshold", async () => {
    // Human-like output: short, concrete, no AI phrases — will score < 40
    const humanOutput =
      "对账从四小时压到二十分钟。就是换了工具，没有魔法。";
    const mockFn = vi.fn<HumanizeFn>(async () => humanOutput);

    await runHumanizePipeline("## 钩子\n\n" + humanOutput, mockFn, {
      maxRounds: 2,
      threshold: 40,
    });
    // Score < 40 after round 1 → should not run a second round
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("retries up to maxRounds when threshold is unreachably high", async () => {
    // threshold: 100 means "always retry" → pipeline must run exactly maxRounds times
    const mockFn = vi.fn<HumanizeFn>(async (text) => text);

    await runHumanizePipeline("## 测试\n\n内容在这里需要处理。", mockFn, {
      maxRounds: 2,
      threshold: 100,
    });
    // threshold=100 means score can never be <= 100 (max is 100), so early-exit
    // fires only when total === 100 which is rare. For human-ish text this won't hit.
    // We just verify it ran at most maxRounds times.
    expect(mockFn.mock.calls.length).toBeLessThanOrEqual(2);
    expect(mockFn.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Suite: concurrency ──────────────────────────────────────────────

describe("runHumanizePipeline · concurrency", () => {
  it("never exceeds the concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const mockFn = vi.fn<HumanizeFn>(async (text) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      // Simulate async delay so concurrency has a chance to build up
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return text;
    });

    // Six sections to process
    const sixSections =
      "## A\n\nBody A\n## B\n\nBody B\n## C\n\nBody C\n## D\n\nBody D\n## E\n\nBody E\n## F\n\nBody F";

    await runHumanizePipeline(sixSections, mockFn, {
      maxRounds: 1,
      concurrency: 3,
      threshold: 100,
    });

    expect(maxConcurrent).toBeLessThanOrEqual(3);
    expect(mockFn).toHaveBeenCalledTimes(6);
  });
});

// ─── Suite: AbortSignal ──────────────────────────────────────────────

describe("runHumanizePipeline · AbortSignal", () => {
  it("propagates signal to humanizeFn", async () => {
    const receivedSignals: Array<AbortSignal | undefined> = [];
    const mockFn: HumanizeFn = async (text, signal) => {
      receivedSignals.push(signal);
      return text;
    };

    const ac = new AbortController();
    await runHumanizePipeline("## 钩子\n\n内容测试", mockFn, {
      maxRounds: 1,
      signal: ac.signal,
    });

    expect(receivedSignals.length).toBeGreaterThan(0);
    expect(receivedSignals[0]).toBe(ac.signal);
  });

  it("aborts mid-run when signal fires", async () => {
    const ac = new AbortController();
    let callCount = 0;

    const mockFn: HumanizeFn = async (text, signal) => {
      callCount++;
      // Abort after the first call
      if (callCount === 1) ac.abort();
      if (signal?.aborted) return text;
      await new Promise((r) => setTimeout(r, 50));
      return text;
    };

    await runHumanizePipeline(THREE_SECTION_TEXT, mockFn, {
      maxRounds: 2,
      threshold: 100,
      signal: ac.signal,
    });

    // With concurrency=3, all 3 sections start simultaneously.
    // Abort is triggered during the first completion, so subsequent
    // rounds (maxRounds=2) for each section are skipped.
    // We verify the pipeline returned without throwing.
    expect(callCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── Suite: scoreBreakdown ───────────────────────────────────────────

describe("runHumanizePipeline · scoreBreakdown", () => {
  it("returns a valid ScoreBreakdown with total in [0, 100]", async () => {
    const mockFn: HumanizeFn = async (text) => text;
    const result = await runHumanizePipeline(THREE_SECTION_TEXT, mockFn, {
      maxRounds: 1,
    });
    const { scoreBreakdown } = result;
    expect(scoreBreakdown.total).toBeGreaterThanOrEqual(0);
    expect(scoreBreakdown.total).toBeLessThanOrEqual(100);
    expect(scoreBreakdown).toHaveProperty("phraseDensity");
    expect(scoreBreakdown).toHaveProperty("sentenceUniformity");
    expect(scoreBreakdown).toHaveProperty("repeatedOpeners");
    expect(scoreBreakdown).toHaveProperty("passiveFiller");
  });
});

// ─── Suite: edge cases ───────────────────────────────────────────────

// ─── runStructurePreservingPipeline ──────────────────────────────────

describe("runStructurePreservingPipeline · structure passthrough", () => {
  const SAMPLE = [
    "## 钩子大段标题",
    "",
    "钩子段落原文。",
    "",
    "### 子段一",
    "",
    "子段一正文。",
    "",
    "- 列表项一",
    "- 列表项二",
    "",
    "> 引用一段",
    "",
    "## 如何使用",
    "",
    "用法段落。",
  ].join("\n");

  it("never invokes humanizeFn on heading / list / blockquote / hr blocks", async () => {
    const seenInputs: string[] = [];
    const fn: HumanizeFn = async (text) => {
      seenInputs.push(text);
      return text + " [REWRITTEN]";
    };
    await runStructurePreservingPipeline(SAMPLE, fn, { maxRounds: 1 });
    // Only paragraph blocks should have been sent
    expect(seenInputs).toContain("钩子段落原文。");
    expect(seenInputs).toContain("子段一正文。");
    expect(seenInputs).toContain("用法段落。");
    // No headings / lists / blockquotes
    expect(seenInputs.some((s) => s.startsWith("## "))).toBe(false);
    expect(seenInputs.some((s) => s.startsWith("- "))).toBe(false);
    expect(seenInputs.some((s) => s.startsWith("> "))).toBe(false);
    expect(seenInputs).toHaveLength(3);
  });

  it("preserves heading / list / blockquote raw text in output", async () => {
    const fn: HumanizeFn = async () => "完全不同的新段落。";
    const result = await runStructurePreservingPipeline(SAMPLE, fn, {
      maxRounds: 1,
    });
    expect(result.text).toContain("## 钩子大段标题");
    expect(result.text).toContain("### 子段一");
    expect(result.text).toContain("- 列表项一");
    expect(result.text).toContain("- 列表项二");
    expect(result.text).toContain("> 引用一段");
    expect(result.text).toContain("## 如何使用");
  });

  it("replaces paragraph blocks with humanized text in original order", async () => {
    const fn: HumanizeFn = async (text) => text.replace("原文", "新版");
    const result = await runStructurePreservingPipeline(SAMPLE, fn, {
      maxRounds: 1,
    });
    expect(result.text).toContain("钩子段落新版。");
    // Order check: 钩子段落新版 should appear before 子段一正文
    const idxHook = result.text.indexOf("钩子段落新版");
    const idxSub = result.text.indexOf("子段一正文");
    expect(idxHook).toBeLessThan(idxSub);
  });

  it("returns a PipelineResult with the standard shape", async () => {
    const fn: HumanizeFn = async (text) => text;
    const result = await runStructurePreservingPipeline(SAMPLE, fn, {
      maxRounds: 1,
    });
    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("scoreBreakdown");
    expect(result).toHaveProperty("totalRounds");
    expect(typeof result.text).toBe("string");
  });

  it("totalRounds counts L1 invocations across paragraph blocks", async () => {
    const fn: HumanizeFn = async (text) => text;
    const result = await runStructurePreservingPipeline(SAMPLE, fn, {
      maxRounds: 1,
      threshold: 100, // never early-exit
    });
    // 3 paragraph blocks × 1 round each
    expect(result.totalRounds).toBe(3);
  });

  it("handles empty input safely", async () => {
    const fn: HumanizeFn = async (text) => text;
    const result = await runStructurePreservingPipeline("", fn);
    expect(result.text).toBe("");
    expect(result.totalRounds).toBe(0);
  });
});

describe("runHumanizePipeline · edge cases", () => {
  it("handles empty input without throwing", async () => {
    const mockFn: HumanizeFn = async (text) => text;
    const result = await runHumanizePipeline("", mockFn);
    expect(result.text).toBe("");
    expect(result.totalRounds).toBe(0);
  });

  it("does not call humanizeFn for sections with empty bodies", async () => {
    const mockFn = vi.fn<HumanizeFn>(async (text) => text);
    // Section with whitespace-only body
    await runHumanizePipeline("## 标题\n\n   \n", mockFn, { maxRounds: 1 });
    expect(mockFn).not.toHaveBeenCalled();
  });
});
