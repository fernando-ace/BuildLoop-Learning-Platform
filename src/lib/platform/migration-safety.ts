export interface MigrationTargetOptions {
  databaseUrl: string;
  environment: string;
  vercelEnvironment?: string;
  allowRemoteMigrations?: string;
  allowProductionMigrations?: string;
}

function parsePostgresUrl(databaseUrl: string) {
  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (target.protocol !== "postgres:" && target.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
  }
  return target;
}

export function validateProductionDatabaseUrl(databaseUrl: string) {
  const target = parsePostgresUrl(databaseUrl);
  const localDatabase = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(target.hostname.toLowerCase());
  if (localDatabase) throw new Error("Production DATABASE_URL cannot point to a local database.");
  const sslmode = target.searchParams.get("sslmode")?.toLowerCase();
  if (!sslmode || !["require", "verify-ca", "verify-full"].includes(sslmode)) {
    throw new Error("Production DATABASE_URL must explicitly require TLS with sslmode=require or stronger.");
  }
  return target;
}

export function validateMigrationTarget(options: MigrationTargetOptions) {
  const target = parsePostgresUrl(options.databaseUrl);
  const localDatabase = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(target.hostname.toLowerCase());
  if (!localDatabase && options.allowRemoteMigrations !== "1") {
    throw new Error("Remote migrations require an explicit BUILDLOOP_ALLOW_REMOTE_MIGRATIONS=1 release step.");
  }

  if (options.environment === "production") {
    if (options.vercelEnvironment && options.vercelEnvironment !== "production") {
      throw new Error("Production migration environment does not match VERCEL_ENV.");
    }
    if (options.allowProductionMigrations !== "1") {
      throw new Error("Production migrations require an explicit BUILDLOOP_ALLOW_PRODUCTION_MIGRATIONS=1 release step.");
    }
    if (localDatabase) throw new Error("Refusing to apply production migrations to a local database.");
    validateProductionDatabaseUrl(options.databaseUrl);
  }

  return target;
}
