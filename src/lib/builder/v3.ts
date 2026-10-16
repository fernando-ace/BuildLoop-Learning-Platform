import type { RuntimeData, V2Action, V2Collection, V2Screen } from "./v2";
import { validateArtifactV2, seedRuntimeData, applyRuntimeAction } from "./v2";

export type V3Value = string | number | boolean | null | string[];
export type V3Expr =
  | { op: "literal"; value: V3Value }
  | { op: "field"; field: string }
  | { op: "countRelated"; relationship: string }
  | { op: "sumRelated"; relationship: string; field: string }
  | { op: "add" | "subtract" | "multiply"; left: V3Expr; right: V3Expr }
  | { op: "equals" | "notEquals" | "gte" | "gt" | "lte" | "lt"; left: V3Expr; right: V3Expr }
  | { op: "and" | "or"; items: V3Expr[] }
  | { op: "not"; value: V3Expr }
  | { op: "if"; test: V3Expr; then: V3Expr; otherwise: V3Expr };

export interface V3Relationship {
  id: string;
  field: string;
  label: string;
  targetCollection: string;
  cardinality: "one" | "many";
  required?: boolean;
  onDelete: "restrict" | "nullify" | "cascade";
}
export interface V3ComputedField { id: string; label: string; type: "number" | "boolean" | "text"; expression: V3Expr }
export type V3Constraint =
  | { id: string; label: string; type: "unique"; fields: string[] }
  | { id: string; label: string; type: "uniqueWhere"; fields: string[]; whereField: string; equals: V3Value }
  | { id: string; label: string; type: "nonNegative"; field: string }
  | { id: string; label: string; type: "maxRelated"; relationship: string; limitField: string };
export type V3ValueSource =
  | { source: "currentId" }
  | { source: "current"; field: string }
  | { source: "input"; field: string }
  | { source: "literal"; value: V3Value };
export type V3WorkflowStep =
  | { id: string; type: "create"; collection: string; values: Record<string, V3ValueSource> }
  | { id: string; type: "update"; collection: string; target: "current" | { createdBy: string }; values: Record<string, V3ValueSource> }
  | { id: string; type: "delete"; collection: string; target: "current" | { createdBy: string } }
  | { id: string; type: "feedback"; text: string }
  | { id: string; type: "navigate"; screen: string };
export interface V3Workflow { id: string; label: string; collection: string; inputs?: string[]; enabledWhen?: V3Expr; steps: V3WorkflowStep[] }
export interface V3Collection extends V2Collection { relationships: V3Relationship[]; computed?: V3ComputedField[]; constraints?: V3Constraint[] }
export interface GeneratedAppV3 {
  format: "buildloop-app-v3"; title: string; summary: string; defaultScreen: string;
  screens: V2Screen[]; navigation: Array<{ label: string; screen: string }>;
  collections: V3Collection[]; actions: V2Action[];
  metrics: Array<{ id: string; label: string; op: "count" | "countEquals" | "sum"; collection: string; field?: string; value?: string | number | boolean }>;
  workflows: V3Workflow[]; changeSummary: string[]; testTasks: string[];
}
export type AppArtifactV3 = GeneratedAppV3;

const ID = /^[a-z][a-z0-9_]{0,31}$/;
const safeText = (value: unknown, max = 160): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/(<\s*\/?\s*(?:script|iframe|img|svg|html)|javascript\s*:|data\s*:\s*text\/html|https?:\/\/|\bon\w+\s*=|\b(?:eval|fetch|XMLHttpRequest|Function)\s*\()/i.test(value);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
const ownKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key) && !["__proto__", "prototype", "constructor"].includes(key));
const MAX_BYTES = 96_000;
const MAX_WORKFLOW_STEPS = 12;
const MAX_EXPR_DEPTH = 8;
const MAX_RECORDS = 500;
const MAX_RELATION_ITEMS = 100;

function validateExpression(value: unknown, depth = 0): value is V3Expr {
  if (depth > MAX_EXPR_DEPTH || !object(value) || typeof value.op !== "string") return false;
  switch (value.op) {
    case "literal": return ownKeys(value, ["op", "value"]) && (value.value === null || typeof value.value === "string" && safeText(value.value, 180) || typeof value.value === "number" && Number.isFinite(value.value) || typeof value.value === "boolean");
    case "field": return ownKeys(value, ["op", "field"]) && typeof value.field === "string" && ID.test(value.field);
    case "countRelated": return ownKeys(value, ["op", "relationship"]) && typeof value.relationship === "string" && ID.test(value.relationship);
    case "sumRelated": return ownKeys(value, ["op", "relationship", "field"]) && typeof value.relationship === "string" && ID.test(value.relationship) && typeof value.field === "string" && ID.test(value.field);
    case "add": case "subtract": case "multiply": case "equals": case "notEquals": case "gte": case "gt": case "lte": case "lt": return ownKeys(value, ["op", "left", "right"]) && validateExpression(value.left, depth + 1) && validateExpression(value.right, depth + 1);
    case "and": case "or": return ownKeys(value, ["op", "items"]) && Array.isArray(value.items) && value.items.length >= 1 && value.items.length <= 8 && value.items.every((item) => validateExpression(item, depth + 1));
    case "not": return ownKeys(value, ["op", "value"]) && validateExpression(value.value, depth + 1);
    case "if": return ownKeys(value, ["op", "test", "then", "otherwise"]) && validateExpression(value.test, depth + 1) && validateExpression(value.then, depth + 1) && validateExpression(value.otherwise, depth + 1);
    default: return false;
  }
}

