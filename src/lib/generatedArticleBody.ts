import type { ContentLength } from "@/types";
import { postProcessGeneratedMarkdown } from "@/lib/generatedMarkdown";
import {
  postProcessTrendBody,
  type TrendPostProcessContext,
} from "@/lib/trendPostProcess";

export function finalizeGeneratedBody({
  rawMarkdown,
  isTrendArticle,
  contentLength,
  trendContext,
}: {
  rawMarkdown: string;
  isTrendArticle: boolean;
  contentLength?: ContentLength;
  trendContext?: TrendPostProcessContext;
}): string {
  return isTrendArticle
    ? postProcessTrendBody(rawMarkdown, trendContext)
    : postProcessGeneratedMarkdown(rawMarkdown, contentLength);
}
