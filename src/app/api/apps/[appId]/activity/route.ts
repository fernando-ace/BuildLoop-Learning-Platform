import { getPlatformRepository } from "@/lib/platform/repository";
import { requireIdentity, responseForPlatformError } from "@/lib/platform/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ appId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireIdentity(request);
    const { appId } = await context.params;
    return Response.json({ events: await getPlatformRepository().listActivity(user.id, appId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error); }
}
