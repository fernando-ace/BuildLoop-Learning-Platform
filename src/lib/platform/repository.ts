import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPlatformPool } from "./database";
import type { PlatformIdentity } from "./session";
import type { PlatformRole } from "./authorization";
import { validateArtifact, type GeneratedApp } from "@/lib/builder/contract";
import { validateArtifactV4, type GeneratedAppV4 } from "@/lib/builder/v4";
import { diffV4ApplicationSchemas } from "@/lib/builder/schema-diff-v4";
import { applyRuntimeMigrationV3, planRuntimeMigrationV3, type MigrationSourceArtifact } from "@/lib/builder/migration-v3";
import { getComputedValues, validateRuntimeDataV3 } from "@/lib/builder/v3";
import type { RuntimeData } from "@/lib/builder/v2";
import { toV3Artifact } from "@/lib/builder/v4";
import { canUsePermission, evaluateOwnership, filterVisibleRows } from "@/lib/builder/v4";
import { applyRuntimeOperation } from "@/lib/shared-apps/operation";
import { SharedRuntimeError, type SharedOperation } from "@/lib/shared-apps/runtime-errors";
import { authorizeApplicationOperation } from "./authorization";

export class PlatformError extends Error {
  constructor(public readonly code: "unauthenticated" | "not_found" | "forbidden" | "conflict" | "invalid" | "unavailable", message: string) { super(message); }
}

const APP_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const APP_ID = /^app_[0-9a-f-]{36}$/;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const slugBase = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42).replace(/-$/g, "") || "my-app";

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPlatformPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

async function membership(client: PoolClient, userId: string, appId: string, lock = false) {
  const result = await client.query<{ platform_role: PlatformRole; app_role: string | null }>(
    `SELECT m.platform_role, m.app_role FROM applications a JOIN application_memberships m ON m.app_id = a.id WHERE a.id = $1 AND m.user_id = $2${lock ? " FOR UPDATE OF a, m" : ""}`,
    [appId, userId],
  );
  if (!result.rowCount) throw new PlatformError("not_found", "That application is unavailable to your account.");
  return result.rows[0];
}

function requireAdmin(role: PlatformRole) {
  if (role !== "owner" && role !== "administrator") throw new PlatformError("forbidden", "An app owner or administrator must do that.");
}

async function writeAudit(client: PoolClient, appId: string, actor: string, eventType: string, resourceId: string | null, metadata: Record<string, unknown> = {}) {
  await client.query("INSERT INTO audit_events(id, app_id, actor_user_id, event_type, resource_id, metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)", [randomUUID(), appId, actor, eventType, resourceId, JSON.stringify(metadata)]);
}

export interface ApplicationSummary { id: string; projectId: string; slug: string; name: string; platformRole: PlatformRole; appRole: string | null; productionVersionId: string | null; productionVersionNumber: number | null; }

function emptyRuntime(artifact: GeneratedAppV4): RuntimeData { return Object.fromEntries(artifact.collections.map((collection) => [collection.id, []])); }
function countRuntime(data: RuntimeData) { return Object.values(data).reduce((sum, rows) => sum + rows.length, 0); }

export class PlatformRepository {
  private async loadRuntime(client: PoolClient, appId: string, environment: "preview" | "production", artifact: GeneratedAppV4): Promise<RuntimeData> {
    const result = await client.query<{ collection_id: string; record_id: string; data: Record<string, unknown> }>("SELECT collection_id,record_id,data FROM runtime_records WHERE app_id=$1 AND environment=$2 ORDER BY collection_id,record_id", [appId, environment]);
    const data = emptyRuntime(artifact);
    for (const row of result.rows) if (data[row.collection_id]) data[row.collection_id].push(row.data);
    const checked = validateRuntimeDataV3(toV3Artifact(artifact), data);
    if (!checked.ok) throw new PlatformError("conflict", "Saved app records do not match this version. Ask an owner to review the migration.");
    return checked.data;
  }

  private async saveRuntime(client: PoolClient, appId: string, environment: "preview" | "production", data: RuntimeData) {
    await client.query("DELETE FROM runtime_records WHERE app_id=$1 AND environment=$2", [appId, environment]);
    for (const [collectionId, rows] of Object.entries(data)) for (const row of rows) {
      await client.query("INSERT INTO runtime_records(app_id,environment,collection_id,record_id,data) VALUES($1,$2,$3,$4,$5::jsonb)", [appId, environment, collectionId, String(row.id), JSON.stringify(row)]);
    }
  }

