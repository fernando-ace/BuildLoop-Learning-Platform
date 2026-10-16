import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SharedAppRepository } from "@/lib/shared-apps/store";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { volunteerCoordinationV4 } from "@/lib/builder/v4-fixtures";
import { campusEventOperationsV4 } from "@/lib/builder/v4-platform-fixtures";
import { getPlatformPool, closePlatformDatabase } from "./database";
import { PlatformError, PlatformRepository } from "./repository";
import { importLegacySQLiteFile } from "./sqlite-import";
import type { PlatformIdentity } from "./session";

const enabled = Boolean(process.env.DATABASE_URL);
const pool = () => getPlatformPool();
const repository = new PlatformRepository();
const trackedUsers: string[] = [];
const trackedApps: string[] = [];
const trackedProjects: string[] = [];

async function newUser(label: string): Promise<PlatformIdentity> {
  const id = `goal13-${randomUUID()}`;
  trackedUsers.push(id);
  const email = `${id}@example.test`;
  await pool().query("INSERT INTO platform_users(id,name,email,email_verified) VALUES($1,$2,$3,true)", [id, label, email]);
  return { id, name: label, email };
}

async function newApp(owner: PlatformIdentity, name = "Campus Events") {
  const app = await repository.createApplication(owner, name);
  trackedApps.push(app.id); trackedProjects.push(app.projectId);
  return app;
}

async function addVersion(owner: PlatformIdentity, appId: string, number: number, artifact = volunteerCoordinationV4) {
  return repository.saveVersion(owner, appId, number, structuredClone(artifact));
}

async function currentVersion(appId: string) {
  const result = await pool().query("SELECT published_version_id FROM app_environments WHERE app_id=$1 AND environment='production'", [appId]);
  return result.rows[0]?.published_version_id as string | null | undefined;
}

afterEach(async () => {
  for (const appId of trackedApps.splice(0)) await pool().query("DELETE FROM applications WHERE id=$1", [appId]);
  for (const projectId of trackedProjects.splice(0)) await pool().query("DELETE FROM studio_projects WHERE id=$1", [projectId]);
  for (const userId of trackedUsers.splice(0)) await pool().query("DELETE FROM platform_users WHERE id=$1", [userId]);
});
afterAll(async () => { if (enabled) await closePlatformDatabase(); });

