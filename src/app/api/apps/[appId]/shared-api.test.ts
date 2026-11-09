import { afterEach, describe, expect, it, vi } from "vitest";
import { issueTestSession, testCookieName } from "@/lib/platform/session";
import { GET as loadApp, POST as mutate } from "./route";

const context = { params: Promise.resolve({ appId: "app_12345678-1234-1234-1234-123456789abc" }) };

afterEach(() => vi.unstubAllEnvs());

describe("published app HTTP boundary", () => {
  it("does not treat the old demo persona cookie or request roles as platform identity", async () => {
    const cookie = "buildloop_identity_old-demo-app=forged.signed.value";
    const forged = await mutate(new Request("http://localhost/api/apps/app/mutations", { method: "POST", headers: { origin: "http://localhost", host: "localhost", cookie, "content-type": "application/json" }, body: JSON.stringify({ versionId: "v1", user: { id: "vol_coordinator", roles: ["coordinator"] }, operation: { type: "delete", collection: "registrations", recordId: "registration_ada" } }) }), context);
    expect(forged.status).toBe(401);
  });

  it("requires an authenticated member to read a shared app", async () => {
    const response = await loadApp(new Request("http://localhost/api/apps/app_12345678-1234-1234-1234-123456789abc"), context);
    expect(response.status).toBe(401);
  });

  it("rejects cross-site mutations before reading the body or database", async () => {
    const response = await mutate(new Request("http://localhost/api/apps/app/mutations", { method: "POST", headers: { host: "localhost", "content-type": "application/json" }, body: "{}" }), context);
    expect(response.status).toBe(403);
  });

  it("rejects oversized authenticated mutation bodies before database access", async () => {
    vi.stubEnv("BUILDLOOP_AUTH_MODE", "test");
    vi.stubEnv("BUILDLOOP_TEST_AUTH_SECRET", "shared-api-test-secret-with-at-least-32-characters");
    const session = issueTestSession("test-owner");
    const response = await mutate(new Request("http://localhost/api/apps/app/mutations", {
      method: "POST",
      headers: { origin: "http://localhost", host: "localhost", cookie: `${testCookieName()}=${session}`, "content-type": "application/json" },
      body: JSON.stringify({ versionId: "v1", operation: { type: "update", collection: "records", recordId: "record-1", values: { notes: "x".repeat(65_000) } } }),
    }), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid" });
  });
});
