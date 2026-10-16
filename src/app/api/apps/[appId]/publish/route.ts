import { getSharedAppRepository, SharedRuntimeError } from "@/lib/shared-apps/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ appId: string }> };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be accepted." }, { status: 403 });
  try {
    const { appId } = await context.params;
    const raw = await request.text();
    if (raw.length > 150_000) return Response.json({ error: "This app version is too large to publish." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "The publication request could not be read." }, { status: 400 }); }
    if (!record(body) || !["analyze", "publish", "analyzeRollback", "rollback"].includes(String(body.action)) || body.expectedPublishedVersion !== undefined && body.expectedPublishedVersion !== null && (typeof body.expectedPublishedVersion !== "string" || body.expectedPublishedVersion.length > 32)) return Response.json({ error: "The publication request is incomplete." }, { status: 400 });
    const repository = getSharedAppRepository();
    const expectedPublishedVersion = body.expectedPublishedVersion as string | null | undefined;
    let result;
    if (body.action === "analyzeRollback" || body.action === "rollback") {
      if (typeof body.targetVersionId !== "string" || body.targetVersionId.length > 64) return Response.json({ error: "Choose a saved version to restore." }, { status: 400 });
      result = body.action === "analyzeRollback" ? repository.analyzeRollback(appId, body.targetVersionId, expectedPublishedVersion) : repository.rollback(appId, body.targetVersionId, { expectedPublishedVersion, confirmWarnings: body.confirmWarnings === true });
    } else {
      if (!Number.isInteger(body.versionNumber) || Number(body.versionNumber) < 1 || Number(body.versionNumber) > 20) return Response.json({ error: "The publication request is incomplete." }, { status: 400 });
      result = body.action === "analyze" ? repository.analyzePublication(appId, Number(body.versionNumber), body.artifact, expectedPublishedVersion) : repository.publish(appId, Number(body.versionNumber), body.artifact, { expectedPublishedVersion, confirmWarnings: body.confirmWarnings === true });
    }
    const status = "published" in result && result.published ? 200 : !result.ok ? 422 : result.requiresConfirmation ? 409 : 400;
    return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof SharedRuntimeError && error.code === "validation" ? 400 : error instanceof SharedRuntimeError && error.code === "conflict" ? 409 : 500;
    return Response.json({ error: error instanceof SharedRuntimeError ? error.message : "This version could not be published." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(_request: Request, context: Context) {
  try {
    const { appId } = await context.params;
    const repository = getSharedAppRepository();
    const current = repository.getPublication(appId);
    return Response.json({ current: current ? { versionId: current.versionId, versionNumber: current.versionNumber, title: current.artifact.title, revision: current.revision } : null, versions: repository.listVersions(appId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof SharedRuntimeError && error.code === "validation" ? 400 : 500;
    return Response.json({ error: error instanceof SharedRuntimeError ? error.message : "Published version information could not be loaded." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
