import net from "node:net";
import tls from "node:tls";
import { randomBytes } from "node:crypto";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface SmtpSendInput {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}

export interface SmtpSendResult {
  messageId: string;
  response: string;
}

interface SmtpResponse {
  code: number;
  text: string;
}

const DEFAULT_TIMEOUT_MS = 20_000;

export function getSmtpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  const from = env.SMTP_FROM?.trim() || user;
  const port = Number(env.SMTP_PORT ?? (env.SMTP_SECURE === "true" ? "465" : "587"));

  if (!host || !user || !pass || !from || !Number.isFinite(port)) {
    return null;
  }

  return {
    host,
    port,
    secure: env.SMTP_SECURE === "true" || port === 465,
    user,
    pass,
    from,
  };
}

export function getMissingSmtpEnvNames(env: NodeJS.ProcessEnv = process.env): string[] {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
  const missing = required.filter((key) => !env[key]?.trim());
  if (!env.SMTP_PORT?.trim()) missing.push("SMTP_PORT");
  if (!env.SMTP_SECURE?.trim()) missing.push("SMTP_SECURE");
  return missing;
}

export async function sendSmtpMail(
  config: SmtpConfig,
  input: SmtpSendInput
): Promise<SmtpSendResult> {
  const client = new SmtpClient(config);
  const messageId = `<joto-${Date.now().toString(36)}-${randomBytes(4).toString(
    "hex"
  )}@local.joto>`;

  await client.connect();
  try {
    await client.ehlo();
    if (!config.secure && client.supportsStartTls()) {
      await client.startTls();
      await client.ehlo();
    }
    await client.login();
    await client.mailFrom(config.from);
    await client.rcptTo(input.to);
    const response = await client.data(
      buildMimeMessage({
        ...input,
        from: config.from,
        messageId,
      })
    );
    await client.quit().catch(() => undefined);
    return { messageId, response };
  } catch (err) {
    await client.close();
    throw err;
  }
}

class SmtpClient {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private buffer = "";
  private lastEhloText = "";

  constructor(private readonly config: SmtpConfig) {}

  async connect(): Promise<void> {
    this.socket = this.config.secure
      ? tls.connect({
          host: this.config.host,
          port: this.config.port,
          servername: this.config.host,
        })
      : net.createConnection({
          host: this.config.host,
          port: this.config.port,
        });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("SMTP connection timed out")),
        DEFAULT_TIMEOUT_MS
      );
      this.socket!.once(this.config.secure ? "secureConnect" : "connect", () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket!.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    await this.readResponse([220]);
  }

  async ehlo(): Promise<void> {
    const response = await this.command(`EHLO ${hostnameForEhlo()}`, [250]);
    this.lastEhloText = response.text;
  }

  supportsStartTls(): boolean {
    return /\bSTARTTLS\b/i.test(this.lastEhloText);
  }

  async startTls(): Promise<void> {
    await this.command("STARTTLS", [220]);
    const oldSocket = this.socket;
    this.buffer = "";
    this.socket = tls.connect({
      socket: oldSocket as net.Socket,
      servername: this.config.host,
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("SMTP STARTTLS timed out")),
        DEFAULT_TIMEOUT_MS
      );
      this.socket!.once("secureConnect", () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket!.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async login(): Promise<void> {
    await this.command("AUTH LOGIN", [334]);
    await this.command(Buffer.from(this.config.user).toString("base64"), [334]);
    await this.command(Buffer.from(this.config.pass).toString("base64"), [235]);
  }

  async mailFrom(from: string): Promise<void> {
    await this.command(`MAIL FROM:<${extractEmail(from)}>`, [250]);
  }

  async rcptTo(to: string): Promise<void> {
    await this.command(`RCPT TO:<${extractEmail(to)}>`, [250, 251]);
  }

  async data(message: string): Promise<string> {
    await this.command("DATA", [354]);
    const normalized = message
      .replace(/\r?\n/g, "\r\n")
      .split("\r\n")
      .map((line) => (line.startsWith(".") ? `.${line}` : line))
      .join("\r\n");
    this.socket!.write(`${normalized}\r\n.\r\n`);
    const response = await this.readResponse([250]);
    return response.text;
  }

  async quit(): Promise<void> {
    await this.command("QUIT", [221]);
    await this.close();
  }

  async close(): Promise<void> {
    if (!this.socket) return;
    await new Promise<void>((resolve) => {
      this.socket!.once("close", () => resolve());
      this.socket!.end();
      setTimeout(resolve, 250);
    });
    this.socket = null;
  }

  private async command(command: string, expectedCodes: number[]): Promise<SmtpResponse> {
    if (!this.socket) throw new Error("SMTP socket is not connected");
    this.socket.write(`${command}\r\n`);
    return this.readResponse(expectedCodes);
  }

  private async readResponse(expectedCodes: number[]): Promise<SmtpResponse> {
    if (!this.socket) throw new Error("SMTP socket is not connected");
    const socket = this.socket;

    return new Promise<SmtpResponse>((resolve, reject) => {
      const timer = setTimeout(
        () => cleanup(reject, new Error("SMTP response timed out")),
        DEFAULT_TIMEOUT_MS
      );

      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        const parsed = this.tryParseResponse();
        if (!parsed) return;
        if (!expectedCodes.includes(parsed.code)) {
          cleanup(
            reject,
            new Error(`SMTP unexpected response ${parsed.code}: ${parsed.text}`)
          );
          return;
        }
        cleanup(resolve, parsed);
      };

      const onError = (err: Error) => cleanup(reject, err);

      const cleanup = <T>(cb: (value: T) => void, value: T) => {
        clearTimeout(timer);
        socket.off("data", onData);
        socket.off("error", onError);
        cb(value);
      };

      socket.on("data", onData);
      socket.once("error", onError);
    });
  }

  private tryParseResponse(): SmtpResponse | null {
    const lines = this.buffer.split(/\r?\n/);
    if (!this.buffer.endsWith("\n")) return null;

    const completeLines = lines.filter(Boolean);
    const last = completeLines.at(-1);
    const match = last?.match(/^(\d{3})\s/);
    if (!match) return null;

    this.buffer = "";
    return {
      code: Number(match[1]),
      text: completeLines.join("\n"),
    };
  }
}

function buildMimeMessage(input: SmtpSendInput & { from: string; messageId: string }): string {
  const from = formatAddress(input.from);
  const to = formatAddress(input.to, input.toName);
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    `Message-ID: ${input.messageId}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html || escapeHtml(input.text).replace(/\n/g, "<br />"),
  ].join("\r\n");
}

function formatAddress(emailOrAddress: string, name?: string): string {
  const email = extractEmail(emailOrAddress);
  if (!name) return `<${email}>`;
  return `${encodeHeader(name)} <${email}>`;
}

function extractEmail(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

function encodeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function hostnameForEhlo(): string {
  return "localhost";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
