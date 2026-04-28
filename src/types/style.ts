export interface WritingStyle {
  id: string;
  name: string;
  tags: string[];
  sampleText: string;
  scopeDesc: string;
  scope: "platform" | "tenant";
  promptProfile: string;
}
