import { defineConfig } from "drizzle-kit";
import { getMigrationDatabaseUrl } from "./src/lib/platform/migration-safety";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/platform/schema.ts",
  out: "./src/lib/platform/schema-migrations",
  dbCredentials: { url: getMigrationDatabaseUrl(process.env) ?? "" },
  strict: true,
  verbose: true,
});
