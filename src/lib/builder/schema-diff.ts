import type { GeneratedAppV2, V2Collection, V2Field, V2Screen } from "./v2";

export type SchemaChangeKind =
  | "app-title-changed" | "app-summary-changed" | "sample-data-changed"
  | "collection-added" | "collection-removed" | "collection-renamed"
  | "field-added" | "field-removed" | "field-relabeled" | "field-type-compatible" | "field-type-incompatible"
  | "field-required-changed" | "field-default-changed" | "field-constraints-changed"
  | "view-added" | "view-removed" | "view-renamed" | "view-changed"
  | "navigation-changed" | "form-added" | "form-removed" | "form-changed" | "filter-changed" | "search-changed"
  | "metric-added" | "metric-removed" | "metric-changed" | "action-added" | "action-removed" | "action-changed";

export interface SchemaChange {
  kind: SchemaChangeKind;
  collectionId?: string;
  fieldId?: string;
  itemId?: string;
  before?: unknown;
  after?: unknown;
  destructive?: boolean;
}

const stable = (value: unknown) => JSON.stringify(value);
const mapById = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));
const compatibleType = (before: V2Field["type"], after: V2Field["type"]) => before === after || ((before === "text" || before === "longText") && (after === "text" || after === "longText"));

function diffFields(collectionId: string, before: V2Collection, after: V2Collection): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const oldFields = mapById(before.fields), newFields = mapById(after.fields);
  for (const [id, field] of newFields) if (!oldFields.has(id)) changes.push({ kind: "field-added", collectionId, fieldId: id, after: field });
  for (const [id, field] of oldFields) if (!newFields.has(id)) changes.push({ kind: "field-removed", collectionId, fieldId: id, before: field, destructive: true });
  for (const [id, oldField] of oldFields) {
    const field = newFields.get(id);
    if (!field) continue;
    if (oldField.label !== field.label) changes.push({ kind: "field-relabeled", collectionId, fieldId: id, before: oldField.label, after: field.label });
    if (oldField.type !== field.type) changes.push({ kind: compatibleType(oldField.type, field.type) ? "field-type-compatible" : "field-type-incompatible", collectionId, fieldId: id, before: oldField.type, after: field.type, destructive: !compatibleType(oldField.type, field.type) });
    if (Boolean(oldField.required) !== Boolean(field.required)) changes.push({ kind: "field-required-changed", collectionId, fieldId: id, before: Boolean(oldField.required), after: Boolean(field.required), destructive: Boolean(field.required) && field.default === undefined });
    if (stable(oldField.default) !== stable(field.default)) changes.push({ kind: "field-default-changed", collectionId, fieldId: id, before: oldField.default, after: field.default });
    const withoutLabel = (item: V2Field) => Object.fromEntries(Object.entries(item).filter(([key]) => !["id", "label", "required", "default"].includes(key)));
    if (stable(withoutLabel(oldField)) !== stable(withoutLabel(field))) changes.push({ kind: "field-constraints-changed", collectionId, fieldId: id, before: withoutLabel(oldField), after: withoutLabel(field) });
  }
  return changes;
}

function diffViews(before: V2Screen[], after: V2Screen[]): SchemaChange[] {
  const changes: SchemaChange[] = [], oldItems = mapById(before), newItems = mapById(after);
  for (const [id, item] of newItems) if (!oldItems.has(id)) { changes.push({ kind: "view-added", itemId: id, after: item }); if (item.view === "form") changes.push({ kind: "form-added", itemId: id, after: item }); }
  for (const [id, item] of oldItems) if (!newItems.has(id)) { changes.push({ kind: "view-removed", itemId: id, before: item }); if (item.view === "form") changes.push({ kind: "form-removed", itemId: id, before: item }); }
  for (const [id, oldItem] of oldItems) {
    const item = newItems.get(id);
    if (!item) continue;
    if (oldItem.title !== item.title) changes.push({ kind: "view-renamed", itemId: id, before: oldItem.title, after: item.title });
    if (oldItem.view !== item.view || oldItem.collection !== item.collection || oldItem.primaryField !== item.primaryField || stable(oldItem.fields) !== stable(item.fields) || stable(oldItem.sort) !== stable(item.sort) || oldItem.emptyText !== item.emptyText) changes.push({ kind: "view-changed", itemId: id, before: oldItem, after: item });
    if (stable(oldItem.filters) !== stable(item.filters)) changes.push({ kind: "filter-changed", itemId: id, before: oldItem.filters ?? [], after: item.filters ?? [] });
    if (oldItem.search !== item.search) changes.push({ kind: "search-changed", itemId: id, before: Boolean(oldItem.search), after: Boolean(item.search) });
    if (oldItem.view === "form" || item.view === "form") if (oldItem.view !== item.view || oldItem.formMode !== item.formMode || oldItem.cancelScreen !== item.cancelScreen) changes.push({ kind: "form-changed", itemId: id, before: { mode: oldItem.formMode, cancel: oldItem.cancelScreen }, after: { mode: item.formMode, cancel: item.cancelScreen } });
  }
  return changes;
}

