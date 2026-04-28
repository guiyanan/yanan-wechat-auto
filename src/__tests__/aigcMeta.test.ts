import { describe, it, expect } from "vitest";
import {
  AIGC_META_TAG_NAME,
  AIGC_PRODUCER,
  aigcMetaTag,
  buildAigcMetadata,
  injectAigcMeta,
} from "@/lib/aigcMeta";

describe("aigcMeta · buildAigcMetadata", () => {
  it("fills defaults", () => {
    const meta = buildAigcMetadata();
    expect(meta.producer).toBe(AIGC_PRODUCER);
    expect(meta.type).toBe("aigc");
    expect(meta.model).toBe("qwen-plus");
    expect(meta.humanReviewed).toBe(false);
    expect(new Date(meta.generatedAt).toString()).not.toBe("Invalid Date");
  });

  it("accepts overrides", () => {
    const meta = buildAigcMetadata({
      articleId: "art-42",
      model: "qwen-max",
      humanReviewed: true,
      generatedAt: "2026-04-17T10:00:00.000Z",
    });
    expect(meta.articleId).toBe("art-42");
    expect(meta.model).toBe("qwen-max");
    expect(meta.humanReviewed).toBe(true);
    expect(meta.generatedAt).toBe("2026-04-17T10:00:00.000Z");
  });

  it("converts Date object to ISO string", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    const meta = buildAigcMetadata({ generatedAt: d });
    expect(meta.generatedAt).toBe(d.toISOString());
  });
});

describe("aigcMeta · aigcMetaTag", () => {
  it("always uses name=AIGC (regulatory requirement)", () => {
    const tag = aigcMetaTag(buildAigcMetadata());
    expect(tag).toContain(`name="${AIGC_META_TAG_NAME}"`);
    expect(AIGC_META_TAG_NAME).toBe("AIGC");
  });

  it("escapes double quotes in content", () => {
    const meta = buildAigcMetadata({ articleId: 'weird"id' });
    const tag = aigcMetaTag(meta);
    expect(tag).not.toMatch(/content="[^"]*"[^"]*"[^"]*"/);
  });
});

describe("aigcMeta · injectAigcMeta", () => {
  it("inserts before </head> when head exists", () => {
    const html = "<!doctype html><html><head><title>x</title></head><body></body></html>";
    const meta = buildAigcMetadata();
    const out = injectAigcMeta(html, meta);
    expect(out.indexOf(aigcMetaTag(meta))).toBeLessThan(out.indexOf("</head>"));
  });

  it("replaces an existing AIGC meta tag", () => {
    const meta = buildAigcMetadata({ articleId: "v1" });
    const html = `<head>${aigcMetaTag(meta)}</head>`;
    const newMeta = buildAigcMetadata({ articleId: "v2" });
    const out = injectAigcMeta(html, newMeta);
    expect(out).toContain("v2");
    expect(out).not.toContain("v1");
    expect(out.match(/name="AIGC"/g)?.length).toBe(1);
  });

  it("prepends when no <head> present", () => {
    const meta = buildAigcMetadata();
    const out = injectAigcMeta("<body>hello</body>", meta);
    expect(out.startsWith(aigcMetaTag(meta))).toBe(true);
  });
});
