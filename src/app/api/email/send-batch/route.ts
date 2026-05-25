import { NextRequest, NextResponse } from "next/server";
import {
  getMissingSmtpEnvNames,
  getSmtpConfigFromEnv,
  sendSmtpMail,
} from "@/lib/smtpMailer";
import { getResendConfigFromEnv, sendResendMail } from "@/lib/resendMailer";

export const runtime = "nodejs";

interface EmailArticlePreview {
  id: string;
  title: string;
  angleLabel?: string;
  styleName?: string;
  summary: string;
  reviewUrl: string;
  humanizeStatus?: string;
}

interface EmailRecipientInput {
  email: string;
  name?: string;
}

interface SendBatchRequest {
  batchId: string;
  productName?: string;
  recipients?: EmailRecipientInput[];
  recipientEmail?: string;
  recipientName?: string;
  articles: EmailArticlePreview[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: SendBatchRequest;
  try {
    body = (await req.json()) as SendBatchRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!body.batchId?.trim()) {
    return NextResponse.json({ ok: false, error: "batchId is required" }, { status: 400 });
  }
  const recipients = normalizeRecipients(body);
  if (recipients.length < 1) {
    return NextResponse.json({ ok: false, error: "recipients are required" }, { status: 400 });
  }
  const invalidRecipient = recipients.find((r) => !EMAIL_RE.test(r.email));
  if (invalidRecipient) {
    return NextResponse.json(
      { ok: false, error: `recipient email is invalid: ${invalidRecipient.email}` },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.articles) || body.articles.length < 1) {
    return NextResponse.json({ ok: false, error: "articles are required" }, { status: 400 });
  }
  const blockedArticle = body.articles.find((article) => article.humanizeStatus !== "passed");
  if (blockedArticle) {
    return NextResponse.json(
      {
        ok: false,
        error: `article ${blockedArticle.id ?? blockedArticle.title} has not passed humanize`,
      },
      { status: 400 }
    );
  }

  const subject = `JOTO 内容候选｜${body.productName?.trim() || "产品"}｜${body.articles.length} 篇待选择`;
  const html = buildEmailHtml(body.batchId, body.productName, body.articles);
  const text = buildEmailText(body.batchId, body.productName, body.articles);

  if (shouldUseMockSmtp()) {
    const results = recipients.map((recipient) => ({
      email: recipient.email,
      ok: true,
      messageId: `mock-mail-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    }));
    return NextResponse.json({
      ok: true,
      mock: true,
      status: "success",
      messageId: results[0]?.messageId,
      messageIds: results.map((r) => r.messageId),
      recipientEmail: recipients[0]?.email,
      recipientEmails: recipients.map((r) => r.email),
      results,
      subject,
      previewText: text,
    });
  }

  const resendConfig = getResendConfigFromEnv();
  const smtpConfig = getSmtpConfigFromEnv();
  if (!resendConfig && !smtpConfig) {
    return NextResponse.json(
      {
        ok: false,
        error: `邮件配置缺失: RESEND_API_KEY/RESEND_FROM 或 SMTP 配置（${getMissingSmtpEnvNames().join(", ")}）`,
      },
      { status: 500 }
    );
  }

  const results = await Promise.all(
    recipients.map(async (recipient) => {
      try {
        const sent = resendConfig
          ? await sendResendMail(resendConfig, {
              to: recipient.email,
              toName: recipient.name,
              subject,
              html,
              text,
            })
          : await sendSmtpMail(smtpConfig!, {
          to: recipient.email,
          toName: recipient.name,
          subject,
          html,
          text,
            });
        return {
          email: recipient.email,
          ok: true,
          messageId: sent.messageId,
          response: sent.response,
          provider: resendConfig ? "resend" : "smtp",
        };
      } catch (err) {
        return {
          email: recipient.email,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  const successCount = results.filter((r) => r.ok).length;
  const failedResults = results.filter((r) => !r.ok);
  const status =
    successCount === recipients.length
      ? "success"
      : successCount > 0
        ? "partial_success"
        : "failed";
  const firstError = failedResults[0]?.error;
  const error =
    successCount === 0 && firstError
      ? `邮件发送失败：${firstError}`
      : successCount < recipients.length
        ? `部分邮箱发送失败：${failedResults
            .map((r) => `${r.email} ${r.error ?? "未知错误"}`)
            .join("；")}`
        : undefined;

  return NextResponse.json({
    ok: successCount > 0,
    mock: false,
    status,
    error,
    messageId: results.find((r) => r.ok)?.messageId,
    messageIds: results.flatMap((r) => (r.messageId ? [r.messageId] : [])),
    recipientEmail: recipients[0]?.email,
    recipientEmails: recipients.map((r) => r.email),
    results,
    subject,
    previewText: text,
  }, { status: successCount > 0 ? 200 : 502 });
}

function normalizeRecipients(body: SendBatchRequest): EmailRecipientInput[] {
  const recipients = Array.isArray(body.recipients) ? body.recipients : [];
  if (recipients.length > 0) {
    return recipients.map((r) => ({
      email: r.email.trim(),
      name: r.name?.trim(),
    }));
  }
  if (body.recipientEmail) {
    return [
      {
        email: body.recipientEmail.trim(),
        name: body.recipientName?.trim(),
      },
    ];
  }
  return [];
}

function shouldUseMockSmtp(): boolean {
  if (process.env.SMTP_MOCK === "true") return true;
  if (process.env.SMTP_MOCK === "false") return false;
  return process.env.NODE_ENV === "test";
}

function buildEmailHtml(
  batchId: string,
  productName: string | undefined,
  articles: EmailArticlePreview[]
): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f8fb;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,'PingFang SC','Microsoft YaHei',sans-serif;color:#172033;">
    <main style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5eaf2;border-radius:14px;padding:28px;">
      <p style="margin:0 0 8px;color:#1d6fff;font-size:13px;font-weight:700;">JOTO 内容候选</p>
      <h1 style="margin:0;font-size:24px;line-height:1.35;color:#101828;">${escapeHtml(productName || "产品")} · ${articles.length} 篇待选择</h1>
      <p style="margin:10px 0 0;color:#667085;font-size:14px;">批次 ID：${escapeHtml(batchId)}</p>
      <p style="margin:18px 0 0;color:#344054;font-size:15px;line-height:1.8;">以下候选稿已通过 Humanize，请选择最适合发布的一篇。如需查看完整公众号排版，请点击对应 Review 链接。</p>
      <div style="margin-top:22px;">
        ${articles
          .map(
            (article, idx) => `
          <section style="border-top:1px solid #edf1f7;padding:18px 0;">
            <p style="margin:0 0 8px;color:#1d6fff;font-size:12px;font-weight:700;">候选 ${idx + 1} · ${escapeHtml(article.angleLabel || "选题")}</p>
            <h2 style="margin:0;font-size:18px;line-height:1.45;color:#101828;">${escapeHtml(article.title)}</h2>
            <p style="margin:8px 0;color:#667085;font-size:13px;">风格：${escapeHtml(article.styleName || "JOTO 官方风格")} · Humanize：已通过</p>
            <p style="margin:10px 0 14px;color:#344054;font-size:14px;line-height:1.8;">${escapeHtml(article.summary)}</p>
            <a href="${escapeAttribute(article.reviewUrl)}" style="display:inline-block;border-radius:8px;background:#1d6fff;color:#fff;text-decoration:none;padding:9px 14px;font-size:13px;font-weight:700;">查看完整文章</a>
          </section>`
          )
          .join("")}
      </div>
    </main>
  </body>
</html>`;
}

function buildEmailText(
  batchId: string,
  productName: string | undefined,
  articles: EmailArticlePreview[]
): string {
  return [
    `JOTO 内容候选｜${productName || "产品"}｜${articles.length} 篇待选择`,
    `批次 ID：${batchId}`,
    "以下候选稿已通过 Humanize，请选择最适合发布的一篇。",
    "",
    ...articles.map(
      (a, idx) =>
        `${idx + 1}. ${a.title}\n角度：${a.angleLabel ?? "选题"}\n风格：${a.styleName ?? "JOTO 官方风格"}\n摘要：${a.summary}\nReview：${a.reviewUrl}`
    ),
  ].join("\n\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
