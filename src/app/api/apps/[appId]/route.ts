import { getSharedAppRepository, identityCookieName, parseCookie, SharedRuntimeError } from "@/lib/shared-apps/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ appId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { appId } = await context.params;
    const repository = getSharedAppRepository();
    const publication = repository.getPublication(appId);
    if (!publication) return Response.json({ error: "This app has not been published yet." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const token = parseCookie(request.headers.get("cookie"), identityCookieName(appId));
    const user = repository.resolveIdentity(appId, token);
    const safeArtifact = structuredClone(publication.artifact);
    for (const collection of safeArtifact.collections) collection.seed = [];
    if (!user) return Response.json({ published: true, versionId: publication.versionId, versionNumber: publication.versionNumber, artifact: safeArtifact, users: repository.getTestUsers(appId) }, { headers: { "Cache-Control": "no-store" } });
    const view = repository.readRuntime(appId, user);
    return Response.json(view ? { published: true, ...view, artifact: safeArtifact } : { error: "This app is not available." }, { status: view ? 200 : 404, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof SharedRuntimeError && error.code === "validation" ? 400 : 500;
    return Response.json({ error: error instanceof SharedRuntimeError ? error.message : "This app could not be loaded." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
