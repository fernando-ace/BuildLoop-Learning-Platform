import type { GeneratedAppV3, V3Collection } from "./v3";

export type V3ChangeRisk = "safe" | "migration" | "destructive" | "incompatible";
export type V3ChangeKind = "collection-added" | "collection-removed" | "field-added" | "field-removed" | "field-type-changed" | "relationship-added" | "relationship-removed" | "relationship-changed" | "computed-added" | "computed-removed" | "computed-changed" | "constraint-added" | "constraint-removed" | "constraint-changed" | "workflow-added" | "workflow-removed" | "workflow-changed" | "view-changed" | "app-changed";
export interface V3SchemaChange { kind: V3ChangeKind; risk: V3ChangeRisk; collectionId?: string; itemId?: string; label: string; detail: string }

function equal(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }
function mapById<T extends { id: string }>(items: T[] | undefined) { return new Map((items ?? []).map((item) => [item.id, item])); }
function add(change: V3SchemaChange[]) { return (item: V3SchemaChange) => change.push(item); }

export function diffV3ApplicationSchemas(before: GeneratedAppV3, after: GeneratedAppV3): V3SchemaChange[] {
  const changes: V3SchemaChange[] = [], push = add(changes);
  if (before.title !== after.title || before.summary !== after.summary) push({ kind: "app-changed", risk: "safe", label: "App description changed", detail: "The app title or description changed." });
  const oldCollections = mapById(before.collections), newCollections = mapById(after.collections);
  for (const [id, collection] of newCollections) {
    const old = oldCollections.get(id);
    if (!old) { push({ kind: "collection-added", risk: "safe", collectionId: id, itemId: id, label: `Added ${collection.label}`, detail: `Added the ${collection.label} list.` }); continue; }
    compareCollection(old, collection, push);
  }
  for (const [id, collection] of oldCollections) if (!newCollections.has(id)) push({ kind: "collection-removed", risk: "destructive", collectionId: id, itemId: id, label: `Removed ${collection.label}`, detail: `${collection.label} records remain in the earlier version; related records may need a new home.` });
  const oldScreens = mapById(before.screens), newScreens = mapById(after.screens);
  for (const [id, screen] of newScreens) if (!oldScreens.has(id)) push({ kind: "view-changed", risk: "safe", itemId: id, label: `Added ${screen.title}`, detail: `Added a ${screen.view} view.` });
  for (const [id, screen] of oldScreens) { const next = newScreens.get(id); if (!next) push({ kind: "view-changed", risk: "safe", itemId: id, label: `Removed ${screen.title}`, detail: "Removed a view without deleting saved records." }); else if (!equal(screen, next)) push({ kind: "view-changed", risk: "safe", itemId: id, label: `Changed ${next.title}`, detail: "Updated what appears on this screen." }); }
  changes.push(...diffV3Workflows(before, after));
  return changes;
}

