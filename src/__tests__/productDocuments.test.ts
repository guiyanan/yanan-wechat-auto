import { describe, expect, it } from "vitest";
import { removeProductDocument } from "@/lib/productDocuments";
import type { Product } from "@/types";

function product(): Product {
  return {
    id: "prod-fasium",
    name: "Fasium AI",
    description: "AI fashion design platform",
    tags: [],
    iconGradient: ["#1268FF", "#5B8CFF"],
    knowledgeDocs: [
      {
        id: "doc-fasium",
        fileName: "Fasium AI功能介绍.pdf",
        fileType: "pdf",
        sizeKb: 16886,
        ragStatus: "indexed",
        extractedText: "%PDF-1.7 obj Font",
      },
    ],
    sourcePack: {
      pdfNotes: "来自 Fasium AI功能介绍.pdf 的可读片段：\n%PDF-1.7 obj Font",
      websiteNotes: "官网资料",
    },
  };
}

describe("productDocuments", () => {
  it("removes a PDF document and clears its PDF notes when it was the only document", () => {
    const next = removeProductDocument(product(), "doc-fasium");

    expect(next.knowledgeDocs).toEqual([]);
    expect(next.sourcePack?.pdfNotes).toBe("");
    expect(next.sourcePack?.websiteNotes).toBe("官网资料");
  });
});
