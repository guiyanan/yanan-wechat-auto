import { NextRequest } from "next/server";
import productsData from "@/data/products.json";
import anglesData from "@/data/angles.json";
import stylesData from "@/data/styles.json";
import type {
  Angle,
  AngleStrategy,
  ArticleSourceContext,
  ContentLength,
  PipelineStageId,
  Product,
  WritingStyle,
  TopicPlan,
  TrendSearchResult,
} from "@/types";
import {
  completeChat,
  factcheck,
  generateTitles,
  parseTitles,
  streamChat,
  humanize,
  QwenAuthError,
} from "@/lib/qwen";
import { renderPrompt } from "@/lib/prompts";
import { getDeepSeekChatOptions } from "@/lib/deepseek";
import { generateCoverCandidates } from "@/lib/mockCovers";
import { inferArticleType } from "@/lib/articleType";
import {
  getAngleStrategyInstruction,
  getContentLengthInstruction,
} from "@/lib/contentSettings";
import {
  runHumanizePipeline,
  runStructurePreservingPipeline,
  buildQwenHumanizeFn,
} from "@/lib/humanize/pipeline";
import { productSourceToArticleContext } from "@/lib/productCatalog";
import {
  cleanGeneratedTitle,
  postProcessGeneratedMarkdown,
  resolveGeneratedArticleTitle,
} from "@/lib/generatedMarkdown";
import {
  buildFallbackTrendTitles,
  buildTrendTitlePrompt,
  buildTrendPrompt,
  fallbackTrendBody,
  type TrendPromptVars,
} from "@/lib/trendGenerationPrompt";
import { filterRelevantTrendResults } from "@/lib/trends/hooks";
import {
  parseUnsplashImageConfig,
  searchUnsplashCoverCandidates,
} from "@/lib/trends/unsplash";
import {
  postProcessTrendBody,
  postProcessTrendTitle,
} from "@/lib/trendPostProcess";
import {
  getTrendHumanizeIntent,
  getTrendHumanizeStyleProfile,
} from "@/lib/trendHumanize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTS = productsData as Product[];
const ANGLES = anglesData as Angle[];
const STYLES = stylesData as WritingStyle[];

interface GenerateRequest {
  productId: string;
  productSnapshot?: Product;
  angleId?: string;
  customAngle?: string;
  styleId?: string;
  topicPlan?: TopicPlan;
  styleOverride?: Pick<WritingStyle, "id" | "name" | "promptProfile" | "sampleText">;
  articleId?: string;
  sourcePack?: ArticleSourceContext;
  contentLength?: ContentLength;
  angleStrategy?: AngleStrategy;
  mode?: "manual" | "auto-five" | "trend-radar" | "paste-format";
  trendResults?: TrendSearchResult[];
  trendStyleName?: string;
  trendStyleSource?: "learned" | "fallback";
  /**
   * When true, run the humanize pipeline (L1+L2+L3) on the body
   * between the body and titles stages.
   * Default: false (keeps existing behaviour unchanged).
   */
  autoHumanize?: boolean;
}

function compactLines(items: Array<string | undefined>): string {
  return items
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .join("\n");
}

function formatSourcePack(sourcePack?: ArticleSourceContext, product?: Product): string {
  const materialPack =
    (product ? productSourceToArticleContext(product).productNotes : "") ||
    sourcePack?.productNotes?.trim();
  // 空素材时不是一句"不得编造"带过,而是给出明确的替代写法 —— 实测
  // (Desktop 份 compare 对照)只有这样才能把编造数字/虚构客户压到 0:
  // 模板正例里的「企业名+数字」格式权重很高,必须在素材位置明说怎么办。
  return materialPack
    ? materialPack
    : [
        "未提供补充素材。注意:",
        "- 本篇文章中不得出现任何具体客户名称、客户案例和具体数字(百分比、金额、工时、客户数、点赞数等)",
        "- 也不得出现「某华东快消企业」「某制造团队」这类虚构客户指代;不要讲客户故事,直接讲产品机制与使用场景",
        "- 所有效益一律用定性表述(「显著缩短」「大幅减少人工」),把笔墨放在机制、场景和使用路径上",
      ].join("\n");
}

