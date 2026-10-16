import { describe, expect, it } from "vitest";
import { seedRuntimeData, v2Fixtures } from "./v2";
import { equipmentCheckoutV3, volunteerOperationsV3 } from "./v3-fixtures";
import { seedRuntimeDataV3, validateArtifactV3 } from "./v3";
import type { V3ValueSource } from "./v3";
import { applyRuntimeMigrationV3, planRuntimeMigrationV3 } from "./migration-v3";

describe("V3 relational migration", () => {
  it("preserves records and stable relationship links across a label-only update", () => {
    const after = structuredClone(volunteerOperationsV3);
    after.collections[2].label = "Campus volunteers";
    after.collections[3].relationships[0].label = "Volunteer shift";
    const source = {
      events: [{ id: "event_fair", name: "Welcome Fair", date: "2026-10-22", location: "Campus Green" }],
      shifts: [{ id: "shift_setup", name: "Morning setup", starts_at: "08:00", capacity: 2, event_id: "event_fair" }],
      volunteers: [{ id: "vol_ada", name: "Ada Chen", email: "ada@example.test" }],
      registrations: [{ id: "registration_ada", shift_id: "shift_setup", volunteer_id: "vol_ada", created_on: "2026-10-15" }],
    };
    const plan = planRuntimeMigrationV3(volunteerOperationsV3, after, source, 1, 2);
    const first = applyRuntimeMigrationV3(volunteerOperationsV3, after, source, plan);
    const second = applyRuntimeMigrationV3(volunteerOperationsV3, after, source, plan);
    expect(first.ok).toBe(true);
    expect(first.data).toEqual(second.data);
    expect(first.data.registrations[0].shift_id).toBe("shift_setup");
  });

  it("migrates a stable relationship ID when its stored field is renamed", () => {
    const after = structuredClone(volunteerOperationsV3);
    const registration = after.collections.find((collection) => collection.id === "registrations")!;
    registration.relationships[0].field = "duty_id";
    registration.constraints![0] = { id: "one_signup", label: "No duplicate signup", type: "unique", fields: ["duty_id", "volunteer_id"] };
    registration.seed = registration.seed?.map((row) => { const next: Record<string, unknown> = { ...row, duty_id: row.shift_id }; delete next.shift_id; return next; });
    after.screens.find((screen) => screen.id === "registrations")!.fields = ["volunteer_id", "duty_id"];
    const createStep = after.workflows[0].steps[0];
    if (createStep.type === "create") { const values: Record<string, V3ValueSource> = { ...createStep.values, duty_id: createStep.values.shift_id! }; delete values.shift_id; after.workflows[0].steps[0] = { ...createStep, values }; }
    const validation = validateArtifactV3(after);
    expect(validation.ok, validation.ok ? "" : validation.issues.join("; ")).toBe(true);
    const data = { events: [{ id: "event_fair", name: "Welcome Fair", date: "2026-10-22", location: "Campus Green" }], shifts: [{ id: "shift_setup", name: "Morning setup", starts_at: "08:00", capacity: 2, event_id: "event_fair" }], volunteers: [{ id: "vol_ada", name: "Ada Chen", email: "ada@example.test" }], registrations: [{ id: "registration_ada", shift_id: "shift_setup", volunteer_id: "vol_ada", created_on: "2026-10-15" }] };
    const plan = planRuntimeMigrationV3(volunteerOperationsV3, after, data, 1, 2);
    const migrated = applyRuntimeMigrationV3(volunteerOperationsV3, after, data, plan);
    expect(migrated.ok).toBe(true);
    expect(migrated.data.registrations[0]).toMatchObject({ id: "registration_ada", duty_id: "shift_setup", volunteer_id: "vol_ada" });
  });

  it("warns and rolls back when a required relationship has no historical value", () => {
    const after = structuredClone(volunteerOperationsV3);
    after.collections[2].relationships = [{ id: "volunteer_home_event", field: "home_event_id", label: "Home event", targetCollection: "events", cardinality: "one", required: true, onDelete: "restrict" }];
    after.collections[2].seed = [];
    after.collections[3].seed = [];
    const validation = validateArtifactV3(after);
    expect(validation.ok, validation.ok ? "" : validation.issues.join("; ")).toBe(true);
    const data = { events: [{ id: "event_fair", name: "Welcome Fair", date: "2026-10-22", location: "Campus Green" }], shifts: [{ id: "shift_setup", name: "Morning setup", starts_at: "08:00", capacity: 2, event_id: "event_fair" }], volunteers: [{ id: "vol_ada", name: "Ada Chen", email: "ada@example.test" }], registrations: [{ id: "registration_ada", shift_id: "shift_setup", volunteer_id: "vol_ada", created_on: "2026-10-15" }] };
    const before = structuredClone(data);
    const plan = planRuntimeMigrationV3(volunteerOperationsV3, after, data, 1, 2);
    expect(plan.addedRelationships[0]).toMatchObject({ missingRecords: 1, required: true });
    expect(plan.warnings.join(" ")).toContain("No link will be invented");
    const result = applyRuntimeMigrationV3(volunteerOperationsV3, after, data, plan);
    expect(result.ok).toBe(false);
    expect(result.data).toEqual(seedRuntimeDataV3(after));
    expect(data).toEqual(before);
  });

  it("preserves compatible V2 data while initializing V3-only collections", () => {
    const before = v2Fixtures[0];
    const source = seedRuntimeData(before);
    const target = structuredClone(equipmentCheckoutV3);
    target.collections[0].id = "equipment";
    const plan = planRuntimeMigrationV3(before, target, source, 1, 2);
    const result = applyRuntimeMigrationV3(before, target, source, plan);
    expect(result.ok).toBe(true);
    expect(result.data.equipment[0]).toMatchObject({ name: "Projector", category: "Audio" });
    expect(result.data.borrowers).toHaveLength(2);
  });
});
