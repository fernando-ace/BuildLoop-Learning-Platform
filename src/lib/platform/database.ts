import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { getBuildLoopEnvironment } from "./config";
import { logEvent } from "./logger";

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

export function getPlatformDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for platform authentication and persistence.");
  if (!pool) {
    const max = Number(process.env.DATABASE_POOL_MAX ?? 5);
    if (!Number.isInteger(max) || max < 1 || max > 20) throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 20.");
    const environment = getBuildLoopEnvironment();
    if (environment === "production" && new URL(connectionString).hostname === "localhost") throw new Error("Production DATABASE_URL cannot point to localhost.");
    pool = new Pool({ connectionString, max, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000, statement_timeout: 5_000, application_name: "buildloop-platform" });
    pool.on("error", () => logEvent("error", "database.pool_error"));
    database = drizzle(pool, { schema });
  }
  return database!;
}

export function getPlatformPool() {
  getPlatformDatabase();
  return pool!;
}

export async function closePlatformDatabase() {
  await pool?.end();
  pool = undefined;
  database = undefined;
}
