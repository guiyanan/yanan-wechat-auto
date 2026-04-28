/**
 * 敏感话题库 (PRD 6.2.6)
 * 用于 Editor 中对风险话题做黄色高亮,提醒审核注意。
 * 每个话题有一组关键词,命中任意一个即判定为该话题。
 */
export interface SensitiveTopic {
  id: string;
  label: string;
  keywords: readonly string[];
}

export const DEFAULT_SENSITIVE_TOPICS: readonly SensitiveTopic[] = [
  {
    id: "politics",
    label: "时政/政策",
    keywords: ["时政", "政治", "政策解读", "两会", "中央政府", "国务院"],
  },
  {
    id: "celebrity-neg",
    label: "明星负面",
    keywords: ["明星负面", "塌房", "劣迹艺人", "被封杀"],
  },
  {
    id: "company-neg",
    label: "大公司负面",
    keywords: ["阿里负面", "腾讯负面", "字节负面", "大公司负面"],
  },
  {
    id: "military",
    label: "军事",
    keywords: ["军事行动", "战争", "武器装备", "军机"],
  },
  {
    id: "religion",
    label: "宗教",
    keywords: ["宗教", "佛教", "基督教", "伊斯兰教", "传教"],
  },
  {
    id: "ethnic",
    label: "民族",
    keywords: ["民族矛盾", "民族冲突", "种族歧视"],
  },
  {
    id: "finance",
    label: "金融合规",
    keywords: ["股票内幕", "P2P", "非法集资", "诈骗"],
  },
  {
    id: "health",
    label: "医疗健康",
    keywords: ["治愈癌症", "偏方", "祖传秘方", "神药"],
  },
];

export interface SensitiveMatch {
  topicId: string;
  label: string;
  keyword: string;
  index: number;
  length: number;
}

export function scanSensitive(
  text: string,
  topics: readonly SensitiveTopic[] = DEFAULT_SENSITIVE_TOPICS
): SensitiveMatch[] {
  if (!text) return [];
  const out: SensitiveMatch[] = [];
  const lowered = text.toLowerCase();
  for (const topic of topics) {
    for (const kw of topic.keywords) {
      const needle = kw.toLowerCase();
      let from = 0;
      while (from < lowered.length) {
        const idx = lowered.indexOf(needle, from);
        if (idx === -1) break;
        out.push({
          topicId: topic.id,
          label: topic.label,
          keyword: kw,
          index: idx,
          length: kw.length,
        });
        from = idx + kw.length;
      }
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

export function uniqueTopics(matches: SensitiveMatch[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    if (!seen.has(m.label)) {
      seen.add(m.label);
      out.push(m.label);
    }
  }
  return out;
}
