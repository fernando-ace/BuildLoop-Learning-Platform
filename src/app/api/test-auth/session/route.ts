import { issueTestSession, testCookieName } from "@/lib/platform/session";
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
  if (!body || typeof body !== "object" || Array.isArray(body) || !["test-owner", "test-collaborator"].includes(String((body as Record<string, unknown>).userId))) return Response.json({ error: "Choose a test account." }, { status: 400 });
  try {
    const userId = String((body as Record<string, unknown>).userId);
    const user = userId === "test-owner" ? { name: "Test Owner", email: "owner@example.test" } : { name: "Test Collaborator", email: "collaborator@example.test" };
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
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `${testCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`, "Cache-Control": "no-store" } });
}
