/**
 * Chinese AI-tone anti-pattern dictionary.
 *
 * Curated from open-source project "说人话 shuorenhua" (MIT, 342 stars)
 * plus domain-specific additions for enterprise WeChat content.
 *
 * Three categories:
 *   1. PHRASE_BLACKLIST — exact phrases to replace or delete
 *   2. STRUCTURAL_ANTI_PATTERNS — sentence-level patterns to avoid
 *   3. FILLER_CONNECTORS — overused connectors that signal AI authorship
 *
 * Usage:
 *   - Injected into humanize prompt as blacklist instructions
 *   - Used by L2 post-processing for regex-based replacement
 *   - Used by L3 detection scoring for AI-phrase density calculation
 */

// ─── Category 1: Phrase Blacklist ────────────────────────────────────
// Exact phrases that are strong AI-tone markers in Chinese text.
// Grouped by semantic family for maintainability.

/** Authority/importance inflation */
const AUTHORITY_INFLATION = [
  "值得注意的是",
  "值得一提的是",
  "需要指出的是",
  "不可否认的是",
  "不难发现",
  "不容忽视",
  "众所周知",
  "毋庸置疑",
  "不言而喻",
  "毫不夸张地说",
  "研究表明",
  "数据显示",
  "有专家指出",
  "业内人士认为",
  "据报道",
] as const;

/** Era/time clichés */
const ERA_CLICHES = [
  "在当今",
  "在当今社会",
  "随着……的不断发展",
  "在这个……的时代",
  "在此过程中",
  "在这个过程中",
] as const;

/** Superlative / hyperbolic markers */
const SUPERLATIVES = [
  "至关重要",
  "举足轻重",
  "令人瞩目",
  "令人惊叹",
  "意义非凡",
  "前所未有",
  "史无前例",
  "具有重要意义",
  "发挥着关键作用",
  "颠覆性",
  "范式转移",
  "不可磨灭的",
  "深刻的",
  "深远的",
] as const;

/** Reflection / thought-provoking phrases */
const REFLECTION_MARKERS = [
  "值得深思",
  "令人深思",
  "引发思考",
  "发人深省",
  "不禁让人",
  "深入探讨",
  "让我们拭目以待",
  "未来可期",
] as const;

/** Corporate buzzwords (互联网黑话) */
const CORPORATE_BUZZWORDS = [
  "赋能",
  "助力",
  "打造",
  "抓手",
  "闭环",
  "颗粒度",
  "对齐",
  "拉齐",
  "沉淀",
  "痛点",
  "场景化",
  "降本增效",
  "底层逻辑",
  "顶层设计",
  "体感",
  "心智",
  "链路",
  "触达",
  "透传",
  "拉通",
  "生态",
  "收口",
  "收窄",
  "根因",
  "兜底",
  "压实",
  "收敛",
  "收束",
  "锁住",
  "口径",
  "落盘",
] as const;

/** Summary / concluding clichés */
const SUMMARY_CLICHES = [
  "综上所述",
  "总而言之",
  "总的来说",
  "总体来看",
  "由此可见",
  "换句话说",
  "简而言之",
  "归根结底",
] as const;

/** Hedging / vague qualifiers */
const HEDGING_PHRASES = [
  "可以说",
  "某种程度上",
  "从某种意义上说",
  "本质上",
  "核心在于",
  "关键在于",
  "具体来说",
  "更重要的是",
  "事实上",
  "实际上",
  "在此基础上",
  "进一步地",
  "恰恰",
  "正是",
  "无疑",
] as const;

/** Filler transitions */
const FILLER_TRANSITIONS = [
  "不得不说",
  "诚然",
  "尽管如此",
  "然而",
  "此外",
  "与此同时",
] as const;

/** AI chatbot self-referencing */
const CHATBOT_SELF_REF = [
  "让我们一起来看看",
  "接下来我将为你",
  "好问题",
  "你说得很对",
  "这是一个很好的观点",
  "让我来为你解释",
  "希望这对你有帮助",
  "如果你有其他问题",
] as const;

/** Xiaohongshu / influencer AI tone */
const INFLUENCER_TONE = [
  "保姆级",
  "硬核",
  "干货",
  "拆解",
  "梳理",
  "盘点",
  "避坑",
  "踩坑",
  "一文读懂",
  "万字长文",
  "建议收藏",
  "强烈推荐",
  "划重点",
  "绝绝子",
  "谁懂啊",
  "真的会谢",
] as const;

/** Vague bureaucratic verbs */
const BUREAUCRATIC_VERBS = [
  "显著",
  "有效",
  "全面",
  "积极",
  "持续",
  "进一步",
  "充分",
  "切实",
  "可谓",
  "堪称",
  "追根溯源",
  "优化",
  "提升",
  "推动",
  "加强",
  "确保",
  "实现",
  "促进",
  "创新",
] as const;

/**
 * The complete phrase blacklist — 210+ entries.
 * Each entry is an exact string to match (case-insensitive for Chinese is N/A).
 */
export const PHRASE_BLACKLIST: readonly string[] = [
  ...AUTHORITY_INFLATION,
  ...ERA_CLICHES,
  ...SUPERLATIVES,
  ...REFLECTION_MARKERS,
  ...CORPORATE_BUZZWORDS,
  ...SUMMARY_CLICHES,
  ...HEDGING_PHRASES,
  ...FILLER_TRANSITIONS,
  ...CHATBOT_SELF_REF,
  ...INFLUENCER_TONE,
  ...BUREAUCRATIC_VERBS,
];

// ─── Category 2: Structural Anti-Patterns ────────────────────────────
// Sentence-level patterns that betray AI authorship.

