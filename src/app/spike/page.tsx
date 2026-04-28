"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "streaming" | "done" | "error" | "aborted";

interface ErrorPayload {
  name?: string;
  message: string;
}

const DEFAULT_PROMPT =
  "用 3 个短句介绍一下通义千问 Qwen-Plus 模型的核心能力和适用场景。";

export default function SpikePage() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<ErrorPayload | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function run() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setOutput("");
    setError(null);
    setStatus("streaming");
    setStartedAt(Date.now());
    setFinishedAt(null);

    try {
      const res = await fetch("/api/spike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setError({
          name: "HttpError",
          message: `HTTP ${res.status} ${res.statusText}`,
        });
        setStatus("error");
        setFinishedAt(Date.now());
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex = buffer.indexOf("\n\n");
        while (sepIndex !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          sepIndex = buffer.indexOf("\n\n");
          const line = rawEvent.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") {
            setStatus("done");
            setFinishedAt(Date.now());
            return;
          }
          try {
            const obj = JSON.parse(payload);
            if (obj.error) {
              setError(obj.error as ErrorPayload);
              setStatus("error");
              setFinishedAt(Date.now());
              return;
            }
            if (typeof obj.delta === "string") {
              setOutput((prev) => prev + obj.delta);
            }
          } catch {
            // Ignore malformed event
          }
        }
      }

      setStatus("done");
      setFinishedAt(Date.now());
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("aborted");
        setFinishedAt(Date.now());
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      setError({
        name: err instanceof Error ? err.name : "Error",
        message,
      });
      setStatus("error");
      setFinishedAt(Date.now());
    }
  }

  function abort() {
    abortRef.current?.abort();
  }

  const elapsedMs =
    startedAt && finishedAt
      ? finishedAt - startedAt
      : startedAt
        ? Date.now() - startedAt
        : 0;

  return (
    <main className="flex-1 px-6 py-12 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
            Phase 0.5 · Qwen + SSE 连通 spike
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            通义千问流式生成测试
          </h1>
          <p className="text-sm text-slate-600">
            这个页面只做一件事:验证 Next.js Route Handler 能把 DashScope
            兼容端点的流式 chunk 转成 SSE 并让浏览器逐字接收。
          </p>
        </header>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">
            Prompt
          </label>
          <textarea
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={status === "streaming" || prompt.trim().length === 0}
              className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "streaming" ? "生成中…" : "运行 Spike"}
            </button>
            <button
              type="button"
              onClick={abort}
              disabled={status !== "streaming"}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              中止
            </button>
            <StatusPill status={status} elapsedMs={elapsedMs} />
          </div>
        </section>

        <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm font-medium text-slate-700">
            <span>输出</span>
            <span className="text-xs text-slate-400">
              {output.length} 字
            </span>
          </div>
          <div
            className="min-h-[120px] whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-7 text-slate-800"
            aria-live="polite"
          >
            {output || (
              <span className="text-slate-400">
                {status === "idle" ? "尚未运行" : "等待首个 token…"}
              </span>
            )}
          </div>
        </section>

        {error && (
          <section
            role="alert"
            className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-5"
          >
            <div className="text-sm font-semibold text-red-800">
              {error.name ?? "Error"}
            </div>
            <div className="text-sm text-red-700">{error.message}</div>
          </section>
        )}

        <footer className="text-xs text-slate-400">
          端点:<code className="font-mono">/api/spike</code> ·
          模型:<code className="font-mono">qwen-plus</code> ·
          Base URL:
          <code className="font-mono">
            https://dashscope.aliyuncs.com/compatible-mode/v1
          </code>
        </footer>
      </div>
    </main>
  );
}

interface StatusPillProps {
  status: Status;
  elapsedMs: number;
}

function StatusPill({ status, elapsedMs }: StatusPillProps) {
  const map: Record<Status, { label: string; color: string }> = {
    idle: { label: "就绪", color: "bg-slate-100 text-slate-600" },
    streaming: { label: "流式中", color: "bg-blue-100 text-blue-700" },
    done: { label: "完成", color: "bg-green-100 text-green-700" },
    error: { label: "错误", color: "bg-red-100 text-red-700" },
    aborted: { label: "已中止", color: "bg-amber-100 text-amber-700" },
  };
  const { label, color } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${color}`}
    >
      <span>{label}</span>
      {elapsedMs > 0 && (
        <span className="opacity-70">· {(elapsedMs / 1000).toFixed(1)}s</span>
      )}
    </span>
  );
}
