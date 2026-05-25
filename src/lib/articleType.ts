import angles from "@/data/angles.json";

/**
 * Five JOTO editorial angles. Drives:
 *   - humanize prompt branching (lib/prompts.ts)
 *   - WeChat 排版 default theme
 *
 * The Wizard never asks the user for this directly — it's derived from the
 * chosen angle. Custom angles fall back to keyword inference.
 */
export type ArticleType =
  | "产品介绍"
  | "产品差异"
  | "竞品对比"
  | "时事热点"
  | "场景案例";

export const ARTICLE_TYPES: readonly ArticleType[] = [
  "产品介绍",
  "产品差异",
  "竞品对比",
  "时事热点",
  "场景案例",
];

interface AngleRecord {
  id: string;
  category?: string;
  name?: string;
}

const ANGLES = angles as readonly AngleRecord[];

const ANGLE_CATEGORY_INDEX: Record<string, ArticleType> = (() => {
  const map: Record<string, ArticleType> = {};
  for (const a of ANGLES) {
    if (a.id && a.category && isArticleType(a.category)) {
      map[a.id] = a.category;
    }
  }
  return map;
})();

function isArticleType(value: string): value is ArticleType {
  return (ARTICLE_TYPES as readonly string[]).includes(value);
}

const TREND_KEYWORDS = ["热点", "新闻", "时事", "事件", "借势", "政策", "行业动态"];
const COMPETITOR_KEYWORDS = ["竞品", "对比", "替代", "相比", "平台", "传统监控"];
const DIFF_KEYWORDS = ["差异", "优势", "变化", "传统方案", "为什么", "更适合"];
const SCENARIO_KEYWORDS = ["场景", "案例", "客户故事", "使用", "怎么用"];

export interface InferArticleTypeInput {
  /** Angle ID from src/data/angles.json. If known, its category wins. */
  angleId?: string | null;
  /** User's free-form custom angle text from Wizard step 2. */
  customAngle?: string | null;
}

/**
 * Derive the article category. Priority:
 *   1. angleId → look up category from angles.json
 *   2. customAngle text → keyword scan (热点 > 竞品 > 差异 > else 产品介绍)
 *   3. fallback: 产品介绍
 */
export function inferArticleType(input: InferArticleTypeInput): ArticleType {
  if (input.angleId) {
    const fromAngle = ANGLE_CATEGORY_INDEX[input.angleId];
    if (fromAngle) return fromAngle;
  }

  const text = (input.customAngle ?? "").trim();
  if (text.length > 0) {
    if (TREND_KEYWORDS.some((k) => text.includes(k))) return "时事热点";
    if (COMPETITOR_KEYWORDS.some((k) => text.includes(k))) return "竞品对比";
    if (DIFF_KEYWORDS.some((k) => text.includes(k))) return "产品差异";
    if (SCENARIO_KEYWORDS.some((k) => text.includes(k))) return "场景案例";
  }

  return "产品介绍";
}
