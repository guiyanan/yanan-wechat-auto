import { describe, expect, it } from "vitest";
import {
  ANGLE_STRATEGY_OPTIONS,
  getAngleStrategyInstruction,
  getAngleStrategyOption,
} from "@/lib/contentSettings";

describe("contentSettings · angle strategy", () => {
  it("keeps hotspot out of ordinary product angle preferences", () => {
    expect(ANGLE_STRATEGY_OPTIONS.map((option) => option.id)).toEqual([
      "auto",
      "comparison",
      "education",
      "scenario",
    ]);
    expect(ANGLE_STRATEGY_OPTIONS.map((option) => option.label).join("\n")).not.toContain(
      "热点"
    );
  });

  it("normalizes legacy trend strategy back to auto", () => {
    expect(getAngleStrategyOption("trend").id).toBe("auto");
    expect(getAngleStrategyInstruction("trend")).toContain("角度偏好:智能判断");
  });

  it("keeps strategy instructions inside the fixed three entries", () => {
    for (const option of ANGLE_STRATEGY_OPTIONS) {
      const instruction = getAngleStrategyInstruction(option.id);
      expect(instruction).toContain("固定三入口");
      expect(instruction).toContain("不得改变入口数量和顺序");
      expect(instruction).not.toContain("优先规划");
      expect(instruction).not.toContain("等选题");
    }
  });
});
