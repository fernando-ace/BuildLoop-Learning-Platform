import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { Pool, PoolClient } from "pg";
import { toV3Artifact, validateArtifactV4, type GeneratedAppV4 } from "../builder/v4";
import { validateRuntimeDataV3 } from "../builder/v3";
import type { RuntimeData } from "../builder/v2";

type LegacyVersion = { version_id: string; version_number: number; schema_json: string; published_at: string };
type LegacyRecord = { collection_id: string; record_id: string; data_json: string };
type LegacyApp = { app_id: string; published_version: string | null; revision: number; created_at: string };
type PreparedImport = { sourceAppId: string; appId: string; projectId: string; slug: string; name: string; versions: Array<{ id: string; number: number; artifact: GeneratedAppV4; createdAt: string }>; publishedVersionId: string | null; production: RuntimeData; previewVersionId: string | null; preview: RuntimeData; audits: Array<{ event: string; at: string; actorId: string; actorName: string; collection: string; recordIds: string[] }> };

const stableUuid = (value: string) => {
  const hex = createHash("sha256").update(`buildloop-legacy-import:${value}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const slugPart = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42).replace(/-$/g, "") || "legacy-app";
function parseJson(value: string, label: string) { try { return JSON.parse(value) as unknown; } catch { throw new Error(`Legacy ${label} contains invalid JSON; import stopped without writing data.`); } }
function stringIds(value: string) {
  const parsed = parseJson(value, "audit record IDs");
  if (!Array.isArray(parsed)) throw new Error("Legacy audit record IDs are malformed; import stopped without writing data.");
  return parsed.filter((id): id is string => typeof id === "string").slice(0, 100);
}
function validateRows(artifact: GeneratedAppV4, rows: LegacyRecord[]): RuntimeData {
  const data: RuntimeData = Object.fromEntries(artifact.collections.map((collection) => [collection.id, []]));
  for (const record of rows) {
    const list = data[record.collection_id];
    if (!list) throw new Error("Legacy records refer to a collection missing from their saved version; import stopped without writing data.");
    const value = parseJson(record.data_json, "runtime record");
    if (!value || typeof value !== "object" || Array.isArray(value) || String((value as Record<string, unknown>).id) !== record.record_id) throw new Error("A legacy record has an invalid identity; import stopped without writing data.");
    list.push(value as Record<string, unknown>);
  }
  const checked = validateRuntimeDataV3(toV3Artifact(artifact), data);
  if (!checked.ok) throw new Error("Legacy runtime records do not pass the saved app's data rules; import stopped without writing data.");
  return checked.data;
}

function readLegacyFile(filename: string): PreparedImport[] {
  const source = new DatabaseSync(filename, { readOnly: true });
  try {
    for (const table of ["shared_apps", "shared_versions", "shared_records", "shared_audit"]) {
      const exists = source.prepare("SELECT 1 AS found FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (!exists) throw new Error(`The SQLite file is missing the ${table} table; no data was imported.`);
    }
    const apps = source.prepare("SELECT app_id,published_version,revision,created_at FROM shared_apps ORDER BY app_id").all() as LegacyApp[];
    return apps.map((legacy) => {
      const rawVersions = source.prepare("SELECT version_id,version_number,schema_json,published_at FROM shared_versions WHERE app_id=? ORDER BY version_number").all(legacy.app_id) as LegacyVersion[];
      if (rawVersions.length === 0) throw new Error(`Legacy app ${legacy.app_id} has no saved version; import stopped without writing data.`);
      const versions = rawVersions.map((version) => {
        const checked = validateArtifactV4(parseJson(version.schema_json, "version artifact"));
        if (!checked.ok) throw new Error(`Legacy app ${legacy.app_id} version ${version.version_number} is not a valid V4 app; import stopped without writing data.`);
        return { id: `v${version.version_number}`, number: version.version_number, artifact: checked.artifact, createdAt: version.published_at };
      });
      const versionById = new Map(rawVersions.map((version, index) => [version.version_id, versions[index]]));
      const published = legacy.published_version ? versionById.get(legacy.published_version) : undefined;
      if (legacy.published_version && !published) throw new Error(`Legacy app ${legacy.app_id} points to a missing published version; import stopped without writing data.`);
      const latest = versions.at(-1)!;
      const records = (versionId: string | null, artifact: GeneratedAppV4 | undefined) => {
        if (!versionId || !artifact) return Object.fromEntries((artifact?.collections ?? []).map((collection) => [collection.id, []]));
        const rows = source.prepare("SELECT collection_id,record_id,data_json FROM shared_records WHERE app_id=? AND version_id=? ORDER BY collection_id,record_id").all(legacy.app_id, versionId) as LegacyRecord[];
        return validateRows(artifact, rows);
      };
      const audit = source.prepare("SELECT actor_id,actor_name,created_at,operation,collection_id,record_ids_json FROM shared_audit WHERE app_id=? ORDER BY id").all(legacy.app_id) as Array<{ actor_id: string; actor_name: string; created_at: string; operation: string; collection_id: string; record_ids_json: string }>;
      const name = published?.artifact.title ?? latest.artifact.title;
      const sourceKey = legacy.app_id;
      const id = stableUuid(sourceKey);
      const projectId = stableUuid(`project:${sourceKey}`);
      return {
        sourceAppId: sourceKey,
        appId: `app_${id}`,
        projectId,
        slug: `legacy-${slugPart(name).slice(0, 28)}-${id.slice(0, 8)}`,
        name: name.slice(0, 80),
        versions,
        publishedVersionId: published?.id ?? null,
        production: published ? records(legacy.published_version, published.artifact) : {},
        previewVersionId: latest.id,
        preview: records(rawVersions.at(-1)?.version_id ?? null, latest.artifact),
        audits: audit.map((entry) => ({ event: entry.operation.slice(0, 120), at: entry.created_at, actorId: entry.actor_id.slice(0, 160), actorName: entry.actor_name.slice(0, 160), collection: entry.collection_id.slice(0, 120), recordIds: stringIds(entry.record_ids_json) })),
      };
    });
  } finally { source.close(); }
}

async function writeOne(client: PoolClient, item: PreparedImport, owner: { id: string; email: string }) {
  const existing = await client.query<{ owner_user_id: string; source_app_id: string | null }>("SELECT s.owner_user_id,s.brief->>'sourceAppId' AS source_app_id FROM applications a JOIN studio_projects s ON s.id=a.project_id WHERE a.id=$1", [item.appId]);
  if (existing.rowCount) {
    if (existing.rows[0].owner_user_id !== owner.id || existing.rows[0].source_app_id !== item.sourceAppId) throw new Error(`The deterministic imported app ID ${item.appId} is already owned by another record; no data was changed.`);
    return { appId: item.appId, sourceAppId: item.sourceAppId, status: "already_imported" as const, versionCount: item.versions.length };
  }
  await client.query("INSERT INTO studio_projects(id,owner_user_id,name,brief,created_at) VALUES($1,$2,$3,$4::jsonb,$5)", [item.projectId, owner.id, item.name, JSON.stringify({ importedFrom: "legacy-sqlite", sourceAppId: item.sourceAppId }), new Date().toISOString()]);
  await client.query("INSERT INTO applications(id,project_id,slug,name,created_at) VALUES($1,$2,$3,$4,$5)", [item.appId, item.projectId, item.slug, item.name, new Date().toISOString()]);
  const currentArtifact = item.versions.find((version) => version.id === item.publishedVersionId)?.artifact ?? item.versions.at(-1)!.artifact;
  await client.query("INSERT INTO application_memberships(app_id,user_id,platform_role,app_role) VALUES($1,$2,'owner',$3)", [item.appId, owner.id, currentArtifact.roles.find((role) => /owner|admin|coordinator|organizer|manager|officer/i.test(`${role.id} ${role.label}`))?.id ?? currentArtifact.roles[0]?.id ?? null]);
  await client.query("INSERT INTO app_environments(app_id,environment,published_version_id,revision) VALUES($1,'preview',NULL,1),($1,'production',NULL,1)", [item.appId]);
  for (const version of item.versions) await client.query("INSERT INTO application_versions(app_id,version_id,version_number,artifact,metadata,created_by,created_at) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)", [item.appId, version.id, version.number, JSON.stringify(version.artifact), JSON.stringify({ importedFrom: "legacy-sqlite", sourceAppId: item.sourceAppId }), owner.id, version.createdAt]);
  await client.query("UPDATE app_environments SET published_version_id=$2,revision=2 WHERE app_id=$1 AND environment='preview'", [item.appId, item.previewVersionId]);
  await client.query("UPDATE app_environments SET published_version_id=$2,revision=2 WHERE app_id=$1 AND environment='production'", [item.appId, item.publishedVersionId]);
  for (const [environment, data] of [["preview", item.preview], ["production", item.production]] as const) for (const [collection, records] of Object.entries(data)) for (const row of records) await client.query("INSERT INTO runtime_records(app_id,environment,collection_id,record_id,data) VALUES($1,$2,$3,$4,$5::jsonb)", [item.appId, environment, collection, String(row.id), JSON.stringify(row)]);
  if (item.publishedVersionId) await client.query("INSERT INTO publication_history(id,app_id,version_id,environment,action,created_by,metadata) VALUES($1,$2,$3,'production','imported',$4,$5::jsonb)", [randomUUID(), item.appId, item.publishedVersionId, owner.id, JSON.stringify({ sourceAppId: item.sourceAppId, ownerEmail: owner.email })]);
  await client.query("INSERT INTO audit_events(id,app_id,actor_user_id,event_type,resource_id,metadata) VALUES($1,$2,$3,'platform.legacy_imported',$4,$5::jsonb)", [randomUUID(), item.appId, owner.id, item.sourceAppId, JSON.stringify({ source: "legacy-sqlite", legacyAuditEntries: item.audits.length, legacyRevision: item.publishedVersionId })]);
  for (const entry of item.audits) await client.query("INSERT INTO audit_events(id,app_id,actor_user_id,event_type,resource_id,created_at,metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)", [randomUUID(), item.appId, owner.id, `legacy.${entry.event}`.slice(0, 120), entry.collection || null, entry.at, JSON.stringify({ importedFrom: item.sourceAppId, legacyActorId: entry.actorId, legacyActorName: entry.actorName, recordIds: entry.recordIds })]);
  return { appId: item.appId, sourceAppId: item.sourceAppId, status: "imported" as const, versionCount: item.versions.length };
}

export async function importLegacySQLiteFile(input: { filename: string; ownerEmail: string; pool: Pool; apply: boolean }) {
  const imports = readLegacyFile(input.filename);
  const ownerResult = await input.pool.query<{ id: string; email: string }>("SELECT id,email FROM platform_users WHERE lower(email)=lower($1)", [input.ownerEmail.trim()]);
  if (ownerResult.rowCount !== 1) throw new Error("The target owner must already have exactly one BuildLoop account in this PostgreSQL database.");
  const owner = ownerResult.rows[0];
  const results: Array<{ appId: string; sourceAppId: string; status: "planned" | "imported" | "already_imported"; versionCount: number }> = [];
  if (!input.apply) return { mode: "dry_run" as const, ownerEmail: owner.email, appCount: imports.length, results: imports.map((item) => ({ appId: item.appId, sourceAppId: item.sourceAppId, status: "planned" as const, versionCount: item.versions.length })) };
  const client = await input.pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of imports) results.push(await writeOne(client, item, owner));
    await client.query("COMMIT");
    return { mode: "applied" as const, ownerEmail: owner.email, appCount: imports.length, results };
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}
