import { describe, expect, it } from "vitest";
import { applyRuntimeMigration, planRuntimeMigration, validateRuntimeData } from "./migration";
import { seedRuntimeData, validateArtifactV2, v2Fixtures, type GeneratedAppV2, type RuntimeData } from "./v2";

const base = v2Fixtures[2];
const source = (): RuntimeData => ({ ...seedRuntimeData(base), tasks: [...seedRuntimeData(base).tasks, { id: "tasks_second", title: "Read chapter 4", owner: "Mina", status: "Doing" }] });

describe("runtime schema migrations", () => {
  it("preserves rows and IDs, applies defaults, and retains removed values only in the source snapshot", () => {
    const before = structuredClone(base);
    const after = structuredClone(before);
    after.collections[0].label = "Study topics";
    after.collections[0].fields = after.collections[0].fields.filter((field) => field.id !== "owner");
    after.collections[0].seed = after.collections[0].seed?.map((row) => { const remaining = { ...row }; delete remaining.owner; return remaining; });
    after.collections[0].fields[0].label = "Topic";
    after.collections[0].fields.push({ id: "review_date", label: "Review date", type: "date", required: true, default: "2026-10-20" });
    const data = source();
    const plan = planRuntimeMigration(before, after, data, 1, 2);
    const result = applyRuntimeMigration(before, after, data, plan);
    expect(result.ok).toBe(true);
    expect(result.data.tasks).toHaveLength(2);
    expect(result.data.tasks[1]).toMatchObject({ id: "tasks_second", title: "Read chapter 4", review_date: "2026-10-20" });
    expect(result.data.tasks[1]).not.toHaveProperty("owner");
    expect(data.tasks[1]).toHaveProperty("owner", "Mina");
    expect(plan.removedFields).toContainEqual({ collectionId: "tasks", fieldId: "owner", records: 2 });
    expect(plan.createdFields).toContainEqual({ collectionId: "tasks", fieldId: "review_date", defaulted: true, requiredWithoutDefault: false });
    expect(plan.warnings.join(" ")).toContain("remain in the Version 1 snapshot");
    expect(result.counts.defaultedValues).toBe(2);
  });

  it("starts added collections from their seeds while preserving existing collections", () => {
    const after: GeneratedAppV2 = { ...structuredClone(base), collections: [...structuredClone(base.collections), { id: "events", label: "Events", fields: [{ id: "name", label: "Event", type: "text", required: true }], seed: [{ id: "event_1", name: "Welcome day" }] }] };
    const data = source();
    const result = applyRuntimeMigration(base, after, data, planRuntimeMigration(base, after, data, 2, 3));
    expect(result.ok).toBe(true);
    expect(result.data.tasks).toEqual(data.tasks);
    expect(result.data.events).toEqual([{ id: "event_1", name: "Welcome day" }]);
    expect(result.counts.createdRecords).toBe(1);
  });

  it("does not cast an incompatible populated value and explains the safe fallback", () => {
    const before: GeneratedAppV2 = { ...structuredClone(base), collections: [...structuredClone(base.collections), { id: "rooms", label: "Rooms", fields: [{ id: "name", label: "Room", type: "text", required: true }], seed: [{ id: "room_1", name: "Auditorium" }] }] };
    const after = structuredClone(before);
    after.collections[0].fields = after.collections[0].fields.map((field) => field.id === "priority" ? { id: "priority", label: "Priority", type: "reference" as const, collection: "rooms", default: "room_1" } : field);
    after.collections[0].seed = after.collections[0].seed?.map((row) => ({ ...row, priority: "room_1" }));
    expect(validateArtifactV2(after).ok).toBe(true);
    const data = { ...seedRuntimeData(before), tasks: [{ id: "tasks_existing", title: "Review", priority: "High" }] };
    const plan = planRuntimeMigration(before, after, data, 1, 2);
    const result = applyRuntimeMigration(before, after, data, plan);
    expect(result.ok).toBe(true);
    expect(result.data.tasks[0]).toMatchObject({ id: "tasks_existing", title: "Review", priority: "room_1" });
    expect(plan.warnings.join(" ")).toContain("Priority changed to an incompatible format");
    expect(data.tasks[0].priority).toBe("High");
  });

  it("reports a newly required field without a default and keeps existing records editable", () => {
    const after = structuredClone(base);
    after.collections[0].fields.push({ id: "teacher", label: "Teacher", type: "text", required: true });
    const data = seedRuntimeData(base);
    const plan = planRuntimeMigration(base, after, data, 1, 2);
    const result = applyRuntimeMigration(base, after, data, plan);
    expect(result.ok).toBe(true);
    expect(result.data.tasks[0]).not.toHaveProperty("teacher");
    expect(plan.warnings.join(" ")).toContain("value for required Teacher");
    expect(validateRuntimeData(after, result.data).ok).toBe(true);
  });

  it("accepts a legacy V2 data map, rejects malformed persisted rows, and falls back without mutating it", () => {
    const oldStyle = source();
    expect(validateRuntimeData(base, oldStyle).ok).toBe(true);
    const malformed = { tasks: [{ id: "tasks_bad", title: 12 }] };
    expect(validateRuntimeData(base, malformed).ok).toBe(false);
    const after = structuredClone(base);
    after.summary = "Updated app";
    const plan = planRuntimeMigration(base, after, malformed, 1, 2);
    const result = applyRuntimeMigration(base, after, malformed, plan);
    expect(result.ok).toBe(false);
    expect(result.data).toEqual(seedRuntimeData(after));
    expect(malformed.tasks[0].title).toBe(12);
  });

  it("produces repeatable plans and applies required defaults to new seed records", () => {
    const after = structuredClone(base);
    after.collections[0].fields.push({ id: "reviewed", label: "Reviewed", type: "boolean", required: true, default: false });
    after.collections[0].seed = [{ id: "tasks_new", title: "Plan review", reviewed: false }];
    expect(validateArtifactV2(after).ok).toBe(true);
    const data = source();
    const firstPlan = planRuntimeMigration(base, after, data, 2, 3);
    const secondPlan = planRuntimeMigration(base, after, data, 2, 3);
    expect(firstPlan).toEqual(secondPlan);
    expect(applyRuntimeMigration(base, after, data, firstPlan)).toEqual(applyRuntimeMigration(base, after, data, secondPlan));
  });
});