describe.skipIf(!enabled)("PostgreSQL platform repository", () => {
  it("keeps app reads and writes tenant-scoped and enforces environment foreign keys", async () => {
    const ownerA = await newUser("Owner A"), ownerB = await newUser("Owner B");
    const appA = await newApp(ownerA, "Events A"), appB = await newApp(ownerB, "Events B");
    await addVersion(ownerA, appA.id, 1);
    expect((await repository.listApplications(ownerA.id)).map((app) => app.id)).toEqual([appA.id]);
    await expect(repository.getApplication(ownerA.id, appB.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(repository.saveVersion(ownerA, appB.id, 1, volunteerCoordinationV4)).rejects.toMatchObject({ code: "not_found" });
    await expect(pool().query("INSERT INTO runtime_records(app_id,environment,collection_id,record_id,data) VALUES($1,'preview-copy','events','forged','{}'::jsonb)", [appA.id])).rejects.toMatchObject({ code: "23503" });
  });

  it("accepts an invitation once under concurrent retries and persists only its token hash", async () => {
    const owner = await newUser("Event owner"), guest = await newUser("Event coordinator");
    const app = await newApp(owner);
    await addVersion(owner, app.id, 1);
    const invite = await repository.createInvitation(owner, app.id, "coordinator", guest.email);
    const stored = await pool().query<{ token_hash: string }>("SELECT token_hash FROM app_invitations WHERE id=$1", [invite.id]);
    expect(stored.rows[0].token_hash).not.toBe(invite.token);
    expect(stored.rows[0].token_hash).toHaveLength(64);
    const accepted = await Promise.all([repository.acceptInvitation(guest, invite.token), repository.acceptInvitation(guest, invite.token)]);
    expect(accepted.map((item) => item.alreadyAccepted).sort()).toEqual([false, true]);
    const members = await repository.listMembers(owner.id, app.id);
    expect(members).toHaveLength(2);
    expect(members.find((item) => item.id === guest.id)).toMatchObject({ platformRole: "member", appRole: "coordinator" });
    const other = await newUser("Other user");
    await expect(repository.acceptInvitation(other, invite.token)).rejects.toMatchObject({ code: "conflict" });
  });

  it("records expired and revoked invitations and preserves one owner during transfer/removal", async () => {
    const owner = await newUser("Owner"), nextOwner = await newUser("Next owner");
    const app = await newApp(owner);
    await addVersion(owner, app.id, 1);
    const expired = await repository.createInvitation(owner, app.id, "volunteer", nextOwner.email);
    await pool().query("UPDATE app_invitations SET expires_at=now()-interval '1 minute' WHERE id=$1", [expired.id]);
    await expect(repository.acceptInvitation(nextOwner, expired.token)).rejects.toMatchObject({ code: "conflict" });
    expect((await pool().query("SELECT status FROM app_invitations WHERE id=$1", [expired.id])).rows[0].status).toBe("expired");
    const active = await repository.createInvitation(owner, app.id, "coordinator", nextOwner.email);
    await repository.acceptInvitation(nextOwner, active.token);
    await repository.transferOwnership(owner, app.id, nextOwner.id);
    await expect(repository.transferOwnership(owner, app.id, nextOwner.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(repository.changeAppRole(nextOwner, app.id, nextOwner.id, "volunteer")).rejects.toMatchObject({ code: "forbidden" });
    await repository.removeMember(nextOwner, app.id, owner.id);
    await expect(repository.getApplication(owner.id, app.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await repository.listMembers(nextOwner.id, app.id)).filter((item) => item.platformRole === "owner")).toHaveLength(1);
  });

  it("publishes only selected versions, migrates data atomically, and leaves production intact on failure", async () => {
    const owner = await newUser("Publisher"), app = await newApp(owner);
    const first = structuredClone(volunteerCoordinationV4);
    await addVersion(owner, app.id, 1, first);
    const initial = await repository.publishVersion(owner, app.id, "v1", { expectedVersionId: null });
    expect(initial.published).toBe(true);
    expect(await currentVersion(app.id)).toBe("v1");

    const v3Data = Object.fromEntries(first.collections.map((collection) => [collection.id, collection.seed ?? []]));
    expect((await pool().query("SELECT count(*) FROM runtime_records WHERE app_id=$1 AND environment='production'", [app.id])).rows[0].count).toBe(String(Object.values(v3Data).reduce((sum, rows) => sum + rows.length, 0)));
    const second = structuredClone(first); second.collections[0].label = "Campus events";
    await addVersion(owner, app.id, 2, second);
    expect(await currentVersion(app.id)).toBe("v1");
    const published = await repository.publishVersion(owner, app.id, "v2", { expectedVersionId: "v1" });
    expect(published.published).toBe(true);
    expect(await currentVersion(app.id)).toBe("v2");
    expect((await pool().query("SELECT count(*) FROM runtime_records WHERE app_id=$1 AND environment='production'", [app.id])).rows[0].count).toBe(String(Object.values(v3Data).reduce((sum, rows) => sum + rows.length, 0)));

    const unsafe = structuredClone(volunteerCoordinationV4);
    const volunteers = unsafe.collections.find((collection) => collection.id === "volunteers")!;
    volunteers.relationships.push({ id: "required_event", field: "home_event_id", label: "Home event", targetCollection: "events", cardinality: "one", required: true, onDelete: "restrict" });
    volunteers.seed = [];
    unsafe.collections.find((collection) => collection.id === "registrations")!.seed = [];
    await addVersion(owner, app.id, 3, unsafe);
    await expect(repository.publishVersion(owner, app.id, "v3", { expectedVersionId: "v2" })).rejects.toMatchObject({ code: "conflict" });
    expect(await currentVersion(app.id)).toBe("v2");
    expect((await pool().query("SELECT count(*) FROM runtime_records WHERE app_id=$1 AND environment='production'", [app.id])).rows[0].count).toBe(String(Object.values(v3Data).reduce((sum, rows) => sum + rows.length, 0)));
    expect((await repository.listPublicationHistory(owner.id, app.id)).some((entry) => entry.action === "publication_failed")).toBe(true);
  });

  it("serializes competing publication and collaborative unique writes", async () => {
    const owner = await newUser("Organizer"), volunteer = await newUser("Volunteer");
    const app = await newApp(owner, "Campus Event Operations");
    await addVersion(owner, app.id, 1, campusEventOperationsV4);
    const invite = await repository.createInvitation(owner, app.id, "volunteer", volunteer.email);
    await repository.acceptInvitation(volunteer, invite.token);
    const competing = await Promise.allSettled([
      repository.publishVersion(owner, app.id, "v1", { expectedVersionId: null }),
      repository.publishVersion(owner, app.id, "v1", { expectedVersionId: null }),
    ]);
    expect(competing.filter((result) => result.status === "fulfilled" && result.value.published)).toHaveLength(1);
    expect(competing.filter((result) => result.status === "rejected" && result.reason instanceof PlatformError)).toHaveLength(1);

    const runtime = await repository.readRuntime(volunteer, app.id);
    const duplicateSignup = { type: "create" as const, collection: "registrations", values: { shift_id: "shift_setup", volunteer_id: volunteer.id, created_on: "2026-10-16" } };
    const race = await Promise.allSettled([
      repository.mutateRuntime(volunteer, app.id, duplicateSignup, runtime.versionId),
      repository.mutateRuntime(volunteer, app.id, duplicateSignup, runtime.versionId),
    ]);
    expect(race.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(race.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await pool().query("SELECT count(*) FROM runtime_records WHERE app_id=$1 AND environment='production' AND collection_id='registrations' AND data->>'volunteer_id'=$2", [app.id, volunteer.id])).rows[0].count).toBe("1");
  });

  it("dry-runs, imports, and safely replays a legacy SQLite V4 app", async () => {
    const owner = await newUser("Legacy app owner");
    const filename = join(tmpdir(), `buildloop-legacy-import-${randomUUID()}.sqlite`);
    const legacy = new SharedAppRepository(filename);
    try {
      const published = legacy.publish("legacy-campus", 1, campusEventOperationsV4, { expectedPublishedVersion: null });
      expect(published.published).toBe(true);
      const dryRun = await importLegacySQLiteFile({ filename, ownerEmail: owner.email, pool: pool(), apply: false });
      expect(dryRun).toMatchObject({ mode: "dry_run", appCount: 1 });
      expect(await pool().query("SELECT count(*) FROM applications WHERE id=$1", [dryRun.results[0].appId])).toMatchObject({ rows: [{ count: "0" }] });
      const applied = await importLegacySQLiteFile({ filename, ownerEmail: owner.email, pool: pool(), apply: true });
      expect(applied).toMatchObject({ mode: "applied", results: [{ status: "imported", sourceAppId: "legacy-campus", versionCount: 1 }] });
      trackedApps.push(applied.results[0].appId);
      trackedProjects.push((await pool().query<{ project_id: string }>("SELECT project_id FROM applications WHERE id=$1", [applied.results[0].appId])).rows[0].project_id);
      expect(await currentVersion(applied.results[0].appId)).toBe("v1");
      const repeated = await importLegacySQLiteFile({ filename, ownerEmail: owner.email, pool: pool(), apply: true });
      expect(repeated.results[0].status).toBe("already_imported");
      expect(await pool().query("SELECT count(*) FROM applications WHERE id=$1", [applied.results[0].appId])).toMatchObject({ rows: [{ count: "1" }] });
    } finally { legacy.close(); rmSync(filename, { force: true }); rmSync(`${filename}-wal`, { force: true }); rmSync(`${filename}-shm`, { force: true }); }
  });
});
