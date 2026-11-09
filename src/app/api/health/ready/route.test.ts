import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("@/lib/platform/database", () => ({ getPlatformPool: () => ({ query }) }));

import { GET } from "./route";

describe("readiness endpoint", () => {
  beforeEach(() => { query.mockReset(); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("BUILDLOOP_ENVIRONMENT", "test"); });

  it("returns ready only when PostgreSQL responds", async () => {
    query.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    const response = await GET(new Request("http://localhost/api/health/ready", { headers: { "x-request-id": "check-1" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("check-1");
    expect(await response.json()).toMatchObject({ status: "ready", checks: { database: "ok" }, environment: "test" });
  });

  it("returns a redacted 503 when PostgreSQL is unavailable", async () => {
    query.mockRejectedValue(new Error("postgres://secret:password@db.example/private"));
    const response = await GET(new Request("http://localhost/api/health/ready"));
    const body = await response.text();
    expect(response.status).toBe(503);
    expect(body).toContain('"database":"unavailable"');
    expect(body).not.toContain("password");
    expect(body).not.toContain("db.example");
  });
});
