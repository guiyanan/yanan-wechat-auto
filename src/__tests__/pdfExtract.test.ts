import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { cleanPdfTextSnippet, extractPdfTextSnippet } from "@/lib/pdfExtract";

function compressedPdfFile(text: string): File {
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const compressed = deflateSync(Buffer.from(stream, "latin1"));
  const objects: Array<Buffer | string> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    Buffer.concat([
      Buffer.from(
        `<< /Length ${compressed.length} /Filter /FlateDecode >>
stream
`,
        "latin1"
      ),
      compressed,
      Buffer.from(
        `
endstream`,
        "latin1"
      ),
    ]),
  ];
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.concat(parts).byteLength);
    parts.push(Buffer.from(`${index + 1} 0 obj\n`, "latin1"));
    parts.push(typeof object === "string" ? Buffer.from(object, "latin1") : object);
    parts.push(Buffer.from("\nendobj\n", "latin1"));
  });
  const xrefOffset = Buffer.concat(parts).byteLength;
  parts.push(
    Buffer.from(
      `xref
0 6
0000000000 65535 f 
${offsets
  .slice(1)
  .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
  .join("\n")}
trailer
<< /Root 1 0 R /Size 6 >>
startxref
${xrefOffset}
%%EOF`,
      "latin1"
    )
  );
  const buffer = Buffer.concat(parts);
  return {
    name: "manual.pdf",
    type: "application/pdf",
    size: buffer.byteLength,
    arrayBuffer: async () =>
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ),
  } as File;
}

describe("pdfExtract", () => {
  it("keeps useful text up to the product understanding prompt limit", () => {
    const lateSection =
      "PDF后半段关键模块: 版型预览、三视图生成、Tech Pack 导出、品牌知识库。";
    const raw = `${"PDF前半段通用介绍。".repeat(700)}${lateSection}`;

    expect(cleanPdfTextSnippet(raw)).toContain(lateSection);
  });

  it("drops decoded PDF internals when no readable copy is present", () => {
    const raw =
      "%PDF-1.7 1 0 obj /Type /Page /Resources /Font /MediaBox endobj /Encoding /CIDToGIDMap";

    expect(cleanPdfTextSnippet(raw)).toBe("");
  });

  it("extracts text from compressed PDF content streams", async () => {
    const file = compressedPdfFile("Fasium PDF Product Manual");

    await expect(extractPdfTextSnippet(file)).resolves.toContain(
      "Fasium PDF Product Manual"
    );
  });
});
