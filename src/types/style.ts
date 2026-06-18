export interface WritingStyle {
  id: string;
  name: string;
  tags: string[];
  sampleText: string;
  scopeDesc: string;
  scope: "platform" | "tenant";
  promptProfile: string;
}

export type LearnedWritingStyleScope = "product" | "trend";

export interface LearnedWritingStyle {
  id: string;
  scope?: LearnedWritingStyleScope;
  name: string;
  sourceUrls: string[];
  toneProfile: string;
  titlePattern: string;
  openingPattern: string;
  paragraphPattern: string;
  keySentencePattern: string;
  promptProfile?: string;
  sampleDigest: string;
  createdAt: string;
}
