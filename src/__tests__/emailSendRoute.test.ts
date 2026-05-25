import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/email/send-batch/route";

function req(body: unknown): Request {
  return new Request("http://test/api/email/send-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/email/send-batch", () => {
  const oldEnv = { ...process.env };

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...oldEnv };
  });

  it("rejects invalid recipient email", async () => {
    const res = await POST(
      req({
        batchId: "batch-1",
        recipients: [{ email: "bad" }],
        articles: [{ humanizeStatus: "passed" }],
      }) as never
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  it("rejects articles that have not passed humanize", async () => {
    const res = await POST(
      req({
        batchId: "batch-1",
        recipients: [{ email: "pm@example.com" }],
        articles: [{ id: "art-1", title: "标题", summary: "摘要", reviewUrl: "http://x" }],
      }) as never
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  it("returns mock message ids for valid batch candidate email in tests", async () => {
    const res = await POST(
      req({
        batchId: "batch-1",
        productName: "Loop RPA",
        recipients: [
          { email: "pm@example.com", name: "PM" },
          { email: "lead@example.com", name: "Lead" },
        ],
        articles: [
          {
            id: "art-1",
            title: "标题",
            angleLabel: "产品介绍",
            styleName: "JOTO",
            summary: "摘要",
            reviewUrl: "http://localhost:3004/review/art-1",
            humanizeStatus: "passed",
          },
        ],
      }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      mock: true,
      recipientEmails: ["pm@example.com", "lead@example.com"],
    });
    expect(json.messageIds).toHaveLength(2);
    expect(json.messageIds[0]).toMatch(/^mock-mail-/);
  });

  it("returns a clear SMTP config error outside mock mode", async () => {
    process.env.SMTP_MOCK = "false";
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;

    const res = await POST(
      req({
        batchId: "batch-1",
        recipients: [{ email: "pm@example.com" }],
        articles: [
          {
            id: "art-1",
            title: "标题",
            summary: "摘要",
            reviewUrl: "http://localhost:3004/review/art-1",
            humanizeStatus: "passed",
          },
        ],
      }) as never
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: expect.stringContaining("邮件配置缺失"),
    });
  });

  it("sends through Resend HTTP API when Resend env is configured", async () => {
    process.env.SMTP_MOCK = "false";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM = "JOTO 内容工厂 <noreply@mail.jotoai.com>";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      req({
        batchId: "batch-1",
        productName: "Fasium AI",
        recipients: [{ email: "pm@example.com", name: "PM" }],
        articles: [
          {
            id: "art-1",
            title: "标题",
            angleLabel: "产品介绍",
            styleName: "JOTO",
            summary: "摘要",
            reviewUrl: "http://localhost:3004/review/art-1",
            humanizeStatus: "passed",
          },
        ],
      }) as never
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      mock: false,
      status: "success",
      messageIds: ["email_123"],
      results: [{ email: "pm@example.com", ok: true, provider: "resend" }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test",
          "Content-Type": "application/json",
        }),
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      from: "JOTO 内容工厂 <noreply@mail.jotoai.com>",
      to: ["PM <pm@example.com>"],
      subject: "JOTO 内容候选｜Fasium AI｜1 篇待选择",
    });
  });

  it("returns a clear Resend API error when delivery is rejected", async () => {
    process.env.SMTP_MOCK = "false";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM = "JOTO 内容工厂 <noreply@mail.jotoai.com>";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "domain is not verified" }),
      })
    );

    const res = await POST(
      req({
        batchId: "batch-1",
        recipients: [{ email: "pm@example.com" }],
        articles: [
          {
            id: "art-1",
            title: "标题",
            summary: "摘要",
            reviewUrl: "http://localhost:3004/review/art-1",
            humanizeStatus: "passed",
          },
        ],
      }) as never
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      ok: false,
      status: "failed",
      error: expect.stringContaining("Resend API domain is not verified"),
    });
  });
});
