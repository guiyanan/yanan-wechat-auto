const PDF_TEXT_SNIPPET_LIMIT = 12_000;

type PdfTextItem = { str?: string };

export function cleanPdfTextSnippet(raw: string): string {
  const cleaned = raw
    .replace(/\0/g, " ")
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9，。；：、,.!?;:()（）/%+\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const chunks = cleaned
    .split(/\s{2,}|(?<=。)/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 8);

  const snippet = chunks.join("\n").slice(0, PDF_TEXT_SNIPPET_LIMIT);
  return isPdfInternalNoise(snippet) ? "" : snippet;
}

export function isPdfInternalNoise(text: string): boolean {
  const sample = text.slice(0, 1200);
  if (!sample.trim()) return false;
  const pdfTokens = [
    "%PDF",
    " obj ",
    " endobj",
    "/Font",
    "/Type",
    "/Resources",
    "/MediaBox",
    "/CIDToGIDMap",
    "/Encoding",
  ].filter((token) => sample.includes(token)).length;
  const chineseChars = sample.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
  return pdfTokens >= 3 && chineseChars < 80;
}

async function extractWithPdfJs(bytes: Uint8Array): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const documentParams = {
      data: bytes.slice(),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true,
    } as unknown as Parameters<typeof pdfjs.getDocument>[0];
    const loadingTask = pdfjs.getDocument(documentParams);
    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => (item as PdfTextItem).str ?? "")
        .filter(Boolean)
        .join(" ");
      if (text) pages.push(text);
      if (pages.join("\n").length >= PDF_TEXT_SNIPPET_LIMIT) break;
    }

    await loadingTask.destroy();
    return cleanPdfTextSnippet(pages.join("\n"));
  } catch {
    return "";
  }
}

export async function extractPdfTextSnippet(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const parsed = await extractWithPdfJs(bytes);
  if (parsed) return parsed;

  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return cleanPdfTextSnippet(decoded);
}
