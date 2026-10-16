import { getPlatformIdentity, type PlatformIdentity } from "./session";
import { PlatformError } from "./repository";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function requireIdentity(request: Request): Promise<PlatformIdentity> {
  const identity = await getPlatformIdentity(request);
  if (!identity) throw new PlatformError("unauthenticated", "Sign in to continue.");
  return identity;
}

export function responseForPlatformError(error: unknown) {
  if (!(error instanceof PlatformError)) return Response.json({ error: "The app could not complete that request." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  const status = error.code === "unauthenticated" ? 401 : error.code === "not_found" ? 404 : error.code === "forbidden" ? 403 : error.code === "conflict" ? 409 : error.code === "unavailable" ? 503 : 400;
  return Response.json({ error: error.message, code: error.code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson(request: Request, limit = 32_000): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > limit) throw new PlatformError("invalid", "That request is too large.");
  try { return JSON.parse(raw); } catch { throw new PlatformError("invalid", "The request could not be read."); }
}

export function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
