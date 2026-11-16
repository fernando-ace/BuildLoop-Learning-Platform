import { describe, expect, it } from "vitest";
import { getMigrationDatabaseUrl, validateMigrationTarget, validateProductionDatabaseUrl } from "./migration-safety";

const remoteProduction = {
  databaseUrl: "postgresql://operator:secret@db.example.test:5432/buildloop?sslmode=require",
  environment: "production",
  vercelEnvironment: "production",
  allowRemoteMigrations: "1",
  allowProductionMigrations: "1",
};

describe("migration target safety", () => {
  it("prefers an explicitly supplied migration URL, then Neon unpooled URLs, then runtime URL", () => {
    expect(getMigrationDatabaseUrl({ DATABASE_MIGRATION_URL: "direct-explicit", DATABASE_URL_UNPOOLED: "direct-neon", DATABASE_URL: "pooled" })).toBe("direct-explicit");
    expect(getMigrationDatabaseUrl({ DATABASE_MIGRATION_URL: "", DATABASE_URL_UNPOOLED: "direct-neon", DATABASE_URL: "pooled" })).toBe("direct-neon");
    expect(getMigrationDatabaseUrl({ DATABASE_URL_UNPOOLED: "", POSTGRES_URL_NON_POOLING: "direct-non-pooling", DATABASE_URL: "pooled" })).toBe("direct-non-pooling");
    expect(getMigrationDatabaseUrl({ DATABASE_URL: "pooled" })).toBe("pooled");
    expect(getMigrationDatabaseUrl({})).toBeUndefined();
  });

  it("allows local development migration targets without production opt-ins", () => {
    expect(validateMigrationTarget({ databaseUrl: "postgresql://localhost:5432/buildloop", environment: "development" }).hostname).toBe("localhost");
  });

  it("requires explicit opt-in before applying a remote preview migration", () => {
    expect(() => validateMigrationTarget({ databaseUrl: "postgresql://db.example.test/buildloop", environment: "preview" })).toThrow("BUILDLOOP_ALLOW_REMOTE_MIGRATIONS=1");
    expect(validateMigrationTarget({ databaseUrl: "postgresql://db.example.test/buildloop", environment: "preview", allowRemoteMigrations: "1" }).hostname).toBe("db.example.test");
  });

  it.each([undefined, "disable", "prefer", "allow", "verify-ca-invalid"])("rejects production sslmode=%s because TLS is not guaranteed", (sslmode) => {
    const databaseUrl = `postgresql://db.example.test/buildloop${sslmode ? `?sslmode=${sslmode}` : ""}`;
    expect(() => validateMigrationTarget({ ...remoteProduction, databaseUrl })).toThrow("must explicitly require TLS");
  });

  it.each(["require", "verify-ca", "verify-full"])("accepts TLS-enforcing sslmode=%s", (sslmode) => {
    const databaseUrl = `postgresql://db.example.test/buildloop?sslmode=${sslmode}`;
    expect(validateMigrationTarget({ ...remoteProduction, databaseUrl }).hostname).toBe("db.example.test");
    expect(validateProductionDatabaseUrl(databaseUrl).hostname).toBe("db.example.test");
  });

  it("applies production TLS and loopback checks to application database URLs", () => {
    expect(() => validateProductionDatabaseUrl("postgresql://db.example.test/buildloop")).toThrow("must explicitly require TLS");
    expect(() => validateProductionDatabaseUrl("postgresql://127.0.0.1/buildloop?sslmode=require")).toThrow("cannot point to a local database");
    expect(() => validateProductionDatabaseUrl("postgresql://[::1]/buildloop?sslmode=require")).toThrow("cannot point to a local database");
  });

  it("requires production opt-in and rejects local production databases", () => {
    expect(() => validateMigrationTarget({ ...remoteProduction, allowProductionMigrations: undefined })).toThrow("BUILDLOOP_ALLOW_PRODUCTION_MIGRATIONS=1");
    expect(() => validateMigrationTarget({ ...remoteProduction, databaseUrl: "postgresql://localhost/buildloop?sslmode=require" })).toThrow("Refusing to apply production migrations to a local database");
    expect(() => validateMigrationTarget({ ...remoteProduction, databaseUrl: "postgresql://[::1]/buildloop?sslmode=require" })).toThrow("Refusing to apply production migrations to a local database");
  });

  it("rejects a Vercel environment mismatch and non-PostgreSQL URLs", () => {
    expect(() => validateMigrationTarget({ ...remoteProduction, vercelEnvironment: "preview" })).toThrow("does not match VERCEL_ENV");
    expect(() => validateMigrationTarget({ ...remoteProduction, databaseUrl: "https://db.example.test/buildloop" })).toThrow("must use the PostgreSQL protocol");
  });
});
