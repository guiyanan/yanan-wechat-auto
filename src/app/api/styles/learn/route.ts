import { NextRequest, NextResponse } from "next/server";
import type { LearnedWritingStyle, LearnedWritingStyleScope } from "@/types";
import { completeChat, QwenAuthError } from "@/lib/qwen";
import { getDeepSeekChatOptions } from "@/lib/deepseek";
import { buildHotspotContractPrompt } from "@/lib/trendArticleContract";
import { sanitizeTrendStylePromptProfile } from "@/lib/learnedStyles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LearnStyleRequest {
  urls?: string[];
  pastedText?: string;
  htmlDocuments?: HtmlStyleDocument[];
  scope?: LearnedWritingStyleScope;
}

interface HtmlStyleDocument {
  name?: string;
  html?: string;
}

interface ParsedHtmlStyleDocument {
  source: string;
  text: string;
}

const MIN_REUSABLE_PROMPT_PROFILE_LENGTH = 1000;

function genId(): string {
  return `style-learned-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHtmlFileName(name: unknown, index: number): string {
  const safeName =
    typeof name === "string"
      ? name.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_").slice(0, 80)
      : "";
  return safeName || `uploaded-${index + 1}.html`;
}

function parseHtmlDocuments(input: unknown): ParsedHtmlStyleDocument[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 5)
    .map((doc, index) => {
      if (!doc || typeof doc !== "object") return null;
      const item = doc as HtmlStyleDocument;
      const html = typeof item.html === "string" ? item.html : "";
      const text = stripHtml(html);
      if (!text) return null;
      return {
        source: `html:${normalizeHtmlFileName(item.name, index)}`,
        text: text.slice(0, 3000),
      };
    })
    .filter((doc): doc is ParsedHtmlStyleDocument => Boolean(doc));
}

async function fetchUrlText(url: string, signal: AbortSignal): Promise<string> {
  const parsed = new URL(url);
  if (parsed.hostname.includes("mp.weixin.qq.com")) {
    throw new Error("微信公众号链接通常无法稳定抓取,请粘贴正文兜底。");
  }
  const res = await fetch(url, {
    signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; JOTOContentFactory/1.0; +https://joto.ai)",
    },
  });
  if (!res.ok) throw new Error(`抓取失败: HTTP ${res.status}`);
  const html = await res.text();
  const text = stripHtml(html);
  if (text.length < 300) {
    throw new Error("链接正文过短,请粘贴文章正文兜底。");
  }
  return text.slice(0, 12000);
}

function normalizeScope(scope: unknown): LearnedWritingStyleScope {
  return scope === "trend" ? "trend" : "product";
}

function sanitizePromptProfileHint(
  text: string,
  scope: LearnedWritingStyleScope
): string {
  const scopedText =
    scope === "trend" ? sanitizeTrendStylePromptProfile(text) : text;
  return scopedText
    .replace(/硬约束/g, "表达规则")
    .replace(/推进顺序/g, "表达承接")
    .replace(/产品出现位置/g, "产品相关表达")
    .replace(/【产品介入】/g, "【产品相关表达】")
    .replace(/产品介入/g, "产品相关表达");
}

function buildFallbackPromptProfile(
  scope: LearnedWritingStyleScope,
  style: Pick<
    LearnedWritingStyle,
    | "toneProfile"
    | "titlePattern"
    | "openingPattern"
    | "paragraphPattern"
    | "keySentencePattern"
  >,
  sourceSummary?: string
): string {
  const sourceSummaryLine = sourceSummary
    ? `【学习摘要】模型给出的短版提示是:${sanitizePromptProfileHint(sourceSummary, scope)}。下面规则优先级更高,生成时按分项规则校准表达。`
    : "";
  if (scope === "trend") {
    const toneProfile = sanitizeTrendStylePromptProfile(style.toneProfile);
    const titlePattern = sanitizeTrendStylePromptProfile(style.titlePattern);
    const openingPattern = sanitizeTrendStylePromptProfile(style.openingPattern);
    const paragraphPattern = sanitizeTrendStylePromptProfile(style.paragraphPattern);
    const keySentencePattern = sanitizeTrendStylePromptProfile(style.keySentencePattern);
    return [
      "风格提示词:这套风格只作为表达节奏参考,用于校准标题语气、开头口吻、段落密度、句式长短和收束习惯。风格只能影响表达方式,不能改变文章身份、不能改变任务骨架、不能改变产品回应策略。不得决定事实、选题入口或文章结构,不得复用范文事实。写作时先服从本次素材、事实边界和热点文章契约,再用这套风格把表达改得更清楚、更克制、更像公众号编辑在解释问题。",
      buildHotspotContractPrompt(),
      sourceSummaryLine,
      `【标题结构】${titlePattern}。标题先抓读者会停下来的具体矛盾、反常识问题或最近被讨论的使用困惑,用一个清楚场景承载主题。标题不要把产品名写成主角,不要写成行业报告标题,不要用“重磅、颠覆、赋能、解决方案”这类宣传词。标题要让读者知道:这篇文章会帮他看懂一个现象、避开一个误区,或重新理解一个选择。`,
      `【开头方式】${openingPattern}。第一段先落到正在被讨论的热点现象、普通人的使用困惑或工作场景,用清楚但不过分口语化的方式进入;可以先写一个公开可见的现象,再写它为什么让人犹豫、困惑或误判。不要一上来解释概念、介绍产品、罗列背景。开头的任务是把读者带进问题现场,让他觉得“这事我也见过”。`,
      "【问题表达】把外部现象翻译成读者能感知的问题、动作或选择,不要从热点直接跳到产品卖点。中段可以用对照写法:热闹说法 vs 真实麻烦、表面需求 vs 实际决策、大家以为的答案 vs 真正影响体验的细节。",
      `【段落节奏】${paragraphPattern}。每段只推进一个观察、转折或判断;段落之间要有因果和转向。短段优先,但不能碎成口号。可以使用小标题、重点句和少量列表,但它们必须推进观察,不能变成功能清单。每段结尾尽量留下一个自然的下一步,比如“问题不在这里”“真正麻烦的是后面那一步”“所以这件事不能只看表面热度”。`,
      `【句式和语气】${toneProfile}。句子保持短而清楚,像编辑在帮读者把事情说顺;允许轻判断,但不要夸张、网感口号、情绪煽动或硬广 CTA。多用具体动词和普通名词,少用抽象名词堆叠。可以有一点观察感,但语气要像解释,不是站队。`,
      "【转场方式】从热点现象转到用户困惑,再转到真实工作问题;进入产品团队视角时,先说明我们为什么关注这个问题,再写产品在哪些环节承接它。转场必须服务于完整公众号观察文,不能把产品写成突兀广告,也不能回避产品团队的回应。",
      `【收束方式】${keySentencePattern}。结尾回到用户判断和选择标准,不要突然升华成宏大判断。产品相关表达可以在中后段自然进入,但必须回应前文提出的动作、判断或麻烦,不要变成产品介绍。收束句要像读者读完后能带走的一句话,不是广告标语。`,
      "【反例提醒】不要写成“热点很火,所以我们产品很重要”;不要用一整段解释行业趋势;不要把外部事实编造成确定新闻;不要把来源文章中的案例、数字、客户或原句带进新文章;不要把产品功能清单伪装成观点。",
      "【硬性边界】只学习标题、开头、段落、语气和收尾方式;不要学习范文里的事实,不得学习或复用范文里的数据、客户、案例、观点结论、具体说法和表达片段。生成时如果缺少事实材料,就写场景和判断,不要补新闻细节。",
      "【生成时自检】写完后逐项检查:身份是否仍是产品团队写给用户的完整公众号观察文;结构是否覆盖热点现象、用户困惑、真实工作问题、产品团队视角、我们的回应和收束判断;每段是否只有一个重点;段落之间是否有自然推进;有没有把来源文章事实带进来;有没有出现硬广语气;产品回应是否服务于用户问题;标题是否能独立吸引点击而不靠产品名。",
    ].filter(Boolean).join("\n");
  }
  return [
    "风格提示词:这套风格只作为表达节奏参考,用于校准标题语气、开头口吻、段落密度、句式长短和收束习惯。不得决定事实、选题入口或文章结构,不得复用范文事实。写作时先服从本次产品素材、事实边界和既定文章入口,再用这套风格把表达改得更清楚、更克制、更像公众号编辑在解释问题。",
    sourceSummaryLine,
    `【标题结构】${style.titlePattern}。标题必须承载一个具体工作场景、读者问题或清晰观点,避免只写产品能力、行业大词、空泛效率口号。好的标题应该让读者先看到自己的麻烦,再隐约知道文章会给出一种判断或选择理由。标题不要写成“某产品如何提升效率”,而要写成“某个工作环节为什么总卡住”“某类选择为什么看起来省事但后面更累”这种有问题感的句子。`,
    `【开头方式】${style.openingPattern}。第一段用自然口语把读者带进问题,但具体场景必须来自本次素材;素材没有事实场景时,只写匿名角色和通用工作状态。不要开头就堆产品概念,也不要新增人物、客户、时间地点或真实案例。`,
    "【问题表达】把麻烦拆成读者能感知的动作、判断成本或协作阻力。可以用“表面上是……其实是……”“真正耗时间的不是……而是……”“让人犹豫的地方在于……”这样的表达方式。这里的任务是让文字顺,不是替文章增加事实或改写选题。",
    `【段落节奏】${style.paragraphPattern}。每段围绕一个动作、判断或变化展开;段落长度保持中等,每段只承载一个意思。段首负责承接上一段,段尾负责把读者带到下一段。不要一段里同时解释背景、功能、价值和结论,那会让文章变成方案说明书。`,
    `【句式和语气】${style.toneProfile}。表达要克制、清楚、像公众号编辑在解释一件具体事;少用宏大判断,多用短句、具体名词和读者能感知的变化。避免“全面赋能、深度融合、打造闭环、重塑生态”等泛化词。可以写判断,但判断要来自场景,比如“真正浪费时间的,不是填表,而是每个人都不知道下一步该找谁”。`,
    "【转场方式】观点不要悬空出现,要从前面的表达自然转出来。可以先承认读者眼前的问题,再指出旧办法为什么只能缓解一部分,最后回到本次文章大纲要求的判断。写法上可以用短句做停顿,让文章有节奏。",
    `【总结句】${style.keySentencePattern}。阶段性总结用短句,强调为什么要改变、改变后少了什么麻烦、选择理由是什么;不要写成广告口号。总结句应该有判断感,但不要喊口号。可以写“流程顺了,人就不用一直补位”“真正的效率,往往来自少一次反复确认”这类句子。`,
    "【反例提醒】不要写成官网功能介绍;不要用连续列表堆卖点;不要每段都出现产品名;不要把读者问题写得太虚;不要编造客户、数据、百分比、部署效果或来源文章里的案例;不要照搬范文中的事实、行业结论或原句表达。",
    "【硬性边界】只模仿表达方式、段落节奏、标题结构和总结方式;不得照抄来源文章内容,不得复用来源文章里的事实、客户、数据、案例、观点结论或原句片段。没有明确材料时,宁可写普通工作场景和可验证的动作变化,也不要补充看似专业但无来源的事实。",
    "【生成时自检】写完后逐项检查:风格是否只影响表达节奏;有没有新增事实、人物、客户或数据;标题是否不是功能名;每段是否只有一个重点;有没有连续术语;有没有把来源文章事实带入新文章;结尾是否像判断而不是广告。",
  ].filter(Boolean).join("\n");
}

function isReusablePromptProfile(promptProfile: string | undefined): boolean {
  const text = promptProfile?.trim() ?? "";
  if (text.length < MIN_REUSABLE_PROMPT_PROFILE_LENGTH) return false;
  return ["【标题结构】", "【开头方式】", "【段落节奏】", "【硬性边界】"].every(
    (marker) => text.includes(marker)
  );
}

function normalizePromptProfile(
  promptProfile: string | undefined,
  scope: LearnedWritingStyleScope,
  styleFields: Pick<
    LearnedWritingStyle,
    | "toneProfile"
    | "titlePattern"
    | "openingPattern"
    | "paragraphPattern"
    | "keySentencePattern"
  >
): string {
  const trimmed = promptProfile?.trim();
  if (scope === "trend") {
    return buildFallbackPromptProfile(scope, styleFields, trimmed);
  }
  if (trimmed && isReusablePromptProfile(trimmed)) return trimmed;
  return buildFallbackPromptProfile(scope, styleFields, trimmed);
}

function fallbackStyle(
  text: string,
  urls: string[],
  scope: LearnedWritingStyleScope
): LearnedWritingStyle {
  const compact = text.replace(/\s+/g, " ").trim();
  if (scope === "trend") {
    const style = {
      id: genId(),
      scope,
      name: "热点观察体",
      sourceUrls: urls,
      toneProfile:
        "基于热点范文提炼:语气克制清楚,先抓一个正在被讨论的问题,再把它解释成用户能理解的判断。",
      titlePattern: "标题偏疑问式或反常识式,用热点里的一个具体矛盾吸引读者点开。",
      openingPattern:
        "开头先用一句轻切入点出热点现象,接着把问题落到普通工作场景里。",
      paragraphPattern:
        "段落短一些,一段只讲一个观察或转折,适合快速滑读,不堆术语。",
      keySentencePattern:
        "收束句回到用户判断和产品团队回应,不写硬广 CTA。",
      sampleDigest: compact.slice(0, 220),
      createdAt: new Date().toISOString(),
    };
    return {
      ...style,
      promptProfile: buildFallbackPromptProfile(scope, style),
    };
  }
  const style = {
    id: genId(),
    scope,
    name: "学习风格",
    sourceUrls: urls,
    toneProfile: "基于范文提炼:表达克制,段落清晰,先写场景和问题,再进入观点和产品价值。",
    titlePattern: "标题偏向问题式或观点式,用一个明确场景承载主题。",
    openingPattern: "开头先写一个具体工作场景或读者正在面对的矛盾,不直接堆产品概念。",
    paragraphPattern: "段落中等长度,每段围绕一个动作或判断展开,避免连续术语。",
    keySentencePattern: "用短句做阶段性总结,强调业务改变和选择理由。",
    sampleDigest: compact.slice(0, 220),
    createdAt: new Date().toISOString(),
  };
  return {
    ...style,
    promptProfile: buildFallbackPromptProfile(scope, style),
  };
}

function parseStyle(
  raw: string,
  text: string,
  urls: string[],
  scope: LearnedWritingStyleScope
): LearnedWritingStyle {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallbackStyle(text, urls, scope);
  try {
    const row = JSON.parse(match[0]) as Partial<LearnedWritingStyle>;
    const fallback = fallbackStyle(text, urls, scope);
    const styleFields = {
      toneProfile: row.toneProfile?.trim() || fallback.toneProfile,
      titlePattern: row.titlePattern?.trim() || fallback.titlePattern,
      openingPattern: row.openingPattern?.trim() || fallback.openingPattern,
      paragraphPattern:
        row.paragraphPattern?.trim() || fallback.paragraphPattern,
      keySentencePattern:
        row.keySentencePattern?.trim() || fallback.keySentencePattern,
    };
    return {
      id: genId(),
      scope,
      name:
        row.name?.trim() ||
        (scope === "trend" ? "热点轻评论体" : "学习风格"),
      sourceUrls: urls,
      ...styleFields,
      promptProfile: normalizePromptProfile(
        row.promptProfile,
        scope,
        styleFields
      ),
      sampleDigest: row.sampleDigest?.trim() || text.replace(/\s+/g, " ").slice(0, 220),
      createdAt: new Date().toISOString(),
    };
  } catch {
    return fallbackStyle(text, urls, scope);
  }
}

export async function POST(req: NextRequest) {
  let body: LearnStyleRequest;
  try {
    body = (await req.json()) as LearnStyleRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const urls = (body.urls ?? [])
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 2);
  const htmlDocuments = parseHtmlDocuments(body.htmlDocuments);
  const pastedText = body.pastedText?.trim() ?? "";
  const scope = normalizeScope(body.scope);
  const chunks: string[] = [];
  const sourceRefs: string[] = [...urls];
  const failures: string[] = [];

  for (const url of urls) {
    try {
      chunks.push(await fetchUrlText(url, req.signal));
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
    }
  }
  for (const doc of htmlDocuments) {
    chunks.push(`【${doc.source}】\n${doc.text}`);
    sourceRefs.push(doc.source);
  }
  if (pastedText) chunks.push(pastedText);

  const text = chunks.join("\n\n---\n\n").trim();
  if (text.length < 300) {
    return NextResponse.json(
      {
        ok: false,
        needsPaste: true,
        error:
          failures[0] ??
          "范文正文不足 300 字,请粘贴 1-2 篇文章正文后再学习。",
      },
      { status: 422 }
    );
  }

  try {
    const raw = await completeChat({
      ...getDeepSeekChatOptions(),
      temperature: 0.5,
      maxTokens: 4200,
      messages: [
        {
          role: "system",
          content: [
            "你是公众号写作风格分析师。",
            "任务:从用户提供的范文中提炼可复用写作风格,不是提炼文章角度,也不能照抄原文。",
            "风格只管表达节奏、标题语气、句式密度、段落长短和收束习惯;不得决定事实、选题入口或文章结构。",
            scope === "trend"
              ? "本次只学习热点稿写法:标题方式、开头切入、语气、段落节奏和结尾方式。不要学习或复用范文里的事实、案例、数据、观点结论。"
              : "本次学习产品文章写法:表达方式、段落节奏、标题结构和阶段性总结方式。",
            "必须额外生成 promptProfile:这是一段后续可直接放进生成模型的固定风格提示词,它要像规则手册,不是风格摘要。",
            "如果用户提供多篇范文,先找共同写法,只沉淀共同稳定模式;不得把单篇事实、案例、客户、数据写进规则。",
            "输出严格 JSON 对象,不要解释文字。",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "请提炼以下范文的写作风格,字段:",
            "- name: 8 字以内中文风格名",
            "- toneProfile: 语气特征",
            "- titlePattern: 标题结构",
            "- openingPattern: 开头方式",
            "- paragraphPattern: 段落节奏",
            "- keySentencePattern: 金句/总结句方式",
            "- promptProfile: 2000 字以内中文固定风格提示词,建议 1200-1800 字,写给后续生成模型使用;必须拆成【标题结构】【开头方式】【问题表达】【段落节奏】【句式和语气】【转场方式】【总结句/收束方式】【反例提醒】【硬性边界】【生成时自检】这些小节;每个维度必须写成可执行规则,不能只写“表达克制、段落清晰”这类概括词;风格只用于表达节奏,不得决定事实、选题入口或文章结构;必须只描述标题、开头、语气、段落、收尾等写法,不得照抄来源文章内容,不得学习来源文章里的事实、数据、客户、案例或观点结论",
            "- sampleDigest: 120 字以内范文摘要",
            "",
            "【范文】",
            text.slice(0, 12000),
          ].join("\n"),
        },
      ],
      signal: req.signal,
    });
    return NextResponse.json({
      ok: true,
      style: parseStyle(raw, text, sourceRefs, scope),
      source: "deepseek",
      warnings: failures,
    });
  } catch (err) {
    const style = fallbackStyle(text, sourceRefs, scope);
    const reason =
      err instanceof QwenAuthError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return NextResponse.json({
      ok: true,
      style,
      source: "fallback",
      warnings: [...failures, reason],
    });
  }
}
