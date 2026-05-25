export interface ResendConfig {
  apiKey: string;
  from: string;
}

export interface ResendSendInput {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}

export interface ResendSendResult {
  messageId: string;
  response: string;
}

export function getResendConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): ResendConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export async function sendResendMail(
  config: ResendConfig,
  input: ResendSendInput
): Promise<ResendSendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [formatRecipient(input.to, input.toName)],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    message?: string;
    error?: string;
  };

  if (!res.ok || !data.id) {
    const detail = data.message ?? data.error ?? `HTTP ${res.status}`;
    throw new Error(`Resend API ${detail}`);
  }

  return {
    messageId: data.id,
    response: `Resend API accepted ${data.id}`,
  };
}

function formatRecipient(email: string, name?: string): string {
  const cleanEmail = email.trim();
  const cleanName = name?.trim();
  return cleanName ? `${cleanName} <${cleanEmail}>` : cleanEmail;
}
