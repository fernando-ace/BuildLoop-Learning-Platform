import { describe, expect, it } from "vitest";
import { volunteerOperationsV3 } from "./v3-fixtures";
import { diffV3ApplicationSchemas } from "./schema-diff-v3";

describe("V3 schema changes", () => {
  it("preserves relationship identity when only the learner-facing label changes", () => {
    const before = structuredClone(volunteerOperationsV3);
    const after = structuredClone(volunteerOperationsV3);
    after.collections[1].relationships[0].label = "Festival";
    expect(diffV3ApplicationSchemas(before, after).filter((change) => change.kind.startsWith("relationship"))).toEqual([]);
  });

  it("classifies required relationships, target changes, and rule/workflow edits", () => {
    const before = structuredClone(volunteerOperationsV3);
    const after = structuredClone(volunteerOperationsV3);
    after.collections[0].relationships.push({ id: "event_owner", field: "owner_id", label: "Owner", targetCollection: "volunteers", cardinality: "one", required: true, onDelete: "restrict" });
    after.collections[3].constraints![0] = { ...after.collections[3].constraints![0], label: "Prevent repeat signup" };
    after.workflows[0].steps.push({ id: "confirmation", type: "feedback", text: "Signup saved." });
    const changes = diffV3ApplicationSchemas(before, after);
    expect(changes.find((change) => change.kind === "relationship-added")?.risk).toBe("destructive");
    expect(changes.find((change) => change.kind === "constraint-changed")?.risk).toBe("migration");
    expect(changes.find((change) => change.kind === "workflow-changed")?.risk).toBe("safe");
  });

  it("marks removal of a saved relationship as destructive", () => {
    const before = structuredClone(volunteerOperationsV3);
    const after = structuredClone(volunteerOperationsV3);
    after.collections[3].relationships = after.collections[3].relationships.filter((relation) => relation.id !== "registration_shift");
    expect(diffV3ApplicationSchemas(before, after).find((change) => change.kind === "relationship-removed")?.risk).toBe("destructive");
  });
});