  private async publicationPlan(client: PoolClient, userId: string, appId: string, targetVersionId: string, expectedVersionId?: string | null) {
    const access = await membership(client, userId, appId, true);
    requireAdmin(access.platform_role);
    const current = await client.query<{ published_version_id: string | null }>("SELECT published_version_id FROM app_environments WHERE app_id=$1 AND environment='production' FOR UPDATE", [appId]);
    if (!current.rowCount) throw new PlatformError("not_found", "This app does not have a production environment.");
    const currentVersionId = current.rows[0].published_version_id;
    if (expectedVersionId !== undefined && expectedVersionId !== currentVersionId) throw new PlatformError("conflict", "Production changed while you were reviewing. Refresh the app before publishing.");
    const candidateResult = await client.query<{ version_number: number; artifact: GeneratedApp }>("SELECT version_number,artifact FROM application_versions WHERE app_id=$1 AND version_id=$2", [appId, targetVersionId]);
    const candidateRow = candidateResult.rows[0];
    if (!candidateRow) throw new PlatformError("not_found", "That version is not part of this app.");
    const candidate = validateArtifactV4(candidateRow.artifact);
    if (!candidate.ok) throw new PlatformError("invalid", "Only a validated role-based app version can be published to the shared runtime.");
    const assignedRoles = await client.query<{ app_role: string | null; count: string }>("SELECT app_role,count(*) OVER (PARTITION BY app_role) AS count FROM application_memberships WHERE app_id=$1 AND app_role IS NOT NULL", [appId]);
    const invalidAssignments = assignedRoles.rows.filter((row) => !candidate.artifact.roles.some((role) => role.id === row.app_role));
    if (invalidAssignments.length) throw new PlatformError("conflict", "Some collaborators use a role removed from this version. Reassign those roles before publishing.");
    const currentRow = currentVersionId ? await client.query<{ version_number: number; artifact: GeneratedApp }>("SELECT version_number,artifact FROM application_versions WHERE app_id=$1 AND version_id=$2", [appId, currentVersionId]) : null;
    const currentArtifactResult = currentRow?.rows[0];
    let data = Object.fromEntries(candidate.artifact.collections.map((collection) => [collection.id, structuredClone(collection.seed ?? [])]));
    const initialCheck = validateRuntimeDataV3(toV3Artifact(candidate.artifact), data);
    if (!initialCheck.ok) throw new PlatformError("invalid", "This version's sample records do not match its app rules.");
    data = initialCheck.data;
    let warnings: string[] = [];
    let changes: ReturnType<typeof diffV4ApplicationSchemas> = [];
    let migrationPlan: unknown = { sourceVersion: null, targetVersion: candidateRow.version_number, changes: [], warnings: [] };
    if (currentVersionId && currentArtifactResult) {
      if (currentArtifactResult.artifact.format !== "buildloop-app-v4") throw new PlatformError("conflict", "This saved publication requires a supported migration before it can move to the hosted runtime.");
      const previous = validateArtifactV4(currentArtifactResult.artifact);
      if (!previous.ok) throw new PlatformError("conflict", "The current production version needs repair before another version can be published.");
      const source = await this.loadRuntime(client, appId, "production", previous.artifact);
      const plan = planRuntimeMigrationV3(toV3Artifact(previous.artifact) as MigrationSourceArtifact, toV3Artifact(candidate.artifact), source, currentArtifactResult.version_number, candidateRow.version_number);
      migrationPlan = plan;
      const migration = applyRuntimeMigrationV3(toV3Artifact(previous.artifact), toV3Artifact(candidate.artifact), source, plan);
      warnings = [...plan.warnings, ...migration.warnings.filter((warning) => !plan.warnings.includes(warning))];
      if (!migration.ok) throw new PlatformError("conflict", warnings.at(-1) ?? "Saved records cannot move safely to this version.");
      data = migration.data;
      changes = diffV4ApplicationSchemas(previous.artifact, candidate.artifact);
    }
    const requiresConfirmation = changes.some((change) => change.risk !== "informational") || warnings.length > 0;
    return { access, candidate: candidate.artifact, targetVersionId, versionNumber: candidateRow.version_number, currentVersionId, changes, warnings, migrationPlan, data, requiresConfirmation };
  }

  async analyzePublication(user: PlatformIdentity, appId: string, targetVersionId: string, expectedVersionId?: string | null) {
    return transaction(async (client) => {
      const plan = await this.publicationPlan(client, user.id, appId, targetVersionId, expectedVersionId);
      return { ok: true, published: false, appId, ...plan, migratedRecords: 0 };
    });
  }

