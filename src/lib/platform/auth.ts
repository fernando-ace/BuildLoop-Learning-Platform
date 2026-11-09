import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getPlatformDatabase } from "./database";
import { authAccounts, authSessions, authVerifications, platformUsers } from "./schema";
import { getBuildLoopEnvironment, getPublicAppUrl } from "./config";
import { sendRequiredAccountActionEmail, type AccountActionEmail } from "./email";
import { logEvent } from "./logger";
import { consumeOperationLimit } from "./rate-limit";

async function deliverAuthEmail(kind: "verification" | "password_reset", message: AccountActionEmail) {
  try {
    await sendRequiredAccountActionEmail(message);
  } catch {
    logEvent("warn", `email.${kind}_unavailable`);
    throw new Error("BuildLoop could not deliver the account email. Try again later.");
  }
}

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const environment = getBuildLoopEnvironment();
  if (!secret || secret.length < 32) {
    if (environment === "production" || environment === "preview") throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters.");
  }
  const baseURL = process.env.BETTER_AUTH_URL ?? getPublicAppUrl();
  if (new URL(baseURL).origin !== getPublicAppUrl()) throw new Error("BETTER_AUTH_URL and PUBLIC_APP_URL must use the same origin.");
  const trustedOrigins = new Set([getPublicAppUrl(), new URL(baseURL).origin]);
  if (process.env.VERCEL_URL) trustedOrigins.add(`https://${process.env.VERCEL_URL}`);
  return betterAuth({
    appName: "BuildLoop",
    baseURL,
    secret: secret && secret.length >= 32 ? secret : "development-only-buildloop-auth-secret-change-before-deploying",
    trustedOrigins: [...trustedOrigins],
    database: drizzleAdapter(getPlatformDatabase(), {
      provider: "pg",
      schema: { user: platformUsers, session: authSessions, account: authAccounts, verification: authVerifications },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: environment !== "production" && environment !== "preview",
      requireEmailVerification: environment === "production" || environment === "preview",
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await deliverAuthEmail("password_reset", { recipient: user.email, subject: "Reset your BuildLoop password", introduction: "A password reset was requested for your BuildLoop account.", actionLabel: "Reset password", actionUrl: url });
      },
    },
    emailVerification: {
      sendOnSignUp: environment === "production" || environment === "preview",
      sendOnSignIn: environment === "production" || environment === "preview",
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await deliverAuthEmail("verification", { recipient: user.email, subject: "Verify your BuildLoop email", introduction: "Confirm your email address to finish setting up your BuildLoop account.", actionLabel: "Verify email", actionUrl: url });
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 10,
      customStorage: {
        consume: async (key, rule) => {
          const result = await consumeOperationLimit(`auth:${key}`, rule.max, rule.window);
          return { allowed: result.allowed, retryAfter: result.allowed ? null : result.retryAfterSeconds };
        },
      },
    },
    advanced: { useSecureCookies: environment === "production" || environment === "preview", cookiePrefix: "buildloop" },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
