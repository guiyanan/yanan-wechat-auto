export type ProductImageKind =
  | "开头主图"
  | "功能截图"
  | "流程图"
  | "架构图"
  | "对比图"
  | "视频封面"
  | "其他";

export interface ProductImageAsset {
  id: string;
  url: string;
  fileName: string;
  kind: ProductImageKind;
  caption: string;
  tags: string[];
  uploadedAt: string;
}

export type ProductSourceMediaFileType = "image" | "video";

export interface ProductSourceMediaAsset {
  id: string;
  url: string;
  fileName: string;
  fileType: ProductSourceMediaFileType;
  sizeKb: number;
  caption: string;
  analysis?: string;
  uploadedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  website?: string;
  appUrl?: string;
  tags: string[];
  iconGradient: [string, string];
  knowledgeDocs: ProductDocument[];
  imageAssets?: ProductImageAsset[];
  sourceMediaAssets?: ProductSourceMediaAsset[];
  sourcePack?: ProductSourcePack;
  understanding?: ProductUnderstanding;
  updatedAt?: string;
}

export interface ProductDocument {
  id: string;
  fileName: string;
  fileType: "pdf" | "word" | "markdown" | "excel";
  sizeKb: number;
  ragStatus: "indexed" | "indexing" | "failed";
  uploadedAt?: string;
  extractedText?: string;
}

export interface ProductSourcePack {
  productNotes?: string;
  competitorNotes?: string;
  trendNotes?: string;
  imageRefs?: string;
  websiteNotes?: string;
  pdfNotes?: string;
  mediaNotes?: string;
}

export type ProductUnderstandingConfidence = "explicit" | "inferred";

export type ProductUnderstandingEvidenceSource =
  | "product"
  | "website"
  | "pdf"
  | "media"
  | "manual"
  | "inferred";

export interface ProductUnderstandingEntry {
  text: string;
  confidence: ProductUnderstandingConfidence;
  basis?: string;
}

export interface ProductUnderstandingEvidence {
  sourceType: ProductUnderstandingEvidenceSource;
  sourceLabel: string;
  text: string;
}

export interface ProductUnderstanding {
  definition: string;
  coreFunctions: ProductUnderstandingEntry[];
  targetCustomers: ProductUnderstandingEntry[];
  painPoints: ProductUnderstandingEntry[];
  traditionalAlternatives: ProductUnderstandingEntry[];
  afterUseChanges: ProductUnderstandingEntry[];
  evidence: ProductUnderstandingEvidence[];
  writingBoundaries: string[];
  questionsToAsk: string[];
  generatedAt: string;
  source: "deepseek" | "qwen" | "fallback" | "manual";
}
