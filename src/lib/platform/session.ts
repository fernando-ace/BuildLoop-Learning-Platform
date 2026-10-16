import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getAuth } from "./auth";

export interface PlatformIdentity { id: string; name: string; email: string; }

const TEST_USERS: Record<string, PlatformIdentity> = {
  "test-owner": { id: "test-owner", name: "Test Owner", email: "owner@example.test" },
  "test-collaborator": { id: "test-collaborator", name: "Test Collaborator", email: "collaborator@example.test" },
};
const TEST_COOKIE = "buildloop_test_session";
const testModeEnabled = () => (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") && process.env.BUILDLOOP_AUTH_MODE === "test";

export function getTestIdentity(request: Request): PlatformIdentity | null {
  if (!testModeEnabled()) return null;
  const secret = process.env.BUILDLOOP_TEST_AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  const pair = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${TEST_COOKIE}=`));
  const token = pair?.slice(TEST_COOKIE.length + 1);
  if (!token || token.length > 512) return null;
  const [userId, expiresText, signature] = token.split(".");
  if (!userId || !expiresText || !signature || !TEST_USERS[userId]) return null;
  const expiresAt = Number(expiresText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Date.now()) return null;
  const expected = createHmac("sha256", secret).update(`${userId}.${expiresText}`).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, "base64url"); } catch { return null; }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  return TEST_USERS[userId];
}

export async function getPlatformIdentity(request: Request): Promise<PlatformIdentity | null> {
  const testIdentity = getTestIdentity(request);
  if (testIdentity) return testIdentity;
  if (testModeEnabled()) return null;
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    return session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null;
  } catch {
    return null;
  }
}

export function issueTestSession(userId: string) {
  if (!testModeEnabled() || !TEST_USERS[userId]) throw new Error("Test auth is available only to the explicitly enabled development test server.");
  const secret = process.env.BUILDLOOP_TEST_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("BUILDLOOP_TEST_AUTH_SECRET must be configured for test authentication.");
  const expiresAt = String(Date.now() + 60 * 60 * 1000);
  const payload = `${userId}.${expiresAt}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function testCookieName() { return TEST_COOKIE; }
