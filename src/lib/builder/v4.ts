import type { RuntimeData } from "./v2";
import { validateArtifactV3, type GeneratedAppV3 } from "./v3";

export type V4Scalar = string | number | boolean | null;
export type V4UserField = "id" | "displayName" | { profile: string };
export type V4OwnershipExpr =
  | { op: "equals"; left: { op: "recordField"; field: string }; right: { op: "userField"; field: V4UserField } }
  | { op: "notEquals"; left: { op: "recordField"; field: string }; right: { op: "userField"; field: V4UserField } }
  | { op: "and"; items: V4OwnershipExpr[] }
  | { op: "or"; items: V4OwnershipExpr[] }
  | { op: "not"; value: V4OwnershipExpr };
export interface V4Role { id: string; label: string }
export interface V4AppUser { id: string; displayName: string; roles: string[]; profile?: Record<string, V4Scalar> }
export type V4Operation = "read" | "create" | "update" | "delete";
export interface V4Permission {
  id: string;
  role: string;
  collection: string | "activity";
  operations: V4Operation[];
  visibility: "all" | "owned" | "public";
  ownership?: V4OwnershipExpr;
  fields?: string[];
}
export interface V4WorkflowPermission { workflow: string; roles: string[] }
export interface GeneratedAppV4 extends Omit<GeneratedAppV3, "format"> {
  format: "buildloop-app-v4";
  roles: V4Role[];
  users: V4AppUser[];
  permissions: V4Permission[];
  workflowPermissions: V4WorkflowPermission[];
}
export type AppArtifactV4 = GeneratedAppV4;

const ID = /^[a-z][a-z0-9_]{0,31}$/;
const safeLabel = (value: unknown, max = 80): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/(<\s*\/?\s*(?:script|iframe|img|svg|html)|javascript\s*:|https?:\/\/|\bon\w+\s*=|\b(?:eval|fetch|Function)\s*\()/i.test(value);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
const ownKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key) && !["__proto__", "prototype", "constructor"].includes(key));
const MAX_BYTES = 110_000;
const MAX_ROLES = 12;
const MAX_USERS = 100;
const MAX_PERMISSIONS = 120;
const MAX_DEPTH = 8;

function validOwnership(value: unknown, depth = 0): value is V4OwnershipExpr {
  if (depth > MAX_DEPTH || !object(value) || typeof value.op !== "string") return false;
  if (value.op === "and" || value.op === "or") return ownKeys(value, ["op", "items"]) && Array.isArray(value.items) && value.items.length > 0 && value.items.length <= 8 && value.items.every((item) => validOwnership(item, depth + 1));
  if (value.op === "not") return ownKeys(value, ["op", "value"]) && validOwnership(value.value, depth + 1);
  if (value.op !== "equals" && value.op !== "notEquals") return false;
  if (!ownKeys(value, ["op", "left", "right"]) || !object(value.left) || !object(value.right)) return false;
  const record = value.left, user = value.right;
  return ownKeys(record, ["op", "field"]) && record.op === "recordField" && typeof record.field === "string" && ID.test(record.field) &&
    ownKeys(user, ["op", "field"]) && user.op === "userField" && (user.field === "id" || user.field === "displayName" || object(user.field) && ownKeys(user.field, ["profile"]) && typeof user.field.profile === "string" && ID.test(user.field.profile));
}

