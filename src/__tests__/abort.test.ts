import { describe, expect, it } from "vitest";
import { abortWithReason, isAbortLikeError } from "@/lib/abort";

describe("abort helpers", () => {
  it("treats browser AbortError as a normal cancellation", () => {
    const controller = new AbortController();
    controller.abort();

    expect(isAbortLikeError(controller.signal.reason)).toBe(true);
  });

  it("recognizes Next/browser abort messages even when they arrive as Error", () => {
    expect(
      isAbortLikeError(new Error("signal is aborted without reason"))
    ).toBe(true);
  });

  it("aborts with an explicit reason so cancellation is not reasonless", () => {
    const controller = new AbortController();

    abortWithReason(controller, "user-left-generation");

    expect(controller.signal.aborted).toBe(true);
    expect(controller.signal.reason).toBeInstanceOf(DOMException);
    expect((controller.signal.reason as DOMException).name).toBe("AbortError");
    expect((controller.signal.reason as DOMException).message).toBe(
      "user-left-generation"
    );
  });

  it("does not hide unrelated errors", () => {
    expect(isAbortLikeError(new Error("HTTP 500"))).toBe(false);
  });
});
