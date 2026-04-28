export interface Product {
  id: string;
  name: string;
  description: string;
  website?: string;
  tags: string[];
  iconGradient: [string, string];
  knowledgeDocs: ProductDocument[];
}

export interface ProductDocument {
  id: string;
  fileName: string;
  fileType: "pdf" | "word" | "markdown" | "excel";
  sizeKb: number;
  ragStatus: "indexed" | "indexing" | "failed";
}
