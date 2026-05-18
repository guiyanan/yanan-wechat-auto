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