function compareCollection(before: V3Collection, after: V3Collection, push: (item: V3SchemaChange) => void) {
  const oldFields = mapById(before.fields), newFields = mapById(after.fields);
  for (const [id, field] of newFields) {
    const old = oldFields.get(id);
    if (!old) push({ kind: "field-added", risk: "migration", collectionId: before.id, itemId: id, label: `Added ${field.label}`, detail: `Added ${field.label} to ${after.label}.` });
    else if (old.type !== field.type) push({ kind: "field-type-changed", risk: "incompatible", collectionId: before.id, itemId: id, label: `Changed ${field.label} field type`, detail: `The stored ${field.label} values may not fit the new type.` });
  }
  for (const [id, field] of oldFields) if (!newFields.has(id)) push({ kind: "field-removed", risk: "destructive", collectionId: before.id, itemId: id, label: `Removed ${field.label}`, detail: `Saved ${field.label} values will not appear in the new version.` });
  const oldRelations = mapById(before.relationships), newRelations = mapById(after.relationships);
  for (const [id, rel] of newRelations) {
    const old = oldRelations.get(id);
    if (!old) push({ kind: "relationship-added", risk: rel.required ? "destructive" : "migration", collectionId: before.id, itemId: id, label: `Added relationship to ${rel.label}`, detail: rel.required ? `Older ${after.label} records need a ${rel.label} before they can move forward.` : `Added an optional link from ${after.label} to ${rel.label}.` });
    else if (old.targetCollection !== rel.targetCollection || old.field !== rel.field || old.cardinality !== rel.cardinality || old.required !== rel.required || old.onDelete !== rel.onDelete) push({ kind: "relationship-changed", risk: old.targetCollection !== rel.targetCollection || old.cardinality !== rel.cardinality || old.required !== rel.required || old.onDelete !== rel.onDelete ? "destructive" : "safe", collectionId: before.id, itemId: id, label: `Changed relationship ${rel.label}`, detail: `The way ${after.label} connects to ${rel.label} changed.` });
  }
  for (const [id, rel] of oldRelations) if (!newRelations.has(id)) push({ kind: "relationship-removed", risk: "destructive", collectionId: before.id, itemId: id, label: `Removed relationship to ${rel.label}`, detail: `Saved ${after.label} records may lose their ${rel.label} link.` });
  compareDerived(before, after, "computed", "Computed value", push);
  compareDerived(before, after, "constraints", "Rule", push);
}

function compareDerived(before: V3Collection, after: V3Collection, key: "computed" | "constraints", label: string, push: (item: V3SchemaChange) => void) {
  const oldItems = mapById(before[key] as Array<{ id: string; label: string }> | undefined), newItems = mapById(after[key] as Array<{ id: string; label: string }> | undefined);
  const addedKind = key === "computed" ? "computed-added" : "constraint-added";
  const removedKind = key === "computed" ? "computed-removed" : "constraint-removed";
  const changedKind = key === "computed" ? "computed-changed" : "constraint-changed";
  for (const [id, item] of newItems) {
    const old = oldItems.get(id);
    if (!old) push({ kind: addedKind, risk: key === "computed" ? "safe" : "migration", collectionId: before.id, itemId: id, label: `Added ${label.toLowerCase()} ${item.label}`, detail: key === "computed" ? `Added the calculated ${item.label} value.` : `Added a new rule: ${item.label}.` });
    else if (!equal(old, item)) push({ kind: changedKind, risk: key === "computed" ? "safe" : "migration", collectionId: before.id, itemId: id, label: `Changed ${label.toLowerCase()} ${item.label}`, detail: `Updated ${item.label}.` });
  }
  for (const [id, item] of oldItems) if (!newItems.has(id)) push({ kind: removedKind, risk: "safe", collectionId: before.id, itemId: id, label: `Removed ${label.toLowerCase()} ${item.label}`, detail: `Removed ${item.label}; stored records are unchanged.` });
}

export function diffV3Workflows(before: GeneratedAppV3, after: GeneratedAppV3): V3SchemaChange[] {
  const changes: V3SchemaChange[] = [], oldItems = mapById(before.workflows), newItems = mapById(after.workflows);
  for (const [id, item] of newItems) { const old = oldItems.get(id); if (!old) changes.push({ kind: "workflow-added", risk: "safe", itemId: id, label: `Added action ${item.label}`, detail: `Added the ${item.label} action.` }); else if (!equal(old, item)) changes.push({ kind: "workflow-changed", risk: "safe", itemId: id, label: `Changed action ${item.label}`, detail: `Changed the steps in ${item.label}.` }); }
  for (const [id, item] of oldItems) if (!newItems.has(id)) changes.push({ kind: "workflow-removed", risk: "safe", itemId: id, label: `Removed action ${item.label}`, detail: `Removed the ${item.label} action.` });
  return changes;
}

export function describeV3SchemaChanges(changes: V3SchemaChange[]) { return changes.map((change) => change.label); }