function buildFactcheckGroundTruth({
  product,
  sourcePackText,
}: {
  product: Product;
  sourcePackText: string;
}): string {
  return compactLines([
    product.description,
    sourcePackText,
  ]);
}

function formatTrendSources(trends?: TrendSearchResult[]): string {
  if (!trends?.length) {
    return "未抓取到可用热点。可以围绕近期行业讨论做轻评论,但不得编造具体新闻、数据或来源。";
  }
  return trends
    .slice(0, 8)
    .map((trend, index) => {
      const source = [trend.source, trend.publishedAt].filter(Boolean).join(" · ");
      return [
        `${index + 1}. ${trend.title}`,
        trend.snippet ? `摘要:${trend.snippet}` : "",
        source ? `来源信息:${source}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

type StageEvent =
  | {
      type: "stage";
      stage: PipelineStageId;
      status: "running" | "done" | "failed";
      elapsedMs?: number;
      error?: string;
      data?: unknown;
    }
  | { type: "body-delta"; delta: string }
  | { type: "result"; result: GenerationResult }
  | { type: "error"; error: { name: string; message: string } };

interface GenerationResult {
  outline: string;
  body: string;
  titles: string[];
  covers: Array<{ url: string; styleLabel: string }>;
  factcheck: { passed: boolean; warning: string | null };
}

function encodeEvent(encoder: TextEncoder, event: StageEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function encodeDone(encoder: TextEncoder): Uint8Array {
  return encoder.encode(`data: [DONE]\n\n`);
}

export async function POST(req: NextRequest) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const product =
    body.productSnapshot?.id === body.productId
      ? body.productSnapshot
      : PRODUCTS.find((p) => p.id === body.productId);
  if (!product) {
    return new Response(`product not found: ${body.productId}`, { status: 400 });
  }
  const style = body.styleOverride
    ? {
        id: body.styleOverride.id,
        name: body.styleOverride.name,
        promptProfile: body.styleOverride.promptProfile,
        sampleText: body.styleOverride.sampleText,
      }
    : STYLES.find((s) => s.id === body.styleId);
  if (!style) {
    return new Response(`style not found: ${body.styleId}`, { status: 400 });
  }
  const angleById = ANGLES.find((a) => a.id === body.angleId);
  const isTrendMode = body.mode === "trend-radar";
  const angleName =
    body.topicPlan?.trafficHookLabel ??
    body.topicPlan?.angleLabel ??
    angleById?.name ??
    "自定义角度";
  const angleInstruction =
    [
      body.topicPlan?.promptInstruction ??
        angleById?.promptInstruction ??
        body.customAngle?.trim() ??
        "",
      isTrendMode ? "" : getAngleStrategyInstruction(body.angleStrategy),
    ]
      .filter(Boolean)
      .join("\n");
  if (!body.topicPlan && !angleById && !(body.customAngle && body.customAngle.trim())) {
    return new Response("angle or customAngle required", { status: 400 });
  }

  const encoder = new TextEncoder();
  const signal = req.signal;
  const relevantTrendResults: TrendSearchResult[] = isTrendMode
    ? filterRelevantTrendResults(product, body.sourcePack, body.trendResults ?? [])
    : body.trendResults ?? [];
  const trendPostProcessContext = {
    product: product.name,
    productDesc: product.description,
  };
  const sourcePackText = [
    formatSourcePack(body.sourcePack, product),
    isTrendMode ? `【近 30 天热点素材摘要】\n${formatTrendSources(relevantTrendResults)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const factcheckGroundTruth = buildFactcheckGroundTruth({
    product,
    sourcePackText,
  });
  const lengthInstruction = getContentLengthInstruction(body.contentLength);
  const deepSeekOptions = getDeepSeekChatOptions();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: StageEvent) =>
        controller.enqueue(encodeEvent(encoder, e));
      const emitStageStart = (stage: PipelineStageId) =>
        emit({ type: "stage", stage, status: "running" });
      const emitStageDone = (
        stage: PipelineStageId,
        elapsedMs: number,
        data?: unknown
      ) => emit({ type: "stage", stage, status: "done", elapsedMs, data });
      const emitStageFailed = (
        stage: PipelineStageId,
        elapsedMs: number,
        error: string
      ) => emit({ type: "stage", stage, status: "failed", elapsedMs, error });

      const result: GenerationResult = {
        outline: "",
        body: "",
        titles: [],
        covers: [],
        factcheck: { passed: true, warning: null },
      };
      let rawBodyForTitle = "";

      try {
        // ---------- Stage 1 · outline ----------
        emitStageStart("outline");
        let t0 = Date.now();
        try {
          const outline = await callWithTimeout(
            () =>
              isTrendMode
                ? callTrendNonStream("outline", signal, {
                    product: product.name,
                    productDesc: product.description,
                    angle: angleName,
                    angleInstruction,
                    sourcePack: sourcePackText,
                    lengthInstruction,
                    styleName: body.trendStyleName ?? style.name,
                    styleProfile: style.promptProfile,
                    styleSample: style.sampleText,
                  })
                : callPromptNonStream("outline", signal, {
                    product: product.name,
                    productDesc: product.description,
                    angle: angleName,
                    angleInstruction,
                    sourcePack: sourcePackText,
                    lengthInstruction,
                  }),
            60_000
          );
          result.outline = outline;
          emitStageDone("outline", Date.now() - t0, { outline });
        } catch (err) {
          emitStageFailed("outline", Date.now() - t0, errMsg(err));
          throw err;
        }

        // ---------- Stage 2 · body (streaming) ----------
        emitStageStart("body");
        t0 = Date.now();
        try {
          const iter = isTrendMode
            ? callTrendStream(signal, {
                product: product.name,
                productDesc: product.description,
                angle: angleName,
                angleInstruction,
                styleName: body.trendStyleName ?? style.name,
                styleProfile: style.promptProfile,
                styleSample: style.sampleText,
                outline: result.outline,
                sourcePack: sourcePackText,
                lengthInstruction,
              })
            : callPromptStream("body", signal, {
                product: product.name,
                productDesc: product.description,
                angle: angleName,
                angleInstruction,
                styleName: style.name,
                styleProfile: style.promptProfile,
                styleSample: style.sampleText,
                outline: result.outline,
                sourcePack: sourcePackText,
                lengthInstruction,
              });
          for await (const delta of iter) {
            result.body += delta;
            emit({ type: "body-delta", delta });
          }
          rawBodyForTitle = result.body;
          result.body = isTrendMode
            ? postProcessTrendBody(result.body, trendPostProcessContext)
            : postProcessGeneratedMarkdown(result.body, body.contentLength);
          emitStageDone("body", Date.now() - t0);
        } catch (err) {
          emitStageFailed("body", Date.now() - t0, errMsg(err));
          throw err;
        }

        // ---------- Stage 2b · humanize (optional) ----------
        if (body.autoHumanize) {
          emitStageStart("humanize" as PipelineStageId);
          t0 = Date.now();
          try {
            const articleType = isTrendMode ? "时事热点" : inferArticleType({
              angleId: body.angleId,
              customAngle: body.customAngle,
            });
            const humanizeFn = buildQwenHumanizeFn({
              intent:
                isTrendMode
                  ? getTrendHumanizeIntent()
                  : "在保持主要观点与事实的前提下，用更接近真人公众号编辑的语气逐段重写。允许自然口语化,但不要网红腔;保留 01/02 章节、蓝色重点句和结尾行动建议;不得新增产品流程、按钮文案、登录状态、客户或数据。",
              styleName: style.name,
              styleProfile: isTrendMode
                ? getTrendHumanizeStyleProfile(style.name)
                : style.promptProfile,
              articleType,
              ...deepSeekOptions,
              humanize,
            });
            const pipelineResult = isTrendMode
              ? await runStructurePreservingPipeline(result.body, humanizeFn, {
                  threshold: 40,
                  maxRounds: 2,
                  concurrency: 3,
                  signal,
                })
              : await runHumanizePipeline(result.body, humanizeFn, {
                  threshold: 40,
                  maxRounds: 2,
                  concurrency: 3,
                  signal,
                });
            result.body = isTrendMode
              ? postProcessTrendBody(pipelineResult.text, trendPostProcessContext)
              : postProcessGeneratedMarkdown(
                  pipelineResult.text,
                  body.contentLength
                );
            emitStageDone("humanize" as PipelineStageId, Date.now() - t0, {
              score: pipelineResult.scoreBreakdown.total,
              rounds: pipelineResult.totalRounds,
            });
          } catch (err) {
            // Non-fatal: if humanize fails, continue with original body
            emitStageFailed(
              "humanize" as PipelineStageId,
              Date.now() - t0,
              errMsg(err)
            );
          }
        }

        // ---------- Stage 3 · titles ----------
        emitStageStart("titles");
        t0 = Date.now();
        try {
          const titles = await callWithTimeout(
            () =>
              isTrendMode
                ? generateTrendTitles({
                    product: product.name,
                    angle: angleName,
                    styleName: body.trendStyleName ?? style.name,
                    body: result.body,
                    sourceSummary: formatTrendSources(relevantTrendResults),
                    signal,
                  })
                : generateTitles({
                    product: product.name,
                    angle: angleName,
                    styleName: style.name,
                    body: result.body,
                    ...deepSeekOptions,
                    signal,
                  }),
            60_000
          );
          result.titles = titles
            .map((title) =>
              isTrendMode
                ? postProcessTrendTitle(title, trendPostProcessContext)
                : cleanGeneratedTitle(title)
            )
            .filter(Boolean);
          if (!isTrendMode) {
            result.titles = resolveGeneratedArticleTitle({
              titles: result.titles,
              bodyMarkdown: rawBodyForTitle || result.body,
              fallbackTitle: product.name,
            }).titleCandidates;
          }
          emitStageDone("titles", Date.now() - t0, { titles: result.titles });
        } catch (err) {
          // Fall back to a deterministic 5-title set if LLM fails —
          // titles are nice-to-have, not a reason to abort whole pipeline.
          const fallback = isTrendMode
            ? buildFallbackTrendTitles({
                product: product.name,
                angle: angleName,
                sourceSummary: formatTrendSources(relevantTrendResults),
              })
            : parseTitles(
                `[${JSON.stringify(`${product.name} · 产品观察`)},${JSON.stringify(
                  `${product.name}:${angleName}`
                )},${JSON.stringify(
                  `我们为什么选择 ${product.name}`
                )},${JSON.stringify(`关于 ${product.name} 的一份实测笔记`)},${JSON.stringify(
                  `${product.name} 的三个真实场景`
                )}]`
              );
          result.titles = fallback
            .map((title) =>
              isTrendMode
                ? postProcessTrendTitle(title, trendPostProcessContext)
                : cleanGeneratedTitle(title)
            )
            .filter(Boolean);
          if (!isTrendMode) {
            result.titles = resolveGeneratedArticleTitle({
              titles: result.titles,
              bodyMarkdown: rawBodyForTitle || result.body,
              fallbackTitle: product.name,
            }).titleCandidates;
          }
          emitStageDone("titles", Date.now() - t0, {
            titles: result.titles,
            note: "fallback",
            error: errMsg(err),
          });
        }

        // ---------- Stage 4 · covers ----------
        emitStageStart("covers");
        t0 = Date.now();
        if (isTrendMode) {
          const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
          if (unsplashAccessKey) {
            const candidates = await searchUnsplashCoverCandidates({
              accessKey: unsplashAccessKey,
              product,
              trends: relevantTrendResults,
              sourcePack: body.sourcePack,
              config: parseUnsplashImageConfig(
                process.env.UNSPLASH_TREND_IMAGE_QUERY_MAP
              ),
              count: 4,
              signal,
            });
            result.covers = candidates.map((candidate) => ({
              url: candidate.url300,
              styleLabel: candidate.styleLabel,
            }));
          } else {
            result.covers = [];
          }
          emitStageDone("covers", Date.now() - t0, {
            covers: result.covers,
            note: unsplashAccessKey
              ? "unsplash-trend-cover"
              : "unsplash-not-configured",
          });
        } else {
          await delay(900, signal);
          const titleForCover = result.titles[0] ?? product.name;
          const covers = generateCoverCandidates(titleForCover, 4).map((c) => ({
            url: c.url,
            styleLabel: c.styleLabel,
          }));
          result.covers = covers;
          emitStageDone("covers", Date.now() - t0, { covers });
        }

        // ---------- Stage 5 · factcheck ----------
        emitStageStart("factcheck");
        t0 = Date.now();
        try {
          const checked = await callWithTimeout(
            () =>
              factcheck({
                product: product.name,
                productDesc: factcheckGroundTruth,
                body: result.body,
                ...deepSeekOptions,
                signal,
              }),
            60_000
          );
          result.factcheck = {
            passed: checked.ok,
            warning: checked.warnings[0] ?? null,
          };
        } catch (err) {
          result.factcheck = fallbackFactcheck(result.body, factcheckGroundTruth);
          if (result.factcheck.passed && !(err instanceof QwenAuthError)) {
            result.factcheck = {
              passed: false,
              warning: "事实核查暂不可用,建议发布前人工复核。",
            };
          }
        }
        emitStageDone("factcheck", Date.now() - t0, result.factcheck);

        // ---------- All done ----------
        emit({ type: "result", result });
        controller.enqueue(encodeDone(encoder));
        controller.close();
      } catch (err: unknown) {
        emit({
          type: "error",
          error: {
            name: err instanceof Error ? err.name : "Error",
            message: errMsg(err),
          },
        });
        controller.enqueue(encodeDone(encoder));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ---------- helpers ----------

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      },
      { once: true }
    );
  });
}

