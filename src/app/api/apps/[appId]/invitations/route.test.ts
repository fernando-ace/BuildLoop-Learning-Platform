import { afterEach, describe, expect, it, vi } from "vitest";
import { issueTestSession, testCookieName } from "@/lib/platform/session";

const { createInvitation, resendInvitation, sendInvitationEmail } = vi.hoisted(() => ({ createInvitation: vi.fn(), resendInvitation: vi.fn(), sendInvitationEmail: vi.fn() }));
vi.mock("@/lib/platform/repository", () => ({ getPlatformRepository: () => ({ createInvitation, resendInvitation }) }));
vi.mock("@/lib/platform/email", () => ({ sendInvitationEmail }));

import { PATCH, POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  createInvitation.mockReset(); resendInvitation.mockReset(); sendInvitationEmail.mockReset();
});

function request(body: unknown) {
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("BUILDLOOP_ENVIRONMENT", "test");
  vi.stubEnv("BUILDLOOP_AUTH_MODE", "test"); vi.stubEnv("BUILDLOOP_TEST_AUTH_SECRET", "unit-test-secret-with-at-least-32-characters");
  vi.stubEnv("PUBLIC_APP_URL", "https://buildloop.example");
  const cookie = `${testCookieName()}=${issueTestSession("test-owner")}`;
  return new Request("https://internal-host.invalid/api/apps/app_test/invitations", { method: "POST", headers: { origin: "https://buildloop.example", host: "untrusted-host.invalid", cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
}

const context = { params: Promise.resolve({ appId: "app_12345678-1234-1234-1234-123456789abc" }) };

describe("invitation routes", () => {
  it("uses configured public origin and keeps invite usable when email is not configured", async () => {
    createInvitation.mockResolvedValue({ id: "invite-1", token: "random-token", expiresAt: "2027-01-01T00:00:00.000Z", accountName: "Workspace" });
    sendInvitationEmail.mockResolvedValue("not_configured");
    const response = await POST(request({ appRole: "member", email: "person@example.test" }), context);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ invitation: { url: "https://buildloop.example/invite/random-token" }, delivery: "not_configured" });
    expect(sendInvitationEmail).toHaveBeenCalledWith(expect.objectContaining({ recipient: "person@example.test", invitationUrl: "https://buildloop.example/invite/random-token" }));
  });

  it("rotates links on resend and reports delivery failure without invalidating the invitation record", async () => {
    resendInvitation.mockResolvedValue({ id: "invite-1", token: "replacement-token", email: "person@example.test", accountName: "Workspace", expiresAt: "2027-01-08T00:00:00.000Z" });
    sendInvitationEmail.mockResolvedValue("failed");
    const response = await PATCH(request({ invitationId: "invite-1" }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ invitation: { url: "https://buildloop.example/invite/replacement-token" }, delivery: "failed" });
  });
});
