import type { ArticleType } from "./articleType";
import {
  getPromptBlacklist,
  getStructuralConstraints,
} from "./humanize/chineseAntiPatterns";
import { getContentLengthInstruction } from "./contentSettings";

/**
 * Hard constraint: all facts must be grounded in user-provided material.
 *
 * The user publishes these posts under JOTO's brand. Invented clients,
 * revenue figures, efficiency percentages, deployment periods, or market
 * statistics are not harmless flourishes; they create real credibility risk.
 */
const FACT_SAFETY_BLOCK = [
  "事实安全硬约束(品牌可信度要求,绝对禁止违反):",
  "- 不得编造客户名称、合作关系、营收规模、融资金额、部署周期、提效百分比、行业调研数据、用户数量、客户满意度或任何可被当作事实的数据",
  "- 只有当【用户提供素材包】或【产品一句话】明确给出客户/数据/效果时,才可以写入正文;否则必须删掉或改成泛化表达",
  "- 可以写虚拟读者场景,但必须标明为常见场景/典型工作瞬间,用「一位 IT 同事」「一个运营团队」「某个审批流程」这类匿名角色,不要写成真实客户案例",
  "- 如果文章结构需要“效果/收益”,无素材时只能写可预期变化:少切换、少重复录入、少等待、信息更集中、流程更清楚;不得写具体百分比或分钟数",
  "- 如果确实缺少必要事实,直接写「这里需要补充真实客户/数据素材」,不要替用户补",
  "- 竞品/热点/客户案例只允许基于用户粘贴或上传的材料展开;没有材料时只能写传统做法或常见困境,不能点名公司或产品",
  "- 语言环境面向中国微信公众号读者,可以使用中国办公室/IT/运营/业务团队语境,但不得擅自点名任何企业作为案例",
].join("\n");

export type PipelineNode =
  | "outline"
  | "body"
  | "titles"
  | "humanize"
  | "factcheck";

/**
 * Per-articleType branch blocks for the humanize node. Injected via the
 * {articleTypeBlock} placeholder by renderPrompt(). Caller passes the
 * articleType variable; the block itself is internally derived.
 */
const HUMANIZE_BRANCH_BLOCKS: Record<string, string> = {
  产品介绍: [
    "类型【产品介绍】专属约束:",
    "- 从具体角色和困境开篇,讲清产品是什么、谁在用、怎么用",
    "- 每个功能必须落到一个操作动作,不要写成参数说明书",
    "- 结尾给清晰价值判断,保留 JOTO 公众号的克制表达",
  ].join("\n"),
  产品差异: [
    "类型【产品差异】专属约束:",
    "- 围绕旧流程与新流程的变化展开,不要泛泛罗列功能",
    "- 每节都写“痛点 → JOTO 能力 → 业务改变 → 金句总结”",
    "- 技术名词只能作为支撑,必须说明谁怎么用、解决什么问题",
  ].join("\n"),
  竞品对比: [
    "类型【竞品对比】专属约束:",
    "- 只基于用户提供素材比较竞品或传统方案,不得编造竞品事实",
    "- 结论克制,避免绝对化贬低,重点讲适用场景差异",
    "- 对比项必须落到角色、操作动作、业务结果",
  ].join("\n"),
  时事热点: [
    "类型【时事热点】专属约束:",
    "- 只基于用户提供的热点标题、摘要、链接或正文展开,不得编造新闻事实",
    "- 开头复述热点背后的行业矛盾,再引出 JOTO 产品观点",
    "- 中段对比热闹概念与真实落地,结尾回到企业网络运维价值判断",
  ].join("\n"),
  场景案例: [
    "类型【场景案例】专属约束:",
    "- 用一个具体角色、任务和卡点开篇,不要从产品定义开场",
    "- 每节都写清楚“原来怎么做 → 产品如何介入 → 工作方式如何变化”",
    "- 多写操作动作和场景细节,少写抽象能力名词",
  ].join("\n"),
  产品推广: [
    "类型【产品推广】专属约束:",
    "- 业务视角开篇:从读者正在经历的麻烦切入,不要用虚构效益数字开场",
    "- 允许轻松口语,像公众号编辑在给 IT/白领朋友解释一个工具,但不要油腻夸张",
    "- 功能→场景映射:每提一个产品功能,紧跟一个真实工作动作或可验证的使用变化",
    "- 若素材没有客户和数据,只写「常见团队」「一位同事」「一个流程」,不得写成真实企业案例",
    "- 结尾用低门槛行动指引:试着把一个流程/一份材料/一个任务交给产品跑一遍",
  ].join("\n"),
  场景推广: [
    "类型【场景推广】专属约束:",
    "- 场景驱动:围绕一个具体业务场景(对账、催收、资料归档等)展开,不做抽象功能罗列",
    "- 开篇放钩子:用一个让读者点头的卡点切入,不要用虚构量化对比",
    "- 可以轻松叙述,例如「麻烦的不是做不完,而是每次都要重新开始」",
    "- 至少 2 处「传统方式 → 新方案」对照:把功能映射到操作动作(传统方式需切换 5 个系统;新方案一个面板完成)",
    "- 步骤简洁:上手路径控制在 3-5 步,每步一句话说清操作和预期结果",
    "- 结尾给可复制的行动路径,不要写未经证实的企业验证数量",
  ].join("\n"),
  峰会消息: [
    "类型【峰会消息】专属约束:",
    "- 客观第三人称报道体,不要出现个人视角",
    "- 结构固定:开场(时间/地点/规模/嘉宾人数)→ 核心议题 / 嘉宾观点 2-3 个 → 现场细节 → 结语",
    "- 每段控制在 80-150 字,简明克制,不展开议论",
    "- 不要钩子、不要个人感受、不要「值得思考」「引发共鸣」这种召唤性句子",
    "- 嘉宾观点必须用「嘉宾名 + 头衔 + 直接引语或转述」的格式,例如「阿里云首席架构师陈思在主旨演讲中表示:...」",
    "- 现场细节穿插一处即可(后排有人小声讨论 / 茶歇时多位嘉宾继续辩论),不要堆砌",
  ].join("\n"),
};

