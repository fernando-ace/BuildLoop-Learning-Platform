import { afterEach, describe, expect, it, vi } from "vitest";

const { captureMessage, flush } = vi.hoisted(() => ({ captureMessage: vi.fn(), flush: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureMessage, flush }));

import { POST } from "./route";

afterEach(() => vi.unstubAllEnvs());

function request() { return new Request("http://localhost:3000/api/monitoring/test", { method: "POST", headers: { origin: "http://localhost:3000" } }); }

describe("monitoring verification endpoint", () => {
  it("is unavailable unless explicitly enabled in a local test environment", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("BUILDLOOP_MONITORING_TEST", "1"); vi.stubEnv("SENTRY_DSN", "https://public@example.ingest.sentry.io/1");
    expect((await POST(request())).status).toBe(404);
  });

  it("sends a fixed test event only when configured and enabled", async () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("BUILDLOOP_ENVIRONMENT", "test"); vi.stubEnv("BUILDLOOP_MONITORING_TEST", "1"); vi.stubEnv("SENTRY_DSN", "https://public@example.ingest.sentry.io/1");
    flush.mockResolvedValue(true);
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(captureMessage).toHaveBeenCalledWith("BuildLoop monitoring verification event", expect.objectContaining({ tags: { operation: "monitoring.test" } }));
    expect(flush).toHaveBeenCalledWith(2_000);
  });

  it("reports unconfigured monitoring without sending an event", async () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("BUILDLOOP_MONITORING_TEST", "1"); vi.stubEnv("SENTRY_DSN", "");
    expect((await POST(request())).status).toBe(503);
  });
});