export interface StructuralPattern {
  /** Machine-readable ID */
  id: string;
  /** Human label (Chinese) */
  label: string;
  /** Short description for prompt injection */
  description: string;
}

export const STRUCTURAL_ANTI_PATTERNS: readonly StructuralPattern[] = [
  {
    id: "binary-contrast",
    label: "二元对比戏剧化",
    description: "人为对立 X 和 Y 制造虚假顿悟,如「不是A,而是B」",
  },
  {
    id: "negation-listing",
    label: "否定式罗列",
    description: "先说一堆「不是什么」再说「是什么」,循环定义",
  },
  {
    id: "three-item-list",
    label: "三件套排比",
    description: "默认三段排比,两段或一段更自然时仍凑三段",
  },
  {
    id: "mechanical-progression",
    label: "机械递进",
    description: "首先…其次…最后… 或 第一…第二…第三… 的僵硬结构",
  },
  {
    id: "summary-ending",
    label: "总结式收尾",
    description: "用「综上」「总而言之」重复已说过的结论",
  },
  {
    id: "symmetry-padding",
    label: "对称填充",
    description: "强行凑平行结构以求形式对称,实际没有新信息",
  },
  {
    id: "sourceless-attribution",
    label: "无源引用",
    description: "「研究表明」「专家指出」但不给具体来源",
  },
  {
    id: "bold-abuse",
    label: "加粗滥用",
    description: "机械地给每个要点加粗以制造结构感",
  },
  {
    id: "inspirational-closing",
    label: "鸡汤式收尾",
    description: "无论主题,结尾都来一段励志升华",
  },
  {
    id: "fake-colloquialism",
    label: "伪口语化",
    description: "生硬插入网络流行语或俚语,与整体语域不匹配",
  },
  {
    id: "uniform-sentence-length",
    label: "句长均匀",
    description: "所有句子字数接近,缺乏真人写作的长短参差",
  },
  {
    id: "value-elevation",
    label: "价值拔高",
    description: "用「不仅仅是…更是…」「真正的X其实是Y」把事实包装成洞见",
  },
  {
    id: "passive-stacking",
    label: "被动堆砌",
    description: "连续使用被动句式,模糊动作主体",
  },
  {
    id: "rhetorical-question-bait",
    label: "设问钓鱼",
    description: "用反问或设问开头吸引注意力,实际不需要答案",
  },
  {
    id: "false-agency",
    label: "虚假主语",
    description: "给无生命对象赋予人类动词(「技术驱动变革」「数据赋能决策」)",
  },
  {
    id: "compulsive-bullets",
    label: "强迫列表",
    description: "不必要地把所有内容编号列表化",
  },
  {
    id: "debug-speak",
    label: "工程师腔",
    description: "对非技术话题使用「根因」「收口」「落盘」等技术术语",
  },
  {
    id: "empty-wrapping",
    label: "空话包装",
    description: "用大量修饰词包裹很少的实际信息",
  },
  {
    id: "dramatized-fragments",
    label: "戏剧化碎句",
    description: "用短碎句制造假紧凑感,如「对。就是这样。没错。」",
  },
] as const;

// ─── Category 3: Connector Patterns (regex-ready) ───────────────────
// These are sentence-level patterns matched by regex in L2 post-processing.

export interface ConnectorPattern {
  /** Regex pattern string (without flags) */
  pattern: string;
  /** Human-readable description */
  label: string;
}

export const CONNECTOR_PATTERNS: readonly ConnectorPattern[] = [
  { pattern: "首先[,，].*其次[,，].*最后", label: "首先…其次…最后" },
  { pattern: "不仅[^。]+而且", label: "不仅…而且" },
  { pattern: "一方面[^。]+另一方面", label: "一方面…另一方面" },
  { pattern: "与其[^。]+不如", label: "与其…不如" },
  { pattern: "只有[^。]+才能", label: "只有…才能" },
  { pattern: "不是[^。]+而是", label: "不是…而是" },
  { pattern: "通过[^。]+来[^。]+", label: "通过…来…" },
  { pattern: "基于[^。]+", label: "基于…" },
  { pattern: "对于[^。]+而言", label: "对于…而言" },
  { pattern: "从[^。]+的角度来看", label: "从…的角度来看" },
  { pattern: "在[^。]+方面", label: "在…方面" },
  { pattern: "随着[^。]+的", label: "随着…的" },
] as const;

// ─── Prompt-ready exports ────────────────────────────────────────────

/**
 * Format the top N most impactful blacklist phrases for prompt injection.
 * We limit to ~80 to avoid bloating the system prompt token count.
 */
export function getPromptBlacklist(maxItems = 80): string {
  // Prioritize: authority + era + superlatives + corporate + summary
  const prioritized = [
    ...AUTHORITY_INFLATION,
    ...ERA_CLICHES,
    ...SUPERLATIVES,
    ...CORPORATE_BUZZWORDS,
    ...SUMMARY_CLICHES,
    ...REFLECTION_MARKERS,
    ...HEDGING_PHRASES,
    ...FILLER_TRANSITIONS,
    ...CHATBOT_SELF_REF,
  ];
  return prioritized.slice(0, maxItems).join("|");
}

/**
 * Format structural anti-patterns as prompt instructions.
 */
export function getStructuralConstraints(): string {
  return STRUCTURAL_ANTI_PATTERNS.map(
    (p) => `- 禁止「${p.label}」:${p.description}`
  ).join("\n");
}

/**
 * Total count of all anti-pattern entries (phrases + structures + connectors).
 */
export function getTotalPatternCount(): number {
  return (
    PHRASE_BLACKLIST.length +
    STRUCTURAL_ANTI_PATTERNS.length +
    CONNECTOR_PATTERNS.length
  );
}