export function validateArtifactV3(value: unknown, maxBytes = MAX_BYTES): { ok: true; artifact: GeneratedAppV3 } | { ok: false; issues: string[] } {
  if (!object(value)) return { ok: false, issues: ["Artifact must be an object"] };
  let encoded: string;
  try { encoded = JSON.stringify(value); if (new TextEncoder().encode(encoded).length > maxBytes) return { ok: false, issues: ["Artifact is too large"] }; }
  catch { return { ok: false, issues: ["Artifact must contain JSON data only"] }; }
  if (value.format !== "buildloop-app-v3") return { ok: false, issues: ["Unsupported app format"] };
  const issues: string[] = [];
  const base = { ...value, format: "buildloop-app-v2", collections: Array.isArray(value.collections) ? value.collections.map((item) => {
    if (!object(item)) return item;
    const relationships = Array.isArray(item.relationships) ? item.relationships.filter(object) : [];
    const relFields = new Set(relationships.map((rel) => String(rel.field)));
    const seed = Array.isArray(item.seed) ? item.seed.map((raw) => { if (!object(raw)) return raw; return Object.fromEntries(Object.entries(raw).filter(([key]) => !relFields.has(key))); }) : item.seed;
    const rest = Object.fromEntries(Object.entries(item).filter(([key]) => !["relationships", "computed", "constraints"].includes(key)));
    return { ...rest, seed };
  }) : value.collections, workflows: undefined };
  delete (base as Record<string, unknown>).workflows;
  if (Array.isArray(value.screens) && Array.isArray(value.collections)) {
    const collectionById = new Map(value.collections.filter(object).map((collection) => [String(collection.id), collection]));
    (base as Record<string, unknown>).screens = value.screens.map((screen) => {
      if (!object(screen)) return screen;
      const collection = collectionById.get(String(screen.collection));
      const extensionFields = new Set(collection ? [
        ...(Array.isArray(collection.relationships) ? collection.relationships.filter(object).map((rel) => String(rel.field)) : []),
        ...(Array.isArray(collection.computed) ? collection.computed.filter(object).map((field) => String(field.id)) : []),
      ] : []);
      const safePrimary = extensionFields.has(String(screen.primaryField)) && collection && Array.isArray(collection.fields) && object(collection.fields[0]) ? collection.fields[0].id : screen.primaryField;
      return { ...screen, primaryField: safePrimary, fields: Array.isArray(screen.fields) ? screen.fields.filter((field) => !extensionFields.has(String(field))) : screen.fields };
    });
  }
  const baseResult = validateArtifactV2(base, maxBytes);
  if (!baseResult.ok) issues.push(...baseResult.issues);
  const collections = Array.isArray(value.collections) ? value.collections : [];
  const collectionMap = new Map(collections.filter(object).map((item) => [String(item.id), item]));
  const relIds = new Set<string>();
  const relFieldIds = new Set<string>();
  for (const [ci, raw] of collections.entries()) {
    if (!object(raw) || !ownKeys(raw, ["id", "label", "fields", "seed", "relationships", "computed", "constraints"])) { issues.push(`Collection ${ci + 1} has unsupported properties`); continue; }
    const fields = Array.isArray(raw.fields) ? raw.fields.filter(object) : [];
    const fieldMap = new Map(fields.map((field) => [String(field.id), field]));
    const relationships = Array.isArray(raw.relationships) ? raw.relationships : [];
    if (relationships.length > 12) issues.push(`Collection ${String(raw.label)} has too many relationships`);
    for (const rel of relationships) {
      if (!object(rel) || !ownKeys(rel, ["id", "field", "label", "targetCollection", "cardinality", "required", "onDelete"]) || typeof rel.id !== "string" || !ID.test(rel.id) || relIds.has(rel.id) || typeof rel.field !== "string" || !ID.test(rel.field) || relFieldIds.has(`${String(raw.id)}.${rel.field}`) || !safeText(rel.label, 80) || !collectionMap.has(String(rel.targetCollection)) || !["one", "many"].includes(String(rel.cardinality)) || !["restrict", "nullify", "cascade"].includes(String(rel.onDelete)) || rel.required !== undefined && typeof rel.required !== "boolean") { issues.push(`Collection ${String(raw.label)} has an invalid relationship`); continue; }
      if (fieldMap.has(String(rel.field))) issues.push(`Relationship field ${String(rel.field)} conflicts with a stored field`);
      if (rel.onDelete === "nullify" && rel.required === true) issues.push(`Required relationship ${String(rel.id)} cannot be nullified`);
      relIds.add(rel.id); relFieldIds.add(`${String(raw.id)}.${rel.field}`);
    }
    const computed = Array.isArray(raw.computed) ? raw.computed : [];
    if (computed.length > 16) issues.push(`Collection ${String(raw.label)} has too many computed values`);
    const computedIds = new Set<string>();
    for (const item of computed) {
      if (!object(item) || !ownKeys(item, ["id", "label", "type", "expression"]) || typeof item.id !== "string" || !ID.test(item.id) || fieldMap.has(item.id) || computedIds.has(item.id) || !safeText(item.label, 80) || !["number", "boolean", "text"].includes(String(item.type)) || !validateExpression(item.expression)) issues.push(`Collection ${String(raw.label)} has an invalid computed value`);
      else computedIds.add(item.id);
    }
    const constraints = Array.isArray(raw.constraints) ? raw.constraints : [];
    if (constraints.length > 16) issues.push(`Collection ${String(raw.label)} has too many constraints`);
    const cids = new Set<string>();
    for (const rule of constraints) {
      if (!object(rule) || typeof rule.id !== "string" || !ID.test(rule.id) || cids.has(rule.id) || !safeText(rule.label, 140)) { issues.push(`Collection ${String(raw.label)} has an invalid constraint`); continue; }
      cids.add(rule.id);
      if ((rule.type === "unique" && ownKeys(rule, ["id", "label", "type", "fields"]) || rule.type === "uniqueWhere" && ownKeys(rule, ["id", "label", "type", "fields", "whereField", "equals"])) && Array.isArray(rule.fields) && rule.fields.length > 0 && rule.fields.length <= 8 && rule.fields.every((field) => typeof field === "string" && (fieldMap.has(field) || relFieldIds.has(`${String(raw.id)}.${field}`))) && (rule.type !== "uniqueWhere" || typeof rule.whereField === "string" && (fieldMap.has(rule.whereField) || relFieldIds.has(`${String(raw.id)}.${rule.whereField}`)) && (rule.equals === null || ["string", "number", "boolean"].includes(typeof rule.equals)))) continue;
      if (rule.type === "nonNegative" && ownKeys(rule, ["id", "label", "type", "field"]) && typeof rule.field === "string" && fieldMap.get(rule.field)?.type === "number") continue;
      if (rule.type === "maxRelated" && ownKeys(rule, ["id", "label", "type", "relationship", "limitField"]) && typeof rule.relationship === "string" && typeof rule.limitField === "string" && fieldMap.get(rule.limitField)?.type === "number" && collections.some((child) => object(child) && Array.isArray(child.relationships) && child.relationships.some((rel) => object(rel) && rel.id === rule.relationship && rel.targetCollection === raw.id))) continue;
      issues.push(`Constraint ${String(rule.id)} is unsupported or references a missing field`);
    }
    if (Array.isArray(raw.seed) && raw.seed.length > MAX_RECORDS) issues.push(`Collection ${String(raw.label)} exceeds the ${MAX_RECORDS}-record limit`);
  }
  // The relationship graph is intentionally shallow. Self-links and cycles are legal only for restrict/nullify links,
  // but cascading links must be acyclic and bounded so deletion cannot recurse without limit.
  const cascadeGraph = new Map<string, string[]>();
  for (const raw of collections.filter(object)) for (const rel of (Array.isArray(raw.relationships) ? raw.relationships : []).filter(object)) if (rel.onDelete === "cascade") cascadeGraph.set(String(raw.id), [...(cascadeGraph.get(String(raw.id)) ?? []), String(rel.targetCollection)]);
  const visiting = new Set<string>(), visited = new Set<string>();
  const walk = (node: string, depth: number): boolean => { if (depth > 8 || visiting.has(node)) return false; if (visited.has(node)) return true; visiting.add(node); for (const next of cascadeGraph.get(node) ?? []) if (!walk(next, depth + 1)) return false; visiting.delete(node); visited.add(node); return true; };
  if ([...cascadeGraph.keys()].some((id) => !walk(id, 0))) issues.push("Cascading relationships must be acyclic and at most eight levels deep");
  const allComputed = collections.filter(object).flatMap((raw) => (Array.isArray(raw.computed) ? raw.computed : []).filter(object).map((item) => ({ collection: String(raw.id), item })));
  const computedById = new Map(allComputed.map(({ collection, item }) => [`${collection}.${String(item.id)}`, item]));
  const computedGraph = new Map<string, string[]>();
  const scanExpr = (expr: unknown, collection: string, refs: string[]) => { if (!object(expr)) return; if (expr.op === "field" && typeof expr.field === "string" && computedById.has(`${collection}.${expr.field}`)) refs.push(`${collection}.${expr.field}`); for (const child of Object.values(expr)) if (object(child)) scanExpr(child, collection, refs); else if (Array.isArray(child)) child.forEach((nested) => scanExpr(nested, collection, refs)); };
  for (const { collection, item } of allComputed) { const refs: string[] = []; scanExpr(item.expression, collection, refs); computedGraph.set(`${collection}.${String(item.id)}`, refs); }
  const active = new Set<string>(), done = new Set<string>();
  const hasCycle = (id: string): boolean => { if (active.has(id)) return true; if (done.has(id)) return false; active.add(id); for (const ref of computedGraph.get(id) ?? []) if (hasCycle(ref)) return true; active.delete(id); done.add(id); return false; };
  if ([...computedGraph.keys()].some(hasCycle)) issues.push("Computed values cannot depend on themselves or form a cycle");
  for (const { collection, item } of allComputed) {
    const owner = collectionMap.get(collection);
    if (!owner || !expressionReferencesValid(item.expression, owner, collectionMap)) issues.push(`Computed value ${String(item.label)} refers to a missing or incompatible field`);
    const inferred = inferExpressionType(item.expression, owner, collectionMap, computedById, new Set());
    if (inferred && inferred !== item.type) issues.push(`Computed value ${String(item.label)} must return ${String(item.type)}`);
  }
  for (const screen of Array.isArray(value.screens) ? value.screens : []) {
    if (!object(screen) || typeof screen.collection !== "string") continue;
    const collection = collectionMap.get(screen.collection);
    if (!collection) continue;
    const valid = new Set([
      ...(Array.isArray(collection.fields) ? collection.fields.filter(object).map((field) => String(field.id)) : []),
      ...(Array.isArray(collection.relationships) ? collection.relationships.filter(object).map((rel) => String(rel.field)) : []),
      ...(Array.isArray(collection.computed) ? collection.computed.filter(object).map((field) => String(field.id)) : []),
    ]);
    if (screen.primaryField !== undefined && !valid.has(String(screen.primaryField))) issues.push(`Screen ${String(screen.id)} has a missing primary field`);
    if (Array.isArray(screen.fields) && screen.fields.some((field) => typeof field !== "string" || !valid.has(field))) issues.push(`Screen ${String(screen.id)} refers to a missing field`);
  }
  const workflows = Array.isArray(value.workflows) ? value.workflows : [];
  if (workflows.length > 20) issues.push("Use no more than 20 workflows");
  const workflowIds = new Set<string>();
  for (const workflow of workflows) {
    if (!object(workflow) || !ownKeys(workflow, ["id", "label", "collection", "inputs", "enabledWhen", "steps"]) || typeof workflow.id !== "string" || !ID.test(workflow.id) || workflowIds.has(workflow.id) || !safeText(workflow.label, 80) || !collectionMap.has(String(workflow.collection)) || !Array.isArray(workflow.steps) || workflow.steps.length < 1 || workflow.steps.length > MAX_WORKFLOW_STEPS || Array.isArray(workflow.inputs) && workflow.inputs.length > 8) { issues.push("A workflow is malformed or exceeds the 12-step limit"); continue; }
    workflowIds.add(workflow.id);
    const sourceCollection = collectionMap.get(String(workflow.collection))!;
    if (workflow.enabledWhen !== undefined && (!validateExpression(workflow.enabledWhen) || !expressionReferencesValid(workflow.enabledWhen, sourceCollection, collectionMap) || inferExpressionType(workflow.enabledWhen, sourceCollection, collectionMap, computedById, new Set()) !== "boolean")) issues.push(`Workflow ${workflow.id} has an invalid availability condition`);
    const inputIds = new Set<string>();
    for (const input of Array.isArray(workflow.inputs) ? workflow.inputs : []) {
      const inputCollections = workflow.steps.filter(object).filter((step) => step.type === "create" && typeof step.collection === "string").map((step) => collectionMap.get(String(step.collection))).filter((item): item is Record<string, unknown> => Boolean(item));
      const exists = inputCollections.some((item) => Array.isArray(item.fields) && item.fields.some((field) => object(field) && field.id === input) || Array.isArray(item.relationships) && item.relationships.some((rel) => object(rel) && rel.field === input));
      if (typeof input !== "string" || !ID.test(input) || inputIds.has(input) || !exists) issues.push(`Workflow ${workflow.id} has an invalid input field`);
      if (typeof input === "string") inputIds.add(input);
    }
    const stepIds = new Set<string>();
    const createdStepCollections = new Map<string, string>();
    for (const step of workflow.steps) {
      if (!object(step) || typeof step.id !== "string" || !ID.test(step.id) || stepIds.has(step.id)) { issues.push(`Workflow ${workflow.id} has an invalid step id`); continue; }
      stepIds.add(step.id);
      if (step.type === "feedback" && ownKeys(step, ["id", "type", "text"]) && safeText(step.text, 140)) continue;
      if (step.type === "navigate" && ownKeys(step, ["id", "type", "screen"]) && typeof step.screen === "string" && Array.isArray(value.screens) && value.screens.some((screen) => object(screen) && screen.id === step.screen)) continue;
      if (step.type === "create" && ownKeys(step, ["id", "type", "collection", "values"]) && typeof step.collection === "string" && collectionMap.has(step.collection) && object(step.values) && Object.keys(step.values).length <= 24) {
        const target = collectionMap.get(step.collection)!;
        const values = step.values as Record<string, unknown>;
        const validFields = new Set([...(Array.isArray(target.fields) ? target.fields.filter(object).map((field) => String(field.id)) : []), ...(Array.isArray(target.relationships) ? target.relationships.filter(object).map((rel) => String(rel.field)) : [])]);
        if (Object.keys(values).some((field) => !validFields.has(field) || Array.isArray(target.computed) && target.computed.some((item) => object(item) && item.id === field) || !validValueSource(values[field], field, target, sourceCollection, inputIds))) issues.push(`Workflow ${workflow.id} creates an unknown or invalid field value`);
        createdStepCollections.set(step.id, step.collection);
        continue;
      }
      if (step.type === "update" && ownKeys(step, ["id", "type", "collection", "target", "values"]) && typeof step.collection === "string" && collectionMap.has(step.collection) && (step.target === "current" && step.collection === workflow.collection || object(step.target) && typeof step.target.createdBy === "string" && step.target.createdBy !== step.id && createdStepCollections.get(step.target.createdBy) === step.collection) && object(step.values) && Object.keys(step.values).length > 0 && Object.keys(step.values).length <= 24) {
        const target = collectionMap.get(step.collection)!;
        const values = step.values as Record<string, unknown>;
        const validFields = new Set([...(Array.isArray(target.fields) ? target.fields.filter(object).map((field) => String(field.id)) : []), ...(Array.isArray(target.relationships) ? target.relationships.filter(object).map((rel) => String(rel.field)) : [])]);
        if (Object.keys(values).some((field) => !validFields.has(field) || Array.isArray(target.computed) && target.computed.some((item) => object(item) && item.id === field) || !validValueSource(values[field], field, target, sourceCollection, inputIds))) issues.push(`Workflow ${workflow.id} updates an unknown or invalid field value`);
        continue;
      }
      if (step.type === "delete" && ownKeys(step, ["id", "type", "collection", "target"]) && typeof step.collection === "string" && collectionMap.has(step.collection) && (step.target === "current" && step.collection === workflow.collection || object(step.target) && typeof step.target.createdBy === "string" && step.target.createdBy !== step.id && createdStepCollections.get(step.target.createdBy) === step.collection)) continue;
      issues.push(`Workflow ${workflow.id} contains an unsupported or invalid operation`);
    }
  }
  if (issues.length) return { ok: false, issues: [...new Set(issues)].slice(0, 12) };
  const artifact = value as unknown as GeneratedAppV3;
  for (const collection of artifact.collections) for (const row of collection.seed ?? []) if (collection.computed?.some((field) => Object.hasOwn(row, field.id))) issues.push(`Computed values in ${collection.label} cannot be stored in seed records`);
  if (issues.length) return { ok: false, issues: [...new Set(issues)].slice(0, 12) };
  const seeded = validateRuntimeDataV3(artifact, seedRuntimeDataV3(artifact));
  if (!seeded.ok) return { ok: false, issues: seeded.issues };
  return { ok: true, artifact };
}

