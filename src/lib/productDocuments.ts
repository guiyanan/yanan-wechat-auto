import type { Product } from "@/types";

function removePdfNoteBlock(notes: string, fileName: string): string {
  const blocks = notes
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.filter((block) => !block.includes(fileName)).join("\n\n");
}

export function removeProductDocument(product: Product, docId: string): Product {
  const removedDoc = product.knowledgeDocs.find((doc) => doc.id === docId);
  const knowledgeDocs = product.knowledgeDocs.filter((doc) => doc.id !== docId);
  const sourcePack = { ...product.sourcePack };

  if (removedDoc?.fileType === "pdf") {
    sourcePack.pdfNotes = knowledgeDocs.some((doc) => doc.fileType === "pdf")
      ? removePdfNoteBlock(sourcePack.pdfNotes ?? "", removedDoc.fileName)
      : "";
  }

  return {
    ...product,
    knowledgeDocs,
    sourcePack,
  };
}
