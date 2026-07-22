import { describe, it, expect } from "vitest";
import {
  getTemplate,
  renderPrompt,
  renderTemplate,
  PromptVariableError,
} from "@/lib/prompts";
import {
  getContentLengthInstruction,
  getContentLengthOption,
} from "@/lib/contentSettings";

describe("prompts · getTemplate", () => {
  it("returns distinct templates per node", () => {
    const nodes = ["outline", "body", "titles", "humanize", "factcheck"] as const;
    const names = nodes.map((n) => getTemplate(n).node);
    expect(new Set(names).size).toBe(nodes.length);
  });

  it("uses qwen-max with low temperature for factcheck (PRD 6.2.5)", () => {
    const t = getTemplate("factcheck");
    expect(t.model).toBe("qwen-max");
    expect(t.temperature).toBe(0.3);
  });

  it("uses higher temperature for titles than outline (PRD 6.2.5)", () => {
    expect(getTemplate("titles").temperature).toBeGreaterThan(
      getTemplate("outline").temperature
    );
  });

  it("factcheck prompt is based on V2 product-card boundaries", () => {
    const out = renderPrompt("factcheck", {
      product: "Fasium AI",
      productDesc: [
        "【产品卡 V2 / 可写事实】",
        "产品定义：Fasium AI 是服装设计 AI 平台。",
        "【产品卡 V2 / 禁写边界】",
        "未提供真实客户资料,不得写客户名称或客户案例。",
        "未提供效果数据,不得写百分比、金额、节省时间或客户数量。",
        "未提供真实流程或截图说明,不得写按钮名称、后台路径或具体点击步骤。",
      ].join("\n"),
      body:
        "某华东服装企业点击生成按钮后,设计效率提升 70%。",
    });

    expect(out.system).toContain("V2 产品卡");
    expect(out.system).toContain("writingBoundaries");
    expect(out.system).toContain("客户");
    expect(out.system).toContain("数字");
    expect(out.system).toContain("按钮路径");
    expect(out.user).toContain("【V2 产品卡事实与边界材料】");
    expect(out.user).toContain("未提供真实客户资料,不得写客户名称或客户案例。");
    expect(out.user).toContain("某华东服装企业点击生成按钮");
  });
});

describe("prompts · renderTemplate", () => {
  it("replaces placeholders with variable values", () => {
    expect(
      renderTemplate("hello {name}!", ["name"], { name: "Tommy" })
    ).toBe("hello Tommy!");
  });

  it("replaces multiple occurrences", () => {
    expect(
      renderTemplate("{a}-{a}-{b}", ["a", "b"], { a: "x", b: "y" })
    ).toBe("x-x-y");
  });

  it("throws PromptVariableError when a declared var is missing", () => {
    expect(() =>
      renderTemplate("{x}{y}", ["x", "y"], { x: "1" })
    ).toThrow(PromptVariableError);
  });

  it("empty string is a valid value (not missing)", () => {
    expect(
      renderTemplate("[{x}]", ["x"], { x: "" })
    ).toBe("[]");
  });

  it("ignores extra keys in vars", () => {
    expect(
      renderTemplate("hi {n}", ["n"], { n: "Bob", extra: "ignored" })
    ).toBe("hi Bob");
  });
});

