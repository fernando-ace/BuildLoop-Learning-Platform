import { describe, expect, it } from "vitest";
import { permissionBoundaryLabV4 } from "@/lib/builder/v4-fixtures";
import { assertCanAssignAppRole, authorizeApplicationOperation, type MembershipContext } from "./authorization";

const owner: MembershipContext = { appId: "app-a", userId: "user-owner", platformRole: "owner", appRole: "admin" };
const member: MembershipContext = { appId: "app-a", userId: "user-member", platformRole: "member", appRole: "member" };

describe("application authorization", () => {
  it("requires an authenticated identity and exact tenant membership", () => {
    expect(authorizeApplicationOperation({ userId: null, appId: "app-a", membership: owner, artifact: permissionBoundaryLabV4, operation: "runtime" })).toMatchObject({ allowed: false, reason: "unauthenticated" });
    expect(authorizeApplicationOperation({ userId: "user-owner", appId: "app-b", membership: owner, artifact: permissionBoundaryLabV4, operation: "publish" })).toMatchObject({ allowed: false, reason: "membership_required" });
  });

  it("keeps platform management privileges separate from generated app roles", () => {
    expect(authorizeApplicationOperation({ userId: member.userId, appId: member.appId, membership: member, artifact: permissionBoundaryLabV4, operation: "publish" })).toMatchObject({ allowed: false, reason: "admin_required" });
    expect(authorizeApplicationOperation({ userId: member.userId, appId: member.appId, membership: member, artifact: permissionBoundaryLabV4, operation: "runtime" })).toMatchObject({ allowed: true, appUser: { id: "user-member", roles: ["member"] } });
    expect(authorizeApplicationOperation({ userId: member.userId, appId: member.appId, membership: member, artifact: permissionBoundaryLabV4, operation: "transfer_ownership" })).toMatchObject({ allowed: false, reason: "owner_required" });
  });

  it("never maps an absent or unknown membership role into app permissions", () => {
    const noRole = { ...member, appRole: "unknown-role" };
    expect(authorizeApplicationOperation({ userId: noRole.userId, appId: noRole.appId, membership: noRole, artifact: permissionBoundaryLabV4, operation: "runtime" })).toMatchObject({ allowed: false, reason: "app_role_required" });
    expect(assertCanAssignAppRole(permissionBoundaryLabV4, "unknown-role", "owner")).toBe(false);
    expect(assertCanAssignAppRole(permissionBoundaryLabV4, "member", "member")).toBe(false);
  });
});
