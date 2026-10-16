import { validateRuntimeData as validateV2RuntimeData } from "./migration";
import { diffV3ApplicationSchemas, type V3SchemaChange } from "./schema-diff-v3";
import { type GeneratedAppV2, type RuntimeData, type V2Field } from "./v2";
import { seedRuntimeDataV3, validateRuntimeDataV3, type GeneratedAppV3, type V3Collection } from "./v3";

export type MigrationSourceArtifact = GeneratedAppV2 | GeneratedAppV3;
export interface V3MigrationPlan {
  sourceVersion: number; targetVersion: number; changes: V3SchemaChange[];
  preservedCollections: string[]; addedCollections: string[]; removedCollections: Array<{ id: string; label: string; records: number }>;
  preservedRecords: number; removedRelationships: Array<{ collectionId: string; relationshipId: string; label: string; affectedRecords: number }>;
  addedRelationships: Array<{ collectionId: string; relationshipId: string; label: string; missingRecords: number; required: boolean }>;
  sourceValid: boolean; sourceIssues: string[]; warnings: string[];
}
export interface V3MigrationResult {
  ok: boolean; data: RuntimeData; warnings: string[];
  counts: { sourceRecords: number; migratedRecords: number; createdRecords: number; removedRecords: number; defaultedValues: number };
}

const countRecords = (data: RuntimeData) => Object.values(data).reduce((sum, rows) => sum + rows.length, 0);

function sourceRelationships(artifact: MigrationSourceArtifact, collection: GeneratedAppV2["collections"][number] | GeneratedAppV3["collections"][number]) {
  if (artifact.format === "buildloop-app-v3") return (collection as GeneratedAppV3["collections"][number]).relationships;
  return collection.fields.filter((field): field is Extract<V2Field, { type: "reference" }> => field.type === "reference").map((field) => ({ id: field.id, field: field.id, label: field.label, targetCollection: field.collection, cardinality: "one" as const, required: field.required, onDelete: "restrict" as const }));
}

function fieldCompatible(source: V2Field, target: V3Collection["fields"][number]) {
  return source.type === target.type || ((source.type === "text" || source.type === "longText") && (target.type === "text" || target.type === "longText")) || ((source.type === "select" || source.type === "status") && target.type === "text");
}

function fieldAccepts(target: V3Collection["fields"][number], value: unknown) {
  if (value === undefined || value === null || value === "") return !target.required;
  switch (target.type) {
    case "text": case "longText": return typeof value === "string" && (target.minLength === undefined || value.length >= target.minLength) && (target.maxLength === undefined || value.length <= target.maxLength);
    case "number": return typeof value === "number" && Number.isFinite(value) && (target.min === undefined || value >= target.min) && (target.max === undefined || value <= target.max);
    case "boolean": return typeof value === "boolean";
    case "date": return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    case "select": case "status": return typeof value === "string" && target.options.includes(value);
    case "reference": return typeof value === "string";
  }
}
export function validateMigrationSource(artifact: MigrationSourceArtifact, data: unknown) {
  return artifact.format === "buildloop-app-v3" ? validateRuntimeDataV3(artifact, data) : validateV2RuntimeData(artifact, data);
}

