import { getPlatformIdentity } from "@/lib/platform/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getPlatformIdentity(request);
  return user
    ? Response.json({ user }, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ error: "Sign in to continue." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
