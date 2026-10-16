import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

export function getPlatformDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for platform authentication and persistence.");
  if (!pool) {
    pool = new Pool({ connectionString, max: Number(process.env.DATABASE_POOL_MAX ?? 10), idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, application_name: "buildloop-platform" });
    pool.on("error", () => console.error(JSON.stringify({ level: "error", event: "database.pool_error" })));
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