async function callWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return await Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function callTrendNonStream(
  node: "outline",
  signal: AbortSignal,
  vars: Omit<TrendPromptVars, "outline">
): Promise<string> {
  const p = buildTrendPrompt(node, vars);
  try {
    return await completeChat({
      ...getDeepSeekChatOptions(),
      temperature: p.temperature,
      maxTokens: p.maxTokens,
      messages: [
        { role: "system", content: p.system },
        { role: "user", content: p.user },
      ],
      signal,
    });
  } catch (err) {
    if (err instanceof QwenAuthError) {
      return [
        "第一屏先借一个同类工具或替代方案正在被讨论的现象做外部话题噱头。",
        "前两段写得像读者刷到会停一下:有反差、有吐槽、有一个具体麻烦,不要先讲产品。",
        "解释为什么大家会点开这类讨论:不是好奇新名词,而是想知道自己会不会少折腾。",
        `产品一笔带过即可: ${vars.product} 只作为一句轻观察出现,不要抢走外部话题主线。`,
        "最后自然收束,不展示链接,不做硬广,不要写成行业分析。",
      ].join("\n");
    }
    throw err;
  }
}

async function* callTrendStream(
  signal: AbortSignal,
  vars: TrendPromptVars
): AsyncGenerator<string, void, unknown> {
  const p = buildTrendPrompt("body", vars);
  try {
    yield* streamChat({
      ...getDeepSeekChatOptions(),
      temperature: p.temperature,
      maxTokens: p.maxTokens,
      messages: [
        { role: "system", content: p.system },
        { role: "user", content: p.user },
      ],
      signal,
    });
  } catch (err) {
    if (err instanceof QwenAuthError) {
      yield fallbackTrendBody(vars);
      return;
    }
    throw err;
  }
}

