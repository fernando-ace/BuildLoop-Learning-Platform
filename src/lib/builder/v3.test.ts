import { describe, expect, it } from "vitest";
import { clubAttendanceV3, equipmentCheckoutV3, volunteerOperationsV3 } from "./v3-fixtures";
import { applyWorkflow, evaluateV3Expression, resolveRelationship, seedRuntimeDataV3, validateArtifactV3, validateRuntimeDataV3 } from "./v3";

const copy = <T,>(value: T): T => structuredClone(value);

describe("V3 artifact validation", () => {
  it("accepts the three representative relational apps", () => {
    for (const artifact of [volunteerOperationsV3, equipmentCheckoutV3, clubAttendanceV3]) { const result = validateArtifactV3(artifact); expect(result.ok, `${artifact.title}: ${result.ok ? "" : result.issues.join("; ")}`).toBe(true); }
  });

  it("rejects unknown relation targets and dangling seed references", () => {
    const missingTarget = copy(volunteerOperationsV3);
    missingTarget.collections[1].relationships[0].targetCollection = "missing";
    expect(validateArtifactV3(missingTarget)).toMatchObject({ ok: false });
    const dangling = copy(volunteerOperationsV3);
    dangling.collections[3].seed![0].volunteer_id = "nobody";
    expect(validateArtifactV3(dangling)).toMatchObject({ ok: false });
  });

  it("rejects unsafe, circular, deep, oversized, and unsupported workflow definitions", () => {
    const unsafe = copy(volunteerOperationsV3);
    unsafe.collections[0].computed = [{ id: "bad", label: "Unsafe", type: "text", expression: { op: "literal", value: "<script>alert(1)</script>" } }];
    expect(validateArtifactV3(unsafe)).toMatchObject({ ok: false });
    const cyclic = copy(clubAttendanceV3);
    cyclic.collections[2].computed = [{ id: "a", label: "A", type: "number", expression: { op: "field", field: "b" } }, { id: "b", label: "B", type: "number", expression: { op: "field", field: "a" } }];
    expect(validateArtifactV3(cyclic)).toMatchObject({ ok: false });
    const tooManySteps = copy(volunteerOperationsV3);
    tooManySteps.workflows[0].steps = Array.from({ length: 13 }, (_, index) => ({ id: `step_${index}`, type: "feedback" as const, text: "Done" }));
    expect(validateArtifactV3(tooManySteps)).toMatchObject({ ok: false });
    const deep = copy(clubAttendanceV3);
    let expression = { op: "literal", value: 1 } as const;
    for (let index = 0; index < 9; index += 1) expression = { op: "not", value: expression } as never;
    deep.collections[0].computed = [{ id: "deep", label: "Deep", type: "boolean", expression }];
    expect(validateArtifactV3(deep)).toMatchObject({ ok: false });
    const badPolicy = copy(clubAttendanceV3);
    badPolicy.collections[3].relationships[0].onDelete = "nullify";
    expect(validateArtifactV3(badPolicy)).toMatchObject({ ok: false });
    const badAction = copy(volunteerOperationsV3);
    if (badAction.workflows[0].steps[0].type === "create") badAction.workflows[0].steps[0].values.shift_id = { source: "literal", value: "javascript:alert(1)" };
    expect(validateArtifactV3(badAction)).toMatchObject({ ok: false });
    const cascadeCycle = copy(clubAttendanceV3);
    cascadeCycle.collections[1].relationships[0].onDelete = "cascade";
    cascadeCycle.collections[0].relationships.push({ id: "club_member", field: "member_id", label: "Member", targetCollection: "members", cardinality: "one", onDelete: "cascade" });
    expect(validateArtifactV3(cascadeCycle)).toMatchObject({ ok: false });
  });
});