function validValueSource(value: unknown, fieldId: string, target: Record<string, unknown>, currentCollection: Record<string, unknown>, inputs: Set<string>): boolean {
  if (!object(value) || typeof value.source !== "string") return false;
  const targetField = Array.isArray(target.fields) ? target.fields.find((field) => object(field) && field.id === fieldId) : undefined;
  const targetRel = Array.isArray(target.relationships) ? target.relationships.find((rel) => object(rel) && rel.field === fieldId) : undefined;
  const source = value.source;
  if (source === "currentId") return ownKeys(value, ["source"]) && Boolean(targetRel && object(targetRel) && targetRel.cardinality === "one");
  if (source === "current") return ownKeys(value, ["source", "field"]) && typeof value.field === "string" && (Array.isArray(currentCollection.fields) && currentCollection.fields.some((field) => object(field) && field.id === value.field) || Array.isArray(currentCollection.relationships) && currentCollection.relationships.some((rel) => object(rel) && rel.field === value.field));
  if (source === "input") return ownKeys(value, ["source", "field"]) && typeof value.field === "string" && inputs.has(value.field) && value.field === fieldId;
  if (source !== "literal" || !ownKeys(value, ["source", "value"])) return false;
  const literal = value.value;
  if (targetRel && object(targetRel)) return targetRel.cardinality === "many" ? Array.isArray(literal) && literal.length <= 100 && literal.every((id) => typeof id === "string" && ID.test(id)) : typeof literal === "string" && ID.test(literal);
  if (!object(targetField)) return false;
  if (literal === null) return !targetField.required;
  if (targetField.type === "number") return typeof literal === "number" && Number.isFinite(literal);
  if (targetField.type === "boolean") return typeof literal === "boolean";
  return typeof literal === "string" && safeText(literal, 180);
}

