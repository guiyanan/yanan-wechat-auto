import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  readPersistedLearnedStyles,
  readPersistedProducts,
  removePersistedLearnedStyle,
  removePersistedProduct,
  upsertPersistedLearnedStyle,
  upsertPersistedProduct,
  writePersistedProducts,
} from "@/lib/persistentLibrary";
import type { LearnedWritingStyle, Product } from "@/types";

let dataDir = "";

function product(patch: Partial<Product> = {}): Product {
  return {
    id: "prod-file",
    name: "文件产品",
    description: "从项目文件读写的产品",
    tags: ["持久化"],
    iconGradient: ["#1268FF", "#5B8CFF"],
    knowledgeDocs: [],
    imageAssets: [],
    ...patch,
  };
}

function learnedStyle(
  patch: Partial<LearnedWritingStyle> = {}
): LearnedWritingStyle {
  return {
    id: "style-file",
    name: "文件风格",
    sourceUrls: ["https://example.com/post"],
    toneProfile: "轻松但克制",
    titlePattern: "问题式标题",
    openingPattern: "先写一个日常场景",
    paragraphPattern: "短段落",
    keySentencePattern: "用一句话收束",
    sampleDigest: "范文摘要",
    createdAt: "2026-05-22T00:00:00.000Z",
    ...patch,
  };
}

describe("persistentLibrary", () => {
  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "joto-library-"));
    process.env.JOTO_DATA_DIR = dataDir;
  });

  afterEach(async () => {
    delete process.env.JOTO_DATA_DIR;
    await rm(dataDir, { recursive: true, force: true });
  });

  it("persists products to a project data file", async () => {
    await upsertPersistedProduct(product({ name: "新版产品" }));

    expect(await readPersistedProducts()).toMatchObject({
      "prod-file": { name: "新版产品" },
    });
    const raw = JSON.parse(
      await readFile(path.join(dataDir, "products.json"), "utf8")
    );
    expect(raw.products["prod-file"].description).toBe("从项目文件读写的产品");
  });

  it("can replace and remove products", async () => {
    await writePersistedProducts({
      "prod-file": product(),
      "prod-other": product({ id: "prod-other", name: "其他产品" }),
    });
    await removePersistedProduct("prod-file");

    expect(Object.keys(await readPersistedProducts())).toEqual(["prod-other"]);
  });

  it("persists learned writing styles to a project data file", async () => {
    await upsertPersistedLearnedStyle(learnedStyle({ name: "场景风格" }));

    expect(await readPersistedLearnedStyles()).toMatchObject([
      { id: "style-file", name: "场景风格" },
    ]);
    const raw = JSON.parse(
      await readFile(path.join(dataDir, "learned-styles.json"), "utf8")
    );
    expect(raw.styles[0].toneProfile).toBe("轻松但克制");
  });

  it("removes learned writing styles", async () => {
    await upsertPersistedLearnedStyle(learnedStyle());
    await removePersistedLearnedStyle("style-file");

    expect(await readPersistedLearnedStyles()).toEqual([]);
  });
});
