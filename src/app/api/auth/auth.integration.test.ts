import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./[...all]/route";
import { getPlatformIdentity } from "@/lib/platform/session";
import { closePlatformDatabase, getPlatformPool } from "@/lib/platform/database";

const enabled = Boolean(process.env.DATABASE_URL);
const testEmails: string[] = [];

afterEach(async () => {
  for (const email of testEmails.splice(0)) {
    await getPlatformPool().query("DELETE FROM platform_users WHERE email=$1", [email]);
  }
});

function request(path: string, method: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost:3000/api/auth/${path}`, {
    method,
    headers: { host: "localhost:3000", origin: "http://localhost:3000", ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe.skipIf(!enabled)("Better Auth PostgreSQL session", () => {
  afterAll(async () => { await closePlatformDatabase(); });

  it("creates a real account, resolves its stable identity from a session cookie, and invalidates logout", async () => {
    vi.stubEnv("BUILDLOOP_ENVIRONMENT", "preview");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("BUILDLOOP_PREVIEW_ALLOW_UNVERIFIED_SIGNUPS", "1");
    vi.stubEnv("PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    const email = `auth-${randomUUID()}@example.test`;
    testEmails.push(email);
    const signUp = await POST(request("sign-up/email", "POST", { name: "Browser User", email, password: "A-real-test-password-394!" }));
    expect(signUp.status).toBe(200);
    const signUpBody: unknown = await signUp.json();
    const token = typeof signUpBody === "object" && signUpBody !== null && "token" in signUpBody ? signUpBody.token : undefined;
    expect(token ?? null).toBeNull();
    expect(signUp.headers.getSetCookie().join(";")).not.toContain("session_token=");

    const signIn = await POST(request("sign-in/email", "POST", { email, password: "A-real-test-password-394!" }));
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    expect(cookie).toMatch(/(?:__Secure-)?buildloop\.session_token=/);

    const identity = await getPlatformIdentity(request("get-session", "GET", undefined, cookie));
    expect(identity).toMatchObject({ name: "Browser User", email });
    if (!identity) throw new Error("Expected the Better Auth session to resolve.");
    expect(identity.id.length).toBeGreaterThan(10);

    const logout = await POST(request("sign-out", "POST", {}, cookie));
    expect(logout.status).toBe(200);
    const afterLogout = await getPlatformIdentity(request("get-session", "GET", undefined, cookie));
    expect(afterLogout).toBeNull();
  });
});
