import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { query, clientQuery, release } = vi.hoisted(() => ({ query: vi.fn(), clientQuery: vi.fn(), release: vi.fn() }));
vi.mock("./database", () => ({ getPlatformPool: () => ({ query, connect: async () => ({ query: clientQuery, release }) }) }));

import { consumeOperationLimit, operationLimitResponse, withOperationLock } from "./rate-limit";

describe("shared operation rate limits", () => {
  beforeEach(() => { query.mockReset(); clientQuery.mockReset(); release.mockReset(); });
  afterEach(() => vi.unstubAllEnvs());

  it("consumes a fixed-window quota with one atomic PostgreSQL upsert", async () => {
    query.mockResolvedValueOnce({ rows: [{ request_count: 4, reset_at: new Date(Date.now() + 20_000) }] });
    const result = await consumeOperationLimit("builder:user-1", 5, 60);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).toContain("ON CONFLICT(key) DO UPDATE");
    expect(query.mock.calls[0][1][0]).toMatch(/^[a-f0-9]{64}$/);
    expect(query.mock.calls[0][1][1]).toBe(60);
  });

  it("reports exhausted limits and bounds configuration", async () => {
    query.mockResolvedValueOnce({ rows: [{ request_count: 6, reset_at: new Date(Date.now() + 20_000) }] });
    await expect(consumeOperationLimit("builder:user-1", 5, 60)).resolves.toMatchObject({ allowed: false });
    await expect(consumeOperationLimit("x".repeat(1_001), 5, 60)).rejects.toThrow("Invalid operation rate limit configuration");
  });

  it("returns a retryable response for exhausted quotas and fails closed if PostgreSQL is unavailable", async () => {
    query.mockResolvedValueOnce({ rows: [{ request_count: 6, reset_at: new Date(Date.now() + 20_000) }] });
    const limited = await operationLimitResponse("app-create:user-1", 5, 60, "Try later.");
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("retry-after")).toBeTruthy();
    query.mockRejectedValueOnce(new Error("private database detail"));
    const unavailable = await operationLimitResponse("app-create:user-1", 5, 60, "Try later.");
    expect(unavailable?.status).toBe(503);
    expect(await unavailable?.text()).not.toContain("private database detail");
  });

  it("bypasses persisted quotas only for explicitly enabled non-production test auth", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BUILDLOOP_AUTH_MODE", "test");
    expect(await operationLimitResponse("app-create:user-1", 5, 60, "Try later.")).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("holds the shared account lock only around the operation", async () => {
    clientQuery.mockResolvedValue({ rows: [{ acquired: true }] });
    const operation = vi.fn().mockResolvedValue("built");
    await expect(withOperationLock("builder:user-1", operation)).resolves.toEqual({ acquired: true, value: "built" });
    expect(operation).toHaveBeenCalledOnce();
    expect(clientQuery.mock.calls.map(([sql]) => sql)).toEqual(["BEGIN", expect.stringContaining("pg_try_advisory_xact_lock"), "COMMIT"]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("skips a concurrent operation and rolls back its transaction", async () => {
    clientQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ acquired: false }] }).mockResolvedValueOnce({ rows: [] });
    const operation = vi.fn();
    await expect(withOperationLock("builder:user-1", operation)).resolves.toEqual({ acquired: false });
    expect(operation).not.toHaveBeenCalled();
    expect(clientQuery).toHaveBeenLastCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases the lock when the operation fails", async () => {
    clientQuery.mockResolvedValue({ rows: [{ acquired: true }] });
    const operation = vi.fn().mockRejectedValue(new Error("provider failed"));
    await expect(withOperationLock("builder:user-1", operation)).rejects.toThrow("provider failed");
    expect(clientQuery).toHaveBeenLastCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });
});