function expressionReferencesValid(expression: unknown, owner: Record<string, unknown>, collections: Map<string, Record<string, unknown>>): boolean {
  if (!object(expression)) return false;
  if (expression.op === "field") return typeof expression.field === "string" && ([...(Array.isArray(owner.fields) ? owner.fields.filter(object).map((field) => String(field.id)) : []), ...(Array.isArray(owner.relationships) ? owner.relationships.filter(object).map((rel) => String(rel.field)) : []), ...(Array.isArray(owner.computed) ? owner.computed.filter(object).map((field) => String(field.id)) : [])].includes(expression.field));
  if (expression.op === "countRelated" || expression.op === "sumRelated") {
    const related = [...collections.values()].flatMap((collection) => (Array.isArray(collection.relationships) ? collection.relationships.filter(object).map((rel) => ({ collection, rel })) : [])).find(({ rel }) => rel.id === expression.relationship);
    if (!related || related.rel.targetCollection !== owner.id) return false;
    return expression.op === "countRelated" || Array.isArray(related.collection.fields) && related.collection.fields.some((field) => object(field) && field.id === expression.field && field.type === "number");
  }
  return Object.values(expression).filter((value) => typeof value === "object" && value !== null).every((value) => Array.isArray(value) ? value.every((item) => expressionReferencesValid(item, owner, collections)) : expressionReferencesValid(value, owner, collections));
}

