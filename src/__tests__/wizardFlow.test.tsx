import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stepper, WIZARD_STEPS } from "@/components/wizard/Stepper";

describe("automated wizard flow", () => {
  it("removes manual angle and style steps from the default stepper", () => {
    expect(WIZARD_STEPS.map((step) => step.label)).toEqual([
      "选产品",
      "生成",
      "批次预览",
    ]);

    render(<Stepper current="product" completedThrough={null} />);

    expect(screen.getByText("选产品")).toBeInTheDocument();
    expect(screen.getByText("生成")).toBeInTheDocument();
    expect(screen.getByText("批次预览")).toBeInTheDocument();
    expect(screen.queryByText("选角度")).not.toBeInTheDocument();
    expect(screen.queryByText("选风格")).not.toBeInTheDocument();
  });
});
