/**
 * Chinese synonym / collocation replacement dictionary for L2 post-processing.
 *
 * Two maps:
 *   1. AI_VOCAB_REPLACEMENTS — direct word/phrase substitutions
 *   2. COLLOCATION_SIMPLIFICATIONS — verbose patterns → concise rewrites
 *
 * All replacements are deterministic (no LLM). The L2 post-processor
 * applies them sequentially after Qwen humanize (L1).
 *
 * Sources: shuorenhua (MIT) + StealthHumanizer patterns + manual additions
 * for enterprise WeChat content.
 */

export interface Replacement {
  /** Source phrase (exact match or regex pattern string) */
  from: string;
  /** Replacement text. Empty string = delete. */
  to: string;
  /** If true, `from` is a regex pattern; otherwise exact string match */
  isRegex?: boolean;
}

// ─── 1. Direct AI Vocabulary Replacements ────────────────────────────
// Maps AI-favored words to more natural alternatives.

export const AI_VOCAB_REPLACEMENTS: readonly Replacement[] = [
  // Corporate buzzwords → plain language
  { from: "赋能", to: "支持" },
  { from: "助力", to: "帮助" },
  { from: "打造", to: "建设" },
  { from: "抓手", to: "着力点" },
  { from: "闭环", to: "完整流程" },
  { from: "颗粒度", to: "精细程度" },
  { from: "对齐", to: "统一" },
  { from: "拉齐", to: "拉平" },
  { from: "沉淀", to: "积累" },
  { from: "痛点", to: "难题" },
  { from: "场景化", to: "具体化" },
  { from: "降本增效", to: "降低成本、提高效率" },
  { from: "底层逻辑", to: "基本原理" },
  { from: "顶层设计", to: "整体规划" },
  { from: "体感", to: "感受" },
  { from: "心智", to: "认知" },
  { from: "链路", to: "流程" },
  { from: "触达", to: "送达" },
  { from: "透传", to: "传递" },
  { from: "拉通", to: "打通" },
  { from: "生态", to: "体系" },
  { from: "收口", to: "收拢" },
  { from: "根因", to: "根本原因" },
  { from: "兜底", to: "兜底保障" },
  { from: "落盘", to: "落实" },
  { from: "口径", to: "标准" },

  // Superlative / hyperbolic → measured
  { from: "至关重要", to: "很关键" },
  { from: "举足轻重", to: "重要" },
  { from: "前所未有", to: "空前的" },
  { from: "史无前例", to: "此前没有过的" },
  { from: "颠覆性", to: "突破性" },
  { from: "范式转移", to: "模式转变" },
  { from: "意义非凡", to: "意义重大" },

  // Authority phrases → delete or simplify
  { from: "值得注意的是", to: "" },
  { from: "值得一提的是", to: "" },
  { from: "需要指出的是", to: "" },
  { from: "不可否认的是", to: "" },
  { from: "不难发现", to: "" },
  { from: "不容忽视", to: "" },
  { from: "众所周知", to: "" },
  { from: "毋庸置疑", to: "" },
  { from: "毫不夸张地说", to: "" },
  { from: "诚然", to: "" },
  { from: "不得不说", to: "" },

  // Era clichés → delete
  { from: "在当今社会", to: "" },
  { from: "在当今", to: "" },

  // Summary clichés → delete or simplify
  { from: "综上所述", to: "" },
  { from: "总而言之", to: "" },
  { from: "总的来说", to: "" },
  { from: "总体来看", to: "" },
  { from: "由此可见", to: "" },
  { from: "归根结底", to: "说到底" },

  // Reflection / thought-provoking → delete
  { from: "值得深思", to: "" },
  { from: "令人深思", to: "" },
  { from: "引发思考", to: "" },
  { from: "发人深省", to: "" },
  { from: "深入探讨", to: "讨论" },
  { from: "让我们拭目以待", to: "" },
  { from: "未来可期", to: "" },

  // Vague hedging → delete
  { from: "事实上", to: "" },
  { from: "实际上", to: "" },
  { from: "在此基础上", to: "" },

  // Influencer tone → simplify
  { from: "保姆级", to: "详细的" },
  { from: "硬核", to: "深入的" },
  { from: "干货", to: "实用内容" },
  { from: "一文读懂", to: "" },
  { from: "万字长文", to: "" },
  { from: "建议收藏", to: "" },
  { from: "强烈推荐", to: "推荐" },
  { from: "划重点", to: "" },
];

