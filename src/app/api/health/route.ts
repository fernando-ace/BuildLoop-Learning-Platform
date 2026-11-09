import { getReleaseMetadata } from "@/lib/platform/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ status: "ok", timestamp: new Date().toISOString(), ...getReleaseMetadata() }, { headers: { "Cache-Control": "no-store" } });
}
