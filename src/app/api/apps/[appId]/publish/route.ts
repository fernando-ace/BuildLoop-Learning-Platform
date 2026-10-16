import { getPlatformRepository, PlatformError } from "@/lib/platform/repository";
import { isRecord, readJson, requireIdentity, responseForPlatformError, sameOrigin } from "@/lib/platform/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ appId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireIdentity(request);
    const { appId } = await context.params;
    const repository = getPlatformRepository();
    const application = await repository.getApplication(user.id, appId);
    return Response.json({
      application,
      current: application.production_version_id ? { versionId: application.production_version_id, versionNumber: application.production_version_number } : null,
      versions: await repository.listVersions(user.id, appId),
      history: await repository.listPublicationHistory(user.id, appId),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error); }
}

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const user = await requireIdentity(request);
    const body = await readJson(request, 8_000);
    if (!isRecord(body) || !["analyze", "publish", "analyzeRollback", "rollback"].includes(String(body.action)) || typeof body.versionId !== "string" || body.versionId.length > 80 || body.expectedPublishedVersion !== undefined && body.expectedPublishedVersion !== null && typeof body.expectedPublishedVersion !== "string") return Response.json({ error: "Choose a saved app version." }, { status: 400 });
    const { appId } = await context.params;
    const repository = getPlatformRepository();
    const expectedVersionId = body.expectedPublishedVersion as string | null | undefined;
    if (body.action === "analyze" || body.action === "analyzeRollback") {
      const result = await repository.analyzePublication(user, appId, body.versionId, expectedVersionId);
      return Response.json(result, { status: result.ok ? 200 : 422, headers: { "Cache-Control": "no-store" } });
    }
    const result = await repository.publishVersion(user, appId, body.versionId, { expectedVersionId, confirmWarnings: body.confirmWarnings === true, rollback: body.action === "rollback" });
    return Response.json(result, { status: result.published ? 200 : result.requiresConfirmation ? 409 : 422, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PlatformError && (error.code === "conflict" || error.code === "invalid")) {
      const result = error.code === "conflict" && error.message.includes("Production changed") ? 409 : 422;
      return Response.json({ error: error.message, code: error.code }, { status: result, headers: { "Cache-Control": "no-store" } });
    }
    return responseForPlatformError(error);
  }
}