async function generateTrendTitles({
  product,
  angle,
  styleName,
  body,
  sourceSummary,
  signal,
}: {
  product: string;
  angle: string;
  styleName: string;
  body: string;
  sourceSummary?: string;
  signal: AbortSignal;
}): Promise<string[]> {
  const prompt = buildTrendTitlePrompt({
    product,
    angle,
    styleName,
    body,
    sourceSummary,
  });
  const raw = await completeChat({
    ...getDeepSeekChatOptions(),
    temperature: prompt.temperature,
    maxTokens: prompt.maxTokens,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    signal,
  });
  return parseTitles(raw)
    .map((title) => title.replaceAll(product, "").trim())
    .filter(Boolean);
}

async function callPromptNonStream(
  node: "outline",
  signal: AbortSignal,
  vars: Record<string, string>
): Promise<string> {
  const p = renderPrompt(node, vars);
  try {
    return await completeChat({
      ...getDeepSeekChatOptions(),
      temperature: p.temperature,
      maxTokens: p.maxTokens,
      messages: [
        { role: "system", content: p.system },
        { role: "user", content: p.user },
      ],
      signal,
    });
  } catch (err) {
    if (err instanceof QwenAuthError) {
      // fall back to deterministic stub
      return `## 大纲(本地 mock,原因:${err.message})
- 背景和痛点
- 解决方案与产品介绍
- 三个关键维度
- 结论`;
    }
    throw err;
  }
}

