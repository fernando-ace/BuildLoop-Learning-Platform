import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("@/lib/platform/database", () => ({ getPlatformPool: () => ({ query }) }));

import { GET } from "./route";

describe("readiness endpoint", () => {
  beforeEach(() => {
    query.mockReset();
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("BUILDLOOP_ENVIRONMENT", "test");
    for (const name of ["BETTER_AUTH_SECRET", "PUBLIC_APP_URL", "BETTER_AUTH_URL", "RESEND_API_KEY", "EMAIL_FROM", "OPENAI_API_KEY", "SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"]) vi.stubEnv(name, "");
  });

  it("returns ready only when PostgreSQL responds", async () => {
    query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }).mockResolvedValueOnce({ rows: [{ table_name: "drizzle.__drizzle_migrations" }] }).mockResolvedValueOnce({ rows: [{ last_migration: "1794209352358" }] });
    const response = await GET(new Request("http://localhost/api/health/ready", { headers: { "x-request-id": "check-1" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("check-1");
    expect(await response.json()).toMatchObject({ status: "ready", checks: { database: "ok", migrationJournal: "current", authentication: "not_required", email: "not_required", builder: "not_required", monitoring: "not_required" }, environment: "test" });
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

  it("returns not ready when the database exists but migrations were never applied", async () => {
    query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }).mockResolvedValueOnce({ rows: [{ table_name: null }] });
    const response = await GET(new Request("http://localhost/api/health/ready"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "not_ready", checks: { database: "ok", migrationJournal: "unavailable" } });
  });

  it("returns not ready when the database migration journal is behind this release", async () => {
    query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }).mockResolvedValueOnce({ rows: [{ table_name: "drizzle.__drizzle_migrations" }] }).mockResolvedValueOnce({ rows: [{ last_migration: "1794208823451" }] });
    const response = await GET(new Request("http://localhost/api/health/ready"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "not_ready", checks: { database: "ok", migrationJournal: "behind" } });
  });

  it("reports missing hosted integrations without exposing configuration values", async () => {
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "preview");
    vi.stubEnv("BETTER_AUTH_SECRET", "short-secret");
    vi.stubEnv("PUBLIC_APP_URL", "https://preview.example.test");
    vi.stubEnv("OPENAI_API_KEY", "private-openai-key");
    query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }).mockResolvedValueOnce({ rows: [{ table_name: "drizzle.__drizzle_migrations" }] }).mockResolvedValueOnce({ rows: [{ last_migration: "1794209352358" }] });
    const response = await GET(new Request("https://preview.example.test/api/health/ready"));
    const body = await response.text();
    expect(response.status).toBe(503);
    expect(body).toContain('"authentication":"unavailable"');
    expect(body).toContain('"email":"unavailable"');
    expect(body).toContain('"builder":"configured"');
    expect(body).toContain('"monitoring":"unavailable"');
    expect(body).not.toContain("private-openai-key");
    expect(body).not.toContain("short-secret");
  });

  it("returns ready in hosted environments when required services are configured", async () => {
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(40));
    vi.stubEnv("PUBLIC_APP_URL", "https://buildloop.example.test");
    vi.stubEnv("BETTER_AUTH_URL", "https://buildloop.example.test");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("EMAIL_FROM", "BuildLoop <hello@example.test>");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("SENTRY_DSN", "https://server@example.test/1");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://client@example.test/2");
    query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }).mockResolvedValueOnce({ rows: [{ table_name: "drizzle.__drizzle_migrations" }] }).mockResolvedValueOnce({ rows: [{ last_migration: "1794209352358" }] });
    const response = await GET(new Request("https://buildloop.example.test/api/health/ready"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ready", checks: { database: "ok", migrationJournal: "current", authentication: "configured", email: "configured", builder: "configured", monitoring: "configured" } });
  });
});