  async publishVersion(user: PlatformIdentity, appId: string, targetVersionId: string, options: { expectedVersionId?: string | null; confirmWarnings?: boolean; rollback?: boolean } = {}) {
    try {
      const plan = await transaction(async (client) => {
        const prepared = await this.publicationPlan(client, user.id, appId, targetVersionId, options.expectedVersionId);
        if (prepared.requiresConfirmation && !options.confirmWarnings) return { ...prepared, needsReview: true as const, migratedRecords: 0 };
        const now = new Date().toISOString();
        await this.saveRuntime(client, appId, "production", prepared.data);
        await client.query("UPDATE app_environments SET published_version_id=$2,revision=revision+1,updated_at=now() WHERE app_id=$1 AND environment='production'", [appId, targetVersionId]);
        await client.query("INSERT INTO schema_migrations(app_id,environment,version_id,migration_plan,status,applied_at) VALUES($1,'production',$2,$3::jsonb,'applied',$4) ON CONFLICT(app_id,environment,version_id) DO UPDATE SET migration_plan=EXCLUDED.migration_plan,status='applied',applied_at=EXCLUDED.applied_at", [appId, targetVersionId, JSON.stringify(prepared.migrationPlan), now]);
        const action = options.rollback ? "rollback" : "published";
        await client.query("INSERT INTO publication_history(id,app_id,version_id,environment,action,created_by,metadata) VALUES($1,$2,$3,'production',$4,$5,$6::jsonb)", [randomUUID(), appId, targetVersionId, action, user.id, JSON.stringify({ fromVersionId: prepared.currentVersionId, versionNumber: prepared.versionNumber, migratedRecords: countRuntime(prepared.data) })]);
        await writeAudit(client, appId, user.id, options.rollback ? "publication.rollback_completed" : "publication.published", targetVersionId, { fromVersionId: prepared.currentVersionId, versionNumber: prepared.versionNumber });
        return { ...prepared, needsReview: false as const, migratedRecords: countRuntime(prepared.data) };
      });
      if (plan.needsReview) return { ...plan, published: false, requiresConfirmation: true };
      return { ...plan, published: true, requiresConfirmation: plan.requiresConfirmation };
    } catch (error) {
      if (error instanceof PlatformError && (error.code === "conflict" || error.code === "invalid")) {
        await transaction(async (client) => {
          const access = await membership(client, user.id, appId);
          requireAdmin(access.platform_role);
          await client.query("INSERT INTO publication_history(id,app_id,version_id,environment,action,created_by,metadata) SELECT $1,$2,$3,'production',$4,$5,$6::jsonb WHERE EXISTS(SELECT 1 FROM application_versions WHERE app_id=$2 AND version_id=$3)", [randomUUID(), appId, targetVersionId, options.rollback ? "rollback_rejected" : "publication_failed", user.id, JSON.stringify({ reason: error.message })]);
          await writeAudit(client, appId, user.id, options.rollback ? "publication.rollback_rejected" : "publication.failed", targetVersionId, { reason: error.message });
        });
      }
      throw error;
    }
  }

  async readVersion(userId: string, appId: string, versionId: string) {
    const result = await getPlatformPool().query<{ version_number: number; artifact: GeneratedApp }>("SELECT v.version_number,v.artifact FROM application_versions v JOIN application_memberships m ON m.app_id=v.app_id AND m.user_id=$3 WHERE v.app_id=$1 AND v.version_id=$2", [appId, versionId, userId]);
    if (!result.rowCount) throw new PlatformError("not_found", "That version is unavailable to your account.");
    return { versionId, versionNumber: result.rows[0].version_number, artifact: result.rows[0].artifact };
  }