describe("V3 relational runtime", () => {
  it("resolves one-to-one and reverse relationships and evaluates computed values", () => {
    const data = seedRuntimeDataV3(volunteerOperationsV3);
    const shift = data.shifts[0];
    expect(evaluateV3Expression(volunteerOperationsV3, data, "shifts", shift, { op: "countRelated", relationship: "registration_shift" })).toBe(1);
    expect(evaluateV3Expression(volunteerOperationsV3, data, "shifts", shift, { op: "subtract", left: { op: "field", field: "capacity" }, right: { op: "countRelated", relationship: "registration_shift" } })).toBe(1);
    const result = validateRuntimeDataV3(volunteerOperationsV3, data);
    expect(result.ok, result.ok ? "" : result.issues.join("; ")).toBe(true);
  });

  it("supports multiple references from one record", () => {
    const artifact = copy(clubAttendanceV3);
    artifact.collections[1].relationships[0].cardinality = "many";
    artifact.collections[1].seed![0].club_id = ["club_robotics"];
    expect(validateArtifactV3(artifact)).toMatchObject({ ok: true });
    const data = seedRuntimeDataV3(artifact);
    expect(resolveRelationship(artifact, data, "members", data.members[0], "member_club")).toMatchObject([{ id: "club_robotics" }]);
  });

  it("commits a valid signup, and rejects duplicate/full attempts without partial writes", () => {
    const data = seedRuntimeDataV3(volunteerOperationsV3);
    const action = volunteerOperationsV3.workflows[0];
    const duplicate = applyWorkflow(volunteerOperationsV3, data, action, "shift_setup", { volunteer_id: "vol_ada" });
    expect(duplicate.ok).toBe(false);
    expect(JSON.stringify(duplicate.data)).toBe(JSON.stringify(data));
    const first = applyWorkflow(volunteerOperationsV3, data, action, "shift_setup", { volunteer_id: "vol_sam" });
    expect(first.ok, first.ok ? "" : first.feedback).toBe(true);
    if (!first.ok) return;
    expect(first.data.registrations).toHaveLength(2);
    const full = applyWorkflow(volunteerOperationsV3, first.data, action, "shift_setup", { volunteer_id: "vol_lee" });
    expect(full.ok).toBe(false);
    expect(JSON.stringify(full.data)).toBe(JSON.stringify(first.data));
    expect(full.feedback).toContain("full");
  });

  it("prevents concurrent equipment checkouts and permits a new checkout after return", () => {
    const data = seedRuntimeDataV3(equipmentCheckoutV3);
    const checkout = equipmentCheckoutV3.workflows.find((item) => item.id === "checkout_item")!;
    const returned = equipmentCheckoutV3.workflows.find((item) => item.id === "return_item")!;
    const first = applyWorkflow(equipmentCheckoutV3, data, checkout, "camera_1", { borrower_id: "borrower_mina" });
    expect(first.ok, first.ok ? "" : first.feedback).toBe(true);
    if (!first.ok) return;
    const conflict = applyWorkflow(equipmentCheckoutV3, first.data, checkout, "camera_1", { borrower_id: "borrower_jo" });
    expect(conflict.ok).toBe(false);
    expect(JSON.stringify(conflict.data)).toBe(JSON.stringify(first.data));
    const returnResult = applyWorkflow(equipmentCheckoutV3, first.data, returned, first.data.checkouts[0].id as string);
    expect(returnResult.ok).toBe(true);
    if (!returnResult.ok) return;
    const repeatedReturn = applyWorkflow(equipmentCheckoutV3, returnResult.data, returned, returnResult.data.checkouts[0].id as string);
    expect(repeatedReturn.ok).toBe(false);
    expect(repeatedReturn.data).toEqual(returnResult.data);
    expect(applyWorkflow(equipmentCheckoutV3, returnResult.data, checkout, "camera_1", { borrower_id: "borrower_jo" }).ok).toBe(true);
  });

  it("enforces restrict and explicit cascade deletion policies", () => {
    const data = seedRuntimeDataV3(volunteerOperationsV3);
    const deletion = { id: "delete_event", label: "Remove event", collection: "events", inputs: [], steps: [{ id: "remove", type: "delete" as const, collection: "events", target: "current" as const }] };
    const restricted = applyWorkflow(volunteerOperationsV3, data, deletion, "event_fair");
    expect(restricted.ok).toBe(false);
    expect(data.events).toHaveLength(1);
    const cascading = applyWorkflow(clubAttendanceV3, seedRuntimeDataV3(clubAttendanceV3), { ...deletion, collection: "meetings", steps: [{ ...deletion.steps[0], collection: "meetings" }] }, "meeting_1");
    expect(cascading.ok, cascading.ok ? "" : cascading.feedback).toBe(true);
    if (cascading.ok) expect(cascading.data.attendance).toHaveLength(0);
  });
});
