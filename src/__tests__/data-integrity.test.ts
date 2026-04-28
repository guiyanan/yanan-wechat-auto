import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_FILES = [
  "products.json",
  "angles.json",
  "styles.json",
  "accounts.json",
  "articles.json",
];

function readDataFile(name: string): unknown {
  const path = join(process.cwd(), "src", "data", name);
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw);
}

describe("data files · JSON validity", () => {
  for (const file of DATA_FILES) {
    it(`parses ${file}`, () => {
      expect(() => readDataFile(file)).not.toThrow();
    });
  }
});

describe("data files · referential integrity", () => {
  const products = readDataFile("products.json") as Array<{ id: string }>;
  const angles = readDataFile("angles.json") as Array<{ id: string }>;
  const styles = readDataFile("styles.json") as Array<{ id: string }>;
  const accounts = readDataFile("accounts.json") as Array<{ id: string }>;
  const articles = readDataFile("articles.json") as Array<{
    id: string;
    productId: string;
    angleId?: string;
    styleId: string;
    accountId?: string;
  }>;

  const productIds = new Set(products.map((p) => p.id));
  const angleIds = new Set(angles.map((a) => a.id));
  const styleIds = new Set(styles.map((s) => s.id));
  const accountIds = new Set(accounts.map((a) => a.id));

  it("article product refs are valid", () => {
    for (const a of articles) {
      expect(productIds.has(a.productId), `article ${a.id} productId`).toBe(
        true
      );
    }
  });

  it("article angle refs are valid", () => {
    for (const a of articles) {
      if (a.angleId) {
        expect(angleIds.has(a.angleId), `article ${a.id} angleId`).toBe(true);
      }
    }
  });

  it("article style refs are valid", () => {
    for (const a of articles) {
      expect(styleIds.has(a.styleId), `article ${a.id} styleId`).toBe(true);
    }
  });

  it("article account refs are valid", () => {
    for (const a of articles) {
      if (a.accountId) {
        expect(accountIds.has(a.accountId), `article ${a.id} accountId`).toBe(
          true
        );
      }
    }
  });
});
