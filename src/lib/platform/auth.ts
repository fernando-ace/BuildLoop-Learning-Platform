import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getPlatformDatabase } from "./database";
import { authAccounts, authSessions, authVerifications, platformUsers } from "./schema";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters.");
  }
  const baseURL = process.env.BETTER_AUTH_URL ?? process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
  return betterAuth({
    appName: "BuildLoop",
    baseURL,
    secret: secret && secret.length >= 32 ? secret : "development-only-buildloop-auth-secret-change-before-deploying",
    trustedOrigins: [new URL(baseURL).origin],
    database: drizzleAdapter(getPlatformDatabase(), {
      provider: "pg",
      schema: { user: platformUsers, session: authSessions, account: authAccounts, verification: authVerifications },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, autoSignIn: true },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, window: 60, max: 10 },
    advanced: { useSecureCookies: process.env.NODE_ENV === "production", cookiePrefix: "buildloop" },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
