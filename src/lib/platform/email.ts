import "server-only";
import { logEvent } from "./logger";
import { getPublicAppUrl } from "./config";

export interface InvitationEmail {
  recipient: string;
  accountName: string;
  inviterName: string;
  expiresAt: string;
  invitationUrl: string;
}

export type EmailDelivery = "sent" | "not_configured" | "failed";

export interface AccountActionEmail {
  recipient: string;
  subject: string;
  introduction: string;
  actionLabel: string;
  actionUrl: string;
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

async function deliver(recipient: string, rendered: { subject: string; html: string; text: string }): Promise<EmailDelivery> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return "not_configured";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [recipient], ...rendered }),
    });
    if (!response.ok) {
      logEvent("warn", "email.delivery_failed", { provider: "resend", status: response.status });
      return "failed";
    }
    logEvent("info", "email.delivered", { provider: "resend" });
    return "sent";
  } catch {
    logEvent("warn", "email.delivery_failed", { provider: "resend", reason: "network_or_timeout" });
    return "failed";
  }
}

export async function sendAccountActionEmail(message: AccountActionEmail) {
  let actionOrigin: string;
  try { actionOrigin = new URL(message.actionUrl).origin; } catch { return "failed" as const; }
  if (actionOrigin !== getPublicAppUrl()) return "failed" as const;
  const result = await deliver(message.recipient, renderAccountActionEmail(message));
  return result;
}

export async function sendInvitationEmail(invitation: InvitationEmail): Promise<EmailDelivery> {
  const rendered = renderInvitationEmail(invitation);
  return deliver(invitation.recipient, rendered);
}