function diffKeyed<T extends { id: string }>(before: T[], after: T[], added: SchemaChangeKind, removed: SchemaChangeKind, changed: SchemaChangeKind): SchemaChange[] {
  const changes: SchemaChange[] = [], oldItems = mapById(before), newItems = mapById(after);
  for (const [id, item] of newItems) if (!oldItems.has(id)) changes.push({ kind: added, itemId: id, after: item });
  for (const [id, item] of oldItems) if (!newItems.has(id)) changes.push({ kind: removed, itemId: id, before: item });
  for (const [id, oldItem] of oldItems) { const item = newItems.get(id); if (item && stable(oldItem) !== stable(item)) changes.push({ kind: changed, itemId: id, before: oldItem, after: item }); }
  return changes;
}

/** Compare validated V2 artifacts by their declarative IDs rather than labels or serialized blob shape. */
export function diffApplicationSchemas(before: GeneratedAppV2, after: GeneratedAppV2): SchemaChange[] {
  const changes: SchemaChange[] = [];
  if (before.title !== after.title) changes.push({ kind: "app-title-changed", before: before.title, after: after.title });
  if (before.summary !== after.summary) changes.push({ kind: "app-summary-changed", before: before.summary, after: after.summary });
  const oldCollections = mapById(before.collections), newCollections = mapById(after.collections);
  for (const [id, collection] of newCollections) if (!oldCollections.has(id)) changes.push({ kind: "collection-added", collectionId: id, after: collection });
  for (const [id, collection] of oldCollections) if (!newCollections.has(id)) changes.push({ kind: "collection-removed", collectionId: id, before: collection, destructive: true });
  for (const [id, oldCollection] of oldCollections) {
    const collection = newCollections.get(id);
    if (!collection) continue;
    if (oldCollection.label !== collection.label) changes.push({ kind: "collection-renamed", collectionId: id, before: oldCollection.label, after: collection.label });
    if (stable(oldCollection.seed ?? []) !== stable(collection.seed ?? [])) changes.push({ kind: "sample-data-changed", collectionId: id, before: oldCollection.seed ?? [], after: collection.seed ?? [] });
    changes.push(...diffFields(id, oldCollection, collection));
  }
  changes.push(...diffViews(before.screens, after.screens));
  if (stable(before.navigation) !== stable(after.navigation) || before.defaultScreen !== after.defaultScreen) changes.push({ kind: "navigation-changed", before: { items: before.navigation, defaultScreen: before.defaultScreen }, after: { items: after.navigation, defaultScreen: after.defaultScreen } });
  changes.push(...diffKeyed(before.metrics, after.metrics, "metric-added", "metric-removed", "metric-changed"));
  changes.push(...diffKeyed(before.actions, after.actions, "action-added", "action-removed", "action-changed"));
  return changes;
}

const titleCase = (id: string) => id.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
export function describeSchemaChanges(changes: SchemaChange[]): string[] {
  if (!changes.length) return ["Kept the existing data model and app structure"];
  return changes.map((change) => {
    const collection = change.collectionId ? titleCase(change.collectionId) : "";
    const field = change.fieldId ? titleCase(change.fieldId) : "";
    switch (change.kind) {
      case "app-title-changed": return `Renamed the app to ${String(change.after)}`;
      case "app-summary-changed": return "Updated the app description";
      case "sample-data-changed": return `Updated sample records in ${collection}`;
      case "collection-added": return `Added ${collection}`;
      case "collection-removed": return `Removed ${collection}`;
      case "collection-renamed": return `Renamed ${String(change.before)} to ${String(change.after)}`;
      case "field-added": return `Added ${field} to ${collection}`;
      case "field-removed": return `Removed ${field} from ${collection}`;
      case "field-relabeled": return `Renamed ${String(change.before)} to ${String(change.after)} in ${collection}`;
      case "field-type-compatible": return `Updated the format of ${field} in ${collection}`;
      case "field-type-incompatible": return `Changed ${field} in ${collection}; some values need attention`;
      case "field-required-changed": return change.after ? `Made ${field} required in ${collection}` : `Made ${field} optional in ${collection}`;
      case "field-default-changed": return `Changed the starting value for ${field} in ${collection}`;
      case "field-constraints-changed": return `Changed the rules for ${field} in ${collection}`;
      case "view-added": return `Added the ${String((change.after as V2Screen).title)} view`;
      case "view-removed": return `Removed the ${String((change.before as V2Screen).title)} view`;
      case "view-renamed": return `Renamed the ${String(change.before)} view to ${String(change.after)}`;
      case "view-changed": return `Updated the ${String(change.itemId)} view`;
      case "navigation-changed": return "Updated app navigation";
      case "form-added": return `Added the ${String((change.after as V2Screen).title)} form`;
      case "form-removed": return `Removed the ${String((change.before as V2Screen).title)} form`;
      case "form-changed": return `Updated the ${String(change.itemId)} form`;
      case "filter-changed": return `Updated filters on ${String(change.itemId)}`;
      case "search-changed": return `Updated search on ${String(change.itemId)}`;
      case "metric-added": return `Added the ${String((change.after as { label: string }).label)} summary`;
      case "metric-removed": return `Removed the ${String((change.before as { label: string }).label)} summary`;
      case "metric-changed": return `Updated the ${String(change.itemId)} summary`;
      case "action-added": return `Added the ${String((change.after as { label: string }).label)} action`;
      case "action-removed": return `Removed the ${String((change.before as { label: string }).label)} action`;
      case "action-changed": return `Updated the ${String(change.itemId)} action`;
    }
  }).slice(0, 20);
}
