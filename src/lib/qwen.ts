import OpenAI from "openai";
import {
  renderPrompt,
  type PipelineNode,
} from "./prompts";

export const DASHSCOPE_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

export class QwenAuthError extends Error {
  constructor(message = "Qwen API key missing or invalid") {
    super(message);
    this.name = "QwenAuthError";
  }
}

export class QwenRateLimitError extends Error {
  constructor(message = "Qwen rate limit exceeded") {
    super(message);
    this.name = "QwenRateLimitError";
  }
}

export class QwenTimeoutError extends Error {
  constructor(message = "Qwen request timed out") {
    super(message);
    this.name = "QwenTimeoutError";
  }
}

export interface QwenClientOptions {
  apiKey?: string;
  baseURL?: string;
  /**
   * For testing: inject a custom OpenAI-compatible client.
   * If provided, apiKey/baseURL are ignored.
   */
  client?: OpenAI;
}

export function createQwenClient(options: QwenClientOptions = {}): OpenAI {
  if (options.client) return options.client;
  const apiKey = options.apiKey ?? process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new QwenAuthError("DASHSCOPE_API_KEY is not set");
  }
  return new OpenAI({
    apiKey,
    baseURL: options.baseURL ?? DASHSCOPE_BASE_URL,
  });
}

function wrapApiError(error: unknown): Error {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) return new QwenAuthError(error.message);
    if (error.status === 429) return new QwenRateLimitError(error.message);
    if (error.status === 408 || error.code === "ETIMEDOUT") {
      return new QwenTimeoutError(error.message);
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

export interface StreamChatOptions {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  client?: OpenAI;
}

/**
 * Stream chat completion chunks as plain text deltas.
 * Caller owns the AbortSignal for cancellation.
 */
export async function* streamChat(
  options: StreamChatOptions
): AsyncGenerator<string, void, unknown> {
  const client = createQwenClient({ client: options.client });
  const model =
    options.model ?? process.env.QWEN_MODEL_GENERATE ?? "qwen-plus";

  try {
    const stream = await client.chat.completions.create(
      {
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.8,
        max_tokens: options.maxTokens ?? 4000,
        stream: true,
      },
      { signal: options.signal }
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  } catch (error: unknown) {
    throw wrapApiError(error);
  }
}

export interface CompleteChatOptions extends StreamChatOptions {
  client?: OpenAI;
}

/**
 * Non-streaming chat completion, returns full content as string.
 */
export async function completeChat(
  options: CompleteChatOptions
): Promise<string> {
  const client = createQwenClient({ client: options.client });
  const model =
    options.model ?? process.env.QWEN_MODEL_GENERATE ?? "qwen-plus";

  try {
    const res = await client.chat.completions.create(
      {
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.8,
        max_tokens: options.maxTokens ?? 4000,
        stream: false,
      },
      { signal: options.signal }
    );
    return res.choices[0]?.message?.content ?? "";
  } catch (error: unknown) {
    throw wrapApiError(error);
  }
}

/**
 * Wrap an AsyncGenerator<string> into a ReadableStream that emits
 * Server-Sent Events (data: {"delta": "..."}\n\n). Used by Route Handlers.
 */
export function sseFromGenerator(
  generator: AsyncGenerator<string, void, unknown>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of generator) {
          const payload = JSON.stringify({ delta });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const name = error instanceof Error ? error.name : "Error";
        const payload = JSON.stringify({ error: { name, message } });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        controller.close();
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Domain-specific generation fns that wire prompts + temperatures per PRD 6.2.5
// ---------------------------------------------------------------------------

export interface GenerateOutlineArgs {
  product: string;
  productDesc: string;
  angle: string;
  angleInstruction: string;
  client?: OpenAI;
  signal?: AbortSignal;
}

export async function generateOutline(args: GenerateOutlineArgs): Promise<string> {
  return callPromptNonStream("outline", args, {
    product: args.product,
    productDesc: args.productDesc,
    angle: args.angle,
    angleInstruction: args.angleInstruction,
  });
}

export interface GenerateBodyArgs extends GenerateOutlineArgs {
  outline: string;
  styleName: string;
  styleProfile: string;
  styleSample: string;
}

export async function* generateBody(
  args: GenerateBodyArgs
): AsyncGenerator<string, void, unknown> {
  yield* callPromptStream("body", args, {
    product: args.product,
    productDesc: args.productDesc,
    angle: args.angle,
    angleInstruction: args.angleInstruction,
    styleName: args.styleName,
    styleProfile: args.styleProfile,
    styleSample: args.styleSample,
    outline: args.outline,
  });
}

export interface GenerateTitlesArgs {
  product: string;
  angle: string;
  styleName: string;
  body: string;
  client?: OpenAI;
  signal?: AbortSignal;
}

/**
 * Generate 5 candidate titles. Result is parsed JSON array; if parsing fails,
 * falls back to line-split heuristic. Always returns 5 strings.
 */
export async function generateTitles(args: GenerateTitlesArgs): Promise<string[]> {
  const raw = await callPromptNonStream("titles", args, {
    product: args.product,
    angle: args.angle,
    styleName: args.styleName,
    body: args.body,
  });
  return parseTitles(raw);
}

export function parseTitles(raw: string, target = 5): string[] {
  const trimmed = raw.trim();
  // Try JSON first
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0]);
      if (Array.isArray(arr)) {
        const titles = arr
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter(Boolean);
        if (titles.length >= 1) return padTo(titles, target);
      }
    } catch {
      // fall through
    }
  }
  // Fallback: split by newlines, strip numbering/bullets
  const lines = trimmed
    .split(/\r?\n+/)
    .map((l) => l.replace(/^[-*•\d.、]+\s*/, "").replace(/^["']|["']$/g, "").trim())
    .filter((l) => l.length > 0 && l.length < 80);
  return padTo(lines, target);
}

function padTo(arr: string[], target: number): string[] {
  if (arr.length >= target) return arr.slice(0, target);
  const out = arr.slice();
  while (out.length < target) {
    out.push(arr[out.length % arr.length] ?? "未命名标题");
  }
  return out;
}

export interface HumanizeArgs {
  intent: string;
  text: string;
  styleName: string;
  styleProfile: string;
  client?: OpenAI;
  signal?: AbortSignal;
}

export async function* humanize(
  args: HumanizeArgs
): AsyncGenerator<string, void, unknown> {
  yield* callPromptStream("humanize", args, {
    intent: args.intent,
    text: args.text,
    styleName: args.styleName,
    styleProfile: args.styleProfile,
  });
}

export interface FactcheckArgs {
  product: string;
  productDesc: string;
  body: string;
  client?: OpenAI;
  signal?: AbortSignal;
}

export interface FactcheckResult {
  ok: boolean;
  warnings: string[];
}

export async function factcheck(
  args: FactcheckArgs
): Promise<FactcheckResult> {
  const raw = await callPromptNonStream("factcheck", args, {
    product: args.product,
    productDesc: args.productDesc,
    body: args.body,
  });
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: true, warnings: [] };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ok: parsed.ok !== false,
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.filter((x: unknown): x is string => typeof x === "string")
        : [],
    };
  } catch {
    return { ok: true, warnings: [] };
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface CallArgs {
  client?: OpenAI;
  signal?: AbortSignal;
}

async function callPromptNonStream(
  node: PipelineNode,
  callArgs: CallArgs,
  vars: Record<string, string>
): Promise<string> {
  const p = renderPrompt(node, vars);
  return completeChat({
    model: p.model,
    temperature: p.temperature,
    maxTokens: p.maxTokens,
    messages: [
      { role: "system", content: p.system },
      { role: "user", content: p.user },
    ],
    client: callArgs.client,
    signal: callArgs.signal,
  });
}

async function* callPromptStream(
  node: PipelineNode,
  callArgs: CallArgs,
  vars: Record<string, string>
): AsyncGenerator<string, void, unknown> {
  const p = renderPrompt(node, vars);
  yield* streamChat({
    model: p.model,
    temperature: p.temperature,
    maxTokens: p.maxTokens,
    messages: [
      { role: "system", content: p.system },
      { role: "user", content: p.user },
    ],
    client: callArgs.client,
    signal: callArgs.signal,
  });
}
