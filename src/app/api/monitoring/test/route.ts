import * as Sentry from "@sentry/nextjs";
import { sameOrigin } from "@/lib/platform/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") return Response.json({ error: "Not found." }, { status: 404 });
  if (process.env.BUILDLOOP_MONITORING_TEST !== "1") return Response.json({ error: "Monitoring test event is disabled." }, { status: 404 });
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  if (!process.env.SENTRY_DSN) return Response.json({ error: "Error monitoring is not configured." }, { status: 503 });
  Sentry.captureMessage("BuildLoop monitoring verification event", { level: "info", tags: { operation: "monitoring.test" } });
  await Sentry.flush(2_000);
  return Response.json({ status: "submitted" }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
