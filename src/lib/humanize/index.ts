export {
  PHRASE_BLACKLIST,
  STRUCTURAL_ANTI_PATTERNS,
  CONNECTOR_PATTERNS,
  getPromptBlacklist,
  getStructuralConstraints,
  getTotalPatternCount,
} from "./chineseAntiPatterns";
export type { StructuralPattern, ConnectorPattern } from "./chineseAntiPatterns";

export {
  AI_VOCAB_REPLACEMENTS,
  COLLOCATION_SIMPLIFICATIONS,
  applyVocabReplacements,
  applyCollocationSimplifications,
  applyAllReplacements,
} from "./zhDictionary";
export type { Replacement } from "./zhDictionary";
