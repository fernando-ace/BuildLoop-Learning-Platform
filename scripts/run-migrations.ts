import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { validateMigrationTarget } from "../src/lib/platform/migration-safety";

loadEnvConfig(process.cwd());
const environment = process.env.BUILDLOOP_ENVIRONMENT ?? (process.env.VERCEL_ENV === "production" ? "production" : process.env.VERCEL_ENV === "preview" ? "preview" : process.env.NODE_ENV ?? "development");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set DATABASE_URL to the intended database before applying migrations.");
validateMigrationTarget({
  databaseUrl,
  environment,
  vercelEnvironment: process.env.VERCEL_ENV,
  allowRemoteMigrations: process.env.BUILDLOOP_ALLOW_REMOTE_MIGRATIONS,
  allowProductionMigrations: process.env.BUILDLOOP_ALLOW_PRODUCTION_MIGRATIONS,
});

const cli = resolve("node_modules/drizzle-kit/bin.cjs");
const result = spawnSync(process.execPath, [cli, "migrate"], { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
