import "server-only";
import { randomUUID } from "node:crypto";
import { logEvent } from "./logger";
import { getPublicAppUrl } from "./config";

export interface InvitationEmail {
  recipient: string;
  accountName: string;
  inviterName: string;
  expiresAt: string;
  invitationUrl: string;
}

export type EmailDelivery = "sent" | "captured" | "not_configured" | "failed";

export interface AccountActionEmail {
  recipient: string;
  subject: string;
  introduction: string;
  actionLabel: string;
  actionUrl: string;
}

export interface OutboundEmail {
  recipient: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailTransport {
  send(message: OutboundEmail): Promise<EmailDelivery>;
}

const capturedEmails: OutboundEmail[] = [];
const maxCapturedEmails = 50;

/** In-memory transport for local development and tests. It never performs network I/O. */
export const captureEmailTransport: EmailTransport = {
  async send(message) {
    capturedEmails.push(structuredClone(message));
    if (capturedEmails.length > maxCapturedEmails) capturedEmails.shift();
    logEvent("info", "email.captured", { transport: "capture" });
    return "captured";
  },
};

export function getCapturedEmails(): readonly OutboundEmail[] {
  return structuredClone(capturedEmails);
}

export function clearCapturedEmails() {
  capturedEmails.length = 0;
}

export function createEmailSender(transport: EmailTransport) {
  return (message: OutboundEmail) => transport.send(message);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function renderInvitationEmail(invitation: InvitationEmail) {
  const plainAccountName = invitation.accountName.replace(/[\r\n]+/g, " ").slice(0, 80);
  const accountName = escapeHtml(plainAccountName);
  const inviterName = escapeHtml(invitation.inviterName);
  const link = escapeHtml(invitation.invitationUrl);
  const expires = escapeHtml(new Date(invitation.expiresAt).toUTCString());
  return {
    subject: `You're invited to ${plainAccountName} on BuildLoop`,
    text: `BuildLoop\n\n${invitation.inviterName} invited you to collaborate on ${invitation.accountName}.\n\nAccept the invitation: ${invitation.invitationUrl}\n\nThis link expires ${new Date(invitation.expiresAt).toUTCString()}. Sign in with the invited email address to accept.`,
    html: `<!doctype html><html><body><main><h1>BuildLoop</h1><p>${inviterName} invited you to collaborate on <strong>${accountName}</strong> in BuildLoop.</p><p><a href="${link}">Accept invitation</a></p><p>This link expires ${expires}. Sign in with the invited email address to accept.</p></main></body></html>`,
  };
}

export function renderAccountActionEmail(message: AccountActionEmail) {
  const introduction = escapeHtml(message.introduction);
  const actionLabel = escapeHtml(message.actionLabel);
  const actionUrl = escapeHtml(message.actionUrl);
  return {
    subject: message.subject.replace(/[\r\n]+/g, " ").slice(0, 120),
    text: `BuildLoop\n\n${message.introduction}\n\n${message.actionLabel}: ${message.actionUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<!doctype html><html><body><main><h1>BuildLoop</h1><p>${introduction}</p><p><a href="${actionUrl}">${actionLabel}</a></p><p>If you did not request this, you can ignore this email.</p></main></body></html>`,
  };
}

const resendEmailTransport: EmailTransport = {
  async send(message) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) return "not_configured";
    const idempotencyKey = randomUUID();
    const maxAttempts = 2;
    const requestTimeoutMs = 2_500;
    const maxRetryDelayMs = 3_000;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          signal: AbortSignal.timeout(requestTimeoutMs),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ from, to: [message.recipient], subject: message.subject, html: message.html, text: message.text }),
        });
      } catch {
        if (attempt < maxAttempts) {
          logEvent("warn", "email.delivery_retry", { provider: "resend", attempt, reason: "network_or_timeout" });
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }
        logEvent("warn", "email.delivery_failed", { provider: "resend", reason: "network_or_timeout" });
        return "failed";
      }

      if (response.ok) {
        logEvent("info", "email.delivered", { provider: "resend" });
        return "sent";
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < maxAttempts) {
        const retryAfter = response.headers.get("retry-after");
        const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter);
        const retryAfterDate = retryAfter === null || Number.isFinite(retryAfterSeconds) ? Number.NaN : Date.parse(retryAfter);
        const requestedDelayMs = Number.isFinite(retryAfterSeconds)
          ? Math.max(0, Math.ceil(retryAfterSeconds * 1_000))
          : Number.isFinite(retryAfterDate)
            ? Math.max(0, retryAfterDate - Date.now())
            : 200;

        if (requestedDelayMs <= maxRetryDelayMs) {
          logEvent("warn", "email.delivery_retry", { provider: "resend", attempt, status: response.status });
          await new Promise((resolve) => setTimeout(resolve, requestedDelayMs));
          continue;
        }
      }

      logEvent("warn", "email.delivery_failed", { provider: "resend", status: response.status });
      return "failed";
    }

    return "failed";
  },
};

function getEmailSender() {
  // Tests always capture, even when provider credentials are present. Local development
  // also captures by default; opting into a real provider requires an explicit setting.
  if (process.env.NODE_ENV === "production") return createEmailSender(resendEmailTransport);
  if (process.env.NODE_ENV === "test") return createEmailSender(captureEmailTransport);
  return createEmailSender(process.env.BUILDLOOP_EMAIL_TRANSPORT === "resend" ? resendEmailTransport : captureEmailTransport);
}

function deliver(recipient: string, rendered: { subject: string; html: string; text: string }): Promise<EmailDelivery> {
  return getEmailSender()({ recipient, ...rendered });
}

export async function sendAccountActionEmail(message: AccountActionEmail) {
  let actionOrigin: string;
  try { actionOrigin = new URL(message.actionUrl).origin; } catch { return "failed" as const; }
  if (actionOrigin !== getPublicAppUrl()) return "failed" as const;
  const result = await deliver(message.recipient, renderAccountActionEmail(message));
  return result;
}

export async function sendRequiredAccountActionEmail(message: AccountActionEmail) {
  const result = await sendAccountActionEmail(message);
  if (result !== "sent" && result !== "captured") throw new Error("BuildLoop could not deliver the account email. Try again later.");
}

export async function sendInvitationEmail(invitation: InvitationEmail): Promise<EmailDelivery> {
  const rendered = renderInvitationEmail(invitation);
  return deliver(invitation.recipient, rendered);
}
