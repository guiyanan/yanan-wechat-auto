export async function extractPdfTextSnippet(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const cleaned = decoded
    .replace(/\0/g, " ")
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9，。；：、,.!?;:()（）/%+\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const chunks = cleaned
    .split(/\s{2,}|(?<=。)/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 8)
    .slice(0, 30);

  return chunks.join("\n").slice(0, 6000);
}
