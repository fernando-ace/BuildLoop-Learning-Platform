import { getSharedAppRepository, identityCookieName, parseCookie, SharedRuntimeError, type SharedOperation } from "@/lib/shared-apps/store";

export const runtime = "nodejs";
type Context = { params: Promise<{ appId: string }> };

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function isOperation(value: unknown): value is SharedOperation {
  if (!record(value) || typeof value.type !== "string") return false;
  if (value.type === "create") return typeof value.collection === "string" && record(value.values);
  if (value.type === "update") return typeof value.collection === "string" && typeof value.recordId === "string" && record(value.values);
  if (value.type === "delete") return typeof value.collection === "string" && typeof value.recordId === "string";
  return value.type === "workflow" && typeof value.workflow === "string" && typeof value.recordId === "string" && (value.inputs === undefined || record(value.inputs));
}
function statusFor(error: SharedRuntimeError) {
  if (error.code === "authorization") return 403;
  if (error.code === "not_found") return 404;
  if (error.code === "conflict" || error.code === "stale_version") return 409;
  if (error.code === "persistence") return 503;
  if (error.code === "workflow") return 422;
  return 400;
}

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be accepted." }, { status: 403 });
  try {
    const { appId } = await context.params;
    const raw = await request.text();
    if (raw.length > 32_000) return Response.json({ error: "That change is too large. Try a smaller update." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "The change request could not be read." }, { status: 400 }); }
    if (!record(body) || !isOperation(body.operation) || body.versionId !== undefined && (typeof body.versionId !== "string" || body.versionId.length > 32)) return Response.json({ error: "The change request is incomplete." }, { status: 400 });
    const repository = getSharedAppRepository();
    const user = repository.resolveIdentity(appId, parseCookie(request.headers.get("cookie"), identityCookieName(appId)));
    if (!user) return Response.json({ error: "Choose a test identity before making a change." }, { status: 401 });
    const result = repository.mutate(appId, user, body.operation, body.versionId as string | undefined);
    return Response.json({ ok: true, versionId: result.versionId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SharedRuntimeError) return Response.json({ error: error.message, code: error.code }, { status: statusFor(error), headers: { "Cache-Control": "no-store" } });
    return Response.json({ error: "The change could not be saved. Refresh the app and try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
