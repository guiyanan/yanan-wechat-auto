import type { AngleStrategy, ContentLength } from "@/types";
import { AUTO_ARTICLE_COUNT } from "@/lib/generationConstants";

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
    wordRange: "不设字数上限",
  },
  {
    id: "standard",
    label: "标准文章",
    shortLabel: "标准",
    description: "正式公众号产品稿,适合默认生成。",
    wordRange: "不设字数上限",
  },
  {
    id: "deep",
    label: "深度文章",
    shortLabel: "深度",
    description: "竞品对比、行业观点、体系拆解。",
    wordRange: "不设字数上限",
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
    description: `系统固定生成 ${AUTO_ARTICLE_COUNT} 个入口:场景痛点、传统做法、产品能力/适用人群。`,
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
];

export function getContentLengthOption(id?: ContentLength) {
  return (
    CONTENT_LENGTH_OPTIONS.find((option) => option.id === id) ??
    CONTENT_LENGTH_OPTIONS[1]
  );
}

export function getAngleStrategyOption(id?: AngleStrategy) {
  return (
    ANGLE_STRATEGY_OPTIONS.find((option) => option.id === id && id !== "trend") ??
    ANGLE_STRATEGY_OPTIONS[0]
  );
}

export function getContentLengthInstruction(id?: ContentLength): string {
  const length = getContentLengthOption(id).id;
  if (length === "short") {
    return [
      "篇幅要求:水文短稿。不设固定字数,优先跟随所选风格提示词的节奏。",
      "结构参考:开头工作场景 + 少量核心观察 + 轻量结尾;不要为了模板强行堆满章节。",
      "密度要求:每个小节只讲一个新信息,不必每节都放截图占位、长列表或金句块。",
      "去重要求:不要用不同说法重复同一个意思;如果两段都在讲同一麻烦,合并成一段。",
      "收尾要求:宁可短一点,也不要为了撑篇幅重复“少切换、少等待、更清楚”这类相同价值。",
      "正文禁词:不要把「钩子」「角度」「事实点」「图片建议」「风险提示」这些内部策划词写进正文标题或段落。",
      "表达要求:更像公众号短文,轻松、具体、好读,少用复杂概念和长列表。",
    ].join("\n");
  }
  if (length === "deep") {
    return [
      "篇幅要求:深度文章。不设固定字数,允许根据材料和所选风格提示词充分展开。",
      "结构参考:开头工作场景 + 完整章节 + 克制结尾,适合竞品对比、行业观点或体系拆解。",
      "密度要求:每一节必须提供新事实、新对比或新判断;不要把同一流程/价值换句话写两遍。",
      "正文禁词:不要把「钩子」「角度」「事实点」「图片建议」「风险提示」这些内部策划词写进正文标题或段落。",
      "表达要求:信息密度更高,但每个技术点仍必须落到角色、动作和工作变化;不得编造数据。",
    ].join("\n");
  }
  return [
    "篇幅要求:标准文章。不设固定字数,优先跟随所选风格提示词和材料密度。",
    "结构参考:开头工作场景 + 若干完整章节 + 自然行动建议,适合正式公众号产品稿。",
    "密度要求:每段只讲一个新信息;如果两段都在讲同一痛点、同一卖点或同一流程,合并成一段。",
    "正文禁词:不要把「钩子」「角度」「事实点」「图片建议」「风险提示」这些内部策划词写进正文标题或段落。",
    "表达要求:兼顾故事感和产品解释,不要写成白皮书或技术说明书。",
  ].join("\n");
}

export function getAngleStrategyInstruction(id?: AngleStrategy): string {
  const strategy = getAngleStrategyOption(id).id;
  if (strategy === "comparison") {
    return "角度偏好:偏选型对比。普通产品仍固定三入口:场景痛点、传统做法、产品能力/适用人群;偏好只影响三篇内部表达重心,可多解释选择理由、传统方案差异、迁移成本或协作成本;没有竞品素材时只写传统做法,不得点名编造竞品事实;不得改变入口数量和顺序。";
  }
  if (strategy === "education") {
    return "角度偏好:偏产品启蒙。普通产品仍固定三入口:场景痛点、传统做法、产品能力/适用人群;偏好只影响三篇内部表达重心,可多解释为什么需要、这是什么、解决什么问题和使用前后变化;先建立需求认知,再讲产品;不得改变入口数量和顺序。";
  }
  if (strategy === "scenario") {
    return "角度偏好:偏场景痛点。普通产品仍固定三入口:场景痛点、传统做法、产品能力/适用人群;偏好只影响三篇内部表达重心,可多用匿名工作片段解释产品价值;没有真实素材时不要写具体人名或客户故事;不得改变入口数量和顺序。";
  }
  return "角度偏好:智能判断。普通产品固定三入口:场景痛点、传统做法、产品能力/适用人群;偏好只影响每篇内部的表达重心,不得改变入口数量和顺序。";
}