export function validateArtifactV4(value: unknown): { ok: true; artifact: GeneratedAppV4 } | { ok: false; issues: string[] } {
  if (!object(value)) return { ok: false, issues: ["Artifact must be an object"] };
  let byteLength = 0;
  try { byteLength = new TextEncoder().encode(JSON.stringify(value)).length; } catch { return { ok: false, issues: ["Artifact must contain JSON data only"] }; }
  if (byteLength > MAX_BYTES) return { ok: false, issues: ["Artifact is too large"] };
  const issues: string[] = [];
  if (value.format !== "buildloop-app-v4") return { ok: false, issues: ["Unsupported app format"] };
  const { roles, users, permissions, workflowPermissions, ...base } = value;
  const v3Base = { ...base, format: "buildloop-app-v3" };
  const validatedBase = validateArtifactV3(v3Base);
  if (!validatedBase.ok) return { ok: false, issues: validatedBase.issues };
  const roleRows = Array.isArray(roles) ? roles : [];
  const userRows = Array.isArray(users) ? users : [];
  const permissionRows = Array.isArray(permissions) ? permissions : [];
  const workflowRows = Array.isArray(workflowPermissions) ? workflowPermissions : [];
  if (!Array.isArray(roles) || roleRows.length < 1 || roleRows.length > MAX_ROLES) issues.push(`Define 1 to ${MAX_ROLES} roles`);
  if (!Array.isArray(users) || userRows.length < 1 || userRows.length > MAX_USERS) issues.push(`Define 1 to ${MAX_USERS} test users`);
  if (!Array.isArray(permissions) || permissionRows.length > MAX_PERMISSIONS) issues.push(`Use no more than ${MAX_PERMISSIONS} permissions`);
  const roleIds = new Set<string>();
  for (const raw of roleRows) {
    if (!object(raw) || !ownKeys(raw, ["id", "label"]) || typeof raw.id !== "string" || !ID.test(raw.id) || roleIds.has(raw.id) || !safeLabel(raw.label)) issues.push("A role is invalid or duplicated");
    else roleIds.add(raw.id);
  }
  const userIds = new Set<string>();
  for (const raw of userRows) {
    if (!object(raw) || !ownKeys(raw, ["id", "displayName", "roles", "profile"]) || typeof raw.id !== "string" || !ID.test(raw.id) || userIds.has(raw.id) || !safeLabel(raw.displayName, 100) || !Array.isArray(raw.roles) || raw.roles.length < 1 || raw.roles.length > MAX_ROLES || !raw.roles.every((role) => typeof role === "string" && roleIds.has(role)) || raw.profile !== undefined && (!object(raw.profile) || Object.keys(raw.profile).length > 12 || Object.entries(raw.profile).some(([key, item]) => !ID.test(key) || !(item === null || typeof item === "string" && item.length <= 140 || typeof item === "number" && Number.isFinite(item) || typeof item === "boolean")))) issues.push("An app user is invalid or refers to an unknown role");
    else userIds.add(raw.id);
  }
  const v3 = validatedBase.artifact;
  const collectionMap = new Map((v3?.collections ?? []).map((collection) => [collection.id, collection]));
  const permissionIds = new Set<string>();
  for (const raw of permissionRows) {
    if (!object(raw) || !ownKeys(raw, ["id", "role", "collection", "operations", "visibility", "ownership", "fields"]) || typeof raw.id !== "string" || !ID.test(raw.id) || permissionIds.has(raw.id) || typeof raw.role !== "string" || !roleIds.has(raw.role) || typeof raw.collection !== "string" || raw.collection !== "activity" && !collectionMap.has(raw.collection) || !Array.isArray(raw.operations) || raw.operations.length < 1 || raw.operations.length > 4 || !raw.operations.every((op) => ["read", "create", "update", "delete"].includes(String(op))) || new Set(raw.operations).size !== raw.operations.length || !["all", "owned", "public"].includes(String(raw.visibility)) || raw.visibility === "owned" && !validOwnership(raw.ownership) || raw.visibility !== "owned" && raw.ownership !== undefined || raw.fields !== undefined && (!Array.isArray(raw.fields) || raw.fields.length > 32 || new Set(raw.fields).size !== raw.fields.length || raw.fields.some((field) => typeof field !== "string" || !ID.test(field)))) {
      issues.push("A permission is invalid or refers to a missing role or collection"); continue;
    }
    permissionIds.add(raw.id);
    if (raw.collection === "activity" && (raw.operations.some((op) => op !== "read") || raw.visibility !== "all")) issues.push("Activity permissions can only allow all activity to be read");
    const collection = collectionMap.get(raw.collection);
    if (collection && Array.isArray(raw.fields)) {
      const declared = new Set([...collection.fields.map((field) => field.id), ...collection.relationships.map((relationship) => relationship.field), ...(collection.computed ?? []).map((computed) => computed.id)]);
      if (raw.fields.some((field) => !declared.has(String(field)))) issues.push(`Permission ${raw.id} refers to an unknown visible field`);
    }
    if (collection && raw.visibility === "owned") {
      const check = (expr: unknown): void => { if (!object(expr)) return; if (expr.op === "equals" || expr.op === "notEquals") {
        const field = object(expr.left) && expr.left.op === "recordField" ? expr.left.field : undefined;
        if (typeof field !== "string" || !collection.fields.some((item) => item.id === field) && !collection.relationships.some((item) => item.field === field)) issues.push(`Ownership rule ${raw.id} refers to a missing stored field`);
      } else if (Array.isArray(expr.items)) expr.items.forEach(check); else if (object(expr.value)) check(expr.value); };
      check(raw.ownership);
    }
  }
  const workflows = new Set((v3?.workflows ?? []).map((workflow) => workflow.id));
  const workflowIds = new Set<string>();
  if (!Array.isArray(workflowPermissions) || workflowRows.length > 20) issues.push("Workflow permissions are malformed");
  for (const raw of workflowRows) {
    if (!object(raw) || !ownKeys(raw, ["workflow", "roles"]) || typeof raw.workflow !== "string" || !workflows.has(raw.workflow) || workflowIds.has(raw.workflow) || !Array.isArray(raw.roles) || raw.roles.length < 1 || raw.roles.length > MAX_ROLES || !raw.roles.every((role) => typeof role === "string" && roleIds.has(role))) issues.push("A workflow permission is invalid or refers to a missing workflow or role");
    else workflowIds.add(raw.workflow);
  }
  if (issues.length) return { ok: false, issues: [...new Set(issues)].slice(0, 12) };
  return { ok: true, artifact: { ...validatedBase.artifact, format: "buildloop-app-v4", roles: roleRows as V4Role[], users: userRows as V4AppUser[], permissions: permissionRows as V4Permission[], workflowPermissions: workflowRows as V4WorkflowPermission[] } };
}