  async readRuntime(user: PlatformIdentity, appId: string, environment: "preview" | "production" = "production") {
    return transaction(async (client) => {
      const access = await membership(client, user.id, appId);
      if (environment === "preview") requireAdmin(access.platform_role);
      const selected = await client.query<{ published_version_id: string | null }>("SELECT published_version_id FROM app_environments WHERE app_id=$1 AND environment=$2", [appId, environment]);
      const versionId = selected.rows[0]?.published_version_id;
      if (!versionId) throw new PlatformError("not_found", environment === "production" ? "This app has not been published yet." : "Build a version before opening its preview.");
      const stored = await client.query<{ version_number: number; artifact: GeneratedApp }>("SELECT version_number,artifact FROM application_versions WHERE app_id=$1 AND version_id=$2", [appId, versionId]);
      const checked = validateArtifactV4(stored.rows[0]?.artifact);
      if (!checked.ok) throw new PlatformError("conflict", "This version cannot run in the shared app environment.");
      const decision = authorizeApplicationOperation({ userId: user.id, appId, membership: { appId, userId: user.id, platformRole: access.platform_role, appRole: access.app_role }, artifact: checked.artifact, operation: "runtime", displayName: user.name });
      if (!decision.allowed || !decision.appUser) throw new PlatformError("forbidden", "Your account does not have an app role for this version.");
      const userView = decision.appUser;
      const fullData = await this.loadRuntime(client, appId, environment, checked.artifact);
      const visible: RuntimeData = {};
      for (const collection of checked.artifact.collections) {
        const rows = fullData[collection.id] ?? [];
        const filtered = filterVisibleRows(checked.artifact, userView, collection.id, rows);
        if (filtered.length || checked.artifact.permissions.some((permission) => permission.collection === collection.id && permission.operations.includes("read") && userView.roles.includes(permission.role))) {
          visible[collection.id] = filtered.map((row) => {
            const policies = checked.artifact.permissions.filter((permission) => permission.collection === collection.id && permission.operations.includes("read") && userView.roles.includes(permission.role) && (permission.visibility !== "owned" || Boolean(permission.ownership && evaluateOwnership(permission.ownership, rows.find((item) => item.id === row.id) ?? row, userView))));
            const canSeeComputed = (fieldId: string) => policies.some((permission) => permission.fields === undefined || permission.fields.includes(fieldId));
            const sourceRow = rows.find((item) => item.id === row.id) ?? row;
            const computed = getComputedValues(toV3Artifact(checked.artifact), fullData, collection.id, sourceRow);
            return { ...row, ...Object.fromEntries(Object.entries(computed).filter(([fieldId]) => canSeeComputed(fieldId))) };
          });
        }
      }
      const publicArtifact = structuredClone(checked.artifact);
      publicArtifact.users = [];
      for (const collection of publicArtifact.collections) collection.seed = [];
      const activity = canUsePermission(checked.artifact, userView, "activity", "read")
        ? (await client.query("SELECT e.id,e.event_type AS operation,u.name AS \"actorName\",e.created_at AS \"createdAt\",e.metadata->'recordIds' AS \"recordIds\" FROM audit_events e JOIN platform_users u ON u.id=e.actor_user_id WHERE e.app_id=$1 ORDER BY e.created_at DESC LIMIT 50", [appId])).rows
        : [];
      return { published: true as const, appId, versionId, versionNumber: stored.rows[0].version_number, environment, artifact: publicArtifact, user: userView, data: visible, activity };
    });
  }

  async mutateRuntime(user: PlatformIdentity, appId: string, operation: SharedOperation, expectedVersionId?: string, environment: "preview" | "production" = "production") {
    try {
      return await transaction(async (client) => {
        const access = await membership(client, user.id, appId, true);
        if (environment === "preview") requireAdmin(access.platform_role);
        const active = await client.query<{ published_version_id: string | null }>("SELECT published_version_id FROM app_environments WHERE app_id=$1 AND environment=$2 FOR UPDATE", [appId, environment]);
        const versionId = active.rows[0]?.published_version_id;
        if (!versionId) throw new PlatformError("not_found", "This app environment has no selected version.");
        if (expectedVersionId && expectedVersionId !== versionId) throw new PlatformError("conflict", "This app changed. Refresh it before trying again.");
        const stored = await client.query<{ artifact: GeneratedApp }>("SELECT artifact FROM application_versions WHERE app_id=$1 AND version_id=$2", [appId, versionId]);
        const checked = validateArtifactV4(stored.rows[0]?.artifact);
        if (!checked.ok) throw new PlatformError("conflict", "This version cannot accept shared app changes.");
        const decision = authorizeApplicationOperation({ userId: user.id, appId, membership: { appId, userId: user.id, platformRole: access.platform_role, appRole: access.app_role }, artifact: checked.artifact, operation: "runtime", displayName: user.name });
        if (!decision.allowed || !decision.appUser) throw new PlatformError("forbidden", "Your account no longer has permission to use this app.");
        const before = await this.loadRuntime(client, appId, environment, checked.artifact);
        const result = applyRuntimeOperation(checked.artifact, decision.appUser, before, operation);
        await this.saveRuntime(client, appId, environment, result.data);
        await client.query("UPDATE app_environments SET revision=revision+1,updated_at=now() WHERE app_id=$1 AND environment=$2", [appId, environment]);
        await writeAudit(client, appId, user.id, `runtime.${result.operation}`, result.collection, { recordIds: result.recordIds, environment });
        return { versionId, environment };
      });
    } catch (error) {
      if (error instanceof SharedRuntimeError) {
        const mapped = error.code === "authorization" ? "forbidden" : error.code === "not_found" ? "not_found" : error.code === "conflict" || error.code === "stale_version" ? "conflict" : "invalid";
        throw new PlatformError(mapped, error.message);
      }
      throw error;
    }
  }

