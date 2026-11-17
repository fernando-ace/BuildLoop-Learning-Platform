import "server-only";
import { createHash } from "node:crypto";
import { getPlatformPool } from "./database";

export type OperationLockResult<T> = { acquired: true; value: T } | { acquired: false };

/** Run work under a transaction-scoped PostgreSQL advisory lock shared across app instances. */
export async function withOperationLock<T>(key: string, operation: () => Promise<T>): Promise<OperationLockResult<T>> {
  if (typeof key !== "string" || key.length < 1 || key.length > 1_000) throw new Error("Invalid operation lock key.");
  const client = await getPlatformPool().connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const result = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired", [key]);
    if (!result.rows[0]?.acquired) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return { acquired: false };
    }
    const value = await operation();
    await client.query("COMMIT");
    transactionOpen = false;
    return { acquired: true, value };
  } catch (error) {
    if (transactionOpen) {
      try { await client.query("ROLLBACK"); } catch { /* The connection may already be closed. */ }
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Consume one fixed-window quota atomically, shared by all instances using the platform database. */
export async function consumeOperationLimit(key: string, limit: number, windowSeconds: number) {
  if (typeof key !== "string" || key.length < 1 || key.length > 1_000 || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("Invalid operation rate limit configuration.");
  }
  const storageKey = createHash("sha256").update(key).digest("hex");
  const result = await getPlatformPool().query<{ request_count: number; reset_at: Date | string }>(
    `INSERT INTO operation_rate_limits(key,window_started_at,request_count) VALUES($1,now(),1)
     ON CONFLICT(key) DO UPDATE SET
       window_started_at=CASE WHEN operation_rate_limits.window_started_at <= now()-($2 * interval '1 second') THEN now() ELSE operation_rate_limits.window_started_at END,
       request_count=CASE WHEN operation_rate_limits.window_started_at <= now()-($2 * interval '1 second') THEN 1 ELSE operation_rate_limits.request_count+1 END
     RETURNING request_count,window_started_at+($2 * interval '1 second') AS reset_at`,
    [storageKey, windowSeconds],
  );
  const row = result.rows[0];
  if (!row) throw new Error("The operation rate limit could not be checked.");
  const resetAt = new Date(row.reset_at).getTime();
  return { allowed: Number(row.request_count) <= limit, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) };
}

export async function operationLimitResponse(key: string, limit: number, windowSeconds: number, message: string): Promise<Response | null> {
  if (process.env.NODE_ENV !== "production" && process.env.BUILDLOOP_AUTH_MODE === "test") return null;
  try {
    const result = await consumeOperationLimit(key, limit, windowSeconds);
    if (result.allowed) return null;
    return Response.json({ error: message }, { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "This service is temporarily unavailable. Try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