function inferExpressionType(expression: unknown, owner: Record<string, unknown> | undefined, collections: Map<string, Record<string, unknown>>, computed: Map<string, Record<string, unknown>>, active: Set<string>): string | null {
  if (!object(expression) || !owner || typeof expression.op !== "string") return null;
  const typeOf = (item: unknown) => inferExpressionType(item, owner, collections, computed, active);
  switch (expression.op) {
    case "literal": return expression.value === null ? null : typeof expression.value === "string" ? "text" : typeof expression.value;
    case "field": {
      if (typeof expression.field !== "string") return null;
      const key = `${String(owner.id)}.${expression.field}`;
      const calculated = computed.get(key);
      if (calculated && !active.has(key)) { active.add(key); const result = typeOf(calculated.expression); active.delete(key); return result; }
      const stored = Array.isArray(owner.fields) ? owner.fields.find((field) => object(field) && field.id === expression.field) : undefined;
      if (object(stored)) return ["text", "longText", "select", "status", "date", "reference"].includes(String(stored.type)) ? "text" : String(stored.type);
      const relationship = Array.isArray(owner.relationships) ? owner.relationships.find((rel) => object(rel) && rel.field === expression.field) : undefined;
      return object(relationship) && relationship.cardinality === "one" ? "text" : null;
    }
    case "countRelated": case "sumRelated": return "number";
    case "add": case "subtract": case "multiply": return typeOf(expression.left) === "number" && typeOf(expression.right) === "number" ? "number" : null;
    case "equals": case "notEquals": case "gte": case "gt": case "lte": case "lt": case "and": case "or": case "not": return "boolean";
    case "if": { const yes = typeOf(expression.then), no = typeOf(expression.otherwise); return typeOf(expression.test) === "boolean" && yes === no ? yes : null; }
    default: return null;
  }
}

