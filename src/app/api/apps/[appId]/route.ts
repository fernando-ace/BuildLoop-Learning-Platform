import { getPlatformRepository, PlatformError } from "@/lib/platform/repository";
import { requireIdentity, responseForPlatformError } from "@/lib/platform/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ appId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireIdentity(request);
    const { appId } = await context.params;
    const environment = new URL(request.url).searchParams.get("environment") === "preview" ? "preview" : "production";
    return Response.json(await getPlatformRepository().readRuntime(user, appId, environment), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error); }
}

export async function POST(request: Request, context: Context) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (!origin || !host || (() => { try { return new URL(origin).host !== host; } catch { return true; } })()) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const user = await requireIdentity(request);
    const { appId } = await context.params;
    const body = await request.json() as { operation?: unknown; versionId?: unknown; environment?: unknown };
    if (typeof body.versionId !== "string" || !body.operation || typeof body.operation !== "object" || typeof body.environment !== "undefined" && body.environment !== "preview" && body.environment !== "production") return Response.json({ error: "The change request is incomplete." }, { status: 400 });
    const result = await getPlatformRepository().mutateRuntime(user, appId, body.operation as never, body.versionId, body.environment === "preview" ? "preview" : "production");
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PlatformError) return responseForPlatformError(error);
    return Response.json({ error: "The change could not be saved. Refresh the app and try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
