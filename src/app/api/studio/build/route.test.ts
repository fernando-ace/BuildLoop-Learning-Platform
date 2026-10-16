import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { issueTestSession, testCookieName } from "@/lib/platform/session";

const payload = { appId: "app_12345678-1234-1234-1234-123456789abc", project: { name: "Study tracker", user: "Students", problem: "They lose track of practice", why: "Study time matters", behavior: "Add a topic", constraints: "Phone friendly", inScope: ["Track a topic"], laterIdeas: ["Share with friends"] }, mode: "initial", version: 1, instruction: "Build a simple topic tracker", observations: [], feedback: [] };
function request(body: unknown, headers: Record<string, string> = {}) {
  vi.stubEnv("BUILDLOOP_AUTH_MODE", "test"); vi.stubEnv("BUILDLOOP_TEST_AUTH_SECRET", "unit-test-secret-with-at-least-32-characters");
  const cookie = `${testCookieName()}=${issueTestSession("test-owner")}`;
  return new Request("http://localhost/api/studio/build", { method: "POST", headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json", cookie, ...headers }, body: JSON.stringify(body) });
}

afterEach(() => vi.unstubAllEnvs());

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

  it("limits repeated builds in one server process", async () => {
    vi.stubEnv("BUILDLOOP_BUILDER_MODE", "openai"); vi.stubEnv("OPENAI_API_KEY", "");
    const headers = { "x-forwarded-for": "192.0.2.5, 203.0.113.250" };
    for (let i = 0; i < 5; i += 1) expect((await POST(request(payload, headers))).status).toBe(503);
    expect((await POST(request(payload, headers))).status).toBe(429);
  });
});
