import { getReleaseMetadata } from "@/lib/platform/config";
import { getPlatformPool } from "@/lib/platform/database";
import { logEvent, requestId } from "@/lib/platform/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = requestId(request);
  const started = Date.now();
  let database: "ok" | "unavailable" = "ok";
  try {
    await getPlatformPool().query("select 1");
  } catch {
    database = "unavailable";
    logEvent("error", "health.database_unavailable", { requestId: id });
  }
  const status = database === "ok" ? "ready" : "not_ready";
  logEvent(database === "ok" ? "info" : "warn", "health.readiness", { requestId: id, result: status, durationMs: Date.now() - started });
  return Response.json({ status, timestamp: new Date().toISOString(), ...getReleaseMetadata(), checks: { database } }, { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Request-Id": id } });
}
