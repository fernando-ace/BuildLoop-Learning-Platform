import { getPlatformIdentity, type PlatformIdentity } from "./session";
import { PlatformError } from "./repository";
import { getBuildLoopEnvironment, getPublicAppUrl } from "./config";
import { logEvent, requestId } from "./logger";
import * as Sentry from "@sentry/nextjs";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const allowed = getPublicAppUrl(request.url);
    return new URL(origin).origin === allowed && (getBuildLoopEnvironment() !== "production" || new URL(origin).protocol === "https:");
  } catch { return false; }
}

export async function requireIdentity(request: Request): Promise<PlatformIdentity> {
  const identity = await getPlatformIdentity(request);
  if (!identity) throw new PlatformError("unauthenticated", "Sign in to continue.");
  return identity;
}

export function responseForPlatformError(error: unknown, request?: Request) {
  const id = request ? requestId(request) : undefined;
  const headers = { "Cache-Control": "no-store", ...(id ? { "X-Request-Id": id } : {}) };
  if (!(error instanceof PlatformError)) {
    logEvent("error", "platform.unexpected_failure", { requestId: id, errorType: error instanceof Error ? error.name : "unknown" });
    Sentry.captureException(error);
    return Response.json({ error: "The app could not complete that request.", ...(id ? { requestId: id } : {}) }, { status: 500, headers });
  }
  logEvent(error.code === "forbidden" || error.code === "unauthenticated" ? "warn" : "info", "platform.request_rejected", { requestId: id, code: error.code });
  const status = error.code === "unauthenticated" ? 401 : error.code === "not_found" ? 404 : error.code === "forbidden" ? 403 : error.code === "conflict" ? 409 : error.code === "unavailable" ? 503 : 400;
  return Response.json({ error: error.message, code: error.code, ...(id ? { requestId: id } : {}) }, { status, headers });
}

export async function readJson(request: Request, limit = 32_000): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > limit) throw new PlatformError("invalid", "That request is too large.");
  try { return JSON.parse(raw); } catch { throw new PlatformError("invalid", "The request could not be read."); }
}

export function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
