import type { GeneratedAppV4, V4Permission } from "./v4";

export interface V4SchemaChange { kind: string; risk: "informational" | "security" | "destructive"; label: string }

const permissionKey = (permission: V4Permission) => permission.id;
const visibilityRank = (visibility: V4Permission["visibility"]) => visibility === "owned" ? 1 : visibility === "public" ? 2 : 3;

export function diffV4ApplicationSchemas(before: GeneratedAppV4, after: GeneratedAppV4): V4SchemaChange[] {
  const changes: V4SchemaChange[] = [];
  const oldRoles = new Map(before.roles.map((role) => [role.id, role]));
  const newRoles = new Map(after.roles.map((role) => [role.id, role]));
  for (const role of after.roles) if (!oldRoles.has(role.id)) changes.push({ kind: "role-added", risk: "security", label: `Added the ${role.label} role` });
  for (const role of before.roles) if (!newRoles.has(role.id)) changes.push({ kind: "role-removed", risk: "destructive", label: `Removed the ${role.label} role` });
  const oldPermissions = new Map(before.permissions.map((permission) => [permissionKey(permission), permission]));
  const newPermissions = new Map(after.permissions.map((permission) => [permissionKey(permission), permission]));
  for (const [key, next] of newPermissions) {
    const previous = oldPermissions.get(key);
    const role = after.roles.find((item) => item.id === next.role)?.label ?? next.role;
    const collection = after.collections.find((item) => item.id === next.collection)?.label ?? next.collection;
    if (!previous) { changes.push({ kind: "permission-added", risk: "security", label: `${role} can now ${next.operations.join(", ")} ${collection.toLowerCase()}` }); continue; }
    const widened = next.operations.some((operation) => !previous.operations.includes(operation)) || visibilityRank(next.visibility) > visibilityRank(previous.visibility) || previous.fields !== undefined && next.fields === undefined || previous.fields !== undefined && next.fields?.some((field) => !previous.fields?.includes(field));
    const restricted = previous.operations.some((operation) => !next.operations.includes(operation)) || visibilityRank(next.visibility) < visibilityRank(previous.visibility) || previous.fields === undefined && next.fields !== undefined || previous.fields !== undefined && next.fields !== undefined && previous.fields.some((field) => !next.fields?.includes(field));
    if (widened) changes.push({ kind: "permission-widened", risk: "security", label: `${role} can access more ${collection.toLowerCase()} records or actions` });
    else if (restricted) changes.push({ kind: "permission-restricted", risk: "security", label: `${role} can access fewer ${collection.toLowerCase()} records or actions` });
    if (JSON.stringify(previous.ownership ?? null) !== JSON.stringify(next.ownership ?? null) && !widened && !restricted) changes.push({ kind: "ownership-changed", risk: "security", label: `${role}'s ownership rule changed for ${collection.toLowerCase()}` });
  }
  for (const [key, previous] of oldPermissions) if (!newPermissions.has(key)) {
    const role = before.roles.find((item) => item.id === previous.role)?.label ?? previous.role;
    const collection = before.collections.find((item) => item.id === previous.collection)?.label ?? previous.collection;
    changes.push({ kind: "permission-removed", risk: "security", label: `${role} can no longer ${previous.operations.join(", ")} ${collection.toLowerCase()}` });
  }
  const workflowRoles = (artifact: GeneratedAppV4) => new Map(artifact.workflowPermissions.map((permission) => [permission.workflow, permission.roles.join(",")]));
  const oldWorkflows = workflowRoles(before), newWorkflows = workflowRoles(after);
  for (const workflow of after.workflows) {
    const old = oldWorkflows.get(workflow.id), next = newWorkflows.get(workflow.id);
    if (old !== next) changes.push({ kind: "workflow-authorization-changed", risk: "security", label: `Access to “${workflow.label}” changed` });
  }
  if (JSON.stringify(before.workflows) !== JSON.stringify(after.workflows) && !changes.some((change) => change.kind === "workflow-authorization-changed")) changes.push({ kind: "workflow-changed", risk: "informational", label: "Changed a shared action" });
  return changes;
}