export function seedRuntimeDataV3(artifact: GeneratedAppV3): RuntimeData { return seedRuntimeData(artifact as unknown as Parameters<typeof seedRuntimeData>[0]); }

export function validateRuntimeDataV3(artifact: GeneratedAppV3, value: unknown): { ok: true; data: RuntimeData } | { ok: false; issues: string[] } {
  if (!object(value) || Object.keys(value).some((key) => !artifact.collections.some((collection) => collection.id === key))) return { ok: false, issues: ["Runtime data contains an unknown collection"] };
  const data: RuntimeData = {};
  let count = 0;
  for (const collection of artifact.collections) {
    const rows = value[collection.id];
    if (!Array.isArray(rows) || rows.length > MAX_RECORDS || rows.some((row) => !object(row) || typeof row.id !== "string")) return { ok: false, issues: [`${collection.label} data is invalid or over the record limit`] };
    count += rows.length;
    const relFields = new Set(collection.relationships.map((rel) => rel.field));
    const computedIds = new Set((collection.computed ?? []).map((field) => field.id));
    const base = Object.fromEntries(Object.entries(collection).filter(([key]) => !["relationships", "computed", "constraints"].includes(key))) as Omit<V3Collection, "relationships" | "computed" | "constraints">;
    const baseCollection = { ...base, seed: rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !relFields.has(key) && !computedIds.has(key) && key !== "id"))) };
    const check = validateArtifactV2({ format: "buildloop-app-v2", title: artifact.title, summary: artifact.summary, defaultScreen: "records", screens: [{ id: "records", title: "Records", view: "list", collection: collection.id }], navigation: [], collections: [baseCollection], actions: [], metrics: [], changeSummary: [], testTasks: ["Check records"] }, 1_000_000);
    if (!check.ok) return { ok: false, issues: check.issues };
    data[collection.id] = structuredClone(rows) as Array<Record<string, unknown>>;
  }
  if (count > 2_000) return { ok: false, issues: ["Runtime data exceeds the 2,000-record project limit"] };
  const ids = new Map<string, Set<string>>();
  for (const collection of artifact.collections) { const seen = new Set<string>(); for (const row of data[collection.id]) { if (seen.has(String(row.id))) return { ok: false, issues: [`${collection.label} has duplicate record ids`] }; seen.add(String(row.id)); } ids.set(collection.id, seen); }
  let relationshipValues = 0;
  for (const collection of artifact.collections) for (const field of collection.fields) if (field.type === "reference") {
    const availableIds = ids.get(field.collection);
    for (const row of data[collection.id]) if (row[field.id] !== undefined && row[field.id] !== null && row[field.id] !== "" && (typeof row[field.id] !== "string" || !availableIds?.has(row[field.id] as string))) return { ok: false, issues: [`${field.label} points to a record that no longer exists`] };
  }
  for (const collection of artifact.collections) for (const relationship of collection.relationships) for (const row of data[collection.id]) {
    const storedComputed = collection.computed?.find((computed) => Object.hasOwn(row, computed.id));
    if (storedComputed) return { ok: false, issues: [`${storedComputed.label} is calculated and cannot be saved`] };
    const valueAt = row[relationship.field];
    if (valueAt === undefined || valueAt === null || valueAt === "" || relationship.cardinality === "many" && Array.isArray(valueAt) && valueAt.length === 0) { if (relationship.required) return { ok: false, issues: [`${relationship.label} is required`] }; continue; }
    const refs = relationship.cardinality === "many" ? valueAt : [valueAt];
    if (!Array.isArray(refs) || refs.length > MAX_RELATION_ITEMS || new Set(refs).size !== refs.length || refs.some((id) => typeof id !== "string" || !ids.get(relationship.targetCollection)?.has(id))) return { ok: false, issues: [`${relationship.label} points to a missing or repeated record`] };
    relationshipValues += refs.length;
    if (relationshipValues > 4_000) return { ok: false, issues: ["Runtime data contains too many linked records"] };
  }
  const constraintCheck = validateConstraints(artifact, data);
  return constraintCheck.length ? { ok: false, issues: constraintCheck } : { ok: true, data };
}

function validateConstraints(artifact: GeneratedAppV3, data: RuntimeData): string[] {
  const issues: string[] = [];
  for (const collection of artifact.collections) for (const rule of collection.constraints ?? []) {
    const rows = data[collection.id] ?? [];
    if (rule.type === "nonNegative" && rows.some((row) => typeof row[rule.field] !== "number" || Number(row[rule.field]) < 0)) issues.push(rule.label);
    if (rule.type === "unique" || rule.type === "uniqueWhere") { const seen = new Set<string>(); for (const row of rows) { if (rule.type === "uniqueWhere" && row[rule.whereField] !== rule.equals) continue; const values = rule.fields.map((field) => row[field]); if (values.some((value) => value === undefined || value === null || value === "")) continue; const key = JSON.stringify(values); if (seen.has(key)) { issues.push(rule.label); break; } seen.add(key); } }
    if (rule.type === "maxRelated") { const rel = artifact.collections.flatMap((child) => child.relationships.map((item) => ({ child, item }))).find(({ item }) => item.id === rule.relationship); if (rel) for (const parent of rows) { const n = (data[rel.child.id] ?? []).filter((row) => row[rel.item.field] === parent.id).length; if (typeof parent[rule.limitField] === "number" && n > Number(parent[rule.limitField])) { issues.push(rule.label); break; } } }
  }
  return issues;
}