  async listVersions(userId: string, appId: string) {
    const result = await getPlatformPool().query("SELECT v.version_id AS \"versionId\",v.version_number AS \"versionNumber\",v.artifact->>'title' AS title,v.created_at AS \"createdAt\",e.published_version_id AS \"productionVersionId\" FROM application_versions v JOIN application_memberships m ON m.app_id=v.app_id AND m.user_id=$2 LEFT JOIN app_environments e ON e.app_id=v.app_id AND e.environment='production' WHERE v.app_id=$1 ORDER BY v.version_number DESC", [appId, userId]);
    return result.rows;
  }

  async listPublicationHistory(userId: string, appId: string) {
    const result = await getPlatformPool().query("SELECT h.id,h.version_id AS \"versionId\",v.version_number AS \"versionNumber\",h.action,h.environment,h.created_at AS \"createdAt\",h.metadata,e.published_version_id AS \"currentVersionId\" FROM publication_history h JOIN application_memberships m ON m.app_id=h.app_id AND m.user_id=$2 JOIN application_versions v ON v.app_id=h.app_id AND v.version_id=h.version_id LEFT JOIN app_environments e ON e.app_id=h.app_id AND e.environment=h.environment WHERE h.app_id=$1 ORDER BY h.created_at DESC LIMIT 100", [appId, userId]);
    return result.rows;
  }
  async createApplication(user: PlatformIdentity, name: string, brief: Record<string, unknown> = {}) {
    const cleanName = name.trim().slice(0, 80);
    if (cleanName.length < 2) throw new PlatformError("invalid", "Give the app a name between 2 and 80 characters.");
    const id = `app_${randomUUID()}`;
    const projectId = randomUUID();
    const slug = `${slugBase(cleanName)}-${randomBytes(3).toString("hex")}`;
    if (!APP_ID.test(id) || !APP_SLUG.test(slug)) throw new PlatformError("invalid", "This app name cannot be used as a safe address.");
    await transaction(async (client) => {
      await client.query("INSERT INTO studio_projects(id, owner_user_id, name, brief) VALUES($1,$2,$3,$4::jsonb)", [projectId, user.id, cleanName, JSON.stringify(brief)]);
      await client.query("INSERT INTO applications(id, project_id, slug, name) VALUES($1,$2,$3,$4)", [id, projectId, slug, cleanName]);
      await client.query("INSERT INTO application_memberships(app_id, user_id, platform_role, app_role) VALUES($1,$2,'owner',NULL)", [id, user.id]);
      await client.query("INSERT INTO app_environments(app_id, environment) VALUES($1,'preview'),($1,'production')", [id]);
      await writeAudit(client, id, user.id, "app.created", id, { name: cleanName, slug });
    });
    return { id, projectId, slug, name: cleanName };
  }

  async listApplications(userId: string): Promise<ApplicationSummary[]> {
    const result = await getPlatformPool().query<ApplicationSummary>(
      `SELECT a.id, a.project_id AS "projectId", a.slug, a.name, m.platform_role AS "platformRole", m.app_role AS "appRole", e.published_version_id AS "productionVersionId", v.version_number AS "productionVersionNumber" FROM applications a JOIN application_memberships m ON m.app_id = a.id AND m.user_id = $1 LEFT JOIN app_environments e ON e.app_id = a.id AND e.environment = 'production' LEFT JOIN application_versions v ON v.app_id = e.app_id AND v.version_id = e.published_version_id ORDER BY a.created_at DESC`, [userId]);
    return result.rows;
  }

