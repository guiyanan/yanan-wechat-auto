/**
 * 广告法极限词库 (PRD 6.2.6)
 * 来源:国家市场监管总局《广告法》关于绝对化用语的规定
 * 命中任何一个都会在 Editor 中高亮标红,审核必须处理
 */
export const DEFAULT_LIMIT_WORDS: readonly string[] = [
  // 数量/顺序极限
  "第一", "第1", "唯一", "独家", "独一无二", "绝无仅有",
  // 等级极限
  "最", "最好", "最佳", "最大", "最小", "最多", "最少",
  "最新", "最先进", "最高", "最低", "最强", "最快",
  // 程度极限
  "顶级", "顶尖", "极致", "至尊", "尊享", "绝对", "完美",
  "永久", "永远", "绝对", "百分百", "100%", "全网",
  // 权威背书
  "国家级", "世界级", "国际级", "世界首创", "国家特供",
  "中央级", "王牌", "领袖", "领袖级", "大牌",
  // 促销欺骗
  "史无前例", "前无古人", "万能", "秒杀", "抄底",
];

export interface LimitWordMatch {
  word: string;
  index: number;
  length: number;
}

/**
 * Scan text for any occurrence of limit words.
 * Returns all matches with position and the matched surface form.
 * Matching is case-insensitive (not that it matters for Chinese).
 */
export function scanLimitWords(
  text: string,
  words: readonly string[] = DEFAULT_LIMIT_WORDS
): LimitWordMatch[] {
  if (!text) return [];
  const matches: LimitWordMatch[] = [];
  const lowered = text.toLowerCase();
  for (const word of words) {
    if (!word) continue;
    const needle = word.toLowerCase();
    let from = 0;
    while (from < lowered.length) {
      const idx = lowered.indexOf(needle, from);
      if (idx === -1) break;
      matches.push({
        word,
        index: idx,
        length: word.length,
      });
      from = idx + word.length;
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

/**
 * Unique list of matched words (deduped, preserving first-seen order).
 */
export function uniqueMatchedWords(matches: LimitWordMatch[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    if (!seen.has(m.word)) {
      seen.add(m.word);
      out.push(m.word);
    }
  }
  return out;
}
