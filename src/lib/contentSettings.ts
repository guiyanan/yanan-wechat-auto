import type { AngleStrategy, ContentLength } from "@/types";

export const CONTENT_LENGTH_OPTIONS: Array<{
  id: ContentLength;
  label: string;
  shortLabel: string;
  description: string;
  wordRange: string;
}> = [
  {
    id: "short",
    label: "水文短稿",
    shortLabel: "水文",
    description: "轻松种草、日常观察,结构更少。",
    wordRange: "800-1000 字",
  },
  {
    id: "standard",
    label: "标准文章",
    shortLabel: "标准",
    description: "正式公众号产品稿,适合默认生成。",
    wordRange: "1100-1400 字",
  },
  {
    id: "deep",
    label: "深度文章",
    shortLabel: "深度",
    description: "竞品对比、行业观点、体系拆解。",
    wordRange: "1500-1800 字",
  },
];

export const ANGLE_STRATEGY_OPTIONS: Array<{
  id: AngleStrategy;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "auto",
    label: "智能判断",
    shortLabel: "智能",
    description: "系统根据产品成熟度自动分配 5 个选题。",
  },
  {
    id: "comparison",
    label: "偏选型对比",
    shortLabel: "对比",
    description: "适合成熟赛道,重点讲为什么选择我们。",
  },
  {
    id: "education",
    label: "偏产品启蒙",
    shortLabel: "启蒙",
    description: "适合低认知产品,先讲是什么和为什么需要。",
  },
  {
    id: "scenario",
    label: "偏场景痛点",
    shortLabel: "场景",
    description: "从工作片段切入,适合轻松公众号阅读。",
  },
  {
    id: "trend",
    label: "偏热点借势",
    shortLabel: "热点",
    description: "需要热点素材,把产品观点接到行业事件里。",
  },
];

export function getContentLengthOption(id?: ContentLength) {
  return (
    CONTENT_LENGTH_OPTIONS.find((option) => option.id === id) ??
    CONTENT_LENGTH_OPTIONS[1]
  );
}

export function getAngleStrategyOption(id?: AngleStrategy) {
  return (
    ANGLE_STRATEGY_OPTIONS.find((option) => option.id === id) ??
    ANGLE_STRATEGY_OPTIONS[0]
  );
}

export function getContentLengthInstruction(id?: ContentLength): string {
  const length = getContentLengthOption(id).id;
  if (length === "short") {
    return [
      "篇幅要求:水文短稿,约 800-1000 字,最多不超过 1000 字。",
      "结构要求:开头钩子 + 最多 2 个编号章节 + 轻量结尾;全文 4-6 段,不要强行堆满章节。",
      "密度要求:每个小节只讲一个新信息,不必每节都放截图占位、长列表或金句块。",
      "去重要求:不要用不同说法重复同一个意思;如果两段都在讲同一麻烦,合并成一段。",
      "收尾要求:宁可短一点,也不要为了凑字数重复“少切换、少等待、更清楚”这类相同价值。",
      "表达要求:更像公众号短文,轻松、具体、好读,少用复杂概念和长列表。",
    ].join("\n");
  }
  if (length === "deep") {
    return [
      "篇幅要求:深度文章,约 1500-1800 字,最多不超过 2000 字。",
      "结构要求:开头钩子 + 最多 4 个完整章节 + 克制结尾,适合竞品对比、行业观点或体系拆解。",
      "密度要求:每一节必须提供新事实、新对比或新判断;不要把同一流程/价值换句话写两遍。",
      "表达要求:信息密度更高,但每个技术点仍必须落到角色、动作和工作变化;不得编造数据。",
    ].join("\n");
  }
  return [
    "篇幅要求:标准文章,约 1100-1400 字,最多不超过 1400 字。",
    "结构要求:开头钩子 + 3 个章节为主,最多 4 个章节 + 自然行动建议,适合正式公众号产品稿。",
    "密度要求:每段只讲一个新信息;如果两段都在讲同一痛点、同一卖点或同一流程,合并成一段。",
    "表达要求:兼顾故事感和产品解释,不要写成白皮书或技术说明书。",
  ].join("\n");
}

export function getAngleStrategyInstruction(id?: AngleStrategy): string {
  const strategy = getAngleStrategyOption(id).id;
  if (strategy === "comparison") {
    return "角度偏好:偏选型对比。优先规划为什么选择我们、传统方案差异、迁移理由、价格/生态/协作成本等选题;没有竞品素材时只写传统做法,不得点名编造竞品事实。";
  }
  if (strategy === "education") {
    return "角度偏好:偏产品启蒙。优先规划为什么需要、这是什么、第一次怎么用、解决什么问题、使用前后变化等选题;先建立需求认知,再讲产品。";
  }
  if (strategy === "scenario") {
    return "角度偏好:偏场景痛点。优先从 IT、运营、办公室用户的具体工作片段切入,用轻松故事解释产品价值,少写抽象概念。";
  }
  if (strategy === "trend") {
    return "角度偏好:偏热点借势。只有在素材包提供热点标题、摘要、链接或正文时才规划热点对比;缺少热点素材时改为趋势观察,不得编造新闻事实。";
  }
  return "角度偏好:智能判断。成熟概念/已有替代方案优先写选型对比;低认知/新概念产品优先写产品启蒙;判断不明确时混合启蒙、对比和场景痛点。";
}
