import { describe, it, expect } from "vitest";
import {
  DEFAULT_LIMIT_WORDS,
  scanLimitWords,
  uniqueMatchedWords,
} from "@/lib/limitWords";

describe("limitWords · default set", () => {
  it("includes the canonical 极限 words", () => {
    const s = new Set(DEFAULT_LIMIT_WORDS);
    expect(s.has("最")).toBe(true);
    expect(s.has("第一")).toBe(true);
    expect(s.has("唯一")).toBe(true);
    expect(s.has("国家级")).toBe(true);
  });

  it("has at least 40 entries", () => {
    expect(DEFAULT_LIMIT_WORDS.length).toBeGreaterThanOrEqual(40);
  });
});

describe("limitWords · scanLimitWords", () => {
  it("returns empty for empty input", () => {
    expect(scanLimitWords("")).toEqual([]);
    expect(scanLimitWords("正常文案")).toEqual([]);
  });

  it("catches single hit", () => {
    const matches = scanLimitWords("这是最好的产品");
    const words = matches.map((m) => m.word);
    expect(words).toContain("最好");
    expect(words).toContain("最");
  });

  it("reports correct index and length", () => {
    const text = "你唯一的选择";
    const matches = scanLimitWords(text, ["唯一"]);
    expect(matches).toHaveLength(1);
    expect(matches[0].index).toBe(1);
    expect(matches[0].length).toBe(2);
  });

  it("catches multiple occurrences of same word", () => {
    const matches = scanLimitWords("最 最 最", ["最"]);
    expect(matches).toHaveLength(3);
  });

  it("sorts by index ascending", () => {
    const matches = scanLimitWords("世界级第一的产品", ["第一", "世界级"]);
    const idxs = matches.map((m) => m.index);
    expect(idxs).toEqual([...idxs].sort((a, b) => a - b));
  });

  it("handles overlapping words independently", () => {
    const matches = scanLimitWords("最好", ["最", "最好"]);
    const words = new Set(matches.map((m) => m.word));
    expect(words.has("最")).toBe(true);
    expect(words.has("最好")).toBe(true);
  });

  it("ignores empty entries in custom list", () => {
    expect(scanLimitWords("text", ["", "foo"])).toEqual([]);
  });
});

describe("limitWords · uniqueMatchedWords", () => {
  it("dedupes preserving first-seen order", () => {
    const matches = [
      { word: "最", index: 0, length: 1 },
      { word: "第一", index: 2, length: 2 },
      { word: "最", index: 5, length: 1 },
    ];
    expect(uniqueMatchedWords(matches)).toEqual(["最", "第一"]);
  });

  it("empty input returns empty", () => {
    expect(uniqueMatchedWords([])).toEqual([]);
  });
});
