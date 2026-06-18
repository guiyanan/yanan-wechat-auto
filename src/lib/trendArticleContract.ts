export const HOTSPOT_ARTICLE_CONTRACT = {
  identity:
    "产品团队写给用户的完整公众号观察文。",
  prohibitedIdentity:
    "不得装成第三方测评,不得写成热点短评,不得写成普通产品说明稿。",
  audience:
    "写给正在关注相关热点、品类变化或选型问题的真实产品用户和潜在用户。",
  structure: [
    "热点现象:最近大家为什么讨论这个话题",
    "用户困惑:这个热点背后,用户真正关心什么",
    "真实工作问题:落到工作场景里到底卡在哪里",
    "产品团队视角:我们为什么关注这个问题",
    "我们的回应:产品在哪些环节承接这个问题",
    "收束判断:给用户一个选择标准或理解方式",
  ],
  productBoundary:
    "产品可以在中后段自然进入,但必须服务于用户问题和团队判断;不得写成功能清单、参数堆叠或硬广 CTA。",
  styleAuthority:
    "风格只能影响表达方式,例如标题手法、开头口吻、句式密度、转场习惯和收束语气;不能改变文章身份、不能改变任务骨架、不能改变篇幅目标、不能改变产品回应策略。",
  length:
    "标准热点稿按完整公众号文章处理,目标 1200-1600 字;内容不足时优先补充新的判断层次,不得重复同一意思撑篇幅。",
  factBoundary:
    "热点事实、客户、数据、竞品关系和产品流程必须来自素材;素材没有时写成观察、判断或边界提醒,不得编造。",
} as const;

export function buildHotspotContractPrompt(): string {
  return [
    "【热点文章不可覆盖契约】",
    `身份:${HOTSPOT_ARTICLE_CONTRACT.identity}`,
    `身份边界:${HOTSPOT_ARTICLE_CONTRACT.prohibitedIdentity}`,
    `读者:${HOTSPOT_ARTICLE_CONTRACT.audience}`,
    "结构:",
    ...HOTSPOT_ARTICLE_CONTRACT.structure.map((item) => `- ${item}`),
    `产品边界:${HOTSPOT_ARTICLE_CONTRACT.productBoundary}`,
    `风格权限:${HOTSPOT_ARTICLE_CONTRACT.styleAuthority}`,
    `篇幅:${HOTSPOT_ARTICLE_CONTRACT.length}`,
    `事实边界:${HOTSPOT_ARTICLE_CONTRACT.factBoundary}`,
  ].join("\n");
}
