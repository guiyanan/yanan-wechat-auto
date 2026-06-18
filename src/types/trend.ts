export interface TrendSearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
  source?: string;
  publishedAt?: string;
  score?: number;
  mainstreamAnchor?: string;
  categoryHook?: string;
  hookMode?:
    | "explicit_anchor"
    | "category_hook"
    | "scenario_hook"
    | "comparison_hook"
    | "pitfall_hook";
  featureHint?: string;
}
