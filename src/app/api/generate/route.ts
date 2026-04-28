import { NextRequest } from "next/server";
import productsData from "@/data/products.json";
import anglesData from "@/data/angles.json";
import stylesData from "@/data/styles.json";
import type { Angle, PipelineStageId, Product, WritingStyle } from "@/types";
import {
  completeChat,
  generateTitles,
  parseTitles,
  streamChat,
  QwenAuthError,
} from "@/lib/qwen";
import { renderPrompt } from "@/lib/prompts";
import { generateCoverCandidates } from "@/lib/mockCovers";
import { seededBool } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTS = productsData as Product[];
const ANGLES = anglesData as Angle[];
const STYLES = stylesData as WritingStyle[];

interface GenerateRequest {
  productId: string;
  angleId?: string;
  customAngle?: string;
  styleId: string;
  articleId?: string;
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

  const product = PRODUCTS.find((p) => p.id === body.productId);
  if (!product) {
    return new Response(`product not found: ${body.productId}`, { status: 400 });
  }
  const style = STYLES.find((s) => s.id === body.styleId);
  if (!style) {
    return new Response(`style not found: ${body.styleId}`, { status: 400 });
  }
  const angleById = ANGLES.find((a) => a.id === body.angleId);
  const angleName = angleById?.name ?? "自定义角度";
  const angleInstruction =
    angleById?.promptInstruction ?? body.customAngle?.trim() ?? "";
  if (!angleById && !(body.customAngle && body.customAngle.trim())) {
    return new Response("angle or customAngle required", { status: 400 });
  }

  const encoder = new TextEncoder();
  const signal = req.signal;

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

      try {
        // ---------- Stage 1 · outline ----------
        emitStageStart("outline");
        let t0 = Date.now();
        try {
          const outline = await callWithTimeout(
            () =>
              callPromptNonStream("outline", signal, {
                product: product.name,
                productDesc: product.description,
                angle: angleName,
                angleInstruction,
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
          const iter = callPromptStream("body", signal, {
            product: product.name,
            productDesc: product.description,
            angle: angleName,
            angleInstruction,
            styleName: style.name,
            styleProfile: style.promptProfile,
            styleSample: style.sampleText,
            outline: result.outline,
          });
          for await (const delta of iter) {
            result.body += delta;
            emit({ type: "body-delta", delta });
          }
          emitStageDone("body", Date.now() - t0);
        } catch (err) {
          emitStageFailed("body", Date.now() - t0, errMsg(err));
          throw err;
        }

        // ---------- Stage 3 · titles ----------
        emitStageStart("titles");
        t0 = Date.now();
        try {
          const titles = await callWithTimeout(
            () =>
              generateTitles({
                product: product.name,
                angle: angleName,
                styleName: style.name,
                body: result.body,
                signal,
              }),
            60_000
          );
          result.titles = titles;
          emitStageDone("titles", Date.now() - t0, { titles });
        } catch (err) {
          // Fall back to a deterministic 5-title set if LLM fails —
          // titles are nice-to-have, not a reason to abort whole pipeline.
          const fallback = parseTitles(
            `[${JSON.stringify(`${product.name} · 产品观察`)},${JSON.stringify(
              `${product.name}:${angleName}`
            )},${JSON.stringify(
              `我们为什么选择 ${product.name}`
            )},${JSON.stringify(`关于 ${product.name} 的一份实测笔记`)},${JSON.stringify(
              `${product.name} 的三个真实场景`
            )}]`
          );
          result.titles = fallback;
          emitStageDone("titles", Date.now() - t0, {
            titles: fallback,
            note: "fallback",
            error: errMsg(err),
          });
        }

        // ---------- Stage 4 · covers (mock) ----------
        emitStageStart("covers");
        t0 = Date.now();
        await delay(900, signal);
        const titleForCover = result.titles[0] ?? product.name;
        const covers = generateCoverCandidates(titleForCover, 4).map((c) => ({
          url: c.url,
          styleLabel: c.styleLabel,
        }));
        result.covers = covers;
        emitStageDone("covers", Date.now() - t0, { covers });

        // ---------- Stage 5 · factcheck (mock 1/10 warning) ----------
        // Seeded by articleId so the same draft always reproduces the same
        // factcheck outcome — demos don't "randomly" lose warnings on reload.
        emitStageStart("factcheck");
        t0 = Date.now();
        await delay(700, signal);
        const seed = body.articleId ?? `${body.productId}:${body.angleId ?? body.customAngle ?? ""}:${body.styleId}`;
        const warn = seededBool(`${seed}:factcheck`, 0.1);
        result.factcheck = warn
          ? {
              passed: false,
              warning:
                "正文中出现了无法从产品简介直接推导的声明,建议人工复核。",
            }
          : { passed: true, warning: null };
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

async function callPromptNonStream(
  node: "outline" | "factcheck",
  signal: AbortSignal,
  vars: Record<string, string>
): Promise<string> {
  const p = renderPrompt(node, vars);
  try {
    return await completeChat({
      model: p.model,
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

async function* callPromptStream(
  node: "body",
  signal: AbortSignal,
  vars: Record<string, string>
): AsyncGenerator<string, void, unknown> {
  const p = renderPrompt(node, vars);
  try {
    yield* streamChat({
      model: p.model,
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
