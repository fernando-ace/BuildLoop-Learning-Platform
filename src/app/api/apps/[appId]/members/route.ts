import { getPlatformRepository } from "@/lib/platform/repository";
import { isRecord, readJson, requireIdentity, responseForPlatformError, sameOrigin } from "@/lib/platform/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ appId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireIdentity(request);
    const { appId } = await context.params;
    return Response.json({ members: await getPlatformRepository().listMembers(user.id, appId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error); }
}

export async function PATCH(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const user = await requireIdentity(request);
    const body = await readJson(request, 4_000);
    if (!isRecord(body) || typeof body.memberId !== "string" || (typeof body.appRole !== "string" && body.platformRole !== "administrator" && body.platformRole !== "member")) return Response.json({ error: "Choose a member and a role." }, { status: 400 });
    const { appId } = await context.params;
    if (body.platformRole === "administrator" || body.platformRole === "member") await getPlatformRepository().changePlatformRole(user, appId, body.memberId, body.platformRole);
    else await getPlatformRepository().changeAppRole(user, appId, body.memberId, body.appRole as string);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error); }
}

export async function DELETE(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const user = await requireIdentity(request);
    const body = await readJson(request, 4_000);
    if (!isRecord(body) || typeof body.memberId !== "string") return Response.json({ error: "Choose a member to remove." }, { status: 400 });
    const { appId } = await context.params;
    await getPlatformRepository().removeMember(user, appId, body.memberId);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error); }
}
