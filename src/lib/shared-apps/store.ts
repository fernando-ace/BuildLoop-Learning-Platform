import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RuntimeData } from "../builder/v2";
import { applyRuntimeMigrationV3, planRuntimeMigrationV3, type MigrationSourceArtifact } from "../builder/migration-v3";
import { diffV4ApplicationSchemas } from "../builder/schema-diff-v4";
import { applyWorkflow, getComputedValues, seedRuntimeDataV3, validateRuntimeDataV3 } from "../builder/v3";
import { canUsePermission, evaluateOwnership, filterVisibleRows, getV4User, stampOwnedFields, toV3Artifact, validateArtifactV4, type GeneratedAppV4, type V4AppUser, type V4Operation } from "../builder/v4";

export type SharedErrorCode = "validation" | "authorization" | "not_found" | "conflict" | "constraint" | "stale_version" | "migration" | "workflow" | "persistence";
export class SharedRuntimeError extends Error {
  constructor(public readonly code: SharedErrorCode, message: string, public readonly details?: unknown) { super(message); }
}
export type SharedOperation =
  | { type: "create"; collection: string; values: Record<string, unknown> }
  | { type: "update"; collection: string; recordId: string; values: Record<string, unknown> }
  | { type: "delete"; collection: string; recordId: string }
  | { type: "workflow"; workflow: string; recordId: string; inputs?: Record<string, string | number | boolean | null | string[]> };
export interface PublishedRuntimeView { appId: string; versionId: string; versionNumber: number; artifact: GeneratedAppV4; user: V4AppUser; data: RuntimeData; activity: AuditEntry[] }
export interface AuditEntry { id: number; actorId: string; actorName: string; createdAt: string; operation: string; collection: string; recordIds: string[]; result: "success" }
export interface PublicationAnalysis { ok: boolean; appId: string; targetVersionId: string; previousVersionId: string | null; changes: ReturnType<typeof diffV4ApplicationSchemas>; warnings: string[]; requiresConfirmation: boolean; blockedReason?: string }
export interface PublicationResult extends PublicationAnalysis { published: boolean; migratedRecords: number }

const APP_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const MAX_AUDIT_PER_APP = 10_000;
const EMPTY_DATA = (artifact: GeneratedAppV4): RuntimeData => Object.fromEntries(artifact.collections.map((collection) => [collection.id, []]));
const jsonObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype);
const countRows = (data: RuntimeData) => Object.values(data).reduce((total, rows) => total + rows.length, 0);
const clone = <T>(value: T): T => structuredClone(value);

