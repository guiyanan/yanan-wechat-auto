import { cleanGeneratedMarkdown, cleanGeneratedTitle } from "@/lib/generatedMarkdown";

export interface TrendPostProcessContext {
  product?: string;
  productDesc?: string;
}

const COMMON_CHINESE_SURNAMES =
  "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣邓郁单杭洪包诸左石崔吉龚程邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公";

const KNOWN_ANCHOR_GROUPS = [
  {
    mentions: /Notebook\s*LM|NotebookLM|Evernote|AI\s*笔记|AI笔记|笔记本软件/i,
    context:
      /Notebook\s*LM|NotebookLM|AI\s*笔记|AI笔记|知识库|PDF\s*总结|文档|资料|问答|会议记录|记事/i,
  },
  {
    mentions: /Dify|Agent|Workflow|工作流|智能体|低代码|AI\s*客服|AI客服/i,
    context:
      /Dify|Agent|Workflow|工作流|智能体|低代码|AI\s*应用|AI应用|客服|机器人|知识库|自动化/i,
  },
  {
    mentions: /Canva|Midjourney|Stable\s*Diffusion|AI\s*作图|AI作图|AI\s*设计|AI设计/i,
    context:
      /Canva|Midjourney|Stable\s*Diffusion|AI\s*作图|AI作图|AI\s*设计|AI设计|AI\s*fashion|fashion\s*design|design|图片|设计|海报|服装|时尚|穿搭|版型|面料|花型/i,
  },
];

function contextText(ctx?: TrendPostProcessContext): string {
  return [ctx?.product, ctx?.productDesc].filter(Boolean).join(" ");
}

function replaceHardTerms(text: string): string {
  const next = text
    .replace(/Tech\s*Pack/gi, "版单")
    .replace(/Prompt/gi, "提示词")
    .replace(/Pantone/gi, "色号")
    .replace(/GB\/T/gi, "国标")
    .replace(/QC/g, "质检")
    .replace(/[：:]/g, "，")
    .replace(/[—–-]{2,}/g, "，")
    .replace(/又双叒叕/g, "又");

  return next.replace(/\s{2,}/g, " ").trim();
}

function hasFictionalPerson(text: string): boolean {
  const personPattern = new RegExp(
    `(?:^|[，。\\s])(?:小[${COMMON_CHINESE_SURNAMES}]|[${COMMON_CHINESE_SURNAMES}][\\u4e00-\\u9fa5]{1,2})(?:凌晨|早上|晚上|拿着|盯着|看着|打开|收到|发来|问|说|改到|在群里|用手机|刚上班)`
  );
  return personPattern.test(text);
}

function isKnownAnchorUnrelated(
  text: string,
  ctx?: TrendPostProcessContext
): boolean {
  const context = contextText(ctx);
  if (!context.trim()) return false;
  if (/PHP|代码|模板下载|编程/i.test(text)) return true;
  return KNOWN_ANCHOR_GROUPS.some(
    (group) => group.mentions.test(text) && !group.context.test(context)
  );
}

function isJargonDense(text: string): boolean {
  const denseTokens =
    text.match(
      /版单|色号|国标|质检|CAD|PDF|Excel|cm|g\/m|克重|缝份|裁床|工艺单|排期|复盘|PPT|参数|型号|V\d|第\d+版|第\d+份|编号|打样|染缸|面料表/g
    ) ?? [];
  const preciseTokens =
    text.match(
      /\d+(?:\.\d+)?\s*(?:cm|g\/m²?|g\/m|秒|小时|万件|%|份|版)|\d{2}-\d{4}[A-Z]+|±|第\d+版/g
    ) ?? [];

  return denseTokens.length >= 4 || preciseTokens.length >= 2;
}

