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

/**
 * Article lifecycle stage in the batch-preview flow.
 *
 *   "batch" — freshly generated, sitting in the batch preview page;
 *             NOT shown in the main Dashboard until humanize promotes it.
 *   "main"  — promoted (humanized) into the main Dashboard, or a legacy
 *             article. `undefined` is treated as "main" for backward
 *             compatibility with seed data and old drafts.
 */
export type ArticleStage = "batch" | "main";

export interface Article {
  id: string;
  productId: string;
  angleId?: string;
  customAngle?: string;
  styleId: string;
  accountId?: string;
  exportTheme?: WechatTheme;
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