/** Read-only relational migration planner. It describes missing links before a target snapshot is written. */
export function planRuntimeMigrationV3(before: MigrationSourceArtifact, after: GeneratedAppV3, sourceData: unknown, sourceVersion: number, targetVersion: number): V3MigrationPlan {
  const validated = validateMigrationSource(before, sourceData);
  const data = validated.ok ? validated.data : {};
  const oldCollections = new Map(before.collections.map((collection) => [collection.id, collection]));
  const newCollections = new Map(after.collections.map((collection) => [collection.id, collection]));
  const changes = before.format === "buildloop-app-v3" ? diffV3ApplicationSchemas(before, after) : [];
  const preservedCollections: string[] = [], addedCollections: string[] = [];
  const removedCollections: V3MigrationPlan["removedCollections"] = [];
  const removedRelationships: V3MigrationPlan["removedRelationships"] = [];
  const addedRelationships: V3MigrationPlan["addedRelationships"] = [];
  const warnings = validated.ok ? [] : [`Version ${sourceVersion} data could not be checked. It stays unchanged, and Version ${targetVersion} will start with its own sample data.`];
  for (const old of before.collections) {
    const rows = data[old.id] ?? [];
    const next = newCollections.get(old.id);
    if (!next) { removedCollections.push({ id: old.id, label: old.label, records: rows.length }); if (rows.length) warnings.push(`${rows.length} ${old.label.toLowerCase()} record${rows.length === 1 ? " stays" : "s stay"} in Version ${sourceVersion}; Version ${targetVersion} no longer includes ${old.label}.`); continue; }
    preservedCollections.push(old.id);
    const oldRelations = sourceRelationships(before, old);
    const oldIds = new Set(oldRelations.map((item) => item.id));
    const nextIds = new Set(next.relationships.map((item) => item.id));
    for (const rel of oldRelations) if (!nextIds.has(rel.id)) {
      const affectedRecords = rows.filter((row) => row[rel.field] !== undefined && row[rel.field] !== null && row[rel.field] !== "" && !(Array.isArray(row[rel.field]) && (row[rel.field] as unknown[]).length === 0)).length;
      removedRelationships.push({ collectionId: old.id, relationshipId: rel.id, label: rel.label, affectedRecords });
      if (affectedRecords) warnings.push(`${affectedRecords} saved ${old.label.toLowerCase()} record${affectedRecords === 1 ? "" : "s"} use the removed ${rel.label} link. Their old links remain in Version ${sourceVersion}.`);
    }
    for (const rel of next.relationships) if (!oldIds.has(rel.id)) {
      const missingRecords = rows.filter((row) => row[rel.field] === undefined || row[rel.field] === null || row[rel.field] === "" || Array.isArray(row[rel.field]) && (row[rel.field] as unknown[]).length === 0).length;
      addedRelationships.push({ collectionId: old.id, relationshipId: rel.id, label: rel.label, missingRecords, required: Boolean(rel.required) });
      if (rel.required && missingRecords) warnings.push(`${missingRecords} existing ${old.label.toLowerCase()} record${missingRecords === 1 ? "" : "s"} need a ${rel.label} before they can migrate. No link will be invented.`);
      else if (!rel.required) warnings.push(`Added an optional ${rel.label.toLowerCase()} link to ${old.label.toLowerCase()}. Existing records will keep it blank.`);
    }
    for (const rel of next.relationships) {
      const sameId = oldRelations.find((item) => item.id === rel.id);
      const sameField = oldRelations.find((item) => item.field === rel.field);
      const previous = sameId ?? sameField;
      if (previous && (previous.targetCollection !== rel.targetCollection || previous.field !== rel.field)) {
        const affected = rows.filter((row) => row[previous.field] !== undefined && row[previous.field] !== null && row[previous.field] !== "").length;
        if (affected) warnings.push(previous.targetCollection !== rel.targetCollection
          ? `${affected} saved ${old.label.toLowerCase()} record${affected === 1 ? "" : "s"} connect to a different ${rel.label} list. Those links cannot move automatically.`
          : `The ${rel.label} link keeps its saved records while its field name changes.`);
      }
    }
  }
  for (const collection of after.collections) if (!oldCollections.has(collection.id)) { addedCollections.push(collection.id); if (collection.seed?.length) warnings.push(`${collection.label} starts with its sample records.`); }
  const preservedRecords = validated.ok ? preservedCollections.reduce((sum, id) => sum + (data[id]?.length ?? 0), 0) : 0;
  return { sourceVersion, targetVersion, changes, preservedCollections, addedCollections, removedCollections, preservedRecords, removedRelationships, addedRelationships, sourceValid: validated.ok, sourceIssues: validated.ok ? [] : validated.issues.slice(0, 8), warnings: [...new Set(warnings)] };
}

/** Copy-on-write migration. Invalid links or missing required relationships leave the source snapshot untouched and use target sample data. */
export function applyRuntimeMigrationV3(before: MigrationSourceArtifact, after: GeneratedAppV3, sourceData: unknown, plan: V3MigrationPlan): V3MigrationResult {
  const validated = validateMigrationSource(before, sourceData);
  const fallback = seedRuntimeDataV3(after);
  if (!validated.ok || !plan.sourceValid) return { ok: false, data: fallback, warnings: plan.warnings, counts: { sourceRecords: 0, migratedRecords: 0, createdRecords: countRecords(fallback), removedRecords: 0, defaultedValues: 0 } };
  const result: RuntimeData = {};
  let defaultedValues = 0, removedRecords = 0;
  for (const old of before.collections) {
    const rows = validated.data[old.id] ?? [];
    const next = after.collections.find((collection) => collection.id === old.id);
    if (!next) { removedRecords += rows.length; continue; }
    const oldFields = new Map(old.fields.map((field) => [field.id, field]));
    const oldRelations = sourceRelationships(before, old);
    result[old.id] = rows.map((row) => {
      const migrated: Record<string, unknown> = { id: row.id };
      for (const field of next.fields) {
        const previous = oldFields.get(field.id);
        const value = row[field.id];
        if (previous && fieldCompatible(previous, field) && value !== undefined && value !== null && value !== "" && fieldAccepts(field, value)) migrated[field.id] = value;
        else if (field.default !== undefined && fieldAccepts(field, field.default)) { migrated[field.id] = field.default; defaultedValues += 1; }
        else if (row[field.id] !== undefined && !next.relationships.some((rel) => rel.field === field.id)) defaultedValues += 1;
      }
      for (const rel of next.relationships) {
        const previous = oldRelations.find((item) => item.id === rel.id) ?? oldRelations.find((item) => item.field === rel.field);
        if (!previous || previous.targetCollection !== rel.targetCollection) continue;
        if (row[previous.field] !== undefined) migrated[rel.field] = row[previous.field];
      }
      return migrated;
    });
  }
  for (const collection of after.collections) if (!result[collection.id]) result[collection.id] = seedRuntimeDataV3({ ...after, collections: [collection] })[collection.id];
  const checked = validateRuntimeDataV3(after, result);
  if (!checked.ok) return { ok: false, data: fallback, warnings: [...plan.warnings, `The saved records cannot all move into this version yet: ${checked.issues.slice(0, 3).join("; ")}. The earlier version remains unchanged.`], counts: { sourceRecords: countRecords(validated.data), migratedRecords: 0, createdRecords: countRecords(fallback), removedRecords, defaultedValues: 0 } };
  return { ok: true, data: checked.data, warnings: plan.warnings, counts: { sourceRecords: countRecords(validated.data), migratedRecords: countRecords(checked.data), createdRecords: Math.max(0, countRecords(checked.data) - countRecords(validated.data) + removedRecords), removedRecords, defaultedValues } };
}
