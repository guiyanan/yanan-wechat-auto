import { describe, expect, it } from "vitest";
import { hashString, makeRng, seededBool, seededInt } from "@/lib/seed";

describe("seed helpers", () => {
  it("hashString is deterministic and unsigned 32-bit", () => {
    const a = hashString("art-12345");
    const b = hashString("art-12345");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
  });

  it("hashString differs for different inputs", () => {
    expect(hashString("art-1")).not.toBe(hashString("art-2"));
    expect(hashString("")).not.toBe(hashString(" "));
  });

  it("makeRng produces deterministic float stream", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b());
    }
  });

  it("seededInt stays within inclusive bounds", () => {
    for (const seed of ["a", "bb", "ccc", "art-xyz"]) {
      const v = seededInt(seed, 28, 45);
      expect(v).toBeGreaterThanOrEqual(28);
      expect(v).toBeLessThanOrEqual(45);
    }
  });

  it("seededInt is stable across calls", () => {
    expect(seededInt("art-abc", 28, 45)).toBe(seededInt("art-abc", 28, 45));
  });

  it("seededBool converges to the requested probability", () => {
    let hits = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      if (seededBool(`trial-${i}`, 0.1)) hits++;
    }
    const ratio = hits / trials;
    // Within ±3pp for 2k trials
    expect(ratio).toBeGreaterThan(0.07);
    expect(ratio).toBeLessThan(0.13);
  });

  it("same article id + same label always returns same factcheck bool", () => {
    const a = seededBool("art-abc:factcheck", 0.1);
    const b = seededBool("art-abc:factcheck", 0.1);
    expect(a).toBe(b);
  });
});
