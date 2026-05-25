export type ArticleStatus =
  | "draft"
  | "pending_review"
  | "in_review"
  | "approved"
  | "rejected"
  | "published"
  | "archived";

export interface ReviewAuditEntry {
  actorName: string;
  agreedAt: string;
  addedAigcNotice: boolean;
  accountId: string;
}

export interface AiScore {
  value: number;
  checkedAt: string;
  iterations: number;
}

export interface ComplianceResult {
  limitWords: string[];
  sensitiveTopics: string[];
  aigcMetaEmbedded: boolean;
  coverSelected: boolean;
  factCheckPassed: boolean;
  factCheckWarning?: string;
}

import type { WechatTheme } from "@/lib/wechatThemes";
import type { AngleStrategy, ContentLength, TopicPlan } from "./topic";

/**
 * Article lifecycle stage in the batch-preview flow.
 *
 *   "batch" — freshly generated or PM-review candidate, sitting in the
 *             batch preview page; NOT shown in the main Dashboard.
 *   "main"  — promoted into the main Dashboard, or a legacy article.
 *             `undefined` is treated as "main" for backward compatibility.
 */
export type ArticleStage = "batch" | "main";

export interface ArticleSourceContext {
  productNotes?: string;
  competitorNotes?: string;
  trendNotes?: string;
  imageRefs?: string;
  mediaNotes?: string;
}

export interface ArticleStoryMeta {
  scene?: string;
  pain?: string;
  productMoment?: string;
  keyLine?: string;
}

export interface ArticleGenerationMeta {
  mode: "manual" | "auto-five" | "paste-format";
  angleLabel: string;
  angleReason?: string;
  topicPlan?: TopicPlan;
  contentLength?: ContentLength;
  angleStrategy?: AngleStrategy;
  styleSource: "official" | "learned";
  learnedStyleId?: string;
  learnedStyleName?: string;
  imageAssetIds?: string[];
  imageSlotCount?: number;
  missingImageSlots?: number;
}

export type ArticleHumanizeStatus = "pending" | "running" | "passed" | "failed";

export interface ArticleHumanizeMeta {
  status: ArticleHumanizeStatus;
  score?: number;
  beforeScore?: number;
  afterScore?: number;
  similarity?: number;
  mode?: "two-pass-strong" | "legacy";
  checkedAt?: string;
  iterations?: number;
  error?: string;
}

export interface Article {
  id: string;
  productId: string;
  angleId?: string;
  customAngle?: string;
  styleId: string;
  accountId?: string;
  exportTheme?: WechatTheme;
  layoutTheme?: WechatTheme;
  sourceContext?: ArticleSourceContext;
  storyMeta?: ArticleStoryMeta;
  generationMeta?: ArticleGenerationMeta;
  humanizeMeta?: ArticleHumanizeMeta;
  status: ArticleStatus;
  title: string;
  titleCandidates: string[];
  contentHtml: string;
  coverImageUrl?: string;
  coverCandidates: string[];
  aiScore: AiScore;
  compliance: ComplianceResult;
  aigcMetadata?: Record<string, unknown>;
  reviewAudit: ReviewAuditEntry[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  wechatDraftMediaId?: string;
  wechatPushedAt?: string;
  readers?: number;
  /**
   * Batch ID grouping a single generation run's articles together.
   * Same value across all N articles produced by one wizard run.
   * Used by the batch preview page to list this run's outputs.
   */
  batchId?: string;
  /** See `ArticleStage` JSDoc. */
  stage?: ArticleStage;
}

export type PipelineStageId =
  | "outline"
  | "body"
  | "titles"
  | "covers"
  | "factcheck";

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  durationHint: string;
  status: "pending" | "running" | "done" | "failed";
  elapsedMs?: number;
  error?: string;
}
