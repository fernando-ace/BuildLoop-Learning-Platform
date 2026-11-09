import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const environment = process.env.BUILDLOOP_ENVIRONMENT ?? (process.env.VERCEL_ENV === "production" ? "production" : process.env.VERCEL_ENV === "preview" ? "preview" : process.env.NODE_ENV ?? "development");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set DATABASE_URL to the intended database before applying migrations.");

const target = new URL(databaseUrl);
const localDatabase = ["localhost", "127.0.0.1", "::1"].includes(target.hostname);
if (!localDatabase && process.env.BUILDLOOP_ALLOW_REMOTE_MIGRATIONS !== "1") throw new Error("Remote migrations require an explicit BUILDLOOP_ALLOW_REMOTE_MIGRATIONS=1 release step.");
if (environment === "production") {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") throw new Error("Production migration environment does not match VERCEL_ENV.");
  if (process.env.BUILDLOOP_ALLOW_PRODUCTION_MIGRATIONS !== "1") throw new Error("Production migrations require an explicit BUILDLOOP_ALLOW_PRODUCTION_MIGRATIONS=1 release step.");
  if (localDatabase) throw new Error("Refusing to apply production migrations to a local database.");
  if (!target.searchParams.has("sslmode") || target.searchParams.get("sslmode") === "disable") throw new Error("Production DATABASE_URL must explicitly require TLS with sslmode=require or stronger.");
}

const cli = resolve("node_modules/drizzle-kit/bin.cjs");
const result = spawnSync(process.execPath, [cli, "migrate"], { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
