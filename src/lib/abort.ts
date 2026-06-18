const ABORT_MESSAGE_RE = /abort|aborted|signal is aborted/i;

export function isAbortLikeError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error) {
    return err.name === "AbortError" || ABORT_MESSAGE_RE.test(err.message);
  }
  if (typeof err === "string") return ABORT_MESSAGE_RE.test(err);
  return false;
}

export function abortWithReason(
  controller: AbortController | null | undefined,
  reason = "operation-cancelled"
): void {
  if (!controller || controller.signal.aborted) return;

  const abortReason =
    typeof DOMException === "undefined"
      ? Object.assign(new Error(reason), { name: "AbortError" })
      : new DOMException(reason, "AbortError");

  try {
    controller.abort(abortReason);
  } catch (err) {
    if (!isAbortLikeError(err)) throw err;
  }
}
