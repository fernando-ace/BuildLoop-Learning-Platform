import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./[...all]/route";
import { getPlatformIdentity } from "@/lib/platform/session";
import { closePlatformDatabase, getPlatformPool } from "@/lib/platform/database";
import { clearCapturedEmails, getCapturedEmails } from "@/lib/platform/email";

const { consumeOperationLimit } = vi.hoisted(() => ({ consumeOperationLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 1 })) }));
vi.mock("@/lib/platform/rate-limit", () => ({ consumeOperationLimit }));

const enabled = Boolean(process.env.DATABASE_URL);
const testEmails: string[] = [];

afterEach(async () => {
  for (const email of testEmails.splice(0)) {
    await getPlatformPool().query("DELETE FROM auth_verifications WHERE value=(SELECT id FROM platform_users WHERE email=$1)", [email]);
    await getPlatformPool().query("DELETE FROM platform_users WHERE email=$1", [email]);
  }
  clearCapturedEmails();
});

function request(path: string, method: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost:3000/api/auth/${path}`, {
    method,
    headers: { host: "localhost:3000", origin: "http://localhost:3000", ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function configurePreviewAuth() {
  vi.stubEnv("BUILDLOOP_ENVIRONMENT", "preview");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "");
  vi.stubEnv("BUILDLOOP_PREVIEW_ALLOW_UNVERIFIED_SIGNUPS", "1");
  vi.stubEnv("PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
}

describe.skipIf(!enabled)("Better Auth PostgreSQL session", () => {
  afterAll(async () => { await closePlatformDatabase(); });

  it("creates a real account, resolves its stable identity from a session cookie, and invalidates logout", async () => {
    configurePreviewAuth();
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

  it("delivers reset links privately, rejects invalid/expired/reused tokens, and revokes old sessions", async () => {
    configurePreviewAuth();
    const email = `reset-${randomUUID()}@example.test`;
    testEmails.push(email);
    const signup = await POST(request("sign-up/email", "POST", { name: "Reset User", email, password: "Initial-test-password-394!" }));
    expect(signup.status).toBe(200);

    const signIn = await POST(request("sign-in/email", "POST", { email, password: "Initial-test-password-394!" }));
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    expect(await getPlatformIdentity(request("get-session", "GET", undefined, cookie))).toMatchObject({ email });

    const redirectTo = "http://localhost:3000/reset-password";
    const missingRequest = await POST(request("request-password-reset", "POST", { email: `missing-${randomUUID()}@example.test`, redirectTo }));
    const missingBody = await missingRequest.json();
    expect(missingRequest.status).toBe(200);
    expect(missingBody).toMatchObject({ status: true, message: "If this email exists in our system, check your email for the reset link" });
    expect(getCapturedEmails()).toHaveLength(0);

    const resetRequest = await POST(request("request-password-reset", "POST", { email, redirectTo }));
    expect(resetRequest.status).toBe(200);
    expect(await resetRequest.json()).toEqual(missingBody);
    const resetEmail = getCapturedEmails().find((message) => message.subject === "Reset your BuildLoop password");
    if (!resetEmail) throw new Error("Expected the reset email to be captured in the test transport.");
    expect(resetEmail.recipient).toBe(email);
    const resetLink = /Reset password: (https?:\/\/\S+)/.exec(resetEmail.text)?.[1];
    if (!resetLink) throw new Error("Expected the captured email to contain its reset link.");
    const resetToken = /\/reset-password\/([^/?]+)(?:\?|$)/.exec(new URL(resetLink).pathname)?.[1];
    if (!resetToken) throw new Error("Expected the reset link to contain a token.");

    const invalid = await POST(request("reset-password", "POST", { newPassword: "Replacement-password-394!", token: "invalid-reset-token" }));
    expect(invalid.status).toBe(400);

    const expiredRow = await getPlatformPool().query("UPDATE auth_verifications SET expires_at=now()-interval '1 minute' WHERE identifier=$1", [`reset-password:${resetToken}`]);
    expect(expiredRow.rowCount).toBe(1);
    const expired = await POST(request("reset-password", "POST", { newPassword: "Replacement-password-394!", token: resetToken }));
    expect(expired.status).toBe(400);

    const secondRequest = await POST(request("request-password-reset", "POST", { email, redirectTo }));
    expect(secondRequest.status).toBe(200);
    const latestResetEmail = getCapturedEmails().filter((message) => message.subject === "Reset your BuildLoop password").at(-1);
    if (!latestResetEmail) throw new Error("Expected a second reset email after requesting a fresh link.");
    const latestResetLink = /Reset password: (https?:\/\/\S+)/.exec(latestResetEmail.text)?.[1];
    if (!latestResetLink) throw new Error("Expected the second captured email to contain its reset link.");
    const latestToken = /\/reset-password\/([^/?]+)(?:\?|$)/.exec(new URL(latestResetLink).pathname)?.[1];
    if (!latestToken) throw new Error("Expected the new reset link to contain a token.");

    const reset = await POST(request("reset-password", "POST", { newPassword: "Replacement-password-394!", token: latestToken }));
    expect(reset.status).toBe(200);
    expect(await getPlatformIdentity(request("get-session", "GET", undefined, cookie))).toBeNull();
    const reused = await POST(request("reset-password", "POST", { newPassword: "Another-password-394!", token: latestToken }));
    expect(reused.status).toBe(400);

    const oldPassword = await POST(request("sign-in/email", "POST", { email, password: "Initial-test-password-394!" }));
    expect(oldPassword.status).toBe(401);
    const newPassword = await POST(request("sign-in/email", "POST", { email, password: "Replacement-password-394!" }));
    expect(newPassword.status).toBe(200);
  });
});
