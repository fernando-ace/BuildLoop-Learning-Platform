import { afterEach, describe, expect, it, vi } from "vitest";
import { getPlatformIdentity, getTestIdentity, issueTestSession, testCookieName } from "./session";

afterEach(() => vi.unstubAllEnvs());

function request(token: string) {
  return new Request("http://localhost/api/session", { headers: { cookie: `${testCookieName()}=${token}` } });
}

describe("platform identity boundary", () => {
  it("resolves only signed deterministic users in the explicit test adapter", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BUILDLOOP_AUTH_MODE", "test");
    vi.stubEnv("BUILDLOOP_TEST_AUTH_SECRET", "unit-test-secret-with-at-least-32-characters");
    const token = issueTestSession("test-owner");
    expect(await getPlatformIdentity(request(token))).toMatchObject({ id: "test-owner", email: "owner@example.test" });
    expect(await getPlatformIdentity(request(`${token}x`))).toBeNull();
  });

  it("does not accept a test cookie when the test adapter is disabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BUILDLOOP_AUTH_MODE", "");
    vi.stubEnv("BUILDLOOP_TEST_AUTH_SECRET", "unit-test-secret-with-at-least-32-characters");
    expect(getTestIdentity(request("test-owner.9999999999999.invalid"))).toBeNull();
  });

  it("rejects unknown or tampered user identities", () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("BUILDLOOP_AUTH_MODE", "test"); vi.stubEnv("BUILDLOOP_TEST_AUTH_SECRET", "unit-test-secret-with-at-least-32-characters");
    const valid = issueTestSession("test-collaborator");
    const [userId, expiry, signature] = valid.split(".");
    expect(getTestIdentity(request(`test-admin.${expiry}.${signature}`))).toBeNull();
    expect(getTestIdentity(request(`${userId}.${expiry}.not-a-signature`))).toBeNull();
  });
});
