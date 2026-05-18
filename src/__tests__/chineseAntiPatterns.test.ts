import { describe, it, expect } from "vitest";
import {
  PHRASE_BLACKLIST,
  STRUCTURAL_ANTI_PATTERNS,
  CONNECTOR_PATTERNS,
  getPromptBlacklist,
  getStructuralConstraints,
  getTotalPatternCount,
} from "@/lib/humanize/chineseAntiPatterns";

describe("chineseAntiPatterns · PHRASE_BLACKLIST", () => {
  it("contains at least 140 entries", () => {
    expect(PHRASE_BLACKLIST.length).toBeGreaterThanOrEqual(140);
  });

  it("has no duplicates", () => {
    const unique = new Set(PHRASE_BLACKLIST);
    expect(unique.size).toBe(PHRASE_BLACKLIST.length);
  });

  it("every entry is a non-empty string", () => {
    for (const phrase of PHRASE_BLACKLIST) {
      expect(typeof phrase).toBe("string");
      expect(phrase.length).toBeGreaterThan(0);
    }
  });

  it("contains known AI-tone markers from shuorenhua", () => {
    expect(PHRASE_BLACKLIST).toContain("赋能");
    expect(PHRASE_BLACKLIST).toContain("毋庸置疑");
    expect(PHRASE_BLACKLIST).toContain("综上所述");
    expect(PHRASE_BLACKLIST).toContain("在当今");
    expect(PHRASE_BLACKLIST).toContain("值得注意的是");
    expect(PHRASE_BLACKLIST).toContain("闭环");
    expect(PHRASE_BLACKLIST).toContain("底层逻辑");
    expect(PHRASE_BLACKLIST).toContain("降本增效");
  });

  it("contains influencer tone markers", () => {
    expect(PHRASE_BLACKLIST).toContain("保姆级");
    expect(PHRASE_BLACKLIST).toContain("干货");
    expect(PHRASE_BLACKLIST).toContain("一文读懂");
  });

  it("does not contain empty strings", () => {
    expect(PHRASE_BLACKLIST.filter((p) => p.trim() === "")).toHaveLength(0);
  });
});

describe("chineseAntiPatterns · STRUCTURAL_ANTI_PATTERNS", () => {
  it("has 19 structural patterns", () => {
    expect(STRUCTURAL_ANTI_PATTERNS.length).toBe(19);
  });

  it("each pattern has id, label, and description", () => {
    for (const p of STRUCTURAL_ANTI_PATTERNS) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.description).toBeTruthy();
    }
  });

  it("ids are unique", () => {
    const ids = STRUCTURAL_ANTI_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes key patterns: three-item-list, mechanical-progression, summary-ending", () => {
    const ids = STRUCTURAL_ANTI_PATTERNS.map((p) => p.id);
    expect(ids).toContain("three-item-list");
    expect(ids).toContain("mechanical-progression");
    expect(ids).toContain("summary-ending");
    expect(ids).toContain("uniform-sentence-length");
  });
});

describe("chineseAntiPatterns · CONNECTOR_PATTERNS", () => {
  it("has at least 10 connector patterns", () => {
    expect(CONNECTOR_PATTERNS.length).toBeGreaterThanOrEqual(10);
  });

  it("each pattern has valid regex pattern and label", () => {
    for (const cp of CONNECTOR_PATTERNS) {
      expect(cp.label).toBeTruthy();
      // Should not throw when compiled
      expect(() => new RegExp(cp.pattern)).not.toThrow();
    }
  });

  it("首先…其次…最后 pattern matches real text", () => {
    const p = CONNECTOR_PATTERNS.find((c) => c.label === "首先…其次…最后");
    expect(p).toBeDefined();
    const re = new RegExp(p!.pattern);
    expect(re.test("首先，我们做A。其次，我们做B。最后总结")).toBe(true);
  });
});

describe("chineseAntiPatterns · utility functions", () => {
  it("getPromptBlacklist returns pipe-separated string with default cap", () => {
    const result = getPromptBlacklist();
    expect(result).toContain("|");
    expect(result).toContain("赋能");
    expect(result).toContain("在当今");
    // Default cap is 80, so output should have ~79 pipes (80 items)
    const items = result.split("|");
    expect(items.length).toBeLessThanOrEqual(80);
    expect(items.length).toBeGreaterThan(50);
  });

  it("getPromptBlacklist respects maxItems parameter", () => {
    const result = getPromptBlacklist(10);
    const items = result.split("|");
    expect(items.length).toBe(10);
  });

  it("getStructuralConstraints returns formatted lines", () => {
    const result = getStructuralConstraints();
    expect(result).toContain("禁止「");
    expect(result).toContain("三件套排比");
    expect(result).toContain("机械递进");
    // Should have 19 lines (one per pattern)
    const lines = result.split("\n").filter((l) => l.startsWith("- 禁止"));
    expect(lines.length).toBe(19);
  });

  it("getTotalPatternCount sums all three categories", () => {
    const total = getTotalPatternCount();
    expect(total).toBe(
      PHRASE_BLACKLIST.length +
        STRUCTURAL_ANTI_PATTERNS.length +
        CONNECTOR_PATTERNS.length
    );
    // Should be well over 150
    expect(total).toBeGreaterThan(150);
  });
});