function fallbackFactcheck(
  text: string,
  groundTruth: string
): GenerationResult["factcheck"] {
  const normalizedGround = groundTruth.replace(/\s+/g, "");
  const unsupportedPersonalName = findUnsupportedPersonalName(
    text,
    normalizedGround
  );
  if (unsupportedPersonalName) {
    return {
      passed: false,
      warning: `出现未提供素材支撑的具体人名:${unsupportedPersonalName}`,
    };
  }

  const unsupportedNumbers =
    text.match(
      /\d+(?:\.\d+)?\s*(?:%|％|分钟|小时|天|周|个月|年|倍|个|位|家|次|条|份|页|万|亿|元|块)/g
    ) ?? [];
  const riskyNumber = unsupportedNumbers.find(
    (item) => !normalizedGround.includes(item.replace(/\s+/g, ""))
  );
  if (riskyNumber) {
    return {
      passed: false,
      warning: `出现未提供素材支撑的数字:${riskyNumber}`,
    };
  }

  const unsupportedOperationPath = findUnsupportedOperationPath(
    text,
    normalizedGround
  );
  if (unsupportedOperationPath) {
    return {
      passed: false,
      warning: `出现未提供素材支撑的具体操作或按钮路径:${unsupportedOperationPath}`,
    };
  }

  const unsupportedCustomer = findUnsupportedCustomerClaim(
    text,
    normalizedGround
  );
  if (unsupportedCustomer) {
    return {
      passed: false,
      warning: `出现未提供素材支撑的客户/公司:${unsupportedCustomer}`,
    };
  }

  return { passed: true, warning: null };
}

