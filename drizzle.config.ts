import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/platform/schema.ts",
  out: "./src/lib/platform/schema-migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgresql://buildloop:buildloop@127.0.0.1:5432/buildloop" },
  strict: true,
  verbose: true,
});
