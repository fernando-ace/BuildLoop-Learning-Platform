import { existsSync } from "node:fs";
import { Pool } from "pg";
import { importLegacySQLiteFile } from "../src/lib/platform/sqlite-import";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write("Usage: npm run db:import-sqlite -- --source <legacy.sqlite> --owner-email <existing-account-email> [--apply]\n\nRuns a read-only dry run by default. Add --apply to atomically import validated V4 apps. Re-running is safe and reports already-imported app IDs.\n");
    return;
  }
  const filename = argument("--source"), ownerEmail = argument("--owner-email"), connectionString = process.env.DATABASE_URL;
  if (!filename || !ownerEmail || !connectionString || !existsSync(filename)) throw new Error("Set DATABASE_URL and provide an existing --source file and --owner-email. Use --help for usage.");
  const pool = new Pool({ connectionString, max: 2, application_name: "buildloop-legacy-import" });
  try {
    const result = await importLegacySQLiteFile({ filename, ownerEmail, pool, apply: process.argv.includes("--apply") });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Import failed."}\n`);
  process.exitCode = 1;
});
