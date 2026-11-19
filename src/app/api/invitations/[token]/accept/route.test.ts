import { afterEach, describe, expect, it, vi } from "vitest";
import { issueTestSession, testCookieName } from "@/lib/platform/session";

const { acceptInvitation, PlatformError } = vi.hoisted(() => ({
  acceptInvitation: vi.fn(),
  PlatformError: class extends Error {
    constructor(readonly code: "unauthenticated" | "not_found" | "forbidden" | "conflict" | "invalid" | "unavailable", message: string) { super(message); }
  },
}));

vi.mock("@/lib/platform/repository", () => ({
  getPlatformRepository: () => ({ acceptInvitation }),
  PlatformError,
}));

import { POST } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  acceptInvitation.mockReset();
});

function request(token: string) {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("BUILDLOOP_ENVIRONMENT", "test");
  vi.stubEnv("BUILDLOOP_AUTH_MODE", "test");
  vi.stubEnv("BUILDLOOP_TEST_AUTH_SECRET", "unit-test-secret-with-at-least-32-characters");
  vi.stubEnv("PUBLIC_APP_URL", "https://buildloop.example");
  const cookie = `${testCookieName()}=${issueTestSession("e2e-owner-0123456789abcdef")}`;
  return new Request(`https://internal-host.invalid/api/invitations/${token}/accept`, {
    method: "POST",
    headers: { origin: "https://buildloop.example", host: "internal-host.invalid", cookie, "x-request-id": "invite-accept-test-42" },
  });
}

describe("invitation acceptance diagnostics", () => {
  it("logs a safe rejection code and request ID without recording the invitation token", async () => {
    const token = "private-invitation-token";
    acceptInvitation.mockRejectedValue(new PlatformError("not_found", "That invitation is unavailable."));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await POST(request(token), { params: Promise.resolve({ token }) });

    expect(response.status).toBe(404);
    const records = warn.mock.calls.map(([record]) => String(record));
    expect(records.join("\n")).not.toContain(token);
    expect(records.some((record) => record.includes('"event":"invitation.accept_rejected"') && record.includes('"requestId":"invite-accept-test-42"') && record.includes('"code":"not_found"'))).toBe(true);
  });

  it("logs unexpected acceptance failures by error type only", async () => {
    acceptInvitation.mockRejectedValue(new TypeError("private database details"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(request("private-invitation-token"), { params: Promise.resolve({ token: "private-invitation-token" }) });

    expect(response.status).toBe(500);
    const records = error.mock.calls.map(([record]) => String(record));
    expect(records.join("\n")).not.toContain("private database details");
    expect(records.join("\n")).not.toContain("private-invitation-token");
    expect(records.some((record) => record.includes('"event":"invitation.accept_failed"') && record.includes('"errorType":"TypeError"') && record.includes('"requestId":"invite-accept-test-42"'))).toBe(true);
  });
});