function splitSentences(text: string): string[] {
  const matches = text.match(/[^。！？!?]+[。！？!?]?/g) ?? [];
  return matches
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function splitAtPause(text: string): string[] | null {
  if (text.length < 36) return null;
  const marks = ["。", "？", "！", "，", ",", "；", ";"];
  for (const mark of marks) {
    const positions = Array.from(text.matchAll(new RegExp(mark, "g")))
      .map((match) => match.index ?? -1)
      .filter((index) => index > 10 && text.length - index > 12);
    if (positions.length === 0) continue;
    const midpoint = text.length / 2;
    const cut = positions.sort(
      (a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint)
    )[0];
    return [text.slice(0, cut + 1).trim(), text.slice(cut + 1).trim()].filter(
      Boolean
    );
  }
  return null;
}

function splitSingleParagraph(paragraph: string): string[] {
  const sentences = splitSentences(paragraph);
  if (sentences.length < 4) return [paragraph];
  const target = Math.min(7, Math.max(4, Math.ceil(sentences.length / 2)));
  const result: string[] = [];
  for (let index = 0; index < target; index += 1) {
    const start = Math.round((index * sentences.length) / target);
    const end = Math.round(((index + 1) * sentences.length) / target);
    const chunk = sentences.slice(start, end).join("");
    if (chunk.length >= 8) result.push(chunk);
  }
  return result.length >= 4 ? result : [paragraph];
}

function normalizeArticleParagraphs(paragraphs: string[]): string[] {
  if (paragraphs.length >= 4) return paragraphs;

  if (paragraphs.length === 1) {
    return splitSingleParagraph(paragraphs[0]).slice(0, 7);
  }

  const result = [...paragraphs];
  while (result.length < 4) {
    let splitIndex = -1;
    let splitParts: string[] | null = null;
    for (let index = 0; index < result.length; index += 1) {
      const parts = splitAtPause(result[index]);
      if (!parts || parts.length < 2) continue;
      if (splitIndex === -1 || result[index].length > result[splitIndex].length) {
        splitIndex = index;
        splitParts = parts;
      }
    }
    if (splitIndex === -1 || !splitParts) break;
    result.splice(splitIndex, 1, ...splitParts);
  }

  return result;
}

function normalizeMarkdownBlock(block: string): string {
  return block
    .split(/\n+/)
    .map((line) => replaceHardTerms(line))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function plainFallback(ctx?: TrendPostProcessContext): string {
  const product = ctx?.product?.trim();
  return [
    "最近很多人都在聊 AI 工具,但普通人最关心的其实不是名字有多新。",
    "大家点进去,只是想看看它能不能少一点反复修改,少一点来回确认,少一点无效加班。",
    "所以热点不用讲得太玄。把一个真实的小麻烦说清楚,读者才愿意继续看。",
    product
      ? `如果你也在找类似方向,最后再顺手看一眼 ${product} 就够了。`
      : "如果你也在找类似方向,最后再顺手看一眼这个产品就够了。",
  ].join("\n\n");
}

export function postProcessTrendBody(
  text: string,
  ctx?: TrendPostProcessContext
): string {
  const cleaned = cleanGeneratedMarkdown(text)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|internal:\/\/)[^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/internal:\/\/\S+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const rawParagraphs = cleaned
    .split(/\n{2,}/)
    .map(normalizeMarkdownBlock)
    .filter(Boolean)
    .filter((paragraph) => !hasFictionalPerson(paragraph))
    .filter((paragraph) => !isKnownAnchorUnrelated(paragraph, ctx))
    .filter((paragraph) => !isJargonDense(paragraph));

  const paragraphs = normalizeArticleParagraphs(rawParagraphs);
  const result = paragraphs.join("\n\n").trim();
  return result.length >= 45 ? result : plainFallback(ctx);
}

export function postProcessTrendTitle(
  title: string,
  ctx?: TrendPostProcessContext
): string {
  const product = ctx?.product?.trim();
  const cleaned = replaceHardTerms(cleanGeneratedTitle(title))
    .replace(product ? new RegExp(product.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g") : /$^/, "")
    .replace(/[！？!?.。]+$/g, "")
    .trim();

  return cleaned.slice(0, 28);
}