// ─── 2. Collocation Simplifications (regex-based) ────────────────────
// Verbose Chinese collocations → concise rewrites.
// Inspired by StealthHumanizer's applyCollocations approach.

export const COLLOCATION_SIMPLIFICATIONS: readonly Replacement[] = [
  { from: "进行分析", to: "分析", isRegex: false },
  { from: "进行研究", to: "研究", isRegex: false },
  { from: "进行调查", to: "调查", isRegex: false },
  { from: "进行探讨", to: "探讨", isRegex: false },
  { from: "进行优化", to: "优化", isRegex: false },
  { from: "进行测试", to: "测试", isRegex: false },
  { from: "进行部署", to: "部署", isRegex: false },
  { from: "进行处理", to: "处理", isRegex: false },
  { from: "进行改进", to: "改进", isRegex: false },
  { from: "进行评估", to: "评估", isRegex: false },
  { from: "进行验证", to: "验证", isRegex: false },
  { from: "进行整合", to: "整合", isRegex: false },
  { from: "实现了突破", to: "突破了", isRegex: false },
  { from: "实现了提升", to: "提升了", isRegex: false },
  { from: "实现了增长", to: "增长了", isRegex: false },
  { from: "实现了优化", to: "优化了", isRegex: false },
  { from: "实现了覆盖", to: "覆盖了", isRegex: false },
  { from: "取得了显著的成效", to: "效果明显", isRegex: false },
  { from: "取得了良好的效果", to: "效果不错", isRegex: false },
  { from: "得到了广泛的应用", to: "用得广", isRegex: false },
  { from: "得到了充分的验证", to: "验证过了", isRegex: false },
  { from: "具有重要的意义", to: "很重要", isRegex: false },
  { from: "发挥了重要的作用", to: "起了关键作用", isRegex: false },
  { from: "产生了深远的影响", to: "影响深远", isRegex: false },
  // Regex-based patterns for flexible matching
  {
    from: "进行(?:了)?(?:一次|一番|一定的|深入的|全面的|系统的)?([\\u4e00-\\u9fff]{2})",
    to: "$1",
    isRegex: true,
  },
  {
    from: "做(?:了)?(?:一次|一番|一定的|深入的)?([\\u4e00-\\u9fff]{2})",
    to: "$1",
    isRegex: true,
  },
];

/**
 * Apply all direct replacements to text.
 * Returns the transformed text (pure function, no side effects).
 */
export function applyVocabReplacements(text: string): string {
  let result = text;
  for (const { from, to } of AI_VOCAB_REPLACEMENTS) {
    // Use split+join for exact string replacement (faster than regex for literals)
    result = result.split(from).join(to);
  }
  return result;
}

/**
 * Apply collocation simplifications to text.
 * Handles both exact matches and regex patterns.
 */
export function applyCollocationSimplifications(text: string): string {
  let result = text;
  for (const { from, to, isRegex } of COLLOCATION_SIMPLIFICATIONS) {
    if (isRegex) {
      result = result.replace(new RegExp(from, "g"), to);
    } else {
      result = result.split(from).join(to);
    }
  }
  return result;
}

/**
 * Apply all dictionary-based transformations (vocab + collocations).
 */
export function applyAllReplacements(text: string): string {
  let result = applyVocabReplacements(text);
  result = applyCollocationSimplifications(result);
  return result;
}
