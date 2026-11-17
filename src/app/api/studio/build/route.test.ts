import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { issueTestSession, testCookieName } from "@/lib/platform/session";
import { deterministicBuilder } from "@/lib/builder/provider";

const { consumeLimit, withLock, getApplication, saveVersion } = vi.hoisted(() => ({ consumeLimit: vi.fn(), withLock: vi.fn(), getApplication: vi.fn(), saveVersion: vi.fn() }));
getApplication.mockResolvedValue({ platform_role: "owner" });
withLock.mockImplementation(async (_key: string, operation: () => Promise<unknown>) => ({ acquired: true, value: await operation() }));
vi.mock("@/lib/platform/rate-limit", () => ({ consumeOperationLimit: consumeLimit, withOperationLock: withLock }));
vi.mock("@/lib/platform/repository", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/platform/repository")>(),
  getPlatformRepository: () => ({ getApplication, saveVersion }),
}));

const payload = { appId: "app_12345678-1234-1234-1234-123456789abc", project: { name: "Study tracker", user: "Students", problem: "They lose track of practice", why: "Study time matters", behavior: "Add a topic", constraints: "Phone friendly", inScope: ["Track a topic"], laterIdeas: ["Share with friends"] }, mode: "initial", version: 1, instruction: "Build a simple topic tracker", observations: [], feedback: [] };
function request(body: unknown, headers: Record<string, string> = {}, url = "http://localhost/api/studio/build") {
  vi.stubEnv("BUILDLOOP_AUTH_MODE", "test"); vi.stubEnv("BUILDLOOP_TEST_AUTH_SECRET", "unit-test-secret-with-at-least-32-characters");
  const cookie = `${testCookieName()}=${issueTestSession("test-owner")}`;
  return new Request(url, { method: "POST", headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json", cookie, ...headers }, body: JSON.stringify(body) });
}

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); consumeLimit.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 60 }); withLock.mockReset().mockImplementation(async (_key: string, operation: () => Promise<unknown>) => ({ acquired: true, value: await operation() })); getApplication.mockReset().mockResolvedValue({ platform_role: "owner" }); saveVersion.mockReset(); });

describe("Studio Builder route", () => {
  it("returns a deterministic valid artifact for a same-origin bounded request", async () => {
    vi.stubEnv("BUILDLOOP_BUILDER_MODE", "deterministic");
    const response = await POST(request(payload));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result).toMatchObject({ provider: "deterministic", attempts: 1, artifact: { format: "buildloop-app-v2" } });
  });

  it("rejects cross-origin and malformed requests before generation", async () => {
    vi.stubEnv("BUILDLOOP_BUILDER_MODE", "deterministic");
    expect((await POST(request(payload, { origin: "https://attacker.example" }))).status).toBe(403);
    expect((await POST(request({ ...payload, project: { ...payload.project, name: "x".repeat(81) } }))).status).toBe(400);
    expect((await POST(request({ ...payload, instruction: "x".repeat(1300) }))).status).toBe(400);
  });

  it("requires a trusted platform session before building", async () => {
    const unauthorized = new Request("http://localhost/api/studio/build", { method: "POST", headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(payload) });
    expect((await POST(unauthorized)).status).toBe(401);
  });

  it("rejects non-admin app members before invoking the Builder", async () => {
    vi.stubEnv("BUILDLOOP_BUILDER_MODE", "deterministic");
    getApplication.mockResolvedValueOnce({ platform_role: "member" });
    const generate = vi.spyOn(deterministicBuilder, "generate");

    const response = await POST(request(payload));

    expect(response.status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns a retryable response when another build is already running for the account", async () => {
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "preview");
    vi.stubEnv("BUILDLOOP_BUILDER_MODE", "deterministic");
    withLock.mockResolvedValueOnce({ acquired: false });
    const generate = vi.spyOn(deterministicBuilder, "generate");

    const response = await POST(request(payload));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(generate).not.toHaveBeenCalled();
  });

  it("bounds serialized request size", async () => {
    const response = await POST(request({ ...payload, observations: [{ happened: "x".repeat(25_000) }] }));
    expect(response.status).toBe(413);
    expect((await response.json()).error).toContain("too long");
  });

  it("returns a safe setup message when the real provider has no API key", async () => {
    vi.stubEnv("BUILDLOOP_BUILDER_MODE", "openai"); vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(request(payload));
    const result = await response.json();
    expect(response.status).toBe(503);
    expect(result.error).toContain("not configured");
    expect(JSON.stringify(result)).not.toContain("OPENAI_API_KEY");
  });

  it("uses the shared learner quota and returns a retry delay when exhausted", async () => {
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "preview");
    vi.stubEnv("BUILDLOOP_BUILDER_MODE", "openai"); vi.stubEnv("OPENAI_API_KEY", "");
    for (let i = 0; i < 5; i += 1) expect((await POST(request(payload))).status).toBe(503);
    consumeLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 23 });
    const response = await POST(request(payload));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("23");
    expect(consumeLimit).toHaveBeenCalledWith("builder:test-owner", 5, 60);
    expect(consumeLimit).toHaveBeenCalledWith("builder-daily:test-owner", 10, 86_400);
  });

  it("enforces a bounded shared daily account build quota", async () => {
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "preview");
    vi.stubEnv("BUILDLOOP_BUILDER_MODE", "openai"); vi.stubEnv("OPENAI_API_KEY", "");
    consumeLimit.mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 60 }).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 3600 });

    const response = await POST(request(payload));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3600");
    expect((await response.json()).error).toContain("today's build limit");
    expect(consumeLimit).toHaveBeenNthCalledWith(2, "builder-daily:test-owner", 10, 86_400);
  });

  it("fails closed when the configured daily build limit is invalid", async () => {
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "preview");
    vi.stubEnv("BUILDLOOP_BUILDER_DAILY_LIMIT", "101");
    const response = await POST(request(payload));
    expect(response.status).toBe(503);
  });

  it("keeps deterministic mode test-only and never lets it bypass hosted quotas", async () => {
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "production");
    vi.stubEnv("PUBLIC_APP_URL", "https://buildloop.example");
    vi.stubEnv("BUILDLOOP_BUILDER_MODE", "deterministic");
    const response = await POST(request(payload, { host: "buildloop.example", origin: "https://buildloop.example" }, "https://buildloop.example/api/studio/build"));
    expect(response.status).toBe(503);
    expect(consumeLimit).toHaveBeenCalledWith("builder:test-owner", 5, 60);
  });
});
