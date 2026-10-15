import { seedRuntimeData, validateArtifactV2, type GeneratedAppV2, type RuntimeData, type V2Field } from "./v2";
import { diffApplicationSchemas, type SchemaChange } from "./schema-diff";

export interface MigrationPlan {
  sourceVersion: number;
  targetVersion: number;
  changes: SchemaChange[];
  preservedCollections: string[];
  addedCollections: string[];
  removedCollections: Array<{ id: string; records: number }>;
  preservedFields: Array<{ collectionId: string; fieldId: string }>;
  createdFields: Array<{ collectionId: string; fieldId: string; defaulted: boolean; requiredWithoutDefault: boolean }>;
  removedFields: Array<{ collectionId: string; fieldId: string; records: number }>;
  incompatibleFields: Array<{ collectionId: string; fieldId: string; records: number; defaulted: number }>;
  preservedRecords: number;
  warnings: string[];
  sourceValid: boolean;
  sourceIssues: string[];
}

export interface MigrationResult {
  ok: boolean;
  data: RuntimeData;
  warnings: string[];
  counts: { sourceRecords: number; migratedRecords: number; createdRecords: number; removedRecords: number; defaultedValues: number };
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
const rowsCount = (data: RuntimeData) => Object.values(data).reduce((total, rows) => total + rows.length, 0);

function fieldAccepts(field: V2Field, value: unknown): boolean {
  if (value === undefined || value === null || value === "") return !field.required;
  switch (field.type) {
    case "text": case "longText": return typeof value === "string" && (field.minLength === undefined || value.length >= field.minLength) && (field.maxLength === undefined || value.length <= field.maxLength);
    case "number": return typeof value === "number" && Number.isFinite(value) && (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max);
    case "boolean": return typeof value === "boolean";
    case "date": return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    case "select": case "status": return typeof value === "string" && field.options.includes(value);
    case "reference": return typeof value === "string";
  }
}

/** Validate persisted runtime values against a V2 artifact without rejecting legacy records that predate a new required field. */
export function validateRuntimeData(artifact: GeneratedAppV2, value: unknown): { ok: true; data: RuntimeData } | { ok: false; issues: string[] } {
  if (!isObject(value)) return { ok: false, issues: ["Runtime data must be an object"] };
  const expected = new Set(artifact.collections.map((collection) => collection.id));
  if (Object.keys(value).some((id) => !expected.has(id))) return { ok: false, issues: ["Runtime data contains an unknown collection"] };
  const collections = artifact.collections.map((collection) => ({
    ...collection,
    fields: collection.fields.map((field) => ({ ...field, required: false })),
    seed: Array.isArray(value[collection.id]) ? value[collection.id] as Array<Record<string, unknown>> : [],
  }));
  const checked = validateArtifactV2({ ...artifact, collections }, 1_600_000);
  if (!checked.ok) return { ok: false, issues: checked.issues };
  for (const collection of artifact.collections) for (const row of (value[collection.id] as unknown[] | undefined) ?? []) {
    if (!isObject(row) || typeof row.id !== "string") return { ok: false, issues: [`A saved ${collection.label} record has no valid ID`] };
    for (const field of collection.fields) if (row[field.id] !== undefined && row[field.id] !== null && row[field.id] !== "" && !fieldAccepts({ ...field, required: false }, row[field.id])) return { ok: false, issues: [`A saved ${collection.label} record has an invalid ${field.label} value`] };
  }
  return { ok: true, data: value as RuntimeData };
}

export function planRuntimeMigration(
  before: GeneratedAppV2,
  after: GeneratedAppV2,
  sourceData: unknown,
  sourceVersion: number,
  targetVersion: number,
): MigrationPlan {
  const validated = validateRuntimeData(before, sourceData);
  const data = validated.ok ? validated.data : {};
  const oldCollections = new Map(before.collections.map((collection) => [collection.id, collection]));
  const newCollections = new Map(after.collections.map((collection) => [collection.id, collection]));
  const changes = diffApplicationSchemas(before, after);
  const preservedCollections: string[] = [], addedCollections: string[] = [];
  const removedCollections: MigrationPlan["removedCollections"] = [];
  const preservedFields: MigrationPlan["preservedFields"] = [], createdFields: MigrationPlan["createdFields"] = [];
  const removedFields: MigrationPlan["removedFields"] = [], incompatibleFields: MigrationPlan["incompatibleFields"] = [];
  const warnings = validated.ok ? [] : ["The previous version’s saved data could not be validated. The new version will start from its own sample data; the previous version remains unchanged."];
  for (const [id, oldCollection] of oldCollections) {
    const records = data[id]?.length ?? 0;
    if (!newCollections.has(id)) {
      removedCollections.push({ id, records });
      if (records) warnings.push(`${records} ${oldCollection.label.toLowerCase()} record${records === 1 ? "" : "s"} stay available in Version ${sourceVersion}; this app version no longer includes that collection.`);
      continue;
    }
    preservedCollections.push(id);
    const newCollection = newCollections.get(id)!;
    const oldFields = new Map(oldCollection.fields.map((field) => [field.id, field]));
    const newFields = new Map(newCollection.fields.map((field) => [field.id, field]));
    for (const [fieldId] of oldFields) if (!newFields.has(fieldId)) {
      const affected = (data[id] ?? []).filter((row) => row[fieldId] !== undefined && row[fieldId] !== null && row[fieldId] !== "").length;
      removedFields.push({ collectionId: id, fieldId, records: affected });
    }
    for (const [fieldId, field] of newFields) {
      const oldField = oldFields.get(fieldId);
      if (!oldField) {
        createdFields.push({ collectionId: id, fieldId, defaulted: field.default !== undefined, requiredWithoutDefault: Boolean(field.required && field.default === undefined) });
        if (field.required && field.default === undefined && records) warnings.push(`${newCollection.label} has ${records} existing record${records === 1 ? "" : "s"} without a value for required ${field.label}; those records are kept and can be completed by editing them.`);
        continue;
      }
      const typeCompatible = oldField.type === field.type || ((oldField.type === "text" || oldField.type === "longText") && (field.type === "text" || field.type === "longText"));
      if (typeCompatible) preservedFields.push({ collectionId: id, fieldId });
      const affectedRows = (data[id] ?? []).filter((row) => row[fieldId] !== undefined && row[fieldId] !== null && row[fieldId] !== "" && (!typeCompatible || !fieldAccepts({ ...field, required: false }, row[fieldId])));
      const invalidValues = affectedRows.length;
      if (invalidValues > 0) incompatibleFields.push({ collectionId: id, fieldId, records: invalidValues, defaulted: affectedRows.filter(() => field.default !== undefined && fieldAccepts({ ...field, required: false }, field.default)).length });
      if (field.required && !oldField.required && field.default === undefined) {
        const missing = (data[id] ?? []).filter((row) => row[fieldId] === undefined || row[fieldId] === "").length;
        if (missing) warnings.push(`${newCollection.label} has ${missing} existing record${missing === 1 ? "" : "s"} without a value for newly required ${field.label}; those records are kept and can be completed by editing them.`);
      }
      if (invalidValues && typeCompatible) warnings.push(`${newCollection.label}: ${invalidValues} existing ${field.label.toLowerCase()} value${invalidValues === 1 ? "" : "s"} no longer fit the new field rules. They are left blank or replaced with the default; Version ${sourceVersion} keeps the old values.`);
    }
    for (const field of incompatibleFields.filter((item) => item.collectionId === id && item.records > 0)) {
      const fieldLabel = newFields.get(field.fieldId)?.label ?? field.fieldId;
      warnings.push(`${newCollection.label}: ${fieldLabel} changed to an incompatible format. Values that do not fit are left blank or replaced with the new default; the old values remain in Version ${sourceVersion}.`);
    }
    if (removedFields.some((field) => field.collectionId === id && field.records > 0)) warnings.push(`${newCollection.label} no longer uses some populated fields. Their values remain in the Version ${sourceVersion} snapshot.`);
  }
  for (const [id, collection] of newCollections) if (!oldCollections.has(id)) {
    addedCollections.push(id);
    if ((collection.seed?.length ?? 0) > 0) warnings.push(`${collection.label} starts with its new sample records.`);
  }
  const preservedRecords = validated.ok ? preservedCollections.reduce((total, id) => total + (data[id]?.length ?? 0), 0) : 0;
  return { sourceVersion, targetVersion, changes, preservedCollections, addedCollections, removedCollections, preservedFields, createdFields, removedFields, incompatibleFields, preservedRecords, warnings: [...new Set(warnings)], sourceValid: validated.ok, sourceIssues: validated.ok ? [] : validated.issues.slice(0, 6) };
}

export function applyRuntimeMigration(before: GeneratedAppV2, after: GeneratedAppV2, sourceData: unknown, plan: MigrationPlan): MigrationResult {
  const validated = validateRuntimeData(before, sourceData);
  const fallback = seedRuntimeData(after);
  if (!validated.ok || !plan.sourceValid) return { ok: false, data: fallback, warnings: plan.warnings, counts: { sourceRecords: 0, migratedRecords: 0, createdRecords: rowsCount(fallback), removedRecords: 0, defaultedValues: 0 } };
  const target = new Map(after.collections.map((collection) => [collection.id, collection]));
  const result: RuntimeData = {};
  let defaultedValues = 0, removedRecords = 0;
  for (const oldCollection of before.collections) {
    const rows = validated.data[oldCollection.id] ?? [];
    const newCollection = target.get(oldCollection.id);
    if (!newCollection) { removedRecords += rows.length; continue; }
    const oldFields = new Map(oldCollection.fields.map((field) => [field.id, field]));
    result[oldCollection.id] = rows.map((row) => {
      const next: Record<string, unknown> = { id: row.id };
      for (const field of newCollection.fields) {
        const previous = oldFields.get(field.id);
        const requiredMissing = Boolean(field.required && (row[field.id] === undefined || row[field.id] === ""));
        if (previous && (previous.type === field.type || ((previous.type === "text" || previous.type === "longText") && (field.type === "text" || field.type === "longText"))) && !requiredMissing && fieldAccepts({ ...field, required: false }, row[field.id])) {
          if (row[field.id] !== undefined) next[field.id] = row[field.id];
          continue;
        }
        const defaultValid = field.default !== undefined && fieldAccepts({ ...field, required: false }, field.default);
        if (defaultValid) { next[field.id] = field.default; defaultedValues += 1; }
        else if (previous && row[field.id] !== undefined) defaultedValues += 1;
      }
      return next;
    });
  }
  for (const collection of after.collections) if (!result[collection.id]) result[collection.id] = seedRuntimeData({ ...after, collections: [collection] })[collection.id];
  for (const collection of after.collections) for (const field of collection.fields) if (field.type === "reference") {
    const validIds = new Set((result[field.collection] ?? []).map((row) => row.id));
    result[collection.id] = (result[collection.id] ?? []).map((row) => {
      if (row[field.id] === undefined || validIds.has(String(row[field.id]))) return row;
      if (field.default !== undefined && validIds.has(String(field.default))) { defaultedValues += 1; return { ...row, [field.id]: field.default }; }
      defaultedValues += 1;
      const remaining = { ...row };
      delete remaining[field.id];
      return remaining;
    });
  }
  const checked = validateRuntimeData(after, result);
  if (!checked.ok) return { ok: false, data: fallback, warnings: [...plan.warnings, "The migrated data did not pass the new app’s validation and was not applied. The previous version remains unchanged."], counts: { sourceRecords: rowsCount(validated.data), migratedRecords: 0, createdRecords: rowsCount(fallback), removedRecords, defaultedValues: 0 } };
  const sourceRecords = rowsCount(validated.data), migratedRecords = rowsCount(result);
  return { ok: true, data: result, warnings: plan.warnings, counts: { sourceRecords, migratedRecords, createdRecords: Math.max(0, migratedRecords - sourceRecords + removedRecords), removedRecords, defaultedValues } };
}
