import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { equipmentCheckoutAppV4, volunteerCoordinationV4 } from "../builder/v4-fixtures";
import { SharedAppRepository, SharedRuntimeError } from "./store";

const opened: SharedAppRepository[] = [];
let idNumber = 0;
function memoryStore() { const store = new SharedAppRepository(":memory:", { idFactory: () => `test_record_${++idNumber}` }); opened.push(store); return store; }
afterEach(() => { for (const store of opened.splice(0)) store.close(); });

describe("shared published app runtime", () => {
  it("persists one published version, signs persona identity, and rejects user-controlled role changes", () => {
    const store = memoryStore();
    const app = structuredClone(volunteerCoordinationV4);
    app.collections.find((collection) => collection.id === "registrations")!.seed = [];
    const published = store.publish("campus-volunteers", 1, app);
    expect(published.published).toBe(true);
    const jordanToken = store.issueIdentityToken("campus-volunteers", "vol_ada");
    expect(store.resolveIdentity("campus-volunteers", jordanToken)?.roles).toEqual(["volunteer"]);
    expect(store.resolveIdentity("another-app", jordanToken)).toBe(null);
    expect(store.resolveIdentity("campus-volunteers", `${jordanToken}x`)).toBe(null);
    const jordan = store.resolveIdentity("campus-volunteers", jordanToken)!;
    const result = store.mutate("campus-volunteers", jordan, { type: "create", collection: "registrations", values: { shift_id: "shift_setup", volunteer_id: "vol_sam", created_on: "2026-10-15" } }, "v1");
    expect(result.versionId).toBe("v1");
    const jordanView = store.readRuntime("campus-volunteers", jordan)!;
    expect(jordanView.data.registrations.map((row) => row.volunteer_id)).toEqual(["vol_ada"]);
    expect(jordanView.activity).toEqual([]);
    const riley = volunteerCoordinationV4.users[1];
    expect(store.readRuntime("campus-volunteers", riley)!.data.registrations).toEqual([]);
    const coordinator = store.readRuntime("campus-volunteers", volunteerCoordinationV4.users[2])!;
    expect(coordinator.data.registrations).toHaveLength(1);
    expect(coordinator.activity).toHaveLength(1);
    expect(() => store.mutate("campus-volunteers", jordan, { type: "update", collection: "registrations", recordId: "registration_ada", values: { volunteer_id: "vol_coordinator" } }, "v1")).toThrowError(SharedRuntimeError);
    expect(() => store.mutate("campus-volunteers", { ...jordan, roles: ["coordinator"] }, { type: "delete", collection: "registrations", recordId: "registration_ada" }, "v1")).toThrowError(SharedRuntimeError);
  });

  it("isolates app IDs and versions while preserving records across a safe republish", () => {
    const store = memoryStore();
    store.publish("project-one", 1, volunteerCoordinationV4);
    store.publish("project-two", 1, volunteerCoordinationV4);
    const coordinator = volunteerCoordinationV4.users[2];
    store.mutate("project-one", coordinator, { type: "create", collection: "events", values: { name: "Night Market", date: "2026-11-01", location: "Quad" } }, "v1");
    expect(store.readRuntime("project-two", coordinator)!.data.events.some((row) => row.name === "Night Market")).toBe(false);
    const next = structuredClone(volunteerCoordinationV4);
    next.collections.find((collection) => collection.id === "events")!.fields.push({ id: "theme", label: "Theme", type: "text" });
    const analysis = store.analyzePublication("project-one", 2, next, "v1");
    expect(analysis.ok).toBe(true);
    expect(analysis.requiresConfirmation).toBe(false);
    const result = store.publish("project-one", 2, next, { expectedPublishedVersion: "v1" });
    expect(result.published).toBe(true);
    expect(store.getPublication("project-one")?.versionId).toBe("v2");
    expect(store.readRuntime("project-one", coordinator)!.data.events.some((row) => row.name === "Night Market")).toBe(true);
    const widening = structuredClone(next);
    widening.permissions.find((permission) => permission.id === "signup_read_own")!.visibility = "all";
    delete widening.permissions.find((permission) => permission.id === "signup_read_own")!.ownership;
    const warning = store.publish("project-one", 3, widening, { expectedPublishedVersion: "v2" });
    expect(warning.published).toBe(false);
    expect(warning).toMatchObject({ requiresConfirmation: true, changes: expect.arrayContaining([expect.objectContaining({ kind: "permission-widened" })]) });
    expect(store.getPublication("project-one")?.versionId).toBe("v2");
    expect(store.publish("project-one", 3, widening, { expectedPublishedVersion: "v2", confirmWarnings: true }).published).toBe(true);
    expect(store.readRuntime("project-one", coordinator)!.data.events.some((row) => row.name === "Night Market")).toBe(true);
    const rollbackReview = store.analyzeRollback("project-one", "v2", "v3");
    expect(rollbackReview.ok).toBe(true);
    expect(rollbackReview.requiresConfirmation).toBe(true);
    const rollback = store.rollback("project-one", "v2", { expectedPublishedVersion: "v3", confirmWarnings: true });
    expect(rollback.published).toBe(true);
    expect(store.getPublication("project-one")?.versionNumber).toBe(2);
    expect(store.readRuntime("project-one", coordinator)!.data.events.some((row) => row.name === "Night Market")).toBe(true);
  });

  it("rejects an unsafe shared migration without switching the active publication", () => {
    const store = memoryStore();
    store.publish("migration-app", 1, volunteerCoordinationV4);
    const coordinator = volunteerCoordinationV4.users[2];
    store.mutate("migration-app", coordinator, { type: "create", collection: "registrations", values: { shift_id: "shift_setup", volunteer_id: "vol_sam", created_on: "2026-10-15" } }, "v1");
    const candidate = structuredClone(volunteerCoordinationV4);
    const registrations = candidate.collections.find((collection) => collection.id === "registrations")!;
    registrations.fields.push({ id: "migration_tag", label: "Migration tag", type: "text", default: "A" });
    registrations.constraints = [...(registrations.constraints ?? []), { id: "tag_unique", label: "Migration tags must be unique", type: "unique", fields: ["migration_tag"] }];
    const attempt = store.publish("migration-app", 2, candidate, { expectedPublishedVersion: "v1", confirmWarnings: true });
    expect(attempt.published).toBe(false);
    expect(attempt.blockedReason).toMatch(/shared records|rules|version/i);
    expect(store.getPublication("migration-app")?.versionId).toBe("v1");
    expect(store.readRuntime("migration-app", coordinator)!.data.registrations).toHaveLength(2);
  });

  it("uses SQLite transactions to protect the last available shift place", async () => {
    const store = memoryStore();
    const candidate = structuredClone(volunteerCoordinationV4);
    candidate.collections.find((collection) => collection.id === "shifts")!.seed![0].capacity = 1;
    candidate.collections.find((collection) => collection.id === "registrations")!.seed = [];
    store.publish("last-seat", 1, candidate);
    const [jordan, riley] = candidate.users;
    const tryJoin = (user: typeof jordan) => store.mutate("last-seat", user, { type: "create", collection: "registrations", values: { shift_id: "shift_setup", volunteer_id: "attacker_choice" } }, "v1");
    const results = await Promise.allSettled([Promise.resolve().then(() => tryJoin(jordan)), Promise.resolve().then(() => tryJoin(riley))]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(store.readRuntime("last-seat", candidate.users[2])!.data.registrations).toHaveLength(1);
  });

  it("rolls back every workflow step when the final relational constraint fails", () => {
    const store = memoryStore();
    const candidate = structuredClone(equipmentCheckoutAppV4);
    const equipment = candidate.collections.find((collection) => collection.id === "equipment")!;
    equipment.fields.push({ id: "safety_count", label: "Safety count", type: "number", min: 0, default: 0 });
    equipment.constraints = [...(equipment.constraints ?? []), { id: "safety_nonnegative", label: "Safety count cannot be negative", type: "nonNegative", field: "safety_count" }];
    candidate.workflows.push({ id: "checkout_then_fail", label: "Try a failing checkout", collection: "equipment", inputs: ["borrower_id"], steps: [
      { id: "create_checkout", type: "create", collection: "checkouts", values: { equipment_id: { source: "currentId" }, borrower_id: { source: "input", field: "borrower_id" }, checked_out_on: { source: "literal", value: "2026-10-15" }, returned: { source: "literal", value: false } } },
      { id: "invalidate_safety", type: "update", collection: "equipment", target: "current", values: { safety_count: { source: "literal", value: -1 } } },
    ] });
    candidate.workflowPermissions.push({ workflow: "checkout_then_fail", roles: ["borrower"] });
    expect(store.publish("atomic-app", 1, candidate).published).toBe(true);
    const borrower = candidate.users[0];
    expect(() => store.mutate("atomic-app", borrower, { type: "workflow", workflow: "checkout_then_fail", recordId: "camera_1", inputs: { borrower_id: borrower.id } }, "v1")).toThrowError(SharedRuntimeError);
    const manager = candidate.users[2];
    const view = store.readRuntime("atomic-app", manager)!;
    expect(view.data.checkouts).toHaveLength(0);
    expect(view.data.equipment[0].safety_count).toBe(0);
    expect(view.activity).toHaveLength(0);
  });

  it("does not let a workflow bypass record-level update permissions", () => {
    const store = memoryStore();
    const candidate = structuredClone(volunteerCoordinationV4);
    candidate.workflows.push({ id: "rename_public_event", label: "Rename an event", collection: "events", steps: [{ id: "rename_event", type: "update", collection: "events", target: "current", values: { name: { source: "literal", value: "Changed by volunteer" } } }] });
    candidate.workflowPermissions.push({ workflow: "rename_public_event", roles: ["volunteer"] });
    expect(store.publish("workflow-boundary", 1, candidate).published).toBe(true);
    const volunteer = candidate.users[0];
    expect(() => store.mutate("workflow-boundary", volunteer, { type: "workflow", workflow: "rename_public_event", recordId: "event_fair" }, "v1")).toThrowError(expect.objectContaining({ code: "authorization" }));
    expect(store.readRuntime("workflow-boundary", candidate.users[2])!.data.events[0].name).toBe("Welcome Fair");
  });

  it("keeps the signed identity and shared records across repository restarts", () => {
    const directory = mkdtempSync(join(tmpdir(), "buildloop-shared-"));
    const path = join(directory, "shared.sqlite");
    const first = new SharedAppRepository(path);
    first.publish("persistent-app", 1, volunteerCoordinationV4);
    const token = first.issueIdentityToken("persistent-app", "vol_coordinator");
    first.mutate("persistent-app", volunteerCoordinationV4.users[2], { type: "create", collection: "events", values: { name: "Open House" } }, "v1");
    first.close();
    const reopened = new SharedAppRepository(path);
    try {
      opened.push(reopened);
      expect(reopened.resolveIdentity("persistent-app", token)?.id).toBe("vol_coordinator");
      expect(reopened.readRuntime("persistent-app", volunteerCoordinationV4.users[2])!.data.events.some((row) => row.name === "Open House")).toBe(true);
    } finally { reopened.close(); opened.splice(opened.indexOf(reopened), 1); rmSync(directory, { recursive: true, force: true }); }
  });
});