/** SQLite repository with one atomic transaction for state changes, audit rows, and publication switches. */
export class SharedAppRepository {
  private readonly db: DatabaseSync;
  private readonly idFactory: () => string;
  constructor(filename = ":memory:", options: { idFactory?: () => string } = {}) {
    if (filename !== ":memory:") mkdirSync(dirname(resolve(/* turbopackIgnore: true */ filename)), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.idFactory = options.idFactory ?? randomUUID;
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shared_apps(app_id TEXT PRIMARY KEY, published_version TEXT, revision INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS shared_versions(app_id TEXT NOT NULL, version_id TEXT NOT NULL, version_number INTEGER NOT NULL, schema_json TEXT NOT NULL, published_at TEXT NOT NULL, PRIMARY KEY(app_id, version_id), FOREIGN KEY(app_id) REFERENCES shared_apps(app_id));
      CREATE TABLE IF NOT EXISTS shared_records(app_id TEXT NOT NULL, version_id TEXT NOT NULL, collection_id TEXT NOT NULL, record_id TEXT NOT NULL, data_json TEXT NOT NULL, PRIMARY KEY(app_id, version_id, collection_id, record_id), FOREIGN KEY(app_id, version_id) REFERENCES shared_versions(app_id, version_id));
      CREATE INDEX IF NOT EXISTS shared_records_by_collection ON shared_records(app_id, version_id, collection_id);
      CREATE TABLE IF NOT EXISTS shared_audit(id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, version_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TEXT NOT NULL, operation TEXT NOT NULL, collection_id TEXT NOT NULL, record_ids_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS shared_audit_recent ON shared_audit(app_id, id DESC);
      CREATE TABLE IF NOT EXISTS shared_settings(setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL);
    `);
    if (!this.db.prepare("SELECT setting_value FROM shared_settings WHERE setting_key = 'identity_secret'").get()) {
      this.db.prepare("INSERT INTO shared_settings(setting_key, setting_value) VALUES('identity_secret', ?)").run(randomBytes(32).toString("base64url"));
    }
  }

  close() { this.db.close(); }

  private transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = work(); this.db.exec("COMMIT"); return result; }
    catch (error) { try { this.db.exec("ROLLBACK"); } catch { /* Preserve the original transaction failure. */ } throw error; }
  }

  private validateAppId(appId: string) { if (!APP_ID.test(appId)) throw new SharedRuntimeError("validation", "This app address is invalid."); }
  private getAppRow(appId: string) { return this.db.prepare("SELECT app_id, published_version, revision FROM shared_apps WHERE app_id = ?").get(appId) as { app_id: string; published_version: string | null; revision: number } | undefined; }
  private getVersion(appId: string, versionId: string) {
    const row = this.db.prepare("SELECT version_number, schema_json FROM shared_versions WHERE app_id = ? AND version_id = ?").get(appId, versionId) as { version_number: number; schema_json: string } | undefined;
    if (!row) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(row.schema_json); } catch { throw new SharedRuntimeError("persistence", "The saved app version could not be read."); }
    const checked = validateArtifactV4(parsed);
    if (!checked.ok) throw new SharedRuntimeError("persistence", "The saved app version did not pass its safety check.", checked.issues);
    return { versionNumber: row.version_number, artifact: checked.artifact };
  }

  private loadData(appId: string, versionId: string, artifact: GeneratedAppV4): RuntimeData {
    const data = EMPTY_DATA(artifact);
    const rows = this.db.prepare("SELECT collection_id, data_json FROM shared_records WHERE app_id = ? AND version_id = ? ORDER BY collection_id, record_id").all(appId, versionId) as Array<{ collection_id: string; data_json: string }>;
    for (const row of rows) {
      if (!Object.hasOwn(data, row.collection_id)) continue;
      try { data[row.collection_id].push(JSON.parse(row.data_json) as Record<string, unknown>); }
      catch { throw new SharedRuntimeError("persistence", "Saved app records could not be read."); }
    }
    return data;
  }

  private saveData(appId: string, versionId: string, data: RuntimeData) {
    this.db.prepare("DELETE FROM shared_records WHERE app_id = ? AND version_id = ?").run(appId, versionId);
    const insert = this.db.prepare("INSERT INTO shared_records(app_id, version_id, collection_id, record_id, data_json) VALUES(?, ?, ?, ?, ?)");
    for (const [collection, rows] of Object.entries(data)) for (const row of rows) insert.run(appId, versionId, collection, String(row.id), JSON.stringify(row));
  }

  private rowsFromSchema(schema: GeneratedAppV4) {
    const parsed = validateArtifactV4(schema);
    if (!parsed.ok) throw new SharedRuntimeError("validation", "This app version needs changes before it can be published.", parsed.issues);
    return parsed.artifact;
  }

  analyzePublication(appId: string, versionNumber: number, candidate: unknown, expectedPublishedVersion?: string | null): PublicationAnalysis {
    this.validateAppId(appId);
    if (!Number.isInteger(versionNumber) || versionNumber < 1 || versionNumber > 20) throw new SharedRuntimeError("validation", "This app version number is invalid.");
    const checked = validateArtifactV4(candidate);
    if (!checked.ok) return { ok: false, appId, targetVersionId: `v${versionNumber}`, previousVersionId: null, changes: [], warnings: checked.issues, requiresConfirmation: false, blockedReason: "Fix the app checks before publishing." };
    const targetVersionId = `v${versionNumber}`;
    const app = this.getAppRow(appId);
    const previousVersionId = app?.published_version ?? null;
    if (expectedPublishedVersion !== undefined && (expectedPublishedVersion || null) !== previousVersionId) return { ok: false, appId, targetVersionId, previousVersionId, changes: [], warnings: [], requiresConfirmation: false, blockedReason: "The published app changed in another session. Reload before publishing." };
    if (app && this.db.prepare("SELECT 1 FROM shared_versions WHERE app_id = ? AND version_id = ?").get(appId, targetVersionId)) return { ok: false, appId, targetVersionId, previousVersionId, changes: [], warnings: [], requiresConfirmation: false, blockedReason: "This draft version has already been published. Build a new version to make another change." };
    if (!previousVersionId) return { ok: true, appId, targetVersionId, previousVersionId: null, changes: [], warnings: [], requiresConfirmation: false };
    const previous = this.getVersion(appId, previousVersionId);
    if (!previous) return { ok: false, appId, targetVersionId, previousVersionId, changes: [], warnings: [], requiresConfirmation: false, blockedReason: "The current published version is unavailable, so this update cannot continue." };
    const currentData = this.loadData(appId, previousVersionId, previous.artifact);
    const before = toV3Artifact(previous.artifact), after = toV3Artifact(checked.artifact);
    const migration = planRuntimeMigrationV3(before as MigrationSourceArtifact, after, currentData, previous.versionNumber, versionNumber);
    const schemaChanges = diffV4ApplicationSchemas(previous.artifact, checked.artifact);
    const securityWarnings = schemaChanges.filter((change) => change.risk === "security" || change.risk === "destructive").map((change) => change.label);
    const warnings = [...new Set([...migration.warnings, ...securityWarnings])];
    const invalidRequiredData = migration.warnings.some((warning) => /need a .* before they can migrate|cannot all move into this version/i.test(warning));
    return { ok: migration.sourceValid && !invalidRequiredData, appId, targetVersionId, previousVersionId, changes: schemaChanges, warnings, requiresConfirmation: warnings.length > 0, blockedReason: !migration.sourceValid ? "The shared data could not be checked. The current published app is unchanged." : invalidRequiredData ? "Some existing records need values or links before this version can be published." : undefined };
  }

  listVersions(appId: string) {
    this.validateAppId(appId);
    return (this.db.prepare("SELECT version_id, version_number, schema_json, published_at FROM shared_versions WHERE app_id = ? ORDER BY rowid DESC").all(appId) as Array<{ version_id: string; version_number: number; schema_json: string; published_at: string }>).map((row) => {
      const schema = JSON.parse(row.schema_json) as { title?: unknown };
      return { versionId: row.version_id, versionNumber: row.version_number, title: typeof schema.title === "string" ? schema.title : "Shared app", publishedAt: row.published_at };
    });
  }

  analyzeRollback(appId: string, targetVersionId: string, expectedPublishedVersion?: string | null): PublicationAnalysis {
    this.validateAppId(appId);
    const app = this.getAppRow(appId), currentVersionId = app?.published_version ?? null;
    if (!currentVersionId) return { ok: false, appId, targetVersionId, previousVersionId: null, changes: [], warnings: [], requiresConfirmation: false, blockedReason: "There is no published version to restore from." };
    if (expectedPublishedVersion !== undefined && (expectedPublishedVersion || null) !== currentVersionId) return { ok: false, appId, targetVersionId, previousVersionId: currentVersionId, changes: [], warnings: [], requiresConfirmation: false, blockedReason: "The published app changed in another session. Reload before continuing." };
    if (targetVersionId === currentVersionId) return { ok: false, appId, targetVersionId, previousVersionId: currentVersionId, changes: [], warnings: [], requiresConfirmation: false, blockedReason: "That version is already active." };
    const current = this.getVersion(appId, currentVersionId), target = this.getVersion(appId, targetVersionId);
    if (!current || !target) return { ok: false, appId, targetVersionId, previousVersionId: currentVersionId, changes: [], warnings: [], requiresConfirmation: false, blockedReason: "That saved version is not available for rollback." };
    const currentData = this.loadData(appId, currentVersionId, current.artifact);
    const currentSchema = toV3Artifact(current.artifact), targetSchema = toV3Artifact(target.artifact);
    const plan = planRuntimeMigrationV3(currentSchema as MigrationSourceArtifact, targetSchema, currentData, current.versionNumber, target.versionNumber);
    const migration = applyRuntimeMigrationV3(currentSchema as MigrationSourceArtifact, targetSchema, currentData, plan);
    const changes = diffV4ApplicationSchemas(current.artifact, target.artifact);
    const securityWarnings = changes.filter((change) => change.risk === "security" || change.risk === "destructive").map((change) => change.label);
    const warnings = [...new Set([...plan.warnings, ...securityWarnings])];
    const ok = plan.sourceValid && migration.ok;
    return { ok, appId, targetVersionId: `rollback_${(app?.revision ?? 0) + 1}`, previousVersionId: currentVersionId, changes, warnings, requiresConfirmation: warnings.length > 0, blockedReason: ok ? undefined : migration.warnings.at(-1) ?? "The latest shared data cannot safely fit the earlier version." };
  }

  rollback(appId: string, targetVersionId: string, options: { expectedPublishedVersion?: string | null; confirmWarnings?: boolean } = {}): PublicationResult {
    const analysis = this.analyzeRollback(appId, targetVersionId, options.expectedPublishedVersion);
    if (!analysis.ok || analysis.requiresConfirmation && !options.confirmWarnings) return { ...analysis, published: false, migratedRecords: 0 };
    try {
      const migratedRecords = this.transaction(() => {
        const app = this.getAppRow(appId);
        if (!app?.published_version || app.published_version !== analysis.previousVersionId) throw new SharedRuntimeError("stale_version", "The published app changed. Reload before rolling back.");
        const current = this.getVersion(appId, app.published_version), target = this.getVersion(appId, targetVersionId);
        if (!current || !target) throw new SharedRuntimeError("not_found", "That saved version is no longer available.");
        const currentData = this.loadData(appId, app.published_version, current.artifact);
        const currentSchema = toV3Artifact(current.artifact), targetSchema = toV3Artifact(target.artifact);
        const plan = planRuntimeMigrationV3(currentSchema as MigrationSourceArtifact, targetSchema, currentData, current.versionNumber, target.versionNumber);
        const migration = applyRuntimeMigrationV3(currentSchema as MigrationSourceArtifact, targetSchema, currentData, plan);
        if (!migration.ok) throw new SharedRuntimeError("migration", migration.warnings.at(-1) ?? "The latest shared data cannot safely fit the earlier version.", migration.warnings);
        const checked = validateRuntimeDataV3(targetSchema, migration.data);
        if (!checked.ok) throw new SharedRuntimeError("migration", "The earlier schema cannot hold the latest shared records.", checked.issues);
        const rollbackId = analysis.targetVersionId, now = new Date().toISOString();
        this.db.prepare("INSERT INTO shared_versions(app_id, version_id, version_number, schema_json, published_at) VALUES(?, ?, ?, ?, ?)").run(appId, rollbackId, target.versionNumber, JSON.stringify(target.artifact), now);
        this.saveData(appId, rollbackId, checked.data);
        this.db.prepare("UPDATE shared_apps SET published_version = ?, revision = revision + 1 WHERE app_id = ?").run(rollbackId, appId);
        return countRows(checked.data);
      });
      return { ...analysis, published: true, migratedRecords };
    } catch (error) {
      return { ...analysis, ok: false, published: false, migratedRecords: 0, blockedReason: error instanceof SharedRuntimeError ? error.message : "The app could not be rolled back. The current version is unchanged." };
    }
  }

  publish(appId: string, versionNumber: number, candidate: unknown, options: { expectedPublishedVersion?: string | null; confirmWarnings?: boolean } = {}): PublicationResult {
    const analysis = this.analyzePublication(appId, versionNumber, candidate, options.expectedPublishedVersion);
    if (!analysis.ok) return { ...analysis, published: false, migratedRecords: 0 };
    if (analysis.requiresConfirmation && !options.confirmWarnings) return { ...analysis, published: false, migratedRecords: 0 };
    const artifact = this.rowsFromSchema(candidate as GeneratedAppV4);
    const targetVersionId = `v${versionNumber}`;
    try {
      const migratedRecords = this.transaction(() => {
        const app = this.getAppRow(appId);
        const nowPublished = app?.published_version ?? null;
        if ((options.expectedPublishedVersion ?? analysis.previousVersionId) !== nowPublished) throw new SharedRuntimeError("stale_version", "The published app changed in another session. Reload before publishing.");
        if (this.db.prepare("SELECT 1 FROM shared_versions WHERE app_id = ? AND version_id = ?").get(appId, targetVersionId)) throw new SharedRuntimeError("conflict", "This draft version has already been published.");
        let data = seedRuntimeDataV3(toV3Artifact(artifact));
        if (nowPublished) {
          const previous = this.getVersion(appId, nowPublished);
          if (!previous) throw new SharedRuntimeError("persistence", "The current published version could not be read.");
          const sourceData = this.loadData(appId, nowPublished, previous.artifact);
          const before = toV3Artifact(previous.artifact), after = toV3Artifact(artifact);
          const plan = planRuntimeMigrationV3(before as MigrationSourceArtifact, after, sourceData, previous.versionNumber, versionNumber);
          const migration = applyRuntimeMigrationV3(before as MigrationSourceArtifact, after, sourceData, plan);
          if (!migration.ok) throw new SharedRuntimeError("migration", migration.warnings.at(-1) ?? "The shared records could not move to this version.", migration.warnings);
          data = migration.data;
        }
        const checkedData = validateRuntimeDataV3(toV3Artifact(artifact), data);
        if (!checkedData.ok) throw new SharedRuntimeError("migration", "The shared records do not fit this version yet.", checkedData.issues);
        const now = new Date().toISOString();
        if (!app) this.db.prepare("INSERT INTO shared_apps(app_id, published_version, revision, created_at) VALUES(?, NULL, 0, ?)").run(appId, now);
        this.db.prepare("INSERT INTO shared_versions(app_id, version_id, version_number, schema_json, published_at) VALUES(?, ?, ?, ?, ?)").run(appId, targetVersionId, versionNumber, JSON.stringify(artifact), now);
        this.saveData(appId, targetVersionId, checkedData.data);
        this.db.prepare("UPDATE shared_apps SET published_version = ?, revision = revision + 1 WHERE app_id = ?").run(targetVersionId, appId);
        return countRows(checkedData.data);
      });
      return { ...analysis, published: true, migratedRecords };
    } catch (error) {
      if (error instanceof SharedRuntimeError) return { ...analysis, ok: false, published: false, migratedRecords: 0, blockedReason: error.message, warnings: [...new Set([...analysis.warnings, ...(Array.isArray(error.details) ? error.details as string[] : [])])] };
      return { ...analysis, ok: false, published: false, migratedRecords: 0, blockedReason: "The app could not be published. The current version and its records are unchanged." };
    }
  }

  getPublication(appId: string) {
    this.validateAppId(appId);
    const app = this.getAppRow(appId);
    if (!app?.published_version) return null;
    const version = this.getVersion(appId, app.published_version);
    return version ? { versionId: app.published_version, versionNumber: version.versionNumber, artifact: version.artifact, revision: app.revision } : null;
  }

  getTestUsers(appId: string) {
    const publication = this.getPublication(appId);
    return publication?.artifact.users.map(({ id, displayName, roles }) => ({ id, displayName, roles })) ?? [];
  }

  issueIdentityToken(appId: string, userId: string) {
    this.validateAppId(appId);
    const publication = this.getPublication(appId);
    if (!publication || !getV4User(publication.artifact, userId)) throw new SharedRuntimeError("authorization", "Choose an app user listed for this published app.");
    const setting = this.db.prepare("SELECT setting_value FROM shared_settings WHERE setting_key = 'identity_secret'").get() as { setting_value: string };
    const payload = Buffer.from(JSON.stringify({ appId, userId, expiresAt: Date.now() + 12 * 60 * 60 * 1000 })).toString("base64url");
    const signature = createHmac("sha256", setting.setting_value).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }

  resolveIdentity(appId: string, token: string | null | undefined): V4AppUser | null {
    if (!token || token.length > 1200) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const setting = this.db.prepare("SELECT setting_value FROM shared_settings WHERE setting_key = 'identity_secret'").get() as { setting_value: string };
    const expected = createHmac("sha256", setting.setting_value).update(payload).digest();
    let received: Buffer;
    try { received = Buffer.from(signature, "base64url"); } catch { return null; }
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    try {
      const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { appId?: string; userId?: string; expiresAt?: number };
      if (value.appId !== appId || typeof value.userId !== "string" || typeof value.expiresAt !== "number" || value.expiresAt < Date.now()) return null;
      const publication = this.getPublication(appId);
      return publication ? getV4User(publication.artifact, value.userId) : null;
    } catch { return null; }
  }

  readRuntime(appId: string, user: V4AppUser): PublishedRuntimeView | null {
    const publication = this.getPublication(appId);
    if (!publication) return null;
    const data = this.loadData(appId, publication.versionId, publication.artifact);
    const visible: RuntimeData = {};
    for (const collection of publication.artifact.collections) {
      const rows = data[collection.id] ?? [];
      const filtered = filterVisibleRows(publication.artifact, user, collection.id, rows);
      if (filtered.length || publication.artifact.permissions.some((permission) => permission.collection === collection.id && permission.operations.includes("read") && user.roles.includes(permission.role))) {
        visible[collection.id] = filtered.map((row) => {
          const policies = publication.artifact.permissions.filter((permission) => permission.collection === collection.id && permission.operations.includes("read") && user.roles.includes(permission.role) && (permission.visibility !== "owned" || Boolean(permission.ownership && evaluateOwnership(permission.ownership, rows.find((item) => item.id === row.id) ?? row, user))));
          const canSeeComputed = (fieldId: string) => policies.some((permission) => permission.fields === undefined || permission.fields.includes(fieldId));
          const sourceRow = rows.find((item) => item.id === row.id) ?? row;
          const computed = getComputedValues(toV3Artifact(publication.artifact), data, collection.id, sourceRow);
          return { ...row, ...Object.fromEntries(Object.entries(computed).filter(([fieldId]) => canSeeComputed(fieldId))) };
        });
      }
    }
    const canReadActivity = Boolean(canUsePermission(publication.artifact, user, "activity", "read"));
    const activity = canReadActivity ? this.readAudit(appId) : [];
    return { appId, versionId: publication.versionId, versionNumber: publication.versionNumber, artifact: publication.artifact, user, data: visible, activity };
  }

  private readAudit(appId: string): AuditEntry[] {
    return (this.db.prepare("SELECT id, actor_id, actor_name, created_at, operation, collection_id, record_ids_json FROM shared_audit WHERE app_id = ? ORDER BY id DESC LIMIT 50").all(appId) as Array<{ id: number; actor_id: string; actor_name: string; created_at: string; operation: string; collection_id: string; record_ids_json: string }>).map((row) => ({ id: row.id, actorId: row.actor_id, actorName: row.actor_name, createdAt: row.created_at, operation: row.operation, collection: row.collection_id, recordIds: JSON.parse(row.record_ids_json) as string[], result: "success" }));
  }

  mutate(appId: string, user: V4AppUser, operation: SharedOperation, expectedVersionId?: string) {
    this.validateAppId(appId);
    return this.transaction(() => {
      const app = this.getAppRow(appId);
      if (!app?.published_version) throw new SharedRuntimeError("not_found", "This app has not been published yet.");
      if (expectedVersionId && expectedVersionId !== app.published_version) throw new SharedRuntimeError("stale_version", "This app was updated. Refresh it before trying again.");
      const stored = this.getVersion(appId, app.published_version);
      if (!stored) throw new SharedRuntimeError("persistence", "The published app version could not be loaded.");
      const artifact = stored.artifact;
      const trustedUser = getV4User(artifact, user.id);
      if (!trustedUser) throw new SharedRuntimeError("authorization", "Your app identity is no longer available. Choose a test user again.");
      const before = this.loadData(appId, app.published_version, artifact);
      let after = clone(before), collection = "", operationName: string = operation.type, affectedIds: string[] = [];
      if (operation.type === "create" || operation.type === "update" || operation.type === "delete") {
        collection = operation.collection;
        const declared = artifact.collections.find((item) => item.id === collection);
        if (!declared) throw new SharedRuntimeError("validation", "This app does not contain that list.");
        const rows = after[collection] ?? [];
        if (operation.type === "create") {
          const values = this.checkedValues(declared, operation.values);
          const candidate = stampOwnedFields(artifact, trustedUser, collection, { id: this.idFactory(), ...values });
          if (!canUsePermission(artifact, trustedUser, collection, "create", candidate)) throw new SharedRuntimeError("authorization", "Your role cannot add this record.");
          rows.push(candidate); after[collection] = rows; affectedIds = [String(candidate.id)];
        } else {
          const existing = rows.find((row) => row.id === operation.recordId);
          if (!existing) throw new SharedRuntimeError("not_found", "That record is no longer available.");
          const action = operation.type as V4Operation;
          const permission = canUsePermission(artifact, trustedUser, collection, action, existing);
          if (!permission) throw new SharedRuntimeError("authorization", "Your role cannot change this record.");
          if (operation.type === "delete") after[collection] = rows.filter((row) => row.id !== existing.id);
          else {
            const values = this.checkedValues(declared, operation.values);
            if (permission.fields && Object.keys(values).some((key) => !permission.fields?.includes(key))) throw new SharedRuntimeError("authorization", "Your role cannot change those details.");
            const candidate = { ...existing, ...values };
            if (!canUsePermission(artifact, trustedUser, collection, "update", candidate)) throw new SharedRuntimeError("authorization", "You can only change records that belong to you.");
            after[collection] = rows.map((row) => row.id === existing.id ? candidate : row);
          }
          affectedIds = [String(existing.id)];
        }
      } else {
        const workflow = artifact.workflows.find((item) => item.id === operation.workflow);
        const workflowAccess = artifact.workflowPermissions.find((permission) => permission.workflow === operation.workflow && permission.roles.some((role) => trustedUser.roles.includes(role)));
        if (!workflow || !workflowAccess) throw new SharedRuntimeError("authorization", "Your role cannot run that action.");
        collection = workflow.collection; operationName = `workflow:${workflow.id}`;
        const current = (before[workflow.collection] ?? []).find((row) => row.id === operation.recordId);
        if (!current || !canUsePermission(artifact, trustedUser, workflow.collection, "read", current)) throw new SharedRuntimeError("authorization", "You cannot use this action on that record.");
        const inputNames = new Set(workflow.inputs ?? []);
        const inputs = operation.inputs ?? {};
        if (Object.keys(inputs).some((key) => !inputNames.has(key))) throw new SharedRuntimeError("validation", "This action received an unexpected value.");
        const result = applyWorkflow(toV3Artifact(artifact), before, workflow, operation.recordId, inputs);
        if (!result.ok) throw new SharedRuntimeError("workflow", result.feedback);
        after = result.data;
        for (const definition of artifact.collections) {
          const beforeRows = before[definition.id] ?? [], afterRows = after[definition.id] ?? [];
          const beforeIds = new Set(beforeRows.map((row) => String(row.id)));
          const afterIds = new Set(afterRows.map((row) => String(row.id)));
          const newRows = afterRows.filter((row) => !beforeIds.has(String(row.id)));
          for (const row of newRows) {
            const stamped = stampOwnedFields(artifact, trustedUser, definition.id, row);
            if (!canUsePermission(artifact, trustedUser, definition.id, "create", stamped)) throw new SharedRuntimeError("authorization", "Your role cannot create the record required for this action.");
            after[definition.id] = after[definition.id].map((item) => item.id === row.id ? stamped : item);
            affectedIds.push(String(row.id));
          }
          const changedRows = afterRows.filter((row) => beforeIds.has(String(row.id)) && JSON.stringify(beforeRows.find((item) => item.id === row.id)) !== JSON.stringify(row));
          for (const row of changedRows) {
            const old = beforeRows.find((item) => item.id === row.id)!;
            const permission = canUsePermission(artifact, trustedUser, definition.id, "update", old);
            if (!permission || !canUsePermission(artifact, trustedUser, definition.id, "update", row)) throw new SharedRuntimeError("authorization", "Your role cannot change that record.");
            if (permission.fields) {
              const changedFields = Object.keys(row).filter((field) => JSON.stringify(row[field]) !== JSON.stringify(old[field]));
              if (changedFields.some((field) => !permission.fields?.includes(field))) throw new SharedRuntimeError("authorization", "Your role cannot change those details.");
            }
            affectedIds.push(String(row.id));
          }
          const removedRows = beforeRows.filter((row) => !afterIds.has(String(row.id)));
          for (const row of removedRows) {
            if (!canUsePermission(artifact, trustedUser, definition.id, "delete", row)) throw new SharedRuntimeError("authorization", "Your role cannot remove that record.");
            affectedIds.push(String(row.id));
          }
        }
      }
      const checked = validateRuntimeDataV3(toV3Artifact(artifact), after);
      if (!checked.ok) throw new SharedRuntimeError("constraint", "That change would break an app rule. Review the record and try again.", checked.issues);
      after = checked.data;
      this.saveData(appId, app.published_version, after);
      const createdAt = new Date().toISOString();
      this.db.prepare("INSERT INTO shared_audit(app_id, version_id, actor_id, actor_name, created_at, operation, collection_id, record_ids_json) VALUES(?, ?, ?, ?, ?, ?, ?, ?)").run(appId, app.published_version, trustedUser.id, trustedUser.displayName, createdAt, operationName, collection, JSON.stringify([...new Set(affectedIds)].slice(0, 100)));
      this.db.prepare("DELETE FROM shared_audit WHERE app_id = ? AND id NOT IN (SELECT id FROM shared_audit WHERE app_id = ? ORDER BY id DESC LIMIT ?)").run(appId, appId, MAX_AUDIT_PER_APP);
      this.db.prepare("UPDATE shared_apps SET revision = revision + 1 WHERE app_id = ?").run(appId);
      return { versionId: app.published_version, data: after };
    });
  }

  private checkedValues(collection: GeneratedAppV4["collections"][number], values: Record<string, unknown>) {
    if (!jsonObject(values) || Object.keys(values).length > 32) throw new SharedRuntimeError("validation", "Enter a few valid values and try again.");
    const fields = new Set(collection.fields.map((field) => field.id));
    const relationships = new Set(collection.relationships.map((relationship) => relationship.field));
    if (Object.keys(values).some((key) => key === "id" || !fields.has(key) && !relationships.has(key))) throw new SharedRuntimeError("validation", "This app does not allow that field to be changed.");
    const encoded = JSON.stringify(values);
    if (encoded.length > 16_000) throw new SharedRuntimeError("validation", "That change is too large.");
    return values;
  }

  resetTestData(appId: string) {
    this.validateAppId(appId);
    return this.transaction(() => {
      const publication = this.getPublication(appId);
      if (!publication) throw new SharedRuntimeError("not_found", "This app has not been published yet.");
      this.saveData(appId, publication.versionId, seedRuntimeDataV3(toV3Artifact(publication.artifact)));
      this.db.prepare("DELETE FROM shared_audit WHERE app_id = ?").run(appId);
    });
  }

  static defaultDatabasePath() {
    return resolve(/* turbopackIgnore: true */ process.env.BUILDLOOP_SHARED_DB_PATH || join(process.cwd(), ".buildloop-data", "shared.sqlite"));
  }
}

let repository: SharedAppRepository | undefined;
export function getSharedAppRepository() {
  if (!repository) repository = new SharedAppRepository(SharedAppRepository.defaultDatabasePath());
  return repository;
}
export function closeSharedAppRepository() { repository?.close(); repository = undefined; }

export function identityCookieName(appId: string) { if (!APP_ID.test(appId)) throw new SharedRuntimeError("validation", "This app address is invalid."); return `buildloop_identity_${appId}`; }
export function parseCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const pair of header.split(";")) { const index = pair.indexOf("="); if (index < 0) continue; if (pair.slice(0, index).trim() === name) return decodeURIComponent(pair.slice(index + 1).trim()); }
  return null;
}

export const DEFAULT_DB_PATH = SharedAppRepository.defaultDatabasePath;
