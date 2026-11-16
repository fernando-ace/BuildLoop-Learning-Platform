import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/platform/schema.ts",
  out: "./src/lib/platform/schema-migrations",
  dbCredentials: { url: process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
