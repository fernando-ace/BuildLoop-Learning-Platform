import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCapturedEmails, createEmailSender, getCapturedEmails, renderInvitationEmail, sendInvitationEmail, sendRequiredAccountActionEmail, type OutboundEmail } from "./email";

afterEach(() => { clearCapturedEmails(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const invitation = { recipient: "learner@example.test", accountName: "Ari & Co", inviterName: "Ari <admin>", expiresAt: "2027-01-01T00:00:00.000Z", invitationUrl: "https://buildloop.example/invite/random-token" };
const accountAction = { recipient: "learner@example.test", subject: "Verify your BuildLoop email", introduction: "Confirm your email address.", actionLabel: "Verify email", actionUrl: "http://localhost:3000/verify?token=secret" };

describe("invitation email", () => {
  it("renders a clear text and escaped HTML invitation", () => {
    const rendered = renderInvitationEmail(invitation);
    expect(rendered.subject).toContain("Ari & Co");
    expect(rendered.text).toContain(invitation.invitationUrl);
    expect(rendered.text).toContain("invited email address");
    expect(rendered.html).toContain("Ari &amp; Co");
    expect(rendered.html).toContain("Ari &lt;admin&gt;");
    expect(rendered.html).not.toContain("Ari <admin>");
  });

  it("keeps copied-link flow available when provider credentials are absent", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("EMAIL_FROM", "");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await sendInvitationEmail(invitation)).toBe("not_configured");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends through Resend and reports provider failure without leaking details", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BUILDLOOP_EMAIL_TRANSPORT", "capture");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key"); vi.stubEnv("EMAIL_FROM", "BuildLoop <invites@example.test>");
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }); vi.stubGlobal("fetch", fetch);
    expect(await sendInvitationEmail(invitation)).toBe("sent");
    const request = fetch.mock.calls[0][1] as RequestInit;
    expect((request.headers as Record<string, string>).Authorization).toBe("Bearer test-resend-key");
    expect(String(request.body)).toContain("learner@example.test");
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    expect(await sendInvitationEmail(invitation)).toBe("failed");
  });

  it("fails required account actions when email is unconfigured or the provider rejects delivery", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("EMAIL_FROM", "");
    await expect(sendRequiredAccountActionEmail(accountAction)).rejects.toThrow("could not deliver the account email");

    vi.stubEnv("RESEND_API_KEY", "test-resend-key"); vi.stubEnv("EMAIL_FROM", "BuildLoop <invites@example.test>");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(sendRequiredAccountActionEmail(accountAction)).rejects.toThrow("could not deliver the account email");
  });

  it("captures development and test messages without network access, even when Resend is configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BUILDLOOP_EMAIL_TRANSPORT", "");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("EMAIL_FROM", "BuildLoop <invites@example.test>");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    expect(await sendInvitationEmail(invitation)).toBe("captured");
    expect(getCapturedEmails()).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();

    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BUILDLOOP_EMAIL_TRANSPORT", "resend");
    vi.stubEnv("PUBLIC_APP_URL", "http://localhost:3000");

    expect(await sendInvitationEmail(invitation)).toBe("captured");
    await expect(sendRequiredAccountActionEmail(accountAction)).resolves.toBeUndefined();

    expect(getCapturedEmails()).toEqual([
      expect.objectContaining({ recipient: invitation.recipient, subject: expect.stringContaining("Ari & Co"), text: expect.stringContaining(invitation.invitationUrl) }),
      expect.objectContaining({ recipient: invitation.recipient, subject: expect.stringContaining("Ari & Co"), text: expect.stringContaining(invitation.invitationUrl) }),
      expect.objectContaining({ recipient: accountAction.recipient, subject: accountAction.subject, text: expect.stringContaining(accountAction.actionUrl) }),
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("routes messages through an injected transport", async () => {
    const message: OutboundEmail = { recipient: "learner@example.test", subject: "Hello", html: "<p>Hello</p>", text: "Hello" };
    const transport = { send: vi.fn().mockResolvedValue("captured" as const) };
    const send = createEmailSender(transport);

    await expect(send(message)).resolves.toBe("captured");
    expect(transport.send).toHaveBeenCalledWith(message);
  });
});