export function toV3Artifact(artifact: GeneratedAppV4): GeneratedAppV3 {
  const { roles: _roles, users: _users, permissions: _permissions, workflowPermissions: _workflowPermissions, ...base } = artifact;
  return { ...base, format: "buildloop-app-v3" };
}

export function getV4User(artifact: GeneratedAppV4, userId: string): V4AppUser | null {
  return artifact.users.find((user) => user.id === userId) ?? null;
}

function userField(user: V4AppUser, field: V4UserField): V4Scalar {
  if (field === "id") return user.id;
  if (field === "displayName") return user.displayName;
  if (object(field) && typeof field.profile === "string") return user.profile?.[field.profile] ?? null;
  return null;
}

export function evaluateOwnership(expression: V4OwnershipExpr, row: Record<string, unknown>, user: V4AppUser): boolean {
  if (expression.op === "and") return expression.items.every((item) => evaluateOwnership(item, row, user));
  if (expression.op === "or") return expression.items.some((item) => evaluateOwnership(item, row, user));
  if (expression.op === "not") return !evaluateOwnership(expression.value, row, user);
  const left = row[expression.left.field];
  const right = userField(user, expression.right.field);
  return expression.op === "equals" ? left === right : left !== right;
}

export function canUsePermission(artifact: GeneratedAppV4, user: V4AppUser, collection: string, operation: V4Operation, row?: Record<string, unknown>): V4Permission | null {
  for (const permission of artifact.permissions) {
    if (permission.collection !== collection || !permission.operations.includes(operation) || !user.roles.includes(permission.role)) continue;
    if (permission.visibility === "owned" && (!row || !permission.ownership || !evaluateOwnership(permission.ownership, row, user))) continue;
    return permission;
  }
  return null;
}

export function filterVisibleRows(artifact: GeneratedAppV4, user: V4AppUser, collection: string, rows: Record<string, unknown>[]) {
  const result: Record<string, unknown>[] = [];
  for (const row of rows) {
    const policies = artifact.permissions.filter((permission) => permission.collection === collection && permission.operations.includes("read") && user.roles.includes(permission.role) && (permission.visibility !== "owned" || Boolean(permission.ownership && evaluateOwnership(permission.ownership, row, user))));
    if (!policies.length) continue;
    const allowed = policies.some((permission) => permission.fields === undefined) ? null : new Set(policies.flatMap((permission) => permission.fields ?? []));
    result.push(allowed ? Object.fromEntries(Object.entries(row).filter(([key]) => key === "id" || allowed.has(key))) : row);
  }
  return result;
}

export function stampOwnedFields(artifact: GeneratedAppV4, user: V4AppUser, collection: string, row: Record<string, unknown>) {
  const output = { ...row };
  for (const permission of artifact.permissions) {
    if (permission.collection !== collection || !permission.operations.includes("create") || permission.visibility !== "owned" || !user.roles.includes(permission.role) || !permission.ownership) continue;
    const expression = permission.ownership;
    const visit = (expr: V4OwnershipExpr) => {
      if (expr.op === "equals" && expr.right.op === "userField" && expr.right.field === "id") output[expr.left.field] = user.id;
      else if (expr.op === "and" || expr.op === "or") expr.items.forEach(visit);
      else if (expr.op === "not") visit(expr.value);
    };
    visit(expression);
  }
  return output;
}

export function validateSharedData(artifact: GeneratedAppV4, data: RuntimeData) {
  const checked = validateArtifactV3(toV3Artifact(artifact));
  if (!checked.ok) return checked;
  return V3Runtime.validateRuntimeDataV3(checked.artifact, data);
}
import * as V3Runtime from "./v3";
