export interface StyleHtmlDocument {
  name: string;
  html: string;
}

export interface ReadStyleHtmlDocumentsResult {
  documents: StyleHtmlDocument[];
  ignoredCount: number;
}

const MAX_STYLE_HTML_DOCUMENTS = 5;

function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取 HTML 文件失败"));
    reader.readAsText(file);
  });
}

export async function readStyleHtmlDocuments(
  files: File[] | FileList
): Promise<ReadStyleHtmlDocumentsResult> {
  const selectedFiles = Array.from(files).slice(0, MAX_STYLE_HTML_DOCUMENTS);
  const documents = await Promise.all(
    selectedFiles.map(async (file) => ({
      name: file.name,
      html: await readFileText(file),
    }))
  );

  return {
    documents,
    ignoredCount: Math.max(0, files.length - MAX_STYLE_HTML_DOCUMENTS),
  };
}
