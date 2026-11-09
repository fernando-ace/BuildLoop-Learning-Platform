import "server-only";
import { createHash } from "node:crypto";
import { getPlatformPool } from "./database";

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
