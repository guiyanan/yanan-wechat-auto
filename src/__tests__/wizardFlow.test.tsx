import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SummaryCard } from "@/components/wizard/SummaryCard";
import { Stepper, WIZARD_STEPS } from "@/components/wizard/Stepper";
import type { Product } from "@/types";

const product: Product = {
  id: "prod-fasium",
  name: "Fasium AI",
  description: "AI fashion design platform",
  tags: ["服装设计"],
  iconGradient: ["#2563eb", "#7c3aed"],
  knowledgeDocs: [],
};

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

  it("shows fixed three-entry planning instead of legacy angle strategy buttons", () => {
    render(<SummaryCard product={product} />);

    expect(screen.getByText("角度 · 固定")).toBeInTheDocument();
    expect(screen.getByText("固定三入口")).toBeInTheDocument();
    expect(screen.getByText("场景痛点入口")).toBeInTheDocument();
    expect(screen.getByText("传统做法入口")).toBeInTheDocument();
    expect(screen.getByText("产品能力/适用人群入口")).toBeInTheDocument();
    expect(screen.queryByText("智能判断")).not.toBeInTheDocument();
    expect(screen.queryByText("偏选型对比")).not.toBeInTheDocument();
    expect(screen.queryByText("偏产品启蒙")).not.toBeInTheDocument();
    expect(screen.queryByText("偏场景痛点")).not.toBeInTheDocument();
  });
});