function findUnsupportedCustomerClaim(
  text: string,
  normalizedGround: string
): string | null {
  const boundaryBlocksCustomerClaims =
    normalizedGround.includes("不得写客户名称") ||
    normalizedGround.includes("不得写客户案例") ||
    normalizedGround.includes("未提供真实客户资料") ||
    normalizedGround.includes("不得编造客户名称") ||
    normalizedGround.includes("不得擅自点名任何企业");

  if (!boundaryBlocksCustomerClaims) return null;

  const customerPatterns = [
    /某(?:华东|华南|华北|上海|北京|深圳|制造|金融|快消|零售|能源|车企|银行|保险|企业|公司|客户|团队|集团)[^，。；;、\s]{0,8}(?:企业|公司|客户|团队|集团|银行|车企)?/,
    /\b(?:Zara|Nike|Adidas|H&M|Uniqlo|SHEIN|LVMH|Prada|Gucci)\b/i,
    /(?:阿里|腾讯|字节|华为|小米|百度|京东|美团|拼多多|耐克|优衣库|海澜之家|安踏|李宁|波司登)[^，。；;、\s]{0,8}(?:客户|团队|品牌|公司|案例|集团)?/,
  ];

  for (const pattern of customerPatterns) {
    const match = text.match(pattern)?.[0] ?? null;
    if (match && !normalizedGround.includes(match.replace(/\s+/g, ""))) {
      return match;
    }
  }
  return null;
}