describe("prompts · renderPrompt", () => {
  it("renders system + user for outline with all variables", () => {
    const out = renderPrompt("outline", {
      product: "Loop RPA",
      productDesc: "浏览器 Agent",
      angle: "产品测评",
      angleInstruction: "实测对比",
      sourcePack: "产品素材: JOTO 智问中枢",
    });
    expect(out.system).toContain("你是一个资深的企业公众号内容编辑");
    expect(out.system).toContain("JOTO 公众号故事稿策划");
    expect(out.user).toContain("Loop RPA");
    expect(out.user).toContain("产品测评");
    expect(out.user).toContain("JOTO 智问中枢");
    expect(out.model).toBe("qwen-plus");
    expect(out.temperature).toBe(0.8);
    expect(out.maxTokens).toBe(1200);
  });

  it("throws when body node is missing required vars", () => {
    expect(() =>
      renderPrompt("body", {
        product: "p",
        productDesc: "d",
        angle: "a",
        angleInstruction: "i",
        // missing styleName, styleProfile, styleSample, outline
      })
    ).toThrow(PromptVariableError);
  });

  it("humanize template inlines intent and text", () => {
    const out = renderPrompt("humanize", {
      intent: "扩写",
      text: "原文段落",
      styleName: "卡兹克",
      styleProfile: "口语锐利",
      articleType: "产品推广",
    });
    expect(out.user).toContain("【重写意图】扩写");
    expect(out.user).toContain("原文段落");
    expect(out.system).toContain("卡兹克");
  });

  it("humanize prompt uses JOTO restrained editing and allows title/key-line rewrites", () => {
    const out = renderPrompt("humanize", {
      intent: "改成人写的公众号稿",
      text: "原文段落",
      styleName: "JOTO 企业官宣体",
      styleProfile: "专业克制",
      articleType: "产品介绍",
    });
    expect(out.system).toContain("JOTO 克制公众号改稿体");
    expect(out.system).toContain("IT、运营、办公室用户");
    expect(out.system).toContain("标题、编号小标题、蓝色金句、列表句");
    expect(out.system).toContain("可以自然口语化");
    expect(out.system).toContain("中文文案排版指北");
    expect(out.system).toContain("中文技术文档写作规范");
    expect(out.system).toContain("不得新增具体场景");
    expect(out.system).not.toContain("不口语化");
  });

  it("humanize injects 产品推广 branch block (business-perspective, grounded facts)", () => {
    const out = renderPrompt("humanize", {
      intent: "x",
      text: "y",
      styleName: "s",
      styleProfile: "p",
      articleType: "产品推广",
    });
    expect(out.system).toContain("【产品推广】专属约束");
    expect(out.system).toContain("业务视角开篇");
    expect(out.system).toContain("不得写成真实企业案例");
    expect(out.system).toContain("轻松口语");
    expect(out.system).toContain("已有事实场景");
    // Old colloquial prescriptions are gone
    expect(out.system).not.toContain("第一人称试用视角");
    expect(out.system).not.toContain("做对一件事让 Y 翻倍");
    expect(out.system).not.toContain("【场景推广】专属约束");
    expect(out.system).not.toContain("【峰会消息】专属约束");
  });

  it("humanize injects 场景推广 branch block (scene-driven, no fake metrics)", () => {
    const out = renderPrompt("humanize", {
      intent: "x",
      text: "y",
      styleName: "s",
      styleProfile: "p",
      articleType: "场景推广",
    });
    expect(out.system).toContain("【场景推广】专属约束");
    expect(out.system).toContain("传统方式 → 新方案");
    expect(out.system).toContain("有事实场景");
    expect(out.system).toContain("不要用虚构量化对比");
    expect(out.system).toContain("可以轻松叙述");
    // Old colloquial prescriptions are gone
    expect(out.system).not.toContain("第一人称视角更重");
    expect(out.system).not.toContain("这个流程可以直接抄");
    expect(out.system).not.toContain("【产品推广】专属约束");
    expect(out.system).not.toContain("【峰会消息】专属约束");
  });

  it("humanize injects 峰会消息 branch block (third-person reportage)", () => {
    const out = renderPrompt("humanize", {
      intent: "x",
      text: "y",
      styleName: "s",
      styleProfile: "p",
      articleType: "峰会消息",
    });
    expect(out.system).toContain("【峰会消息】专属约束");
    expect(out.system).toContain("客观第三人称报道体");
    expect(out.system).toContain("嘉宾名");
    expect(out.system).not.toContain("【产品推广】专属约束");
    expect(out.system).not.toContain("【场景推广】专属约束");
  });

  it("humanize injects 时事热点 branch block without locking to old product/domain", () => {
    const out = renderPrompt("humanize", {
      intent: "x",
      text: "y",
      styleName: "s",
      styleProfile: "p",
      articleType: "时事热点",
    });
    expect(out.system).toContain("【时事热点】专属约束");
    expect(out.system).toContain("产品团队写给用户的观察");
    expect(out.system).toContain("不得删除产品名");
    expect(out.system).toContain("不得删改小标题、引用块、列表");
    expect(out.system).not.toContain("JOTO 产品观点");
    expect(out.system).not.toContain("企业网络运维");
    expect(out.system).not.toContain("第三方测评");
  });

  it("humanize throws when articleType is missing", () => {
    expect(() =>
      renderPrompt("humanize", {
        intent: "x",
        text: "y",
        styleName: "s",
        styleProfile: "p",
        // missing articleType
      })
    ).toThrow(PromptVariableError);
  });

  it("humanize throws when articleType is unrecognized", () => {
    expect(() =>
      renderPrompt("humanize", {
        intent: "x",
        text: "y",
        styleName: "s",
        styleProfile: "p",
        articleType: "随便写写",
      })
    ).toThrow(PromptVariableError);
  });

  it("body system keeps JOTO formatting while removing forced story openings", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "浏览器 Agent",
      angle: "产品推广",
      angleInstruction: "效益数字",
      styleName: "JOTO",
      styleProfile: "专业克制",
      styleSample: "示例段落",
      outline: "## 大纲",
      sourcePack: "产品素材: JOTO 智问中枢",
    });
    expect(out.system).toContain("JOTO 公众号风格硬约束");
    expect(out.system).toContain("有事实场景时");
    expect(out.system).toContain("没有事实场景时");
    expect(out.system).not.toContain("必须使用业务场景故事开头");
    expect(out.system).not.toContain("角色 + 任务 + 卡点");
    expect(out.system).toContain("编号章节");
    expect(out.system).toContain("蓝色强调金句");
    expect(out.system).toContain("产品截图/视频占位");
    expect(out.system).toContain("不要写往期回顾");
    expect(out.system).toContain("公众号后台手动处理");
  });

  it("body system contains light product-story tone requirement", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "浏览器 Agent",
      angle: "产品推广",
      angleInstruction: "效益数字",
      styleName: "JOTO",
      styleProfile: "专业克制",
      styleSample: "示例段落",
      outline: "## 大纲",
      sourcePack: "产品素材: JOTO 智问中枢",
    });
    expect(out.system).toContain("轻松但不轻浮");
    expect(out.system).toContain("IT 部门");
    expect(out.system).toContain("办公室白领");
    expect(out.system).toContain("技术名词只能作为支撑");
  });

  it("body user prompt references grounded product structure and sourcePack", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "浏览器 Agent",
      angle: "产品推广",
      angleInstruction: "效益数字",
      styleName: "JOTO",
      styleProfile: "专业克制",
      styleSample: "示例段落",
      outline: "## 大纲",
      sourcePack: "竞品素材: 传统后台切换成本高",
    });
    expect(out.user).toContain("入口不同,但产品链路必须完整");
    expect(out.user).toContain("产品是什么");
    expect(out.user).toContain("传统做法");
    expect(out.user).toContain("传统后台切换成本高");
    expect(out.user).toContain("不得编造客户、数据、引用或竞品事实");
    expect(out.user).toContain("没有事实场景时");
    expect(out.user).toContain("不得出现在正文");
    expect(out.user).not.toContain("开头钩子");
  });

  it("humanize system always carries shared cliché blacklist", () => {
    for (const articleType of ["产品推广", "场景推广", "峰会消息"] as const) {
      const out = renderPrompt("humanize", {
        intent: "x",
        text: "y",
        styleName: "s",
        styleProfile: "p",
        articleType,
      });
      expect(out.system).toContain("通用硬约束");
      // Cliché blacklist is shared across all branches.
      expect(out.system).toContain("赋能");
      expect(out.system).toContain("毋庸置疑");
    }
  });

  it("humanize system contains expanded AI-tone blacklist from chineseAntiPatterns", () => {
    const out = renderPrompt("humanize", {
      intent: "x",
      text: "y",
      styleName: "s",
      styleProfile: "p",
      articleType: "产品推广",
    });
    // Should contain the pipe-separated blacklist from getPromptBlacklist()
    expect(out.system).toContain("AI 腔黑名单");
    expect(out.system).toContain("值得注意的是");
    expect(out.system).toContain("在当今");
    expect(out.system).toContain("闭环");
    expect(out.system).toContain("底层逻辑");
    expect(out.system).toContain("降本增效");
    expect(out.system).toContain("综上所述");
    expect(out.system).toContain("令人瞩目");
  });

  it("humanize system contains structural anti-pattern constraints", () => {
    const out = renderPrompt("humanize", {
      intent: "x",
      text: "y",
      styleName: "s",
      styleProfile: "p",
      articleType: "场景推广",
    });
    expect(out.system).toContain("结构反模式");
    expect(out.system).toContain("三件套排比");
    expect(out.system).toContain("机械递进");
    expect(out.system).toContain("总结式收尾");
    expect(out.system).toContain("句长均匀");
    expect(out.system).toContain("价值拔高");
  });

  // ─── Fact grounding constraint ────────────────────────────────────
  // Published under JOTO's brand — invented clients and metrics create
  // credibility risk and must be blocked at generation + humanize time.

  it("body system requires concrete paragraphs under every ### subheading", () => {
    // Without this, Qwen tends to compress all content into headings,
    // leaving the article structure-rich but paragraph-poor — and the
    // humanize step has nothing to rewrite.
    const out = renderPrompt("body", {
      product: "p",
      productDesc: "d",
      angle: "a",
      angleInstruction: "i",
      styleName: "s",
      styleProfile: "p",
      styleSample: "x",
      outline: "## o",
      sourcePack: "",
    });
    expect(out.system).toMatch(/正文段落|展开段落|完整段落/);
    // Explicit prohibition against packing content into headings
    expect(out.system).toContain("禁止");
  });

  it("body prompt accepts flexible density instructions without word caps", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "浏览器 Agent",
      angle: "产品推广",
      angleInstruction: "轻松种草",
      styleName: "JOTO",
      styleProfile: "专业克制",
      styleSample: "示例段落",
      outline: "## 大纲",
      sourcePack: "",
      lengthInstruction: getContentLengthInstruction("short"),
    });

    expect(out.system).toContain("本次节奏与密度参考");
    expect(out.system).toContain("水文短稿");
    expect(out.system).not.toContain("800-1000 字");
    expect(out.system).not.toContain("最多不超过");
    expect(out.user).toContain("篇幅要求:水文短稿");
    expect(out.system).not.toContain("字数不少于 1200 字,不超过 2000 字");
  });

  it("short content length is a style/density hint, not a word cap", () => {
    const instruction = getContentLengthInstruction("short");

    expect(getContentLengthOption("short").wordRange).toBe("不设字数上限");
    expect(instruction).not.toContain("800-1000 字");
    expect(instruction).not.toContain("不超过 1000 字");
    expect(instruction).not.toContain("最多 2 个编号章节");
    expect(instruction).toContain("不要用不同说法重复同一个意思");
  });

  it("standard and deep content lengths do not impose numeric word caps", () => {
    const standard = getContentLengthInstruction("standard");
    const deep = getContentLengthInstruction("deep");

    expect(getContentLengthOption("standard").wordRange).toBe("不设字数上限");
    expect(standard).not.toContain("最多不超过 1400 字");
    expect(standard).not.toContain("1100-1400 字");
    expect(standard).toContain("每段只讲一个新信息");

    expect(getContentLengthOption("deep").wordRange).toBe("不设字数上限");
    expect(deep).not.toContain("最多不超过 2000 字");
    expect(deep).not.toContain("1500-1800 字");
    expect(deep).toContain("不要把同一流程/价值换句话写两遍");
  });

  it("body prompt treats style as expression rhythm instead of article structure", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "浏览器 Agent",
      angle: "产品推广",
      angleInstruction: "轻松种草",
      styleName: "JOTO",
      styleProfile: "专业克制",
      styleSample: "示例段落",
      outline: "## 大纲",
      sourcePack: "",
      lengthInstruction: getContentLengthInstruction("short"),
    });

    expect(out.system).not.toContain("水文短稿优先于通用结构");
    expect(out.system).not.toContain("全文 4-6 段");
    expect(out.system).not.toContain("最多 2 个编号章节");
    expect(out.system).not.toContain("每段 60-120 字");
    expect(out.system).not.toContain("每段正文段落 80-180 字");
    expect(out.system).toContain("风格只用于表达节奏");
    expect(out.system).toContain("不得覆盖事实边界");
    expect(out.system).toContain("不得决定文章结构");
    expect(out.system).toContain("不要用不同说法重复同一个意思");
  });

  it("body system forbids invented companies and metrics", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "x",
      angle: "产品推广",
      angleInstruction: "y",
      styleName: "JOTO",
      styleProfile: "z",
      styleSample: "s",
      outline: "## o",
      sourcePack: "",
    });
    expect(out.system).toContain("事实安全硬约束");
    expect(out.system).toContain("不得编造客户名称");
    expect(out.system).toContain("提效百分比");
    expect(out.system).toContain("擅自点名任何企业");
    expect(out.system).toContain("可预期变化");
  });

  it("body prompt forbids fictional personal names while allowing anonymous roles", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "x",
      angle: "场景痛点",
      angleInstruction: "从工作片段切入",
      styleName: "JOTO",
      styleProfile: "z",
      styleSample: "s",
      outline: "## o",
      sourcePack: "",
    });

    expect(out.system).toContain("不得编造具体人名");
    expect(out.system).toContain("陈敏");
    expect(out.system).toContain("Lisa");
    expect(out.system).toContain("匿名角色");
    expect(out.system).not.toContain("具体人物/团队/班次");
    expect(out.user).toContain("不要写具体人名");
  });

  it("body prompt forbids unconfirmed product operation steps", () => {
    const out = renderPrompt("body", {
      product: "Loop RPA",
      productDesc: "浏览器 Agent",
      angle: "产品推广",
      angleInstruction: "轻松种草",
      styleName: "JOTO",
      styleProfile: "专业克制",
      styleSample: "示例段落",
      outline: "## 大纲",
      sourcePack: "未提供真实操作流程。",
    });

    expect(out.system).toContain("产品使用流程只能写素材里明确确认过的步骤");
    expect(out.system).toContain("不要写按钮名、后台路径、点击顺序或部署步骤");
    expect(out.system).toContain("登录/注册");
    expect(out.system).toContain("Demo 环境");
    expect(out.system).toContain("页面跳转");
    expect(out.system).toContain("可通过 Web 端注册/登录后使用");
    expect(out.user).toContain("不要编具体操作、按钮名、登录状态、Demo 环境或页面跳转");
    expect(out.system).toContain("不得出现裸 Markdown 标记");
  });

  it("body prompt keeps internal planning labels out of visible article copy", () => {
    const out = renderPrompt("body", {
      product: "Fasium AI",
      productDesc: "Web 端注册登录后可用的服装设计产品",
      angle: "产品推广",
      angleInstruction: "讲清楚为什么服装团队需要它",
      styleName: "JOTO",
      styleProfile: "专业克制",
      styleSample: "示例段落",
      outline: "## 01 开场\n\n## 02 解决什么",
      sourcePack: "事实卡: Fasium AI 支持 Web 端注册登录后使用。",
    });

    expect(out.system).toContain("标题里不得出现");
    expect(out.system).toContain("钩子");
    expect(out.user).toContain("内部策划词");
    expect(out.user).toContain("不得出现在正文");
    expect(out.user).not.toContain("全文必须按「开头钩子");
  });

  it("body prompt prevents product-chain checklist items from becoming awkward headings", () => {
    const out = renderPrompt("body", {
      product: "Fasium AI",
      productDesc: "面向服装设计团队的 AI 设计平台",
      angle: "产品能力/适用人群入口",
      angleInstruction: "讲清楚产品能力和适用团队",
      styleName: "JOTO",
      styleProfile: "专业克制",
      styleSample: "示例段落",
      outline: "## 产品是什么\n\n### 给服装品牌和设计团队用的",
      sourcePack: "产品素材: Fasium AI 用于服装趋势观察和设计生成。",
    });

    expect(out.system).toContain("产品链路是覆盖检查清单,不是正文标题");
    expect(out.system).toContain("小标题必须是完整、自然、可独立阅读的短句");
    expect(out.system).toContain("标题不得照抄「产品是什么」「给谁用」「痛点」「传统做法」「产品介入」「使用后的变化」「不能写什么」");
    expect(out.system).toContain("不要写成「给某某用的」这类残句");
  });

  it("humanize system preserves fact grounding across all branches", () => {
    for (const articleType of ["产品推广", "场景推广", "峰会消息"] as const) {
      const out = renderPrompt("humanize", {
        intent: "x",
        text: "y",
        styleName: "s",
        styleProfile: "p",
        articleType,
      });
      expect(out.system).toContain("事实安全硬约束");
      expect(out.system).toContain("不得编造客户名称");
      expect(out.system).toContain("数字只能保留或改写原文已有数字");
    }
  });
});
