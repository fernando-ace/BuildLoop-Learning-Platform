import { afterEach, describe, expect, it, vi } from "vitest";
import { responseForPlatformError, sameOrigin } from "./http";
import { PlatformError } from "./repository";

afterEach(() => vi.unstubAllEnvs());

describe("mutation origin check", () => {
  it("requires an Origin matching the configured app origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "production");
    vi.stubEnv("PUBLIC_APP_URL", "https://buildloop.example");
    expect(sameOrigin(new Request("https://internal.invalid/api/apps", { headers: { origin: "https://buildloop.example", host: "attacker.invalid" } }))).toBe(true);
    expect(sameOrigin(new Request("https://buildloop.example/api/apps", { headers: { origin: "https://attacker.invalid", host: "buildloop.example" } }))).toBe(false);
    expect(sameOrigin(new Request("https://buildloop.example/api/apps", { headers: { origin: "http://buildloop.example", host: "buildloop.example" } }))).toBe(false);
  });

  it("rejects absent Origin headers", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(sameOrigin(new Request("http://localhost:3000/api/apps"))).toBe(false);
  });

  it("returns the validated request ID with platform failures for support correlation", async () => {
    const request = new Request("http://localhost:3000/api/apps", { headers: { "x-request-id": "client-trace-42" } });
    const response = responseForPlatformError(new PlatformError("unauthenticated", "Sign in to continue."), request);
    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBe("client-trace-42");
    expect(await response.json()).toMatchObject({ requestId: "client-trace-42", code: "unauthenticated" });
  });
});
