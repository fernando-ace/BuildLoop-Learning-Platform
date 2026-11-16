import { getTestUserIdentity, issueTestSession, testCookieName } from "@/lib/platform/session";
import { getPlatformPool } from "@/lib/platform/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.BUILDLOOP_AUTH_MODE !== "test") {
    return Response.json({ error: "Test authentication is disabled." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Choose a test account." }, { status: 400 }); }
  const userId = body && typeof body === "object" && !Array.isArray(body) ? String((body as Record<string, unknown>).userId ?? "") : "";
  const user = getTestUserIdentity(userId);
  if (!user) return Response.json({ error: "Choose a test account." }, { status: 400 });
  try {
    await getPlatformPool().query("INSERT INTO platform_users(id,name,email,email_verified) VALUES($1,$2,$3,true) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,email_verified=true", [userId, user.name, user.email]);
    const token = issueTestSession(userId);
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return Response.json({ ok: true }, { headers: { "Set-Cookie": `${testCookieName()}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${secure}`, "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Test authentication is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.BUILDLOOP_AUTH_MODE !== "test") return Response.json({ error: "Test authentication is disabled." }, { status: 404 });
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  let cleanupUserIds: string[] = [];
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body) && "cleanupUserIds" in body) {
      const ids = (body as { cleanupUserIds?: unknown }).cleanupUserIds;
      if (!Array.isArray(ids) || ids.length > 2 || ids.some((id) => typeof id !== "string" || !/^e2e-(owner|collaborator)-[a-f0-9]{16}$/.test(id))) {
        return Response.json({ error: "Choose valid synthetic test accounts." }, { status: 400 });
      }
      cleanupUserIds = [...new Set(ids as string[])];
    }
  } catch {
    // Logout requests may have no body.
  }
  if (cleanupUserIds.length > 0) {
    const client = await getPlatformPool().connect();
    try {
      await client.query("BEGIN");
      for (const userId of cleanupUserIds) {
        const user = getTestUserIdentity(userId)!;
        await client.query("DELETE FROM applications WHERE project_id IN (SELECT id FROM studio_projects WHERE owner_user_id=$1)", [userId]);
        await client.query("DELETE FROM studio_projects WHERE owner_user_id=$1", [userId]);
        await client.query("DELETE FROM platform_users WHERE id=$1 AND email=$2", [userId, user.email]);
      }
      await client.query("COMMIT");
    } catch {
      try { await client.query("ROLLBACK"); } catch { /* The connection may already be closed. */ }
      return Response.json({ error: "Synthetic test data could not be cleaned up." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    } finally {
      client.release();
    }
  }
  return Response.json({ ok: true, cleanedUsers: cleanupUserIds.length }, { headers: { "Set-Cookie": `${testCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`, "Cache-Control": "no-store" } });
}