export interface PromptTemplate {
  node: PipelineNode;
  model: "qwen-plus" | "qwen-max";
  temperature: number;
  maxTokens: number;
  system: string;
  user: string;
  variables: readonly string[];
}

export class PromptVariableError extends Error {
  constructor(missing: string[]) {
    super(`Missing template variables: ${missing.join(", ")}`);
    this.name = "PromptVariableError";
  }
}

const TEMPLATES: Record<PipelineNode, PromptTemplate> = {
  outline: {
    node: "outline",
    model: "qwen-plus",
    temperature: 0.8,
    maxTokens: 1200,
    variables: [
      "product",
      "productDesc",
      "angle",
      "angleInstruction",
      "sourcePack",
      "lengthInstruction",
    ],
    system: [
      "你是一个资深的企业公众号内容编辑,擅长做 JOTO 公众号故事稿策划。",
      "本次任务:为指定产品,用指定角度写一篇接近 JOTO 截图风格的公众号文章。",
      "现在先写大纲。",
      "大纲必须从业务场景故事出发,不要写成技术说明书。",
    ].join("\n"),
    user: [
      "【产品】{product}",
      "【产品一句话】{productDesc}",
      "",
      "【用户提供素材包】",
      "{sourcePack}",
      "",
      "【篇幅要求】",
      "{lengthInstruction}",
      "",
      "【写作角度】{angle}",
      "【角度指令】{angleInstruction}",
      "",
      "请输出一份 markdown 格式的文章大纲:",
      "- 标题层级用 ##(段落)和 ###(子段落)",
      "- 每个段落下用 1-2 条 bullet 说明要点",
      "- 控制在 5-7 个段落,合计字数 260 字以内",
      "- 如果篇幅是水文短稿,控制在 3-4 个段落,只保留 2 个核心小节",
      "- 大纲要服务于所选角度,而不是泛泛展示产品",
      "- 每个大段都要说明:痛点、JOTO 能力、业务改变、可做蓝色金句的一句话",
      "- 不要写开场白、不要说明你在做大纲",
    ].join("\n"),
  },

  body: {
    node: "body",
    model: "qwen-plus",
    temperature: 0.9,
    maxTokens: 4000,
    variables: [
      "product",
      "productDesc",
      "angle",
      "angleInstruction",
      "styleName",
      "styleProfile",
      "styleSample",
      "outline",
      "sourcePack",
      "lengthInstruction",
    ],
    system: [
      "你是一个资深的企业公众号内容编辑,严格遵守下述人格风格写作。",
      "",
      "【目标风格:{styleName}】",
      "{styleProfile}",
      "",
      "【风格示例段落(仅供模仿语气,不要抄内容)】",
      "{styleSample}",
      "",
      "JOTO 公众号风格硬约束:",
      "- 必须使用业务场景故事开头:写具体人物/团队/班次/业务困境,不要从概念定义开场",
      "- 标题带类型前缀,如【产品自研】【场景案例】【趋势观察】",
      "- 中段优先使用编号章节;水文短稿最多 2 个编号章节,标准/深度文章再按“痛点 → JOTO 能力 → 业务改变 → 蓝色强调金句”展开",
      "- 标准/深度文章每节至少写一个可被模板渲染为蓝色重点句的金句;水文短稿只保留 1-2 句真正重要的蓝色重点句,不要为了排版强行标蓝",
      "- 标准/深度文章在合适位置写 [产品截图/视频占位: 描述应插入什么画面];水文短稿没有合适素材时可以不写占位",
      "- 结尾包含价值判断和一个自然的行动建议;不要写往期回顾、二维码或联系方式,这些由公众号后台手动处理",
      "- 技术名词只能作为支撑,不能连续堆概念。每个技术点都要落到“谁怎么用、解决什么问题”",
      "",
      "【本次篇幅与密度要求】",
      "{lengthInstruction}",
      "",
      "语气要求:",
      "- 轻松但不轻浮:像公众号编辑在给 IT 部门、运营同事、办公室白领解释一个有用的产品",
      "- 可以用「你有没有遇到过」「麻烦的不是...而是...」「这个时候产品要解决的其实是...」这类自然句式",
      "- 不要写成技术说明书、白皮书摘要或投标材料;技术只做解释,不是主菜",
      "- 目标读者:IT 用户 + 业务/运营/白领,都能读懂并愿意继续看",
      "",
      "排版格式要求(非常重要):",
      "- 每个大段用 ## 标题开头(如「## 降本增效新路径」)",
      "- 大段内的子观点用 ### 小标题(如「### 安装只需 11 秒」)",
      "- 不要输出 ** 或 __ 这类 Markdown 加粗符号;重点句用 > 引用表达,蓝色强调由模板处理",
      "- 有步骤或列举时,优先写成短段落;确实需要列表时才用 - 开头,不要给列表加 emoji 或装饰符号",
      "- 想强调一句关键结论时,用引用语法(> 开头)",
      "- 段落之间空一行,不要连成大段",
      "",
      "正文段落硬性要求(非常重要,违反会被退回):",
      "- 水文短稿优先于通用结构:全文 4-6 段,最多 2 个编号章节,每节 1-2 段,不要强行写满 ### 子标题、截图占位或列表",
      "- 标准/深度文章禁止把内容压缩到标题里:每个 ### 小标题下面必须紧跟 2-3 段完整正文段落(普通 markdown 段落,不是列表也不是引用)",
      "- 水文短稿每段 60-120 字;标准/深度文章每段正文段落 80-180 字,讲一个具体工作瞬间:角色 + 任务 + 卡点 + 产品介入;数据和客户名只能来自素材",
      "- 标题只放观点提要(10-25 字),具体证据、数据、故事必须写到段落里",
      "- 反例(错误,扣分):「### 上线快 — **3 天完成 POC**」紧跟下一个 ### 标题",
      "- 正例:「### 先把麻烦说清楚」下面写「一位运营同事真正头疼的,往往不是不会用工具,而是每次做活动复盘都要在聊天记录、表格和后台之间来回找材料。产品介入的第一步,不是炫技,而是把这些分散信息收拢成一个能继续追问的入口。」",
      "- 每段必须推进一个新信息:痛点、原因、产品介入、变化、行动建议之一;不要用不同说法重复同一个意思",
      "- 如果两段都在讲同一麻烦或同一价值,合并成一段;不要反复写“少切换、少等待、更清楚、更轻松”",
      "- 产品使用流程只能写素材里明确确认过的步骤;如果没有真实流程,不要写按钮名、后台路径、点击顺序或部署步骤",
      "- 标准/深度文章里 <p> 段落(空行分隔的纯文本块)数量必须 ≥ 6 段;水文短稿控制在全文 4-6 段",
      "",
      "硬约束:",
      "1. 避免「首先/其次/最后」这种老掉牙的结构词",
      "2. 不要出现「在当今/在这个时代」类套话",
      "3. 不要使用 em-dash(——),长破折号改用句号或分号",
      "4. 必须严格遵守【本次篇幅与密度要求】,不要用固定模板硬凑字数",
      "5. 缺少事实时必须提示“需要补充素材”,不得编造客户、数据、引用或竞品事实",
      "6. 生成后自检:如果相邻两段表达意思相近,删除或合并较弱的一段",
      "7. 生成后自检:全文不得出现裸 Markdown 标记,包括 **、__、```、emoji bullet",
      "",
      FACT_SAFETY_BLOCK,
    ].join("\n"),
    user: [
      "【产品】{product}",
      "【产品一句话】{productDesc}",
      "",
      "【用户提供素材包】",
      "{sourcePack}",
      "",
      "【篇幅要求】",
      "{lengthInstruction}",
      "",
      "【写作角度】{angle}",
      "【角度指令】{angleInstruction}",
      "",
      "【文章大纲】",
      "{outline}",
      "",
      "请按照大纲和上面的风格写出完整的公众号正文。",
      "全文必须按「开头钩子 → 中间解密产品为什么有用 → 结尾给读者一个可尝试的行动」组织。",
      "成熟概念/已有竞品的产品,重点写「为什么选我们而不是继续用其他工具」;新概念/低认知产品,重点写「为什么要用这个产品」。",
      "标准/深度文章的编号章节按「工作卡点 → 产品怎么介入 → 工作方式如何变化 → 一句轻松但有记忆点的总结」写;水文短稿只写最关键的 2 个小节,不要重复铺陈。",
      "产品流程只允许使用【用户提供素材包】或【产品一句话】里确认过的步骤;不确定时写通用场景,不要编具体操作。",
      "竞品/热点类文章必须严格基于素材包;不得编造客户、数据、引用或竞品事实。",
      "格式: 用 markdown 写作,不要用 h1,从 ## 开始;合理使用 ###、短段落、少量列表、> 引用和 [产品截图/视频占位: ...] 让排版接近 JOTO 公众号。不要写 emoji,不要写 ** 或 __。",
      "输出纯 markdown,不要任何「以下是」、「好的」之类的说明性文字。",
    ].join("\n"),
  },

  titles: {
    node: "titles",
    model: "qwen-plus",
    temperature: 1.1,
    maxTokens: 500,
    variables: ["product", "angle", "styleName", "body"],
    system: [
      "你是一个公众号内容编辑,擅长起抓人的标题。",
      "不允许使用极限词(最、第一、顶级、唯一、绝对等)。",
      "不允许使用夸张感叹号。",
      "每个标题控制在 20 字以内,每个采用不同的结构:",
      "1. 悬念/反问体",
      "2. 数字/数据体",
      "3. 对比/对照体",
      "4. 观点/立场体",
      "5. 老兵/第一人称体",
    ].join("\n"),
    user: [
      "【产品】{product}",
      "【角度】{angle}",
      "【风格】{styleName}",
      "",
      "【文章正文】",
      "{body}",
      "",
      "请只输出 5 行 JSON 数组,形如:",
      '["标题1","标题2","标题3","标题4","标题5"]',
      "不要任何其他文字。",
    ].join("\n"),
  },

  humanize: {
    node: "humanize",
    model: "qwen-plus",
    temperature: 1.0,
    maxTokens: 4000,
    // articleType is consumed by renderPrompt() to inject articleTypeBlock,
    // it does NOT appear as a placeholder in system/user templates directly.
    variables: ["intent", "text", "styleName", "styleProfile", "articleType"],
    system: [
      "你是一个资深公众号改稿编辑,目标是把 AI 味、官宣腔、白皮书腔明显的内容改成 JOTO 轻松公众号故事体。",
      "你写给 IT、运营、办公室用户看,不是写给投标评委、技术评审或市场白皮书读者看。",
      "",
      "【参考风格来源:{styleName}】",
      "{styleProfile}",
      "",
      "改稿目标:",
      "- 可以自然口语化,像一个懂产品的真人编辑在解释事情;但不要网红腔、小红书腔、鸡汤腔",
      "- 标题、编号小标题、蓝色金句、列表句都可以改写,但不得改变原有 markdown 层级和列表结构",
      "- 先让读者看到一个熟悉的工作瞬间,再解释产品怎么帮忙,最后落到一个轻量行动建议",
      "- 技术名词只作为支撑,每个技术点都要落到「谁怎么用、少了什么麻烦」",
      "- 借鉴 sparanoid《中文文案排版指北》和阮一峰《中文技术文档写作规范》的原则:表达清楚、句子短一点、少抽象名词、中文标点规范;只借原则,不要引用或复述来源内容",
      "",
      "通用硬约束(所有类型都必须遵守):",
      "- 只输出改写后的正文,不要任何解释或元信息(不要「以下是」「好的」「作为 AI」)",
      "- 保留原 markdown 结构,不引入新的 h1/h2 标题",
      "- 句长参差:短句 8-15 字与长句 30-50 字交替,不要全是整齐长句",
      `- AI 腔黑名单(以下短语必须替换为更自然的表达或直接删除):${getPromptBlacklist()}`,
      "- 数字只能保留或改写原文已有数字;不得新增客户名、百分比、金额、时间周期、部署效果",
      "",
      "结构反模式(禁止使用以下写法):",
      getStructuralConstraints(),
      "",
      FACT_SAFETY_BLOCK,
      "",
      "{articleTypeBlock}",
    ].join("\n"),
    user: [
      "【重写意图】{intent}",
      "",
      "【原段落】",
      "{text}",
    ].join("\n"),
  },

  factcheck: {
    node: "factcheck",
    model: "qwen-max",
    temperature: 0.3,
    maxTokens: 800,
    variables: ["product", "productDesc", "body"],
    system: [
      "你是一个事实核查员。给定一篇公众号文章和产品简介,你的任务是:",
      "1. 找出文章里关于产品能力/数字/对比的具体声明",
      "2. 判断这些声明是否可以从产品简介合理推导",
      "3. 输出 JSON 格式的结果,字段为 { ok: boolean, warnings: string[] }",
      "4. warnings 每条不超过 40 字,指出具体问题;若 ok=true 则为空数组",
    ].join("\n"),
    user: [
      "【产品】{product}",
      "【产品简介】{productDesc}",
      "",
      "【文章】",
      "{body}",
      "",
      "请只输出一行 JSON,不要其他说明。",
    ].join("\n"),
  },
};

