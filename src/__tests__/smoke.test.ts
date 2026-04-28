import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("smoke · cn util", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("dedupes conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("filters falsy values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });
});
