import "server-only";

export type BuildLoopEnvironment = "development" | "test" | "preview" | "production";

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
