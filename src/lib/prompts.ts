import type { ArticleType } from "./articleType";
import {
  getPromptBlacklist,
  getStructuralConstraints,
} from "./humanize/chineseAntiPatterns";

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
const HUMANIZE_BRANCH_BLOCKS: Record<ArticleType, string> = {
  产品推广: [
    "类型【产品推广】专属约束:",
    "- 业务视角开篇:用效益数字(降本 X%、缩短 Y 天)或业务痛点直接切入,不铺垫",
    "- 禁止第一人称随意表达:不要出现「我用了一周」「说实话」「我们昨天试了下」等口语化叙述",
    "- 可用第三人称案例:「某制造企业部署后第 3 周,工单处理速度提升 62%」",
    "- 功能→效益映射:每提一个产品功能,紧跟该功能带来的量化业务效益",
    "- 至少一处具体场景细节:时间(部署第 3 周 / Q2)、数字(47 家客户 / 节省 32%)、业务指标",
    "- 结尾用低门槛行动指引:「30 分钟 POC 验证」「免费试用覆盖核心场景」,不要「欢迎咨询」「联系我们」",
  ].join("\n"),
  场景推广: [
    "类型【场景推广】专属约束:",
    "- 场景驱动:围绕一个具体业务场景(对账、催收、资料归档等)展开,不做抽象功能罗列",
    "- 效益对比开篇:「某团队月末对账从 4 小时压缩到 20 分钟」式的量化对比直接切入",
    "- 禁止口语化叙述:不要「上周我遇到一个事」「之前我们踩过这个坑」等随意表达",
    "- 至少 2 处「传统方式 → 新方案」对照:把功能映射到操作动作(传统方式需切换 5 个系统;新方案一个面板完成)",
    "- 步骤简洁:上手路径控制在 3-5 步,每步一句话说清操作和预期结果",
    "- 结尾给可复制的行动路径:「以上流程已在 12 家企业验证,可直接复用」",
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
    variables: ["product", "productDesc", "angle", "angleInstruction"],
    system: [
      "你是一个资深的企业公众号内容编辑,擅长把产品故事讲得既专业又不无聊。",
      "本次任务:为指定产品,用指定角度写一篇公众号文章。",
      "现在先写大纲。",
    ].join("\n"),
    user: [
      "【产品】{product}",
      "【产品一句话】{productDesc}",
      "",
      "【写作角度】{angle}",
      "【角度指令】{angleInstruction}",
      "",
      "请输出一份 markdown 格式的文章大纲:",
      "- 标题层级用 ##(段落)和 ###(子段落)",
      "- 每个段落下用 1-2 条 bullet 说明要点",
      "- 控制在 5-7 个段落,合计字数 200 字以内",
      "- 大纲要服务于所选角度,而不是泛泛展示产品",
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
      "固定文章骨架(三段式,可在每段内拆分子段):",
      "1. 钩子:开门见山说效益或痛点,抓注意力,不要铺垫",
      "2. 如何使用:简洁步骤或场景,让读者快速理解上手路径",
      "3. 为什么选我们:对比传统方式或主流竞品,突出差异化优势",
      "",
      "语气要求:",
      "- 不口语化:不要出现「我用了一周」「说实话」「有点离谱」等随意表达",
      "- 不过度学术:不要堆砌术语或写成论文体",
      "- 目标读者:业务决策层 + IT,两边都能读懂",
      "",
      "排版格式要求(非常重要):",
      "- 每个大段用 ## 标题开头(如「## 降本增效新路径」)",
      "- 大段内的子观点用 ### 小标题(如「### 安装只需 11 秒」)",
      "- 关键数字、产品名、核心卖点用 **加粗**,每段至少 2-3 处加粗",
      "- 有步骤或列举时,用无序列表(- 开头)或有序列表(1. 开头)",
      "- 想强调一句关键结论时,用引用语法(> 开头)",
      "- 段落之间空一行,不要连成大段",
      "",
      "硬约束:",
      "1. 避免「首先/其次/最后」这种老掉牙的结构词",
      "2. 不要出现「在当今/在这个时代」类套话",
      "3. 不要使用 em-dash(——),长破折号改用句号或分号",
      "4. 字数不少于 900 字,不超过 1800 字",
    ].join("\n"),
    user: [
      "【产品】{product}",
      "【产品一句话】{productDesc}",
      "【写作角度】{angle}",
      "【角度指令】{angleInstruction}",
      "",
      "【文章大纲】",
      "{outline}",
      "",
      "请按照大纲和上面的风格写出完整的公众号正文。",
      "全文必须按「钩子 → 如何使用 → 为什么选我们」三段式组织,每段可拆子段。",
      "格式: 用 markdown 写作,不要用 h1,从 ## 开始;大量使用 ###、**加粗**、列表和 > 引用让排版丰富。",
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
      "你是一个公众号内容编辑,负责把 AI 痕迹明显的段落改成更像真人写作的版本。",
      "",
      "【保持的风格:{styleName}】",
      "{styleProfile}",
      "",
      "通用硬约束(所有类型都必须遵守):",
      "- 只输出改写后的正文,不要任何解释或元信息(不要「以下是」「好的」「作为 AI」)",
      "- 保留原 markdown 结构,不引入新的 h1/h2 标题",
      "- 句长参差:短句 8-15 字与长句 30-50 字交替,不要全是整齐长句",
      `- AI 腔黑名单(以下短语必须替换为更自然的表达或直接删除):${getPromptBlacklist()}`,
      "- 数字必须具体:把「很多/不少/通常/大量」替换为「3 周/47 个客户/早 8 点/82%」这种可验证数字",
      "",
      "结构反模式(禁止使用以下写法):",
      getStructuralConstraints(),
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
