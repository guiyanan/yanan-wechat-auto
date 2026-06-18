import { describe, expect, it } from "vitest";
import {
  entriesToText,
  evidenceToText,
  normalizeOptionalProductUnderstanding,
  normalizeProductUnderstanding,
  stringsToText,
  textToEntries,
  textToEvidence,
  textToStrings,
} from "@/lib/productUnderstandingForm";
import type { ProductUnderstanding } from "@/types";

describe("productUnderstandingForm", () => {
  it("converts V2 entry lists to editable multiline text and back", () => {
    const entries = [
      { text: "浏览器自动化", confidence: "explicit" as const, basis: "PDF" },
      { text: "权限控制", confidence: "inferred" as const, basis: "官网" },
    ];

    expect(entriesToText(entries)).toBe("浏览器自动化\n权限控制");
    expect(textToEntries("浏览器自动化\n\n权限控制")).toEqual([
      { text: "浏览器自动化", confidence: "inferred", basis: "人工编辑" },
      { text: "权限控制", confidence: "inferred", basis: "人工编辑" },
    ]);
  });

  it("converts string lists to editable multiline text and back", () => {
    expect(stringsToText(["不得写客户案例", "不得写百分比"])).toBe(
      "不得写客户案例\n不得写百分比"
    );
    expect(textToStrings("不得写客户案例\n\n不得写百分比")).toEqual([
      "不得写客户案例",
      "不得写百分比",
    ]);
  });

  it("converts evidence lines with source labels", () => {
    const evidence = [
      {
        sourceType: "pdf" as const,
        sourceLabel: "PDF",
        text: "支持浏览器自动化",
      },
    ];

    expect(evidenceToText(evidence)).toBe("PDF: 支持浏览器自动化");
    expect(textToEvidence("PDF: 支持浏览器自动化")).toEqual([
      {
        sourceType: "manual",
        sourceLabel: "PDF",
        text: "支持浏览器自动化",
      },
    ]);
  });

  it("normalizes partial legacy understanding cards before editing", () => {
    const partial = {
      definition: "AI fashion design platform",
      coreFunctions: [
        { text: "趋势洞察", confidence: "explicit" as const, basis: "官网" },
      ],
      source: "deepseek",
    } as ProductUnderstanding;

    expect(normalizeProductUnderstanding(partial)).toEqual({
      definition: "AI fashion design platform",
      coreFunctions: [
        { text: "趋势洞察", confidence: "explicit", basis: "官网" },
      ],
      targetCustomers: [],
      painPoints: [],
      traditionalAlternatives: [],
      afterUseChanges: [],
      evidence: [],
      writingBoundaries: [],
      questionsToAsk: [],
      generatedAt: expect.any(String),
      source: "deepseek",
    });
  });

  it("drops V1 understanding cards instead of carrying old fields into V2", () => {
    const legacy = {
      summary: "Loop RPA 的旧简介",
      targetUsers: ["运营经理"],
      coreCapabilities: ["浏览器自动化"],
      contentAngles: ["为什么需要"],
      missingInfo: ["客户案例"],
      generatedAt: "2026-06-12T00:00:00.000Z",
      source: "qwen",
    } as unknown as ProductUnderstanding;

    expect(normalizeOptionalProductUnderstanding(legacy)).toBeUndefined();
  });
});
