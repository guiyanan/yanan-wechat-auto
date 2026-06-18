import type {
  ProductUnderstanding,
  ProductUnderstandingEntry,
  ProductUnderstandingEvidence,
  ProductUnderstandingEvidenceSource,
} from "@/types";

function cloneEntries(
  entries: ProductUnderstandingEntry[] | undefined
): ProductUnderstandingEntry[] {
  return Array.isArray(entries) ? entries.map((entry) => ({ ...entry })) : [];
}

function cloneEvidence(
  evidence: ProductUnderstandingEvidence[] | undefined
): ProductUnderstandingEvidence[] {
  return Array.isArray(evidence) ? evidence.map((item) => ({ ...item })) : [];
}

function cloneStrings(items: string[] | undefined): string[] {
  return Array.isArray(items) ? [...items] : [];
}

function isLegacyUnderstanding(value: ProductUnderstanding): boolean {
  const row = value as unknown as Record<string, unknown>;
  return Boolean(
    row.summary ||
      row.targetUsers ||
      row.coreCapabilities ||
      row.contentAngles ||
      row.missingInfo
  );
}

export function normalizeProductUnderstanding(
  understanding: ProductUnderstanding
): ProductUnderstanding {
  return {
    definition: understanding.definition ?? "",
    coreFunctions: cloneEntries(understanding.coreFunctions),
    targetCustomers: cloneEntries(understanding.targetCustomers),
    painPoints: cloneEntries(understanding.painPoints),
    traditionalAlternatives: cloneEntries(understanding.traditionalAlternatives),
    afterUseChanges: cloneEntries(understanding.afterUseChanges),
    evidence: cloneEvidence(understanding.evidence),
    writingBoundaries: cloneStrings(understanding.writingBoundaries),
    questionsToAsk: cloneStrings(understanding.questionsToAsk),
    generatedAt: understanding.generatedAt ?? new Date().toISOString(),
    source: understanding.source ?? "manual",
  };
}

export function normalizeOptionalProductUnderstanding(
  understanding: ProductUnderstanding | undefined
): ProductUnderstanding | undefined {
  if (!understanding || isLegacyUnderstanding(understanding)) return undefined;
  return normalizeProductUnderstanding(understanding);
}

export function entriesToText(entries: ProductUnderstandingEntry[]): string {
  return entries.map((entry) => entry.text).join("\n");
}

export function textToEntries(
  text: string,
  options: {
    confidence?: ProductUnderstandingEntry["confidence"];
    basis?: string;
  } = {}
): ProductUnderstandingEntry[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      text: line,
      confidence: options.confidence ?? "inferred",
      basis: options.basis ?? "人工编辑",
    }));
}

export function stringsToText(items: string[]): string {
  return items.join("\n");
}

export function textToStrings(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function evidenceToText(evidence: ProductUnderstandingEvidence[]): string {
  return evidence
    .map((item) => `${item.sourceLabel}: ${item.text}`)
    .join("\n");
}

export function textToEvidence(
  text: string,
  sourceType: ProductUnderstandingEvidenceSource = "manual"
): ProductUnderstandingEvidence[] {
  return textToStrings(text).map((line) => {
    const [label, ...rest] = line.split(/[:：]/);
    const sourceLabel = rest.length ? label.trim() : "人工补充";
    const content = rest.length ? rest.join(":").trim() : line;
    return {
      sourceType,
      sourceLabel: sourceLabel || "人工补充",
      text: content,
    };
  });
}
