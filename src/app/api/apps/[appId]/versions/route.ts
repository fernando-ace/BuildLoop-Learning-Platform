import { getPlatformRepository } from "@/lib/platform/repository";
import { isRecord, readJson, requireIdentity, responseForPlatformError, sameOrigin } from "@/lib/platform/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ appId: string }> };

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const user = await requireIdentity(request);
    const body = await readJson(request, 170_000);
    if (!isRecord(body) || !Number.isInteger(body.versionNumber) || !Object.hasOwn(body, "artifact")) return Response.json({ error: "The new app version could not be saved." }, { status: 400 });
    const { appId } = await context.params;
    const version = await getPlatformRepository().saveVersion(user, appId, Number(body.versionNumber), body.artifact, isRecord(body.metadata) ? body.metadata : {});
    return Response.json({ version }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error); }
}

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireIdentity(request);
    const { appId } = await context.params;
    const application = await getPlatformRepository().getApplication(user.id, appId);
    return Response.json({ application }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error); }
}
