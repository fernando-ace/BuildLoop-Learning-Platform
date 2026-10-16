import type { GeneratedAppV4 } from "./v4";
import { clubAttendanceV3, equipmentCheckoutV3, volunteerOperationsV3 } from "./v3-fixtures";

function common(base: (typeof volunteerOperationsV3), roles: GeneratedAppV4["roles"], users: GeneratedAppV4["users"], permissions: GeneratedAppV4["permissions"], workflowPermissions: GeneratedAppV4["workflowPermissions"]): GeneratedAppV4 {
  return { ...structuredClone(base), format: "buildloop-app-v4", roles, users, permissions, workflowPermissions };
}

export const volunteerCoordinationV4: GeneratedAppV4 = common(volunteerOperationsV3,
  [{ id: "volunteer", label: "Volunteer" }, { id: "coordinator", label: "Coordinator" }],
  [{ id: "vol_ada", displayName: "Jordan Lee", roles: ["volunteer"] }, { id: "vol_sam", displayName: "Riley Chen", roles: ["volunteer"] }, { id: "vol_coordinator", displayName: "Maya Brooks", roles: ["coordinator"] }],
  [
    { id: "events_public", role: "volunteer", collection: "events", operations: ["read"], visibility: "public" },
    { id: "shifts_public", role: "volunteer", collection: "shifts", operations: ["read"], visibility: "public" },
    { id: "signup_read_own", role: "volunteer", collection: "registrations", operations: ["read"], visibility: "owned", ownership: { op: "equals", left: { op: "recordField", field: "volunteer_id" }, right: { op: "userField", field: "id" } } },
    { id: "signup_create_own", role: "volunteer", collection: "registrations", operations: ["create"], visibility: "owned", ownership: { op: "equals", left: { op: "recordField", field: "volunteer_id" }, right: { op: "userField", field: "id" } } },
    { id: "signup_delete_own", role: "volunteer", collection: "registrations", operations: ["delete"], visibility: "owned", ownership: { op: "equals", left: { op: "recordField", field: "volunteer_id" }, right: { op: "userField", field: "id" } } },
    { id: "coordinator_events", role: "coordinator", collection: "events", operations: ["read", "create", "update", "delete"], visibility: "all" },
    { id: "coordinator_shifts", role: "coordinator", collection: "shifts", operations: ["read", "create", "update", "delete"], visibility: "all" },
    { id: "coordinator_signups", role: "coordinator", collection: "registrations", operations: ["read", "create", "update", "delete"], visibility: "all" },
    { id: "coordinator_activity", role: "coordinator", collection: "activity", operations: ["read"], visibility: "all" },
  ], [{ workflow: "register_volunteer", roles: ["volunteer", "coordinator"] }, { workflow: "cancel_signup", roles: ["volunteer", "coordinator"] }]);

volunteerCoordinationV4.workflows.push({ id: "cancel_signup", label: "Cancel signup", collection: "registrations", steps: [{ id: "remove_own_signup", type: "delete", collection: "registrations", target: "current" }] });

export const equipmentCheckoutAppV4: GeneratedAppV4 = common(equipmentCheckoutV3,
  [{ id: "borrower", label: "Borrower" }, { id: "manager", label: "Equipment manager" }],
  [{ id: "borrower_mina", displayName: "Jordan Lee", roles: ["borrower"] }, { id: "borrower_jo", displayName: "Riley Chen", roles: ["borrower"] }, { id: "equipment_manager", displayName: "Morgan Diaz", roles: ["manager"] }],
  [
    { id: "equipment_browse", role: "borrower", collection: "equipment", operations: ["read"], visibility: "public", fields: ["name", "category", "asset_tag", "active_checkout_count"] },
    { id: "checkout_read_own", role: "borrower", collection: "checkouts", operations: ["read"], visibility: "owned", ownership: { op: "equals", left: { op: "recordField", field: "borrower_id" }, right: { op: "userField", field: "id" } } },
    { id: "checkout_create_own", role: "borrower", collection: "checkouts", operations: ["create"], visibility: "owned", ownership: { op: "equals", left: { op: "recordField", field: "borrower_id" }, right: { op: "userField", field: "id" } } },
    { id: "checkout_update_own", role: "borrower", collection: "checkouts", operations: ["update"], visibility: "owned", ownership: { op: "equals", left: { op: "recordField", field: "borrower_id" }, right: { op: "userField", field: "id" } } },
    { id: "manager_equipment", role: "manager", collection: "equipment", operations: ["read", "create", "update", "delete"], visibility: "all" },
    { id: "manager_checkout", role: "manager", collection: "checkouts", operations: ["read", "create", "update", "delete"], visibility: "all" },
    { id: "manager_activity", role: "manager", collection: "activity", operations: ["read"], visibility: "all" },
  ], [{ workflow: "checkout_item", roles: ["borrower", "manager"] }, { workflow: "return_item", roles: ["borrower", "manager"] }]);

