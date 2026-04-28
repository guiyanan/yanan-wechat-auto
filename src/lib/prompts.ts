export type PipelineNode =
  | "outline"
  | "body"
  | "titles"
  | "humanize"
  | "factcheck";

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
      "硬约束:",
      "1. 段落之间空一行,不要连成大段",
      "2. 避免「首先/其次/最后」这种老掉牙的结构词",
      "3. 不要出现「在当今/在这个时代」类套话",
      "4. 不要使用 em-dash(——),长破折号改用句号或分号",
      "5. 字数不少于 900 字,不超过 1800 字",
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
      "请按照大纲和上面的风格写出完整的公众号正文(markdown 段落,不要用 h1,从 ## 开始)。",
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
    variables: ["intent", "text", "styleName", "styleProfile"],
    system: [
      "你是一个公众号内容编辑,负责根据意图重写用户选中的段落。",
      "",
      "【保持的风格:{styleName}】",
      "{styleProfile}",
      "",
      "硬约束:",
      "- 只输出改写后的正文,不要任何解释或元信息",
      "- 保留 markdown 结构不要引入新的 h1/h2 标题",
      "- 避免出现明显的「作为 AI」、「让我」等口吻",
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
 */
export function renderPrompt(
  node: PipelineNode,
  vars: Record<string, string | undefined>
): { system: string; user: string; model: string; temperature: number; maxTokens: number } {
  const tpl = getTemplate(node);
  return {
    system: renderTemplate(tpl.system, tpl.variables, vars),
    user: renderTemplate(tpl.user, tpl.variables, vars),
    model: tpl.model,
    temperature: tpl.temperature,
    maxTokens: tpl.maxTokens,
  };
}
