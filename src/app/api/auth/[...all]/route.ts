import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/platform/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const handlers = toNextJsHandler(getAuth());
  return request.method === "GET" ? handlers.GET(request) : handlers.POST(request);
}

export const GET = handle;
export const POST = handle;
