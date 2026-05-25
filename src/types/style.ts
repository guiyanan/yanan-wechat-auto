export interface WritingStyle {
  id: string;
  name: string;
  tags: string[];
  sampleText: string;
  scopeDesc: string;
  scope: "platform" | "tenant";
  promptProfile: string;
}

export interface LearnedWritingStyle {
  id: string;
  name: string;
  sourceUrls: string[];
  toneProfile: string;
  titlePattern: string;
  openingPattern: string;
  paragraphPattern: string;
  keySentencePattern: string;
  sampleDigest: string;
  createdAt: string;
}
