import { getReleaseMetadata } from "@/lib/platform/config";
import { getPlatformPool } from "@/lib/platform/database";
import { logEvent, requestId } from "@/lib/platform/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = requestId(request);
  const started = Date.now();
  let database: "ok" | "unavailable" = "ok";
  let migrationJournal: "available" | "unavailable" = "available";
  try {
    await getPlatformPool().query("select 1");
    const migrationTable = await getPlatformPool().query<{ table_name: string | null }>("select to_regclass('drizzle.__drizzle_migrations')::text as table_name");
    if (!migrationTable.rows[0]?.table_name) migrationJournal = "unavailable";
  } catch {
    database = "unavailable";
    logEvent("error", "health.database_unavailable", { requestId: id });
  }
  if (migrationJournal === "unavailable") logEvent("error", "health.migration_journal_unavailable", { requestId: id });
  const ready = database === "ok" && migrationJournal === "available";
  const status = ready ? "ready" : "not_ready";
  logEvent(ready ? "info" : "warn", "health.readiness", { requestId: id, result: status, durationMs: Date.now() - started });
  return Response.json({ status, timestamp: new Date().toISOString(), ...getReleaseMetadata(), checks: { database, migrationJournal } }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Request-Id": id } });
}
