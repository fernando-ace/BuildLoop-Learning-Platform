import { getPlatformRepository } from "@/lib/platform/repository";
import { isRecord, readJson, requireIdentity, responseForPlatformError, sameOrigin } from "@/lib/platform/http";
import { operationLimitResponse } from "@/lib/platform/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireIdentity(request);
    return Response.json({ applications: await getPlatformRepository().listApplications(user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error, request); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const user = await requireIdentity(request);
    const body = await readJson(request, 4_000);
    if (!isRecord(body) || typeof body.name !== "string") return Response.json({ error: "Give your app a name." }, { status: 400 });
    const limited = await operationLimitResponse(`app-create:${user.id}`, 10, 3_600, "You've created several apps recently. Try again later.");
    if (limited) return limited;
    const application = await getPlatformRepository().createApplication(user, body.name, isRecord(body.brief) ? body.brief : {});
    return Response.json({ application }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error, request); }
}
