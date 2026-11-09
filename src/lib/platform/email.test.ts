import { afterEach, describe, expect, it, vi } from "vitest";
import { renderInvitationEmail, sendInvitationEmail } from "./email";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const invitation = { recipient: "learner@example.test", accountName: "Ari & Co", inviterName: "Ari <admin>", expiresAt: "2027-01-01T00:00:00.000Z", invitationUrl: "https://buildloop.example/invite/random-token" };

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
    vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("EMAIL_FROM", "");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await sendInvitationEmail(invitation)).toBe("not_configured");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends through Resend and reports provider failure without leaking details", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key"); vi.stubEnv("EMAIL_FROM", "BuildLoop <invites@example.test>");
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }); vi.stubGlobal("fetch", fetch);
    expect(await sendInvitationEmail(invitation)).toBe("sent");
    const request = fetch.mock.calls[0][1] as RequestInit;
    expect((request.headers as Record<string, string>).Authorization).toBe("Bearer test-resend-key");
    expect(String(request.body)).toContain("learner@example.test");
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    expect(await sendInvitationEmail(invitation)).toBe("failed");
  });
});
