import { volunteerCoordinationV4 } from "./v4-fixtures";
import type { GeneratedAppV4 } from "./v4";

/** A role-based fixture whose relational signup key is a trusted platform user ID. */
export const campusEventOperationsV4: GeneratedAppV4 = (() => {
  const artifact = structuredClone(volunteerCoordinationV4);
  artifact.title = "Campus Event Operations";
  artifact.summary = "Coordinate event shifts with real app members and keep every signup connected to its shift.";
  artifact.changeSummary = ["Connected signups to shifts", "Scoped volunteer signups to the signed-in member", "Kept the shift capacity and duplicate-signup rules on the server"];
  const registrations = artifact.collections.find((collection) => collection.id === "registrations")!;
  registrations.fields.push({ id: "volunteer_id", label: "Volunteer account", type: "text", required: true });
  registrations.relationships = registrations.relationships.filter((relationship) => relationship.id !== "registration_volunteer");
  registrations.constraints = [{ id: "one_signup", label: "This volunteer is already signed up for this shift", type: "unique", fields: ["shift_id", "volunteer_id"] }];
  registrations.seed = [{ id: "registration_demo_ada", shift_id: "shift_setup", volunteer_id: "vol_ada", created_on: "2026-10-15" }];
  return artifact;
})();
