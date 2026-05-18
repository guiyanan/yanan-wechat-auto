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

export { varySentenceLength, postProcess } from "./postProcess";

export { detectScore, detectScoreTotal } from "./detectScore";
export type { ScoreBreakdown } from "./detectScore";

export {
  splitSections,
  joinSections,
  runHumanizePipeline,
  buildQwenHumanizeFn,
} from "./pipeline";
export type { HumanizeFn, PipelineOptions, PipelineResult } from "./pipeline";
