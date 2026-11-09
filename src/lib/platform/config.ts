import "server-only";

export type BuildLoopEnvironment = "development" | "test" | "preview" | "production";

export type HostedReadinessCheck = "configured" | "unavailable" | "not_required";

export function getBuildLoopEnvironment(): BuildLoopEnvironment {
  const explicit = process.env.BUILDLOOP_ENVIRONMENT;
  const inferred = process.env.VERCEL_ENV === "preview" ? "preview" : process.env.VERCEL_ENV === "production" ? "production" : process.env.NODE_ENV;
  const value = explicit ?? inferred;
  if (value !== "development" && value !== "test" && value !== "preview" && value !== "production") {
    throw new Error("BUILDLOOP_ENVIRONMENT must be development, test, preview, or production.");
  }
  if (explicit && process.env.VERCEL_ENV && explicit !== process.env.VERCEL_ENV) {
    throw new Error("BUILDLOOP_ENVIRONMENT must match VERCEL_ENV.");
  }
  return value;
}

export function getHostedReadinessChecks(): { authentication: HostedReadinessCheck; email: HostedReadinessCheck; builder: HostedReadinessCheck; monitoring: HostedReadinessCheck } {
  if (getBuildLoopEnvironment() !== "preview" && getBuildLoopEnvironment() !== "production") {
    return { authentication: "not_required", email: "not_required", builder: "not_required", monitoring: "not_required" };
  }

  const secret = process.env.BETTER_AUTH_SECRET;
  const publicAppUrl = process.env.PUBLIC_APP_URL;
  const authUrl = process.env.BETTER_AUTH_URL ?? publicAppUrl;
  let authentication: HostedReadinessCheck = "unavailable";
  if (secret && secret.length >= 32 && publicAppUrl && authUrl) {
    try {
      const publicOrigin = new URL(publicAppUrl);
      const authOrigin = new URL(authUrl);
      if (!publicOrigin.username && !publicOrigin.password && publicOrigin.origin === publicAppUrl.replace(/\/$/, "") && publicOrigin.protocol === "https:" && authOrigin.origin === publicOrigin.origin && !authOrigin.username && !authOrigin.password) {
        authentication = "configured";
      }
    } catch {
      // Invalid origins remain an unavailable readiness check; never return their values.
    }
  }

  return {
    authentication,
    email: process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? "configured" : "unavailable",
    builder: process.env.OPENAI_API_KEY ? "configured" : "unavailable",
    monitoring: process.env.SENTRY_DSN && process.env.NEXT_PUBLIC_SENTRY_DSN ? "configured" : "unavailable",
  };
}

export function getPublicAppUrl(requestUrl?: string) {
  const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
  const requestOrigin = requestUrl ? new URL(requestUrl).origin : undefined;
  const raw = process.env.PUBLIC_APP_URL ?? vercelOrigin ?? process.env.BETTER_AUTH_URL ?? (getBuildLoopEnvironment() === "production" ? undefined : requestOrigin ?? "http://localhost:3000");
  if (!raw) throw new Error("PUBLIC_APP_URL must be configured.");
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) throw new Error("PUBLIC_APP_URL must be an origin without credentials, path, query, or fragment.");
  if (getBuildLoopEnvironment() === "production" && url.protocol !== "https:") throw new Error("PUBLIC_APP_URL must use HTTPS in production.");
  return url.origin;
}

export function getReleaseMetadata() {
  return {
    environment: getBuildLoopEnvironment(),
    release: process.env.BUILDLOOP_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local",
    version: process.env.npm_package_version ?? "0.1.0",
  };
}