const club = structuredClone(clubAttendanceV3);
club.workflows = [{ id: "check_in", label: "Check in", collection: "meetings", inputs: ["member_id"], steps: [{ id: "create_attendance", type: "create", collection: "attendance", values: { meeting_id: { source: "currentId" }, member_id: { source: "input", field: "member_id" }, checked_in: { source: "literal", value: true } } }] }];
export const clubAttendanceAppV4: GeneratedAppV4 = common(club,
  [{ id: "member", label: "Member" }, { id: "officer", label: "Club officer" }],
  [{ id: "member_ana", displayName: "Jordan Lee", roles: ["member"] }, { id: "member_kai", displayName: "Riley Chen", roles: ["member"] }, { id: "club_officer", displayName: "Sam Patel", roles: ["officer"] }],
  [
    { id: "member_meetings", role: "member", collection: "meetings", operations: ["read"], visibility: "public", fields: ["title", "date", "room", "attendee_count"] },
    { id: "member_attendance", role: "member", collection: "attendance", operations: ["read"], visibility: "owned", ownership: { op: "equals", left: { op: "recordField", field: "member_id" }, right: { op: "userField", field: "id" } } },
    { id: "member_create_attendance", role: "member", collection: "attendance", operations: ["create"], visibility: "owned", ownership: { op: "equals", left: { op: "recordField", field: "member_id" }, right: { op: "userField", field: "id" } } },
    { id: "officer_meetings", role: "officer", collection: "meetings", operations: ["read", "create", "update", "delete"], visibility: "all" },
    { id: "officer_attendance", role: "officer", collection: "attendance", operations: ["read", "create", "update", "delete"], visibility: "all" },
    { id: "officer_activity", role: "officer", collection: "activity", operations: ["read"], visibility: "all" },
  ], [{ workflow: "check_in", roles: ["member", "officer"] }]);

export const permissionBoundaryLabV4: GeneratedAppV4 = {
  ...structuredClone(volunteerCoordinationV4),
  title: "Permission Boundary Lab",
  summary: "Try allowed and blocked actions as two volunteers and an administrator.",
  roles: [{ id: "member", label: "Member" }, { id: "admin", label: "Administrator" }],
  users: [{ id: "vol_ada", displayName: "Jordan Lee", roles: ["member"] }, { id: "vol_sam", displayName: "Riley Chen", roles: ["member"] }, { id: "lab_admin", displayName: "Casey Morgan", roles: ["admin"] }],
  permissions: [
    { id: "public_events", role: "member", collection: "events", operations: ["read"], visibility: "public", fields: ["name", "date", "location"] },
    { id: "private_signups", role: "member", collection: "registrations", operations: ["read"], visibility: "owned", ownership: { op: "equals", left: { op: "recordField", field: "volunteer_id" }, right: { op: "userField", field: "id" } } },
    { id: "own_signup_create", role: "member", collection: "registrations", operations: ["create"], visibility: "owned", ownership: { op: "equals", left: { op: "recordField", field: "volunteer_id" }, right: { op: "userField", field: "id" } } },
    { id: "admin_events", role: "admin", collection: "events", operations: ["read", "create", "update", "delete"], visibility: "all" },
    { id: "admin_shifts", role: "admin", collection: "shifts", operations: ["read", "create", "update", "delete"], visibility: "all" },
    { id: "admin_signups", role: "admin", collection: "registrations", operations: ["read", "create", "update", "delete"], visibility: "all" },
    { id: "admin_activity", role: "admin", collection: "activity", operations: ["read"], visibility: "all" },
  ],
  workflowPermissions: [{ workflow: "register_volunteer", roles: ["member", "admin"] }],
};

export const v4Fixtures = [volunteerCoordinationV4, equipmentCheckoutAppV4, clubAttendanceAppV4] as const;
