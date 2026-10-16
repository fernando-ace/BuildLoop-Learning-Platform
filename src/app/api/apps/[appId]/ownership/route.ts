import { getPlatformRepository } from "@/lib/platform/repository";
import { isRecord, readJson, requireIdentity, responseForPlatformError, sameOrigin } from "@/lib/platform/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ appId: string }> };

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const user = await requireIdentity(request);
    const body = await readJson(request, 4_000);
    if (!isRecord(body) || typeof body.newOwnerId !== "string") return Response.json({ error: "Choose an existing app member as the new owner." }, { status: 400 });
    const { appId } = await context.params;
    await getPlatformRepository().transferOwnership(user, appId, body.newOwnerId);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error); }
}
