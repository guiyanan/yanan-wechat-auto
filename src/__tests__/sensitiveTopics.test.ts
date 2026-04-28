import { describe, it, expect } from "vitest";
import {
  DEFAULT_SENSITIVE_TOPICS,
  scanSensitive,
  uniqueTopics,
} from "@/lib/sensitiveTopics";

describe("sensitiveTopics · default set", () => {
  it("has distinct topic ids", () => {
    const ids = DEFAULT_SENSITIVE_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes at least 6 topics", () => {
    expect(DEFAULT_SENSITIVE_TOPICS.length).toBeGreaterThanOrEqual(6);
  });

  it("each topic has at least one keyword", () => {
    for (const t of DEFAULT_SENSITIVE_TOPICS) {
      expect(t.keywords.length).toBeGreaterThan(0);
    }
  });
});

describe("sensitiveTopics · scanSensitive", () => {
  it("returns empty on clean text", () => {
    expect(scanSensitive("")).toEqual([]);
    expect(scanSensitive("今天天气真好")).toEqual([]);
  });

  it("flags a politics keyword", () => {
    const matches = scanSensitive("关于最新政策解读");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].topicId).toBe("politics");
    expect(matches[0].label).toBe("时政/政策");
  });

  it("reports index and length", () => {
    const matches = scanSensitive("涉及军事行动的报道", [
      {
        id: "military",
        label: "军事",
        keywords: ["军事行动"],
      },
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0].index).toBe(2);
    expect(matches[0].length).toBe(4);
  });

  it("sorts by index", () => {
    const matches = scanSensitive(
      "先说战争,后说P2P",
      DEFAULT_SENSITIVE_TOPICS
    );
    const idxs = matches.map((m) => m.index);
    expect(idxs).toEqual([...idxs].sort((a, b) => a - b));
  });
});

describe("sensitiveTopics · uniqueTopics", () => {
  it("dedupes labels", () => {
    expect(
      uniqueTopics([
        { topicId: "a", label: "A", keyword: "x", index: 0, length: 1 },
        { topicId: "a", label: "A", keyword: "y", index: 2, length: 1 },
        { topicId: "b", label: "B", keyword: "z", index: 4, length: 1 },
      ])
    ).toEqual(["A", "B"]);
  });
});
