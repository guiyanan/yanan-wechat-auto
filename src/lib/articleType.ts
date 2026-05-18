import angles from "@/data/angles.json";

/**
 * Three editorial article categories. Drives:
 *   - humanize prompt branching (lib/prompts.ts)
 *   - WeChat 排版 default theme (Phase B4)
 *
 * The Wizard never asks the user for this directly — it's derived from the
 * chosen angle. Custom angles fall back to keyword inference.
 */
export type ArticleType = "产品推广" | "场景推广" | "峰会消息";

export const ARTICLE_TYPES: readonly ArticleType[] = [
  "产品推广",
  "场景推广",
  "峰会消息",
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

const SUMMIT_KEYWORDS = ["峰会", "论坛", "大会", "嘉宾", "圆桌", "沙龙", "演讲"];
const SCENARIO_KEYWORDS = [
  "教程",
  "实操",
  "上手",
  "复盘",
  "落地",
  "踩坑",
  "实战",
  "经验",
  "场景",
];

export interface InferArticleTypeInput {
  /** Angle ID from src/data/angles.json. If known, its category wins. */
  angleId?: string | null;
  /** User's free-form custom angle text from Wizard step 2. */
  customAngle?: string | null;
}

/**
 * Derive the article category. Priority:
 *   1. angleId → look up category from angles.json
 *   2. customAngle text → keyword scan (峰会 > 场景 > else 产品)
 *   3. fallback: 产品推广
 */
export function inferArticleType(input: InferArticleTypeInput): ArticleType {
  if (input.angleId) {
    const fromAngle = ANGLE_CATEGORY_INDEX[input.angleId];
    if (fromAngle) return fromAngle;
  }

  const text = (input.customAngle ?? "").trim();
  if (text.length > 0) {
    if (SUMMIT_KEYWORDS.some((k) => text.includes(k))) return "峰会消息";
    if (SCENARIO_KEYWORDS.some((k) => text.includes(k))) return "场景推广";
  }

  return "产品推广";
}
