import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ArticleListSkeleton } from "@/components/dashboard/ArticleListSkeleton";
import { EditorSkeleton } from "@/components/editor/EditorSkeleton";

describe("ArticleListSkeleton", () => {
  it("renders a busy region with aria-busy", () => {
    const { container } = render(<ArticleListSkeleton />);
    const section = container.querySelector('[aria-busy="true"]');
    expect(section).toBeTruthy();
    expect(section?.getAttribute("aria-label")).toContain("加载");
  });

  it("has 5 placeholder rows", () => {
    const { container } = render(<ArticleListSkeleton />);
    const rows = container.querySelectorAll("li");
    expect(rows.length).toBe(5);
  });

  it("has 6 filter chip placeholders", () => {
    const { container } = render(<ArticleListSkeleton />);
    // Filter chip row: 6 pill divs
    const chipRow = container.querySelectorAll(".rounded-full.bg-slate-100");
    expect(chipRow.length).toBeGreaterThanOrEqual(6);
  });

  it("uses animate-pulse on shimmer primitives", () => {
    const { container } = render(<ArticleListSkeleton />);
    const pulsed = container.querySelectorAll(".animate-pulse");
    // header bits + 6 chips + 5 rows × several cells
    expect(pulsed.length).toBeGreaterThan(20);
  });
});

describe("EditorSkeleton", () => {
  it("renders a busy region", () => {
    const { container } = render(<EditorSkeleton />);
    const section = container.querySelector('[aria-busy="true"]');
    expect(section).toBeTruthy();
    expect(section?.getAttribute("aria-label")).toContain("编辑器");
  });

  it("has 5 title candidate placeholders", () => {
    const { container } = render(<EditorSkeleton />);
    // Title candidate pills are full-rounded shimmer elements
    const pills = container.querySelectorAll(".rounded-full.bg-slate-100");
    expect(pills.length).toBeGreaterThanOrEqual(5);
  });

  it("has 4 cover thumbnail placeholders", () => {
    const { container } = render(<EditorSkeleton />);
    const covers = container.querySelectorAll(".aspect-video");
    expect(covers.length).toBe(4);
  });

  it("has 3 sidebar card placeholders", () => {
    const { container } = render(<EditorSkeleton />);
    const aside = container.querySelector("aside");
    expect(aside).toBeTruthy();
    expect(aside?.children.length).toBe(3);
  });
});
