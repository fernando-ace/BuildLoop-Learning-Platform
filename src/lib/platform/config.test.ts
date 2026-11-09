import { afterEach, describe, expect, it, vi } from "vitest";
import { getBuildLoopEnvironment, getPublicAppUrl, getReleaseMetadata } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("deployment configuration", () => {
  it("uses explicit deployment environment and Vercel metadata", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "preview");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123");
    expect(getBuildLoopEnvironment()).toBe("preview");
    expect(getReleaseMetadata()).toMatchObject({ environment: "preview", release: "abc123" });
  });

  it("rejects environment mismatch and insecure production origins", () => {
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "preview");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => getBuildLoopEnvironment()).toThrow("must match VERCEL_ENV");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "production");
    vi.stubEnv("PUBLIC_APP_URL", "http://buildloop.example");
    expect(() => getPublicAppUrl()).toThrow("must use HTTPS");
  });

  it("accepts only an origin for configured public URLs", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "test");
    vi.stubEnv("PUBLIC_APP_URL", "http://localhost:3000");
    expect(getPublicAppUrl()).toBe("http://localhost:3000");
    vi.stubEnv("PUBLIC_APP_URL", "http://localhost:3000/redirect");
    expect(() => getPublicAppUrl()).toThrow("must be an origin");
  });
});
