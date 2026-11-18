import { getPlatformRepository, PlatformError } from "@/lib/platform/repository";
import { requireIdentity, responseForPlatformError, sameOrigin } from "@/lib/platform/http";
import { logEvent, requestId } from "@/lib/platform/logger";

export const runtime = "nodejs";
type Context = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const user = await requireIdentity(request);
    const { token } = await context.params;
    return Response.json({ invitation: await getPlatformRepository().acceptInvitation(user, token) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PlatformError) {
      logEvent("warn", "invitation.accept_rejected", { requestId: requestId(request), code: error.code });
    } else {
      logEvent("error", "invitation.accept_failed", { requestId: requestId(request), errorType: error instanceof Error ? error.name : "unknown" });
    }
    return responseForPlatformError(error, request);
  }
}
