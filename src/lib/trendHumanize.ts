import type { ArticleType } from "./articleType";

export interface TrendHumanizeRequest {
  text: string;
  articleType: ArticleType;
  styleName: string;
  styleProfile: string;
  intent: string;
  preserveStructure: true;
}

export function getTrendHumanizeIntent(): string {
  return [
    "热点文章只做轻润色:把别扭翻译腔、AI 腔、过度口语和空泛判断改顺。",
    "不得重写文章策略,不得删减事实链路,不得把正文改成短评、测评或广告文案。",
    "保留产品名、产品团队视角、我们的回应、落地判断和原文已有的产品承接段;不得删除产品名或把产品只挪到结尾。",
    "保留 ##、###、引用块和列表;只改段落表达,不改变标题层级、段落顺序和版式结构。",
    "不新增事实、客户、合作、数据、竞品事实、产品流程、按钮路径或来源链接。",
  ].join("\n");
}

export function getTrendHumanizeStyleProfile(styleName?: string): string {
  const label = styleName?.trim() || "默认热点观察体";
  return [
    `目标表达风格:${label}`,
    "文章身份:产品团队写给用户的完整公众号观察文,不是外部媒体稿,也不是纯热点短评。",
    "风格只能影响表达方式、句式节奏、语气密度和收束方式;不能改变文章身份、任务骨架、产品回应策略或事实边界。",
    "保留热点现象、用户困惑、真实工作问题、产品团队视角、我们的回应、收束判断这些结构功能。",
    "产品相关表达要自然嵌入观察和回应里;不得删除产品名,不得把产品写成功能清单,也不得变成硬广 CTA。",
    "格式使用服从原文:保留 ##、###、引用块和列表;章节、重点句和列举方式都跟随原稿。",
  ].join("\n");
}

export function buildTrendHumanizeRequest(input: {
  markdown: string;
  styleName?: string;
}): TrendHumanizeRequest {
  const styleName = input.styleName?.trim() || "默认热点观察体";
  return {
    text: input.markdown,
    articleType: "时事热点",
    styleName,
    styleProfile: getTrendHumanizeStyleProfile(styleName),
    intent: getTrendHumanizeIntent(),
    preserveStructure: true,
  };
}