function findUnsupportedOperationPath(
  text: string,
  normalizedGround: string
): string | null {
  const boundaryBlocksUnconfirmedFlow =
    normalizedGround.includes("未提供真实流程") ||
    normalizedGround.includes("不得写按钮名称") ||
    normalizedGround.includes("不得写后台路径") ||
    normalizedGround.includes("不得写具体点击步骤") ||
    normalizedGround.includes("不得写具体操作") ||
    normalizedGround.includes("不得编造首页样式") ||
    normalizedGround.includes("不得编造具体点击路径");

  if (!boundaryBlocksUnconfirmedFlow) return null;

  const operationPatterns = [
    /点击(?:「[^」]{1,30}」|“[^”]{1,30}”|"[^"]{1,30}"|[^，。；;、\s]{1,16})(?:按钮|入口|菜单|页面|选项|后台|结果页)?/,
    /(?:进入|打开|选择|勾选|上传|下载|导出|跳转到)(?:「[^」]{1,30}」|“[^”]{1,30}”|"[^"]{1,30}"|[^，。；;、\s]{1,16})(?:页面|按钮|入口|路径|菜单|后台|结果页)?/,
    /(?:后台路径|按钮名称|点击路径|页面跳转|Demo\s*环境|控制台|工作台|生成按钮)/i,
  ];

  for (const pattern of operationPatterns) {
    const match = text.match(pattern)?.[0] ?? null;
    if (match && !normalizedGround.includes(match.replace(/\s+/g, ""))) {
      return match;
    }
  }
  return null;
}

function findUnsupportedPersonalName(
  text: string,
  normalizedGround: string
): string | null {
  const chineseName =
    text.match(
      /(?:^|[，。；;：:、\s“”"「」])([赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣邓郁单杭洪包诸左石崔吉龚程邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹龙叶司黎白薄南门司马上官欧阳夏侯诸葛东方][\u4e00-\u9fff]{1,2})(?=把|将|在|打开|放|重新|收到|发现|需要|已经|正在|坐|站|盯|问|说|表示|整理|拿|看|用|做|面前|桌上)/
    )?.[1] ?? null;
  if (
    chineseName &&
    !normalizedGround.includes(chineseName.replace(/\s+/g, ""))
  ) {
    return chineseName;
  }

  const englishName =
    text.match(
      /(?:^|[，。；;：:、\s“”"「」])([A-Z][a-z]{2,16})(?=把|将|在|打开|放|重新|收到|发现|需要|已经|正在|坐|站|盯|问|说|表示|整理|拿|看|用|做|面前|桌上)/
    )?.[1] ?? null;
  if (
    englishName &&
    !normalizedGround.includes(englishName.replace(/\s+/g, ""))
  ) {
    return englishName;
  }

  return null;
}

async function* callPromptStream(
  node: "body",
  signal: AbortSignal,
  vars: Record<string, string>
): AsyncGenerator<string, void, unknown> {
  const p = renderPrompt(node, vars);
  try {
    yield* streamChat({
      ...getDeepSeekChatOptions(),
      temperature: p.temperature,
      maxTokens: p.maxTokens,
      messages: [
        { role: "system", content: p.system },
        { role: "user", content: p.user },
      ],
      signal,
    });
  } catch (err) {
    if (err instanceof QwenAuthError) {
      yield `## 前言\n\n本地 mock 正文(原因:${err.message})。\n\n## 主体\n\n这是一个 demo 段落,用于测试流式 UI。实际接入 Qwen 后会被替换为真实模型输出。`;
      return;
    }
    throw err;
  }
}