  async saveVersion(user: PlatformIdentity, appId: string, versionNumber: number, value: unknown, metadata: Record<string, unknown> = {}) {
    if (!APP_ID.test(appId) || !Number.isSafeInteger(versionNumber) || versionNumber < 1 || versionNumber > 100) throw new PlatformError("invalid", "This app version is invalid.");
    const checked = validateArtifact(value);
    if (!checked.ok) throw new PlatformError("invalid", "This generated app did not pass BuildLoop's artifact checks.");
    if (JSON.stringify(checked.artifact).length > 150_000) throw new PlatformError("invalid", "This app version is too large to save.");
    const versionId = `v${versionNumber}`;
    await transaction(async (client) => {
      const access = await membership(client, user.id, appId, true);
      requireAdmin(access.platform_role);
      const locked = await client.query<{ max_number: number | null }>("SELECT max(version_number) AS max_number FROM application_versions WHERE app_id=$1", [appId]);
      const max = locked.rows[0].max_number;
      if (max !== null && versionNumber !== max + 1) throw new PlatformError("conflict", "Build the next version in this project's history before saving it.");
      await client.query("INSERT INTO application_versions(app_id, version_id, version_number, artifact, metadata, created_by) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6)", [appId, versionId, versionNumber, JSON.stringify(checked.artifact), JSON.stringify(metadata), user.id]);
      if (checked.artifact.format === "buildloop-app-v4") {
        const previewData = Object.fromEntries(checked.artifact.collections.map((collection) => [collection.id, structuredClone(collection.seed ?? [])]));
        const validPreview = validateRuntimeDataV3(toV3Artifact(checked.artifact), previewData);
        if (!validPreview.ok) throw new PlatformError("invalid", "This app version has sample records that do not match its data rules.");
        await this.saveRuntime(client, appId, "preview", validPreview.data);
      }
      await client.query("INSERT INTO app_environments(app_id, environment, published_version_id, revision) VALUES($1,'preview',$2,1) ON CONFLICT(app_id, environment) DO UPDATE SET published_version_id=EXCLUDED.published_version_id, revision=app_environments.revision+1, updated_at=now()", [appId, versionId]);
      if (checked.artifact.format === "buildloop-app-v4") {
        const role = checked.artifact.roles.find((item) => /owner|admin|coordinator|organizer|manager|officer/i.test(`${item.id} ${item.label}`))?.id ?? checked.artifact.roles[0]?.id;
        if (role) await client.query("UPDATE application_memberships SET app_role=$2 WHERE app_id=$1 AND platform_role='owner' AND app_role IS NULL", [appId, role]);
      }
      await client.query("INSERT INTO publication_history(id, app_id, version_id, environment, action, created_by, metadata) VALUES($1,$2,$3,'preview','previewed',$4,$5::jsonb)", [randomUUID(), appId, versionId, user.id, JSON.stringify({ versionNumber })]);
    });
    return { appId, versionId, versionNumber, artifact: checked.artifact as GeneratedApp };
  }

  async getApplication(userId: string, appId: string) {
    if (!APP_ID.test(appId)) throw new PlatformError("not_found", "That application is unavailable to your account.");
    const result = await getPlatformPool().query(
      `SELECT a.id, a.project_id, a.slug, a.name, m.platform_role, m.app_role, prod.published_version_id AS production_version_id, pv.version_number AS production_version_number, prev.published_version_id AS preview_version_id FROM applications a JOIN application_memberships m ON m.app_id=a.id AND m.user_id=$2 LEFT JOIN app_environments prod ON prod.app_id=a.id AND prod.environment='production' LEFT JOIN application_versions pv ON pv.app_id=prod.app_id AND pv.version_id=prod.published_version_id LEFT JOIN app_environments prev ON prev.app_id=a.id AND prev.environment='preview' WHERE a.id=$1`, [appId, userId]);
    if (!result.rowCount) throw new PlatformError("not_found", "That application is unavailable to your account.");
    return result.rows[0];
  }

