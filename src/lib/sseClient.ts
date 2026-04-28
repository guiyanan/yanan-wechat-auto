/**
 * Tiny client-side SSE consumer for `data: {...}\n\n` streams produced by
 * Route Handlers (e.g. /api/humanize). Yields parsed delta strings.
 *
 * Stops on `data: [DONE]` or `{error: ...}` payloads. If the server sends
 * an error payload, the consumer throws a `SseError` with `{name, message}`.
 */

export class SseError extends Error {
  readonly originalName: string;
  constructor(name: string, message: string) {
    super(message);
    this.name = "SseError";
    this.originalName = name;
  }
}

export async function* streamSseDeltas(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  if (!response.body) throw new Error("response has no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const raw = buffer.slice(0, sep).trim();
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf("\n\n");
        if (!raw.startsWith("data:")) continue;
        const payload = raw.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const e = JSON.parse(payload) as {
            delta?: string;
            error?: { name: string; message: string };
          };
          if (e.error) throw new SseError(e.error.name, e.error.message);
          if (typeof e.delta === "string" && e.delta.length > 0) {
            yield e.delta;
          }
        } catch (err) {
          if (err instanceof SseError) throw err;
          // Ignore malformed frames — network noise, keep streaming
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}