export function resolveRelationship(artifact: GeneratedAppV3, data: RuntimeData, collectionId: string, row: Record<string, unknown>, relationshipId: string) {
  const collection = artifact.collections.find((item) => item.id === collectionId);
  const relationship = collection?.relationships.find((item) => item.id === relationshipId);
  if (!relationship) return null;
  const values = relationship.cardinality === "many" ? row[relationship.field] : [row[relationship.field]];
  const ids = Array.isArray(values) ? values : values === undefined || values === null ? [] : [values];
  const targetRows = data[relationship.targetCollection] ?? [];
  const matches = ids.map((id) => targetRows.find((item) => item.id === id)).filter((item): item is Record<string, unknown> => Boolean(item));
  return relationship.cardinality === "many" ? matches : matches[0] ?? null;
}

export function evaluateV3Expression(artifact: GeneratedAppV3, data: RuntimeData, collectionId: string, row: Record<string, unknown>, expression: V3Expr, depth = 0): V3Value {
  if (depth > MAX_EXPR_DEPTH) throw new Error("Computed value is too deeply nested.");
  const evaluate = (expr: V3Expr) => evaluateV3Expression(artifact, data, collectionId, row, expr, depth + 1);
  switch (expression.op) {
    case "literal": return expression.value;
    case "field": { const collection = artifact.collections.find((item) => item.id === collectionId); const computed = collection?.computed?.find((item) => item.id === expression.field); return computed ? evaluate(computed.expression) : row[expression.field] as V3Value ?? null; }
    case "countRelated": { const relation = artifact.collections.flatMap((item) => item.relationships.map((rel) => ({ item, rel }))).find(({ rel }) => rel.id === expression.relationship); return relation ? (data[relation.item.id] ?? []).filter((record) => record[relation.rel.field] === row.id).length : 0; }
    case "sumRelated": { const relation = artifact.collections.flatMap((item) => item.relationships.map((rel) => ({ item, rel }))).find(({ rel }) => rel.id === expression.relationship); return relation ? (data[relation.item.id] ?? []).filter((record) => record[relation.rel.field] === row.id).reduce((sum, record) => sum + (Number(record[expression.field]) || 0), 0) : 0; }
    case "add": return Number(evaluate(expression.left) ?? 0) + Number(evaluate(expression.right) ?? 0);
    case "subtract": return Number(evaluate(expression.left) ?? 0) - Number(evaluate(expression.right) ?? 0);
    case "multiply": return Number(evaluate(expression.left) ?? 0) * Number(evaluate(expression.right) ?? 0);
    case "equals": return evaluate(expression.left) === evaluate(expression.right);
    case "notEquals": return evaluate(expression.left) !== evaluate(expression.right);
    case "gte": return Number(evaluate(expression.left)) >= Number(evaluate(expression.right));
    case "gt": return Number(evaluate(expression.left)) > Number(evaluate(expression.right));
    case "lte": return Number(evaluate(expression.left)) <= Number(evaluate(expression.right));
    case "lt": return Number(evaluate(expression.left)) < Number(evaluate(expression.right));
    case "and": return expression.items.every((item) => Boolean(evaluate(item)));
    case "or": return expression.items.some((item) => Boolean(evaluate(item)));
    case "not": return !evaluate(expression.value);
    case "if": return evaluate(expression.test) ? evaluate(expression.then) : evaluate(expression.otherwise);
  }
}

export function getComputedValues(artifact: GeneratedAppV3, data: RuntimeData, collectionId: string, row: Record<string, unknown>) {
  const result: Record<string, V3Value> = {};
  for (const field of artifact.collections.find((item) => item.id === collectionId)?.computed ?? []) result[field.id] = evaluateV3Expression(artifact, data, collectionId, row, field.expression);
  return result;
}

export function unmetWorkflowRule(artifact: GeneratedAppV3, data: RuntimeData, collectionId: string, row: Record<string, unknown>) {
  for (const rule of artifact.collections.find((item) => item.id === collectionId)?.constraints ?? []) if (rule.type === "maxRelated") {
    const related = artifact.collections.flatMap((child) => child.relationships.map((relationship) => ({ child, relationship }))).find(({ relationship }) => relationship.id === rule.relationship);
    const count = related ? (data[related.child.id] ?? []).filter((item) => item[related.relationship.field] === row.id).length : 0;
    if (typeof row[rule.limitField] === "number" && count >= Number(row[rule.limitField])) return rule.label;
  }
  return null;
}

export function nextRecordId(data: RuntimeData, collectionId: string) {
  const ids = new Set(Object.values(data).flatMap((rows) => rows.map((row) => row.id)));
  const prefix = collectionId.slice(0, 18);
  let suffix = Object.values(data).reduce((sum, rows) => sum + rows.length, 0);
  let id = `${prefix}_${suffix.toString(36)}`;
  while (ids.has(id)) { suffix += 1; id = `${prefix}_${suffix.toString(36)}`; }
  return id;
}