  async createInvitation(user: PlatformIdentity, appId: string, appRole: string, email?: string) {
    const token = randomBytes(32).toString("base64url");
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await transaction(async (client) => {
      const access = await membership(client, user.id, appId, true);
      requireAdmin(access.platform_role);
      const version = await client.query<{ artifact: GeneratedApp }>("SELECT artifact FROM application_versions WHERE app_id=$1 ORDER BY version_number DESC LIMIT 1", [appId]);
      if (!version.rowCount || version.rows[0].artifact.format !== "buildloop-app-v4") throw new PlatformError("conflict", "Build a role-based app before inviting collaborators.");
      const valid = validateArtifactV4(version.rows[0].artifact);
      if (!valid.ok || !valid.artifact.roles.some((role) => role.id === appRole)) throw new PlatformError("invalid", "Choose a role defined by this app.");
      const cleanEmail = email?.trim().toLowerCase() || null;
      if (cleanEmail && (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) throw new PlatformError("invalid", "Enter a valid email address.");
      await client.query("INSERT INTO app_invitations(id, app_id, invited_by, email, app_role, token_hash, expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, appId, user.id, cleanEmail, appRole, hashToken(token), expiresAt]);
      await writeAudit(client, appId, user.id, "invitation.created", id, { appRole, expiresAt: expiresAt.toISOString() });
    });
    return { id, token, expiresAt: expiresAt.toISOString() };
  }

  async acceptInvitation(user: PlatformIdentity, token: string) {
    if (token.length < 40 || token.length > 128) throw new PlatformError("invalid", "This invitation link is not valid.");
    const result = await transaction(async (client) => {
      const result = await client.query<{ id: string; app_id: string; app_role: string; email: string | null; status: string; expires_at: Date; accepted_by: string | null }>("SELECT id, app_id, app_role, email, status, expires_at, accepted_by FROM app_invitations WHERE token_hash=$1 FOR UPDATE", [hashToken(token)]);
      const invitation = result.rows[0];
      if (!invitation) throw new PlatformError("not_found", "This invitation link is not valid.");
      if (invitation.status === "accepted") {
        if (invitation.accepted_by === user.id) return { appId: invitation.app_id, alreadyAccepted: true };
        throw new PlatformError("conflict", "This invitation has already been used.");
      }
      if (invitation.status !== "pending") throw new PlatformError("conflict", "This invitation is no longer available.");
      if (new Date(invitation.expires_at).getTime() <= Date.now()) {
        await client.query("UPDATE app_invitations SET status='expired' WHERE id=$1", [invitation.id]);
        return { expired: true as const };
      }
      if (invitation.email && invitation.email !== user.email.toLowerCase()) throw new PlatformError("forbidden", "Sign in with the email address this invitation was sent to.");
      await client.query("INSERT INTO application_memberships(app_id,user_id,platform_role,app_role) VALUES($1,$2,'member',$3) ON CONFLICT(app_id,user_id) DO NOTHING", [invitation.app_id, user.id, invitation.app_role]);
      await client.query("UPDATE app_invitations SET status='accepted', accepted_by=$2, accepted_at=now() WHERE id=$1", [invitation.id, user.id]);
      await writeAudit(client, invitation.app_id, user.id, "invitation.accepted", invitation.id, { appRole: invitation.app_role });
      return { appId: invitation.app_id, alreadyAccepted: false as const };
    });
    if ("expired" in result) throw new PlatformError("conflict", "This invitation has expired. Ask the app owner for a new one.");
    return result;
  }

  async changeAppRole(user: PlatformIdentity, appId: string, memberId: string, appRole: string) {
    await transaction(async (client) => {
      const access = await membership(client, user.id, appId, true);
      requireAdmin(access.platform_role);
      if (memberId === user.id) throw new PlatformError("forbidden", "You cannot change your own app role.");
      const version = await client.query<{ artifact: GeneratedApp }>("SELECT artifact FROM application_versions WHERE app_id=$1 ORDER BY version_number DESC LIMIT 1", [appId]);
      if (!version.rowCount || version.rows[0].artifact.format !== "buildloop-app-v4") throw new PlatformError("conflict", "This app version does not have assignable app roles.");
      const valid = validateArtifactV4(version.rows[0].artifact);
      if (!valid.ok || !valid.artifact.roles.some((role) => role.id === appRole)) throw new PlatformError("invalid", "Choose a role defined by this app.");
      const changed = await client.query("UPDATE application_memberships SET app_role=$3 WHERE app_id=$1 AND user_id=$2 RETURNING user_id", [appId, memberId, appRole]);
      if (!changed.rowCount) throw new PlatformError("not_found", "That member is no longer part of this app.");
      await writeAudit(client, appId, user.id, "membership.app_role_changed", memberId, { appRole });
    });
  }

  async changePlatformRole(user: PlatformIdentity, appId: string, memberId: string, platformRole: "administrator" | "member") {
    if (memberId === user.id) throw new PlatformError("forbidden", "You cannot change your own platform role.");
    await transaction(async (client) => {
      const access = await membership(client, user.id, appId, true);
      if (access.platform_role !== "owner") throw new PlatformError("forbidden", "Only the app owner can change platform administrator access.");
      const target = await client.query<{ platform_role: PlatformRole }>("SELECT platform_role FROM application_memberships WHERE app_id=$1 AND user_id=$2 FOR UPDATE", [appId, memberId]);
      if (!target.rowCount) throw new PlatformError("not_found", "That member is no longer part of this app.");
      if (target.rows[0].platform_role === "owner") throw new PlatformError("conflict", "Transfer ownership before changing the owner's platform role.");
      await client.query("UPDATE application_memberships SET platform_role=$3 WHERE app_id=$1 AND user_id=$2", [appId, memberId, platformRole]);
      await writeAudit(client, appId, user.id, "membership.platform_role_changed", memberId, { platformRole });
    });
  }

  async removeMember(user: PlatformIdentity, appId: string, memberId: string) {
    await transaction(async (client) => {
      const access = await membership(client, user.id, appId, true);
      requireAdmin(access.platform_role);
      const target = await client.query<{ platform_role: PlatformRole }>("SELECT platform_role FROM application_memberships WHERE app_id=$1 AND user_id=$2 FOR UPDATE", [appId, memberId]);
      if (!target.rowCount) throw new PlatformError("not_found", "That member is no longer part of this app.");
      if ((target.rows[0].platform_role === "owner" || target.rows[0].platform_role === "administrator") && access.platform_role !== "owner") throw new PlatformError("forbidden", "Only an owner can remove an app administrator.");
      if (target.rows[0].platform_role === "owner") {
        const owners = await client.query<{ count: string }>("SELECT count(*) FROM application_memberships WHERE app_id=$1 AND platform_role='owner'", [appId]);
        if (Number(owners.rows[0].count) <= 1) throw new PlatformError("conflict", "Transfer ownership before removing the last owner.");
      }
      await client.query("DELETE FROM application_memberships WHERE app_id=$1 AND user_id=$2", [appId, memberId]);
      await writeAudit(client, appId, user.id, "membership.removed", memberId);
    });
  }

  async transferOwnership(user: PlatformIdentity, appId: string, newOwnerId: string) {
    if (user.id === newOwnerId) throw new PlatformError("invalid", "Choose another current app member as the new owner.");
    await transaction(async (client) => {
      const access = await membership(client, user.id, appId, true);
      if (access.platform_role !== "owner") throw new PlatformError("forbidden", "Only the current owner can transfer ownership.");
      const target = await client.query("SELECT user_id FROM application_memberships WHERE app_id=$1 AND user_id=$2 FOR UPDATE", [appId, newOwnerId]);
      if (!target.rowCount) throw new PlatformError("not_found", "Invite the new owner to this app before transferring it.");
      await client.query("UPDATE application_memberships SET platform_role='administrator' WHERE app_id=$1 AND user_id=$2", [appId, user.id]);
      await client.query("UPDATE application_memberships SET platform_role='owner' WHERE app_id=$1 AND user_id=$2", [appId, newOwnerId]);
      await writeAudit(client, appId, user.id, "ownership.transferred", newOwnerId, { previousOwnerId: user.id });
    });
  }

  async listMembers(userId: string, appId: string) {
    return transaction(async (client) => {
      const access = await membership(client, userId, appId);
      requireAdmin(access.platform_role);
      const result = await client.query("SELECT u.id, u.name, u.email, m.platform_role AS \"platformRole\", m.app_role AS \"appRole\", m.created_at AS \"joinedAt\" FROM application_memberships m JOIN platform_users u ON u.id=m.user_id WHERE m.app_id=$1 ORDER BY m.platform_role, u.name", [appId]);
      return result.rows;
    });
  }

  async listInvitations(user: PlatformIdentity, appId: string) {
    return transaction(async (client) => {
      const access = await membership(client, user.id, appId);
      requireAdmin(access.platform_role);
      const result = await client.query("SELECT id,email,app_role AS \"appRole\",status,expires_at AS \"expiresAt\",created_at AS \"createdAt\" FROM app_invitations WHERE app_id=$1 ORDER BY created_at DESC LIMIT 100", [appId]);
      return result.rows;
    });
  }

  async revokeInvitation(user: PlatformIdentity, appId: string, invitationId: string) {
    await transaction(async (client) => {
      const access = await membership(client, user.id, appId, true);
      requireAdmin(access.platform_role);
      const result = await client.query("UPDATE app_invitations SET status='revoked' WHERE app_id=$1 AND id=$2 AND status='pending' RETURNING id", [appId, invitationId]);
      if (!result.rowCount) throw new PlatformError("not_found", "That pending invitation is unavailable.");
      await writeAudit(client, appId, user.id, "invitation.revoked", invitationId);
    });
  }

  async listActivity(userId: string, appId: string) {
    return transaction(async (client) => {
      const access = await membership(client, userId, appId);
      requireAdmin(access.platform_role);
      const result = await client.query("SELECT event_type AS \"eventType\", resource_id AS \"resourceId\", metadata, created_at AS \"createdAt\" FROM audit_events WHERE app_id=$1 ORDER BY created_at DESC LIMIT 100", [appId]);
      return result.rows;
    });
  }
}

let repository: PlatformRepository | undefined;
export function getPlatformRepository() { return repository ??= new PlatformRepository(); }

export function checkVersion(value: unknown): { artifact: GeneratedApp; app: GeneratedAppV4 | null } {
  const checked = validateArtifact(value);
  if (!checked.ok) throw new PlatformError("invalid", "This generated app did not pass BuildLoop's artifact checks.");
  if (checked.artifact.format !== "buildloop-app-v4") return { artifact: checked.artifact, app: null };
  const v4 = validateArtifactV4(checked.artifact);
  if (!v4.ok) throw new PlatformError("invalid", "This role-based app did not pass BuildLoop's safety checks.");
  return { artifact: v4.artifact, app: v4.artifact };
}
