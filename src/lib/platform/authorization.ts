import type { GeneratedAppV4, V4AppUser } from "@/lib/builder/v4";

export type PlatformRole = "owner" | "administrator" | "member";
export interface MembershipContext { appId: string; userId: string; platformRole: PlatformRole; appRole: string | null; }
export type AppOperation = "runtime" | "publish" | "manage_members" | "transfer_ownership" | "read_audit" | "manage_project";
export type AuthorizationDecision = { allowed: true; appUser?: V4AppUser } | { allowed: false; reason: "unauthenticated" | "membership_required" | "app_role_required" | "owner_required" | "admin_required" };

/** Resolve platform identity and membership together. A membership from another app can never authorize this request. */
export function authorizeApplicationOperation(input: {
  userId: string | null;
  appId: string;
  membership: MembershipContext | null;
  artifact: GeneratedAppV4 | null;
  operation: AppOperation;
  displayName?: string;
}): AuthorizationDecision {
  if (!input.userId) return { allowed: false, reason: "unauthenticated" };
  const member = input.membership;
  if (!member || member.appId !== input.appId || member.userId !== input.userId) return { allowed: false, reason: "membership_required" };
  if (input.operation === "transfer_ownership") return member.platformRole === "owner" ? { allowed: true } : { allowed: false, reason: "owner_required" };
  if (input.operation === "manage_members" || input.operation === "publish" || input.operation === "manage_project") {
    return member.platformRole === "owner" || member.platformRole === "administrator" ? { allowed: true } : { allowed: false, reason: "admin_required" };
  }
  if (input.operation === "runtime") {
    if (!input.artifact || !member.appRole || !input.artifact.roles.some((role) => role.id === member.appRole)) return { allowed: false, reason: "app_role_required" };
    return { allowed: true, appUser: { id: input.userId, displayName: input.displayName ?? input.userId, roles: [member.appRole] } };
  }
  return member.appRole && input.artifact?.roles.some((role) => role.id === member.appRole)
    ? { allowed: true }
    : { allowed: false, reason: "app_role_required" };
}

export function assertCanAssignAppRole(artifact: GeneratedAppV4, roleId: string, assignerRole: PlatformRole) {
  if (assignerRole !== "owner" && assignerRole !== "administrator") return false;
  return artifact.roles.some((role) => role.id === roleId);
}
