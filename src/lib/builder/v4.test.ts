import { describe, expect, it } from "vitest";
import { diffV4ApplicationSchemas } from "./schema-diff-v4";
import { clubAttendanceAppV4, equipmentCheckoutAppV4, permissionBoundaryLabV4, volunteerCoordinationV4 } from "./v4-fixtures";
import { canUsePermission, evaluateOwnership, filterVisibleRows, stampOwnedFields, validateArtifactV4 } from "./v4";

describe("V4 shared app schemas", () => {
  it("accepts the three reference applications and the permission boundary lab", () => {
    for (const fixture of [volunteerCoordinationV4, equipmentCheckoutAppV4, clubAttendanceAppV4, permissionBoundaryLabV4]) {
      const result = validateArtifactV4(fixture);
      expect(result.ok, `${fixture.title}: ${result.ok ? "valid" : result.issues.join("; ")}`).toBe(true);
    }
  });

  it("rejects unknown roles, unsafe ownership fields, duplicate IDs, and unknown permission fields", () => {
    const badRole = structuredClone(volunteerCoordinationV4);
    badRole.users[0].roles = ["superuser"];
    expect(validateArtifactV4(badRole).ok).toBe(false);
    const badOwner = structuredClone(volunteerCoordinationV4);
    badOwner.permissions[2].ownership = { op: "equals", left: { op: "recordField", field: "constructor" }, right: { op: "userField", field: "id" } };
    expect(validateArtifactV4(badOwner).ok).toBe(false);
    const badField = structuredClone(volunteerCoordinationV4);
    badField.permissions[1].fields = ["internal_notes"];
    expect(validateArtifactV4(badField).ok).toBe(false);
    const duplicate = structuredClone(volunteerCoordinationV4);
    duplicate.roles[1].id = duplicate.roles[0].id;
    expect(validateArtifactV4(duplicate).ok).toBe(false);
  });

  it("keeps owner comparisons bounded and filters private rows and fields before serialization", () => {
    const jordan = volunteerCoordinationV4.users[0];
    const signup = { id: "signup_1", volunteer_id: jordan.id, shift_id: "shift_setup", created_on: "2026-10-15" };
    const other = { ...signup, id: "signup_2", volunteer_id: "vol_sam" };
    expect(evaluateOwnership(volunteerCoordinationV4.permissions[2].ownership!, signup, jordan)).toBe(true);
    expect(evaluateOwnership(volunteerCoordinationV4.permissions[2].ownership!, other, jordan)).toBe(false);
    expect(canUsePermission(volunteerCoordinationV4, jordan, "registrations", "update", other)).toBe(null);
    const visible = filterVisibleRows(volunteerCoordinationV4, jordan, "registrations", [signup, other]);
    expect(visible.map((row) => row.id)).toEqual(["signup_1"]);
    const publicMeeting = filterVisibleRows(clubAttendanceAppV4, clubAttendanceAppV4.users[0], "meetings", [{ id: "m1", title: "Build night", internal_notes: "private" }]);
    expect(publicMeeting[0]).toEqual({ id: "m1", title: "Build night" });
  });

  it("stamps owner fields from the selected server identity", () => {
    const jordan = volunteerCoordinationV4.users[0];
    expect(stampOwnedFields(volunteerCoordinationV4, jordan, "registrations", { volunteer_id: "vol_sam", shift_id: "shift_setup" })).toEqual({ volunteer_id: "vol_ada", shift_id: "shift_setup" });
  });

  it("highlights permission widening and role changes in a stable schema diff", () => {
    const after = structuredClone(volunteerCoordinationV4);
    after.permissions[2] = { ...after.permissions[2], visibility: "all" };
    after.roles.push({ id: "auditor", label: "Auditor" });
    const changes = diffV4ApplicationSchemas(volunteerCoordinationV4, after);
    expect(changes.map((change) => change.kind)).toContain("permission-widened");
    expect(changes.map((change) => change.kind)).toContain("role-added");
    expect(changes.every((change) => change.risk === "security")).toBe(true);
  });
});
