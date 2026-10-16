import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { POST } from "./[...all]/route";
import { getPlatformIdentity } from "@/lib/platform/session";
import { closePlatformDatabase } from "@/lib/platform/database";

const enabled = Boolean(process.env.DATABASE_URL);

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
    const email = `auth-${randomUUID()}@example.test`;
    const signUp = await POST(request("sign-up/email", "POST", { name: "Browser User", email, password: "A-real-test-password-394!" }));
    expect(signUp.status).toBe(200);
    const cookie = signUp.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    expect(cookie).toContain("buildloop.session_token=");

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
