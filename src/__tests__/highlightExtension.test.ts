import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { textRangeToDoc } from "@/components/editor/highlightExtension";

/**
 * Build a synthetic ProseMirror doc using the basic schema so we can test the
 * plain-text → PM-position mapping without booting a full TipTap editor.
 */
function buildDoc(schema: Schema, paragraphs: string[]) {
  const pType = schema.nodes.paragraph;
  return schema.topNodeType.create(
    null,
    paragraphs.map((text) =>
      pType.create(null, text ? schema.text(text) : undefined)
    )
  );
}

describe("textRangeToDoc", () => {
  it("maps single-paragraph offsets to doc positions", () => {
    const doc = buildDoc(basicSchema, ["hello"]);
    const flat = doc.textBetween(0, doc.content.size, "\n", "\n");
    expect(flat).toBe("hello");
    // "ell" = offset 1 length 3
    const range = textRangeToDoc(doc, flat, { start: 1, length: 3 });
    expect(range).not.toBeNull();
    expect(doc.textBetween(range!.from, range!.to)).toBe("ell");
  });

  it("maps range crossing one block separator", () => {
    const doc = buildDoc(basicSchema, ["hello", "world"]);
    const flat = doc.textBetween(0, doc.content.size, "\n", "\n");
    expect(flat).toBe("hello\nworld");
    // "o" in world at plain index 7
    const range = textRangeToDoc(doc, flat, { start: 7, length: 1 });
    expect(range).not.toBeNull();
    expect(doc.textBetween(range!.from, range!.to)).toBe("o");
  });

  it("returns null when range exceeds doc length", () => {
    const doc = buildDoc(basicSchema, ["hi"]);
    const flat = doc.textBetween(0, doc.content.size, "\n", "\n");
    expect(textRangeToDoc(doc, flat, { start: 5, length: 1 })).toBeNull();
  });

  it("returns null for zero-length range", () => {
    const doc = buildDoc(basicSchema, ["hi"]);
    const flat = doc.textBetween(0, doc.content.size, "\n", "\n");
    expect(textRangeToDoc(doc, flat, { start: 0, length: 0 })).toBeNull();
  });

  it("handles cjk characters correctly", () => {
    const doc = buildDoc(basicSchema, ["你好世界"]);
    const flat = doc.textBetween(0, doc.content.size, "\n", "\n");
    // "好世" = offset 1 length 2
    const range = textRangeToDoc(doc, flat, { start: 1, length: 2 });
    expect(range).not.toBeNull();
    expect(doc.textBetween(range!.from, range!.to)).toBe("好世");
  });
});
