import type { LearnedWritingStyle, WritingStyle } from "@/types";
import { buildHotspotContractPrompt } from "@/lib/trendArticleContract";

export type GeneratedStylePick = {
  styleId: string;
  styleName: string;
  styleOverride?: Pick<
    WritingStyle,
    "id" | "name" | "promptProfile" | "sampleText"
  >;
  styleSource: "official" | "learned";
  learnedStyleId?: string;
  trendStyleId?: string;
  trendStyleName?: string;
  trendStyleSource?: "learned" | "fallback";
};

export const TREND_FALLBACK_STYLE: Pick<
  WritingStyle,
  "id" | "name" | "promptProfile" | "sampleText"
> = {
  id: "trend-fallback",
  name: "系统兜底",
  promptProfile: wrapTrendStylePromptProfile(
    "内置热点观察写法:标题先抓热点里的具体矛盾、品类变化或用户困惑;开头先进入现象和读者疑问;中段把热闹话题翻译成真实工作问题;后段允许产品团队视角自然进入,用我们的回应解释产品如何承接这个问题;格式可以使用小标题、重点句和少量列表,但必须服务于完整公众号观察文。"
  ),
  sampleText:
    "不是复述新闻,也不是推销产品,而是从一个大家正在讨论的问题里,用人话聊清楚为什么有人会点进来看。",
};

export function sanitizeTrendStylePromptProfile(text: string): string {
  return text
    .replace(/产品只在结尾一句轻点/g, "产品相关表达服从热点文章契约")
    .replace(/产品只在结尾/g, "产品相关表达服从热点文章契约")
    .replace(/产品只能在末尾轻轻带出/g, "产品相关表达服从热点文章契约")
    .replace(/产品只能在末尾/g, "产品相关表达服从热点文章契约")
    .replace(/结尾轻点产品视角/g, "收束回到用户判断和产品团队回应")
    .replace(/轻轻带出产品视角/g, "自然转入产品团队视角")
    .replace(/结尾轻点/g, "收束回应")
    .replace(/不急着推产品/g, "产品回应必须服从热点文章契约")
    .replace(/像第三方测评一样/g, "以产品团队观察方式")
    .replace(/第三方测评/g, "产品团队观察")
    .replace(/热点短评体/g, "热点观察体")
    .replace(/短评体/g, "观察体")
    .replace(/语气像短评/g, "语气保持克制观察")
    .replace(/短评/g, "观察")
    .replace(/不写 01\/02、小标题、引用块、列表或硬广CTA/g, "格式使用服从热点文章契约,避免硬广 CTA")
    .replace(/不写\s*01\/02、小标题、引用块、列表/g, "格式使用服从热点文章契约")
    .replace(/只用自然段落分行/g, "格式使用服从热点文章契约")
    .replace(/不要小标题/g, "可按文章需要使用小标题")
    .replace(/不要转回产品观点/g, "转场需要回到产品团队视角和我们的回应")
    .trim();
}

export function wrapTrendStylePromptProfile(profile: string): string {
  const sanitized = sanitizeTrendStylePromptProfile(profile);
  return [
    "【热点风格权限】",
    buildHotspotContractPrompt(),
    "风格只能影响表达方式,不能改变文章身份、不能改变任务骨架、不能改变产品回应策略。",
    "以下内容只作为作者表达方式参考,用于学习标题手法、开头口吻、句式密度、段落节奏、转场习惯和收束语气,不得覆盖上面的热点文章契约:",
    sanitized,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPromptProfileFromStyle(style: LearnedWritingStyle): string {
  return [
    style.toneProfile,
    `标题结构:${style.titlePattern}`,
    `开头方式:${style.openingPattern}`,
    `段落节奏:${style.paragraphPattern}`,
    `金句方式:${style.keySentencePattern}`,
    "必须学习表达方式,不得照抄来源文章内容。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function learnedToWritingStyle(
  style: LearnedWritingStyle
): Pick<WritingStyle, "id" | "name" | "promptProfile" | "sampleText"> {
  const promptProfile =
    style.promptProfile?.trim() || buildPromptProfileFromStyle(style);
  return {
    id: style.id,
    name: style.name,
    promptProfile:
      style.scope === "trend"
        ? wrapTrendStylePromptProfile(promptProfile)
        : promptProfile,
    sampleText: style.sampleDigest,
  };
}

function shuffleStyles<T>(items: T[], rng: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export function buildProductStylePicks(
  count: number,
  learnedStyles: LearnedWritingStyle[],
  officialStyle: WritingStyle,
  rng: () => number = Math.random
): GeneratedStylePick[] {
  const productStyles = learnedStyles.filter(
    (style) => (style.scope ?? "product") === "product"
  );

  if (productStyles.length === 0) {
    return Array.from({ length: count }, () => ({
      styleId: officialStyle.id,
      styleName: officialStyle.name,
      styleSource: "official" as const,
    }));
  }

  const shuffled = shuffleStyles(productStyles, rng);
  return Array.from({ length: count }, (_, index) => {
    const learned = shuffled[index % shuffled.length];
    return {
      styleId: learned.id,
      styleName: learned.name,
      styleOverride: learnedToWritingStyle(learned),
      styleSource: "learned" as const,
      learnedStyleId: learned.id,
    };
  });
}

export function buildTrendStylePicks(
  count: number,
  learnedStyles: LearnedWritingStyle[],
  rng: () => number = Math.random
): GeneratedStylePick[] {
  const trendStyles = learnedStyles.filter((style) => style.scope === "trend");

  if (trendStyles.length === 0) {
    return Array.from({ length: count }, () => ({
      styleId: TREND_FALLBACK_STYLE.id,
      styleName: "热点风格：系统兜底",
      styleOverride: TREND_FALLBACK_STYLE,
      styleSource: "official" as const,
      trendStyleName: "系统兜底",
      trendStyleSource: "fallback" as const,
    }));
  }

  const shuffled = shuffleStyles(trendStyles, rng);
  return Array.from({ length: count }, (_, index) => {
    const learned = shuffled[index % shuffled.length];
    return {
      styleId: learned.id,
      styleName: `热点风格：${learned.name}`,
      styleOverride: learnedToWritingStyle(learned),
      styleSource: "learned" as const,
      learnedStyleId: learned.id,
      trendStyleId: learned.id,
      trendStyleName: learned.name,
      trendStyleSource: "learned" as const,
    };
  });
}
