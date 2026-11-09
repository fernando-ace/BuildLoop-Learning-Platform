import { afterEach, describe, expect, it, vi } from "vitest";
import { sameOrigin } from "./http";

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
});