export function applyWorkflow(artifact: GeneratedAppV3, source: RuntimeData, workflow: V3Workflow, currentId: string, inputs: Record<string, V3Value> = {}) {
  const data = structuredClone(source);
  const current = data[workflow.collection]?.find((row) => row.id === currentId);
  if (!current) return { ok: false as const, data: source, feedback: "This record is no longer available." };
  if (workflow.enabledWhen && !evaluateV3Expression(artifact, data, workflow.collection, current, workflow.enabledWhen)) {
    return { ok: false as const, data: source, feedback: unmetWorkflowRule(artifact, data, workflow.collection, current) ?? `${workflow.label} is not available right now.` };
  }
  const created = new Map<string, string>();
  let feedback = "";
  let navigation: string | undefined;
  const read = (sourceValue: V3ValueSource): V3Value => sourceValue.source === "literal" ? sourceValue.value : sourceValue.source === "currentId" ? currentId : sourceValue.source === "current" ? current[sourceValue.field] as V3Value ?? null : inputs[sourceValue.field] ?? null;
  for (const step of workflow.steps) {
    if (step.type === "feedback") { feedback = step.text; continue; }
    if (step.type === "navigate") { navigation = step.screen; continue; }
    const rows = data[step.collection] ?? [];
    if (step.type === "create") {
      if (rows.length >= MAX_RECORDS) return { ok: false as const, data: source, feedback: "This list is full. Remove an old record before adding another." };
      const id = nextRecordId(data, step.collection);
      const values = Object.fromEntries(Object.entries(step.values).map(([key, value]) => [key, read(value)]));
      const target = artifact.collections.find((item) => item.id === step.collection);
      const defaults = Object.fromEntries((target?.fields ?? []).filter((field) => field.default !== undefined && values[field.id] === undefined).map((field) => [field.id, field.default]));
      data[step.collection] = [...rows, { id, ...defaults, ...values }]; created.set(step.id, id); continue;
    }
    const targetId = step.target === "current" ? currentId : created.get(step.target.createdBy);
    if (!targetId) return { ok: false as const, data: source, feedback: "This action could not find the record it needs." };
    if (step.type === "update") {
      const values = Object.fromEntries(Object.entries(step.values).map(([key, value]) => [key, read(value)]));
      data[step.collection] = rows.map((row) => row.id === targetId ? { ...row, ...values } : row);
      if (!data[step.collection].some((row) => row.id === targetId)) return { ok: false as const, data: source, feedback: "This action could not find the record it needs." };
    } else {
      const issue = deleteRecord(data, artifact, step.collection, targetId, new Set());
      if (issue) return { ok: false as const, data: source, feedback: issue };
    }
  }
  const checked = validateRuntimeDataV3(artifact, data);
  if (!checked.ok) return { ok: false as const, data: source, feedback: checked.issues[0] ?? "This change does not meet the app's rules." };
  return { ok: true as const, data: checked.data, feedback: feedback || "Done.", navigation };
}

function deleteRecord(data: RuntimeData, artifact: GeneratedAppV3, collectionId: string, recordId: string, visited: Set<string>): string | null {
  const key = `${collectionId}:${recordId}`;
  if (visited.has(key)) return null;
  visited.add(key);
  const current = (data[collectionId] ?? []).find((row) => row.id === recordId);
  if (!current) return "This action could not find the record it needs.";
  const dependents: Array<{ child: V3Collection; rel: V3Relationship; rows: Record<string, unknown>[] }> = [];
  for (const child of artifact.collections) for (const field of child.fields.filter((item) => item.type === "reference" && item.collection === collectionId)) {
    if ((data[child.id] ?? []).some((row) => row[field.id] === recordId)) return `Cannot remove ${artifact.collections.find((item) => item.id === collectionId)?.label ?? "this record"} while ${field.label.toLowerCase()} still use it.`;
  }
  for (const child of artifact.collections) for (const rel of child.relationships.filter((item) => item.targetCollection === collectionId)) {
    const refs = (data[child.id] ?? []).filter((row) => rel.cardinality === "many" ? Array.isArray(row[rel.field]) && (row[rel.field] as unknown[]).includes(recordId) : row[rel.field] === recordId);
    if (refs.length) dependents.push({ child, rel, rows: refs });
  }
  const blocked = dependents.find(({ rel }) => rel.onDelete === "restrict");
  if (blocked) return `Cannot remove ${artifact.collections.find((item) => item.id === collectionId)?.label ?? "this record"} while ${blocked.rel.label.toLowerCase()} still use it.`;
  for (const { child, rel, rows } of dependents) {
    if (rel.onDelete === "nullify") data[child.id] = (data[child.id] ?? []).map((row) => {
      if (!rows.some((ref) => ref.id === row.id)) return row;
      return rel.cardinality === "many" ? { ...row, [rel.field]: (Array.isArray(row[rel.field]) ? row[rel.field] as unknown[] : []).filter((id) => id !== recordId) } : { ...row, [rel.field]: null };
    });
    if (rel.onDelete === "cascade") for (const row of rows) { const issue = deleteRecord(data, artifact, child.id, String(row.id), visited); if (issue) return issue; }
  }
  data[collectionId] = (data[collectionId] ?? []).filter((row) => row.id !== recordId);
  return null;
}

export function applyActionV3(data: RuntimeData, action: V2Action, recordId?: string, artifact?: GeneratedAppV3) {
  if (!artifact || action.type !== "delete" || !recordId) return applyRuntimeAction(data, action, recordId, artifact as unknown as Parameters<typeof applyRuntimeAction>[3]);
  const result = structuredClone(data);
  if (deleteRecord(result, artifact, action.collection, recordId, new Set())) return data;
  return result;
}
