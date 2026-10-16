import { getSharedAppRepository, identityCookieName, SharedRuntimeError } from "@/lib/shared-apps/store";

export const runtime = "nodejs";
type Context = { params: Promise<{ appId: string }> };

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
    if (raw.length > 4_000) return Response.json({ error: "Choose one of the listed test users." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "Choose one of the listed test users." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof (body as Record<string, unknown>).userId !== "string") return Response.json({ error: "Choose one of the listed test users." }, { status: 400 });
    const repository = getSharedAppRepository();
    const token = repository.issueIdentityToken(appId, (body as { userId: string }).userId);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const cookie = `${identityCookieName(appId)}=${encodeURIComponent(token)}; Path=/api/apps/${appId}; HttpOnly; SameSite=Lax; Max-Age=43200${secure}`;
    return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof SharedRuntimeError && error.code === "authorization" ? 403 : error instanceof SharedRuntimeError && error.code === "validation" ? 400 : 500;
    return Response.json({ error: error instanceof SharedRuntimeError ? error.message : "That app user could not be selected." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