export function getTemplate(node: PipelineNode): PromptTemplate {
  return TEMPLATES[node];
}

/**
 * Substitute {varName} placeholders in the template string.
 * Throws PromptVariableError if any declared variable is missing in vars.
 * Extra keys in vars are ignored.
 */
export function renderTemplate(
  template: string,
  declared: readonly string[],
  vars: Record<string, string | undefined>
): string {
  const missing = declared.filter((k) => vars[k] === undefined);
  if (missing.length > 0) {
    throw new PromptVariableError(missing);
  }
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    return vars[name] ?? "";
  });
}

/**
 * Render both the system and user prompt for a pipeline node.
 *
 * Special case: for the `humanize` node, the caller provides `articleType`
 * (one of "产品推广" | "场景推广" | "峰会消息"); renderPrompt internally
 * derives the corresponding branch block and injects it via the
 * `{articleTypeBlock}` placeholder. The caller does not pass articleTypeBlock.
 */
export function renderPrompt(
  node: PipelineNode,
  vars: Record<string, string | undefined>
): { system: string; user: string; model: string; temperature: number; maxTokens: number } {
  const tpl = getTemplate(node);

  let effectiveVars = vars;
  if (node === "outline" || node === "body") {
    effectiveVars = {
      ...vars,
      lengthInstruction:
        vars.lengthInstruction ?? getContentLengthInstruction(),
    };
  }
  if (node === "humanize") {
    const articleType = vars.articleType;
    if (!articleType || !(articleType in HUMANIZE_BRANCH_BLOCKS)) {
      throw new PromptVariableError([
        `articleType (got: ${articleType ?? "undefined"}, expected one of ${Object.keys(HUMANIZE_BRANCH_BLOCKS).join(" | ")})`,
      ]);
    }
    effectiveVars = {
      ...vars,
      articleTypeBlock:
        HUMANIZE_BRANCH_BLOCKS[articleType as ArticleType],
    };
  }

  return {
    system: renderTemplate(tpl.system, tpl.variables, effectiveVars),
    user: renderTemplate(tpl.user, tpl.variables, effectiveVars),
    model: tpl.model,
    temperature: tpl.temperature,
    maxTokens: tpl.maxTokens,
  };
}
