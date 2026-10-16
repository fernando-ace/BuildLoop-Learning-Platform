import { randomUUID } from "node:crypto";
import { applyWorkflow, validateRuntimeDataV3 } from "@/lib/builder/v3";
import type { RuntimeData } from "@/lib/builder/v2";
import { canUsePermission, stampOwnedFields, toV3Artifact, type GeneratedAppV4, type V4AppUser } from "@/lib/builder/v4";
import { SharedRuntimeError, type SharedOperation } from "./runtime-errors";

function object(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype); }
function clone<T>(value: T): T { return structuredClone(value); }

export function applyRuntimeOperation(artifact: GeneratedAppV4, user: V4AppUser, source: RuntimeData, operation: SharedOperation, idFactory: () => string = randomUUID) {
  const before = clone(source);
  let after = clone(source), collection = "", operationName: string = operation.type, affectedIds: string[] = [];
  if (operation.type === "create" || operation.type === "update" || operation.type === "delete") {
    collection = operation.collection;
    const declared = artifact.collections.find((item) => item.id === collection);
    if (!declared) throw new SharedRuntimeError("validation", "This app does not contain that list.");
    const rows = after[collection] ?? [];
    if (operation.type === "create") {
      const values = checkedValues(declared, operation.values);
      const candidate = stampOwnedFields(artifact, user, collection, { id: idFactory(), ...values });
      if (!canUsePermission(artifact, user, collection, "create", candidate)) throw new SharedRuntimeError("authorization", "Your role cannot add this record.");
      rows.push(candidate); after[collection] = rows; affectedIds = [String(candidate.id)];
    } else {
      const existing = rows.find((row) => row.id === operation.recordId);
      if (!existing) throw new SharedRuntimeError("not_found", "That record is no longer available.");
      const permission = canUsePermission(artifact, user, collection, operation.type, existing);
      if (!permission) throw new SharedRuntimeError("authorization", "Your role cannot change this record.");
      if (operation.type === "delete") after[collection] = rows.filter((row) => row.id !== existing.id);
      else {
        const values = checkedValues(declared, operation.values);
        if (permission.fields && Object.keys(values).some((key) => !permission.fields?.includes(key))) throw new SharedRuntimeError("authorization", "Your role cannot change those details.");
        const candidate = { ...existing, ...values };
        if (!canUsePermission(artifact, user, collection, "update", candidate)) throw new SharedRuntimeError("authorization", "You can only change records that belong to you.");
        after[collection] = rows.map((row) => row.id === existing.id ? candidate : row);
      }
      affectedIds = [String(existing.id)];
    }
  } else {
    const workflow = artifact.workflows.find((item) => item.id === operation.workflow);
    const workflowAccess = artifact.workflowPermissions.find((permission) => permission.workflow === operation.workflow && permission.roles.some((role) => user.roles.includes(role)));
    if (!workflow || !workflowAccess) throw new SharedRuntimeError("authorization", "Your role cannot run that action.");
    collection = workflow.collection; operationName = `workflow:${workflow.id}`;
    const current = (before[workflow.collection] ?? []).find((row) => row.id === operation.recordId);
    if (!current || !canUsePermission(artifact, user, workflow.collection, "read", current)) throw new SharedRuntimeError("authorization", "You cannot use this action on that record.");
    const inputNames = new Set(workflow.inputs ?? []), inputs = operation.inputs ?? {};
    if (Object.keys(inputs).some((key) => !inputNames.has(key))) throw new SharedRuntimeError("validation", "This action received an unexpected value.");
    const result = applyWorkflow(toV3Artifact(artifact), before, workflow, operation.recordId, inputs);
    if (!result.ok) throw new SharedRuntimeError("workflow", result.feedback);
    after = result.data;
    for (const definition of artifact.collections) {
      const beforeRows = before[definition.id] ?? [], afterRows = after[definition.id] ?? [];
      const beforeIds = new Set(beforeRows.map((row) => String(row.id))), afterIds = new Set(afterRows.map((row) => String(row.id)));
      const newRows = afterRows.filter((row) => !beforeIds.has(String(row.id)));
      for (const row of newRows) {
        const stamped = stampOwnedFields(artifact, user, definition.id, row);
        if (!canUsePermission(artifact, user, definition.id, "create", stamped)) throw new SharedRuntimeError("authorization", "Your role cannot create the record required for this action.");
        after[definition.id] = after[definition.id].map((item) => item.id === row.id ? stamped : item);
        affectedIds.push(String(row.id));
      }
      const changedRows = afterRows.filter((row) => beforeIds.has(String(row.id)) && JSON.stringify(beforeRows.find((item) => item.id === row.id)) !== JSON.stringify(row));
      for (const row of changedRows) {
        const old = beforeRows.find((item) => item.id === row.id)!;
        const permission = canUsePermission(artifact, user, definition.id, "update", old);
        if (!permission || !canUsePermission(artifact, user, definition.id, "update", row)) throw new SharedRuntimeError("authorization", "Your role cannot change that record.");
        if (permission.fields) {
          const changedFields = Object.keys(row).filter((field) => JSON.stringify(row[field]) !== JSON.stringify(old[field]));
          if (changedFields.some((field) => !permission.fields?.includes(field))) throw new SharedRuntimeError("authorization", "Your role cannot change those details.");
        }
        affectedIds.push(String(row.id));
      }
      for (const row of beforeRows.filter((item) => !afterIds.has(String(item.id)))) {
        if (!canUsePermission(artifact, user, definition.id, "delete", row)) throw new SharedRuntimeError("authorization", "Your role cannot remove that record.");
        affectedIds.push(String(row.id));
      }
    }
  }
  const checked = validateRuntimeDataV3(toV3Artifact(artifact), after);
  if (!checked.ok) throw new SharedRuntimeError("constraint", "That change would break an app rule. Review the record and try again.", checked.issues);
  return { data: checked.data, operation: operationName, collection, recordIds: [...new Set(affectedIds)].slice(0, 100) };
}

function checkedValues(collection: GeneratedAppV4["collections"][number], values: Record<string, unknown>) {
  if (!object(values) || Object.keys(values).length > 32) throw new SharedRuntimeError("validation", "Enter a few valid values and try again.");
  const fields = new Set(collection.fields.map((field) => field.id)), relationships = new Set(collection.relationships.map((relationship) => relationship.field));
  if (Object.keys(values).some((key) => key === "id" || !fields.has(key) && !relationships.has(key))) throw new SharedRuntimeError("validation", "This app does not allow that field to be changed.");
  if (JSON.stringify(values).length > 16_000) throw new SharedRuntimeError("validation", "That change is too large.");
  return values;
}
