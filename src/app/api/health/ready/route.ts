import { getHostedReadinessChecks, getReleaseMetadata } from "@/lib/platform/config";
import { getPlatformPool } from "@/lib/platform/database";
import { logEvent, requestId } from "@/lib/platform/logger";
import migrationJournal from "@/lib/platform/schema-migrations/meta/_journal.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = requestId(request);
  const started = Date.now();
  let database: "ok" | "unavailable" = "ok";
  let migrationStatus: "current" | "behind" | "unavailable" = "current";
  const hosted = getHostedReadinessChecks();
  try {
    await getPlatformPool().query("select 1");
    const migrationTable = await getPlatformPool().query<{ table_name: string | null }>("select to_regclass('drizzle.__drizzle_migrations')::text as table_name");
    if (!migrationTable.rows[0]?.table_name) {
      migrationStatus = "unavailable";
    } else {
      const latestApplied = await getPlatformPool().query<{ last_migration: string }>("select coalesce(max(created_at), 0)::text as last_migration from drizzle.__drizzle_migrations");
      const expectedLatest = migrationJournal.entries.at(-1)?.when;
      if (!expectedLatest || Number(latestApplied.rows[0]?.last_migration ?? 0) < expectedLatest) migrationStatus = "behind";
    }
  } catch {
    database = "unavailable";
    logEvent("error", "health.database_unavailable", { requestId: id });
  }
  if (migrationStatus !== "current") logEvent("error", "health.migration_journal_not_current", { requestId: id, migrationStatus });
  const requiredHostedChecks = getReleaseMetadata().environment === "production" ? Object.entries(hosted) : [["authentication", hosted.authentication] as const];
  const missingHostedChecks = requiredHostedChecks.filter(([, result]) => result === "unavailable").map(([name]) => name);
  const ready = database === "ok" && migrationStatus === "current" && missingHostedChecks.length === 0;
  const status = ready ? "ready" : "not_ready";
  logEvent(ready ? "info" : "warn", "health.readiness", { requestId: id, result: status, durationMs: Date.now() - started, unavailableHostedChecks: missingHostedChecks.join(",") });
  return Response.json({ status, timestamp: new Date().toISOString(), ...getReleaseMetadata(), checks: { database, migrationJournal: migrationStatus, ...hosted } }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Request-Id": id } });
}
