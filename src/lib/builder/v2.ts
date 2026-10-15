export type V2Field =
  | { id: string; label: string; type: "text" | "longText" | "number" | "boolean" | "date"; required?: boolean; minLength?: number; maxLength?: number; min?: number; max?: number }
  | { id: string; label: string; type: "select" | "status"; options: string[]; required?: boolean }
  | { id: string; label: string; type: "reference"; collection: string; required?: boolean };

export type V2Action =
  | { id: string; label: string; type: "navigate"; screen: string }
  | { id: string; label: string; type: "delete"; collection: string }
  | { id: string; label: string; type: "toggle"; collection: string; field: string }
  | { id: string; label: string; type: "increment"; collection: string; field: string; amount: number }
  | { id: string; label: string; type: "set"; collection: string; field: string; value: string | number | boolean };

export interface V2Collection { id: string; label: string; fields: V2Field[]; seed?: Array<Record<string, unknown>> }
export interface V2Screen {
  id: string; title: string; view: "list" | "table" | "cards" | "detail" | "form" | "about";
  collection?: string; primaryField?: string; fields?: string[]; search?: boolean;
  sort?: { field: string; direction: "asc" | "desc" };
  filters?: Array<{ field: string; label: string; value: string }>;
  emptyText?: string; formMode?: "create" | "edit"; cancelScreen?: string;
}
export interface GeneratedAppV2 {
  format: "buildloop-app-v2"; title: string; summary: string; defaultScreen: string;
  screens: V2Screen[]; navigation: Array<{ label: string; screen: string }>;
  collections: V2Collection[]; actions: V2Action[];
  metrics: Array<{ id: string; label: string; op: "count" | "countEquals" | "sum"; collection: string; field?: string; value?: string | number | boolean }>;
  changeSummary: string[]; testTasks: string[];
}
export type AppArtifactV2 = GeneratedAppV2;
export type RuntimeData = Record<string, Array<Record<string, unknown>>>;

const ID = /^[a-z][a-z0-9_]{0,31}$/;
const SAFE = (s: unknown, max = 160): s is string => typeof s === "string" && s.trim().length > 0 && s.length <= max && !/(<\s*\/?\s*(?:script|iframe|img|svg|html)|javascript\s*:|https?:\/\/|\bon\w+\s*=|\b(?:eval|fetch|XMLHttpRequest|Function)\s*\()/i.test(s);
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null));
const keysOnly = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every((key) => keys.includes(key) && !["__proto__", "prototype", "constructor"].includes(key));

export function validateArtifactV2(value: unknown, maxBytes = 48_000): { ok: true; artifact: GeneratedAppV2 } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (!record(value)) return { ok: false, issues: ["Artifact must be an object"] };
  const a = value;
  try { if (new TextEncoder().encode(JSON.stringify(a)).length > maxBytes) issues.push("Artifact is too large"); } catch { return { ok: false, issues: ["Artifact is not valid JSON data"] }; }
  if (a.format !== "buildloop-app-v2") issues.push("Unsupported app format");
  if (!SAFE(a.title, 80) || !SAFE(a.summary, 260)) issues.push("Title or summary is invalid");
  if (!Array.isArray(a.collections) || a.collections.length < 1 || a.collections.length > 8) issues.push("Use 1 to 8 collections");
  if (!Array.isArray(a.screens) || a.screens.length < 1 || a.screens.length > 10) issues.push("Use 1 to 10 screens");
  if (!Array.isArray(a.navigation) || a.navigation.length > 8 || !Array.isArray(a.actions) || a.actions.length > 40 || !Array.isArray(a.metrics) || a.metrics.length > 12) issues.push("Navigation, action, or metric count is outside the supported bounds");
  if (!Array.isArray(a.changeSummary) || a.changeSummary.length > 12 || !a.changeSummary.every((x) => SAFE(x, 140))) issues.push("Change summary is malformed");
  if (!Array.isArray(a.testTasks) || a.testTasks.length < 1 || a.testTasks.length > 6 || !a.testTasks.every((x) => SAFE(x, 140))) issues.push("Use 1 to 6 short test tasks");
  if (!keysOnly(a, ["format", "title", "summary", "defaultScreen", "screens", "navigation", "collections", "actions", "metrics", "changeSummary", "testTasks"])) issues.push("Artifact contains unsupported properties");
  const collections = Array.isArray(a.collections) ? a.collections : [];
  const screens = Array.isArray(a.screens) ? a.screens : [];
  const collectionIds = new Set<string>();
  for (const [i, raw] of collections.entries()) {
    if (!record(raw) || !keysOnly(raw, ["id", "label", "fields", "seed"])) { issues.push(`Collection ${i + 1} is malformed`); continue; }
    if (typeof raw.id !== "string" || !ID.test(raw.id) || collectionIds.has(raw.id)) issues.push(`Collection ${i + 1} has an invalid or duplicate id`);
    if (typeof raw.id === "string") collectionIds.add(raw.id);
    if (!SAFE(raw.label, 80) || !Array.isArray(raw.fields) || raw.fields.length < 1 || raw.fields.length > 16) issues.push(`Collection ${i + 1} needs 1 to 16 fields`);
    const fieldIds = new Set<string>();
    for (const f of Array.isArray(raw.fields) ? raw.fields : []) {
      if (!record(f)) { issues.push(`Collection ${i + 1} has a malformed field`); continue; }
      if (typeof f.id !== "string" || !ID.test(f.id) || f.id === "id" || fieldIds.has(f.id)) issues.push(`Collection ${i + 1} has an invalid or duplicate field id`);
      if (typeof f.id === "string") fieldIds.add(f.id);
      if (!SAFE(f.label, 80) || !["text", "longText", "number", "boolean", "date", "select", "status", "reference"].includes(String(f.type))) issues.push(`Field ${String(f.id)} is invalid`);
      const common = ["id", "label", "type", "required"];
      const allowed = f.type === "text" || f.type === "longText" ? [...common, "minLength", "maxLength"] : f.type === "number" ? [...common, "min", "max"] : f.type === "select" || f.type === "status" ? [...common, "options"] : f.type === "reference" ? [...common, "collection"] : common;
      if (!keysOnly(f, allowed)) issues.push(`Field ${String(f.id)} has properties that do not match its type`);
      if (f.required !== undefined && typeof f.required !== "boolean") issues.push("Field required flag must be boolean");
      if (f.type === "select" || f.type === "status") if (!Array.isArray(f.options) || f.options.length < 1 || f.options.length > 12 || !f.options.every((x) => SAFE(x, 40))) issues.push(`Field ${String(f.id)} has invalid choices`);
      if (f.type === "reference" && (typeof f.collection !== "string" || !ID.test(f.collection))) issues.push(`Field ${String(f.id)} has invalid collection reference`);
      if (f.type === "number" && ((f.min !== undefined && typeof f.min !== "number") || (f.max !== undefined && typeof f.max !== "number") || (typeof f.min === "number" && typeof f.max === "number" && f.min > f.max))) issues.push(`Field ${String(f.id)} has invalid number bounds`);
      if ((f.type === "text" || f.type === "longText") && ((f.minLength !== undefined && (!Number.isInteger(f.minLength) || Number(f.minLength) < 0 || Number(f.minLength) > 2000)) || (f.maxLength !== undefined && (!Number.isInteger(f.maxLength) || Number(f.maxLength) < 1 || Number(f.maxLength) > 2000)))) issues.push(`Field ${String(f.id)} has invalid length bounds`);
      if ((f.type === "text" || f.type === "longText") && typeof f.minLength === "number" && typeof f.maxLength === "number" && f.minLength > f.maxLength) issues.push(`Field ${String(f.id)} has inverted length bounds`);
    }
    if (Array.isArray(raw.seed)) {
      if (raw.seed.length > 100) issues.push(`Collection ${i + 1} has too many seed records`);
      for (const item of raw.seed) {
        if (!record(item) || Object.keys(item).length > 17 || Object.keys(item).some((k) => (k !== "id" && !fieldIds.has(k)) || ["__proto__", "constructor", "prototype"].includes(k))) { issues.push(`Collection ${i + 1} has invalid seed data`); continue; }
        if (item.id !== undefined && (typeof item.id !== "string" || !ID.test(item.id))) issues.push(`Collection ${i + 1} has an invalid record id`);
        for (const f of Array.isArray(raw.fields) ? raw.fields.filter(record) : []) {
          const val = item[String(f.id)]; if (val === undefined) { if (f.required) issues.push(`Seed record is missing ${String(f.id)}`); continue; }
          if (f.required && val === "") issues.push(`Seed record is missing ${String(f.id)}`);
          if ((f.type === "text" || f.type === "longText" || f.type === "date" || f.type === "select" || f.type === "status" || f.type === "reference") && typeof val !== "string") issues.push(`Seed value for ${String(f.id)} must be text`);
          if ((f.type === "text" || f.type === "longText") && typeof val === "string" && ((typeof f.minLength === "number" && val.length < f.minLength) || (typeof f.maxLength === "number" && val.length > f.maxLength))) issues.push(`Seed value for ${String(f.id)} is outside its length bounds`);
          if (f.type === "date" && typeof val === "string" && (!/^\d{4}-\d{2}-\d{2}$/.test(val) || !Number.isFinite(Date.parse(`${val}T00:00:00Z`)) || new Date(`${val}T00:00:00Z`).toISOString().slice(0, 10) !== val)) issues.push(`Seed value for ${String(f.id)} is not a date`);
          if (f.type === "number" && (typeof val !== "number" || !Number.isFinite(val) || (typeof f.min === "number" && val < f.min) || (typeof f.max === "number" && val > f.max))) issues.push(`Seed value for ${String(f.id)} is outside its number bounds`);
          if (f.type === "boolean" && typeof val !== "boolean") issues.push(`Seed value for ${String(f.id)} must be boolean`);
          if ((f.type === "select" || f.type === "status") && Array.isArray(f.options) && !f.options.includes(val)) issues.push(`Seed value for ${String(f.id)} is not an allowed choice`);
        }
      }
    } else if (raw.seed !== undefined) issues.push(`Collection ${i + 1} seed data must be a list`);
  }
  const relationshipGraph = new Map<string, string[]>();
  for (const collection of collections.filter(record)) relationshipGraph.set(String(collection.id), (Array.isArray(collection.fields) ? collection.fields.filter(record) : []).filter((field) => field.type === "reference").map((field) => String(field.collection)));
  const visiting = new Set<string>(), visited = new Set<string>();
  const hasCycle = (id: string): boolean => { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); for (const next of relationshipGraph.get(id) ?? []) if (hasCycle(next)) return true; visiting.delete(id); visited.add(id); return false; };
  for (const id of relationshipGraph.keys()) if (hasCycle(id)) { issues.push("Cyclic collection references are not supported"); break; }
  const seedIds = new Map<string, Set<string>>();
  for (const collection of collections.filter(record)) {
    const ids = new Set<string>();
    for (const row of Array.isArray(collection.seed) ? collection.seed.filter(record) : []) if (typeof row.id === "string") { if (ids.has(row.id)) issues.push(`Collection ${String(collection.id)} has duplicate record IDs`); ids.add(row.id); }
    seedIds.set(String(collection.id), ids);
  }
  for (const collection of collections.filter(record)) for (const row of Array.isArray(collection.seed) ? collection.seed.filter(record) : []) for (const field of Array.isArray(collection.fields) ? collection.fields.filter(record) : []) if (field.type === "reference" && row[String(field.id)] !== undefined && !(seedIds.get(String(field.collection))?.has(String(row[String(field.id)])))) issues.push(`Seed reference ${String(field.id)} points to a missing record`);
  const screenIds = new Set<string>();
  for (const [i, raw] of screens.entries()) {
    if (!record(raw) || !keysOnly(raw, ["id", "title", "view", "collection", "primaryField", "fields", "search", "sort", "filters", "emptyText", "formMode", "cancelScreen"])) { issues.push(`Screen ${i + 1} is malformed`); continue; }
    if (typeof raw.id !== "string" || !ID.test(raw.id) || screenIds.has(raw.id)) issues.push(`Screen ${i + 1} has an invalid or duplicate id`);
    if (typeof raw.id === "string") screenIds.add(raw.id);
    if (!SAFE(raw.title, 80) || !["list", "table", "cards", "detail", "form", "about"].includes(String(raw.view))) issues.push(`Screen ${String(raw.id)} is invalid`);
    if (raw.emptyText !== undefined && !SAFE(raw.emptyText, 160)) issues.push(`Screen ${String(raw.id)} has invalid empty-state text`);
    if (raw.primaryField !== undefined && typeof raw.primaryField !== "string") issues.push(`Screen ${String(raw.id)} primary field is invalid`);
    if (["list", "table", "cards", "detail", "form"].includes(String(raw.view)) && typeof raw.collection !== "string") issues.push(`Screen ${String(raw.id)} needs a collection`);
    if (raw.collection !== undefined && (typeof raw.collection !== "string" || !collectionIds.has(raw.collection))) issues.push(`Screen ${String(raw.id)} refers to a missing collection`);
    if (raw.view === "form" && !["create", "edit"].includes(String(raw.formMode))) issues.push(`Screen ${String(raw.id)} needs a valid form mode`);
    if (raw.cancelScreen !== undefined && typeof raw.cancelScreen !== "string") issues.push(`Screen ${String(raw.id)} has invalid cancel target`);
    if (raw.search !== undefined && typeof raw.search !== "boolean") issues.push(`Screen ${String(raw.id)} search flag must be boolean`);
    if (raw.fields !== undefined && (!Array.isArray(raw.fields) || !raw.fields.every((x) => typeof x === "string"))) issues.push(`Screen ${String(raw.id)} field list is invalid`);
    if (raw.sort !== undefined && (!record(raw.sort) || !keysOnly(raw.sort, ["field", "direction"]) || typeof raw.sort.field !== "string" || !["asc", "desc"].includes(String(raw.sort.direction)))) issues.push(`Screen ${String(raw.id)} sort is invalid`);
    if (raw.filters !== undefined && (!Array.isArray(raw.filters) || raw.filters.length > 8 || !raw.filters.every((f) => record(f) && keysOnly(f, ["field", "label", "value"]) && SAFE(f.label, 60) && SAFE(f.value, 40) && typeof f.field === "string"))) issues.push(`Screen ${String(raw.id)} filters are invalid`);
  }
  const collectionById = new Map(collections.filter(record).map((c) => [String(c.id), c]));
  if (typeof a.defaultScreen !== "string" || !screenIds.has(a.defaultScreen)) issues.push("Default screen is missing");
  for (const nav of Array.isArray(a.navigation) ? a.navigation : []) if (!record(nav) || !keysOnly(nav, ["label", "screen"]) || !SAFE(nav.label, 60) || typeof nav.screen !== "string" || !screenIds.has(nav.screen)) issues.push("Navigation refers to an invalid screen or has unsupported properties");
  for (const c of collections.filter(record)) for (const f of Array.isArray(c.fields) ? c.fields.filter(record) : []) if (f.type === "reference" && !collectionIds.has(String(f.collection))) issues.push(`Field ${String(f.id)} refers to a missing collection`);
  for (const s of screens.filter(record)) {
    const c = typeof s.collection === "string" ? collectionById.get(s.collection) : undefined;
    const fields = c && Array.isArray(c.fields) ? c.fields.filter(record).map((f) => String(f.id)) : [];
    if (typeof s.primaryField === "string" && !fields.includes(s.primaryField)) issues.push(`Screen ${String(s.id)} primary field is missing`);
    if (record(s.sort) && !fields.includes(String(s.sort.field))) issues.push(`Screen ${String(s.id)} sorts by a missing field`);
    if (Array.isArray(s.fields) && s.fields.some((f) => !fields.includes(String(f)))) issues.push(`Screen ${String(s.id)} displays a missing field`);
    if (Array.isArray(s.filters)) for (const filter of s.filters) {
      const filterField = record(filter) && c && Array.isArray(c.fields) ? c.fields.find((item) => record(item) && item.id === filter.field) : undefined;
      if (!filterField || (filterField.type !== "select" && filterField.type !== "status") || !Array.isArray(filterField.options) || !filterField.options.includes(filter.value)) issues.push(`Screen ${String(s.id)} has a filter that does not match a choice field`);
    }
    if (s.cancelScreen && !screenIds.has(String(s.cancelScreen))) issues.push(`Screen ${String(s.id)} cancels to a missing screen`);
  }
  const actionIds = new Set<string>();
  for (const action of Array.isArray(a.actions) ? a.actions : []) {
    if (!record(action) || !keysOnly(action, ["id", "label", "type", "screen", "collection", "field", "amount", "value"])) { issues.push("Action is malformed"); continue; }
    if (typeof action.id !== "string" || !ID.test(action.id) || actionIds.has(action.id)) issues.push("Action id is invalid or duplicated");
    if (typeof action.id === "string") actionIds.add(action.id);
    if (!SAFE(action.label, 60) || !["navigate", "delete", "toggle", "increment", "set"].includes(String(action.type))) issues.push("Action is unsupported");
    const actionKeys = action.type === "navigate" ? ["id", "label", "type", "screen"] : action.type === "delete" ? ["id", "label", "type", "collection"] : action.type === "increment" ? ["id", "label", "type", "collection", "field", "amount"] : action.type === "set" ? ["id", "label", "type", "collection", "field", "value"] : ["id", "label", "type", "collection", "field"];
    if (!keysOnly(action, actionKeys)) issues.push(`Action ${String(action.id)} has unsupported properties for its type`);
    if (action.type === "navigate" && (typeof action.screen !== "string" || !screenIds.has(action.screen))) issues.push(`Action ${String(action.id)} refers to a missing screen`);
    if (["delete", "toggle", "increment", "set"].includes(String(action.type))) {
      const c = typeof action.collection === "string" ? collectionById.get(action.collection) : undefined;
      if (!c) issues.push(`Action ${String(action.id)} refers to a missing collection`);
      else if (action.type !== "delete") {
        const f = Array.isArray(c.fields) ? c.fields.filter(record).find((item) => item.id === action.field) : undefined;
        if (!f || (action.type === "toggle" && f.type !== "boolean") || (action.type === "increment" && f.type !== "number")) issues.push(`Action ${String(action.id)} refers to an incompatible field`);
        if (action.type === "increment" && (typeof action.amount !== "number" || !Number.isFinite(action.amount) || Math.abs(action.amount) > 1000)) issues.push(`Action ${String(action.id)} has an invalid increment amount`);
        if (action.type === "set" && f) {
          const v = action.value;
          const valid = f.type === "boolean" ? typeof v === "boolean" : f.type === "number" ? typeof v === "number" && Number.isFinite(v) : typeof v === "string" && (f.type !== "select" && f.type !== "status" || Array.isArray(f.options) && f.options.includes(v));
          if (!valid) issues.push(`Action ${String(action.id)} has a value that does not match its field`);
          if (f.type === "number" && typeof v === "number" && ((typeof f.min === "number" && v < f.min) || (typeof f.max === "number" && v > f.max))) issues.push(`Action ${String(action.id)} exceeds its field bounds`);
        }
      }
    }
  }
  const metricIds = new Set<string>();
  for (const m of Array.isArray(a.metrics) ? a.metrics : []) {
    if (!record(m) || !keysOnly(m, ["id", "label", "op", "collection", "field", "value"])) { issues.push("Metric is malformed"); continue; }
    const c = typeof m.collection === "string" ? collectionById.get(m.collection) : undefined;
    const metricKeys = m.op === "count" ? ["id", "label", "op", "collection"] : m.op === "sum" ? ["id", "label", "op", "collection", "field"] : ["id", "label", "op", "collection", "field", "value"];
    if (!keysOnly(m, metricKeys)) issues.push(`Metric ${String(m.id)} has unsupported properties for its operation`);
    if (typeof m.id !== "string" || !ID.test(m.id) || metricIds.has(m.id) || !SAFE(m.label, 60) || !c || !["count", "countEquals", "sum"].includes(String(m.op))) issues.push("Metric has invalid references or operation");
    if (typeof m.id === "string") metricIds.add(m.id);
    if (m.op !== "count" && (!c || !Array.isArray(c.fields) || !c.fields.some((f) => record(f) && f.id === m.field && (m.op !== "sum" || f.type === "number")))) issues.push(`Metric ${String(m.id)} refers to an invalid field`);
    if (m.op === "countEquals" && c && Array.isArray(c.fields)) {
      const f = c.fields.find((item) => record(item) && item.id === m.field);
      const valid = f && (f.type === "boolean" ? typeof m.value === "boolean" : f.type === "number" ? typeof m.value === "number" : typeof m.value === "string" && (f.type !== "select" && f.type !== "status" || Array.isArray(f.options) && f.options.includes(m.value)));
      if (!valid) issues.push(`Metric ${String(m.id)} has an invalid comparison value`);
    }
  }
  if (issues.length) return { ok: false, issues: [...new Set(issues)].slice(0, 12) };
  return { ok: true, artifact: a as unknown as GeneratedAppV2 };
}

export function seedRuntimeData(artifact: GeneratedAppV2): RuntimeData {
  return Object.fromEntries(artifact.collections.map((c) => [c.id, (c.seed ?? []).map((row, i) => ({ id: typeof row.id === "string" ? row.id : `${c.id.slice(0, 20)}_${i + 1}`, ...row }))]));
}
export function applyRuntimeAction(data: RuntimeData, action: V2Action, recordId?: string, artifact?: GeneratedAppV2): RuntimeData {
  const rows = data[action.type === "navigate" ? "" : action.collection] ?? [];
  if (action.type === "navigate" || !recordId) return data;
  const numericField = action.type === "increment" ? artifact?.collections.find((c) => c.id === action.collection)?.fields.find((f) => f.id === action.field) : undefined;
  const nextRows = action.type === "delete" ? rows.filter((r) => r.id !== recordId) : rows.map((r) => {
    if (r.id !== recordId) return r;
    if (action.type === "toggle") return { ...r, [action.field]: !r[action.field] };
    if (action.type === "increment") { const next = Number(r[action.field] ?? 0) + action.amount; return { ...r, [action.field]: Math.min(numericField?.type === "number" ? numericField.max ?? Infinity : Infinity, Math.max(numericField?.type === "number" ? numericField.min ?? -Infinity : -Infinity, next)) }; }
    return { ...r, [action.field]: action.value };
  });
  return { ...data, [action.collection]: nextRows };
}
export function deriveMetric(data: RuntimeData, metric: GeneratedAppV2["metrics"][number]): number {
  const rows = data[metric.collection] ?? [];
  if (metric.op === "sum") { const field = metric.field; if (!field) return 0; return rows.reduce((sum, row) => sum + (typeof row[field] === "number" ? Number(row[field]) : 0), 0); }
  if (metric.op === "countEquals") { const field = metric.field; if (!field) return 0; return rows.filter((row) => row[field] === metric.value).length; }
  return rows.length;
}
export function diffArtifacts(before: GeneratedAppV2, after: GeneratedAppV2): string[] {
  const changes: string[] = [];
  const keyed = <T extends { id: string }>(oldItems: T[], newItems: T[], label: string, describe?: (oldItem: T, newItem: T) => void) => {
    const old = new Map(oldItems.map((item) => [item.id, item])); const fresh = new Map(newItems.map((item) => [item.id, item]));
    for (const id of fresh.keys()) if (!old.has(id)) changes.push(`Added ${label} ${id}`);
    for (const id of old.keys()) if (!fresh.has(id)) changes.push(`Removed ${label} ${id}`);
    if (describe) for (const [id, item] of old) { const next = fresh.get(id); if (next) describe(item, next); }
    else for (const [id, item] of old) { const next = fresh.get(id); if (next && JSON.stringify(item) !== JSON.stringify(next)) changes.push(`Changed ${label} ${id}`); }
  };
  if (before.title !== after.title) changes.push("Changed app title");
  if (before.summary !== after.summary) changes.push("Changed app summary");
  keyed(before.screens, after.screens, "screen", (old, next) => {
    if (old.title !== next.title) changes.push(`Renamed screen ${old.id}`);
    if (old.view !== next.view || old.collection !== next.collection || old.primaryField !== next.primaryField || JSON.stringify(old.fields) !== JSON.stringify(next.fields)) changes.push(`Changed record view ${old.id}`);
    if (JSON.stringify(old.filters) !== JSON.stringify(next.filters) || old.search !== next.search) changes.push(`Changed filters or search on ${old.id}`);
    if (JSON.stringify(old.sort) !== JSON.stringify(next.sort)) changes.push(`Changed sorting on ${old.id}`);
    if (old.emptyText !== next.emptyText) changes.push(`Changed empty state on ${old.id}`);
  });
  keyed(before.collections, after.collections, "collection", (old, next) => {
    if (old.label !== next.label) changes.push(`Changed collection ${old.id}`);
    const oldFields = old.fields, nextFields = next.fields;
    keyed(oldFields, nextFields, "field", (left, right) => {
      if (JSON.stringify(left) !== JSON.stringify(right)) changes.push(`Changed validation or type for ${old.id}.${left.id}`);
    });
    if (JSON.stringify(old.seed ?? []) !== JSON.stringify(next.seed ?? [])) changes.push(`Changed seed data for ${old.id}`);
  });
  keyed(before.actions, after.actions, "action"); keyed(before.metrics, after.metrics, "derived value");
  if (JSON.stringify(before.navigation) !== JSON.stringify(after.navigation) || before.defaultScreen !== after.defaultScreen) changes.push("Changed navigation");
  return changes.length ? changes.slice(0, 12) : ["Kept existing screens and behaviors"];
}

const fixture = (title: string, collection: V2Collection, screens: V2Screen[], metrics: GeneratedAppV2["metrics"] = []): GeneratedAppV2 => ({
  format: "buildloop-app-v2", title, summary: `A small ${title.toLowerCase()} workspace.`, defaultScreen: screens[0].id,
  screens: [...screens, ...screens.filter((s) => s.view === "form" && s.formMode === "create").map((s) => ({ id: `${s.id}_edit`, title: `Edit ${collection.label.toLowerCase()}`, view: "form" as const, collection: collection.id, formMode: "edit" as const, cancelScreen: s.cancelScreen })), ...screens.filter((s) => ["list", "table", "cards"].includes(s.view)).map((s) => ({ id: `${s.id}_detail`, title: `${collection.label} details`, view: "detail" as const, collection: collection.id, fields: s.fields }))],
  navigation: screens.filter((s) => s.view !== "form" && s.view !== "detail").map((s) => ({ label: s.title, screen: s.id })),
  collections: [collection], actions: [
    { id: "delete_record", label: "Delete record", type: "delete", collection: collection.id },
    ...collection.fields.filter((field) => field.type === "boolean").map((field) => ({ id: `toggle_${field.id}`, label: `Toggle ${field.label}`, type: "toggle" as const, collection: collection.id, field: field.id })),
    ...collection.fields.filter((field) => field.type === "number").map((field) => ({ id: `increase_${field.id}`, label: `Increase ${field.label}`, type: "increment" as const, collection: collection.id, field: field.id, amount: 1 })),
  ], metrics, changeSummary: ["Added screens", "Added structured records"], testTasks: [`Add a ${collection.label.toLowerCase()} record`, `Search ${collection.label.toLowerCase()}`],
});
export const v2Fixtures: GeneratedAppV2[] = [
  fixture("Equipment checkout", { id: "equipment", label: "Equipment", fields: [{ id: "name", label: "Item", type: "text", required: true, maxLength: 80 }, { id: "category", label: "Category", type: "select", options: ["Audio", "Sports", "Lab"] }, { id: "quantity", label: "Quantity", type: "number", min: 0, max: 500 }, { id: "checked_out", label: "Checked out", type: "boolean" }], seed: [{ name: "Projector", category: "Audio", quantity: 4, checked_out: false }] }, [{ id: "inventory", title: "Inventory", view: "table", collection: "equipment", primaryField: "name", fields: ["name", "category", "quantity", "checked_out"], search: true, sort: { field: "name", direction: "asc" }, emptyText: "Add equipment to start." }, { id: "add", title: "Add equipment", view: "form", collection: "equipment", formMode: "create", cancelScreen: "inventory" }], [{ id: "items", label: "Items", op: "count", collection: "equipment" }]),
  fixture("Volunteer manager", { id: "shifts", label: "Volunteer shifts", fields: [{ id: "event", label: "Event", type: "text", required: true }, { id: "role", label: "Role", type: "text", required: true }, { id: "capacity", label: "Capacity", type: "number", min: 1, max: 200 }, { id: "status", label: "Status", type: "status", options: ["Open", "Full"] }], seed: [{ event: "Welcome fair", role: "Setup", capacity: 8, status: "Open" }] }, [{ id: "shifts", title: "Shifts", view: "cards", collection: "shifts", primaryField: "event", search: true }, { id: "new_shift", title: "Add a shift", view: "form", collection: "shifts", formMode: "create", cancelScreen: "shifts" }], [{ id: "open", label: "Open shifts", op: "countEquals", collection: "shifts", field: "status", value: "Open" }]),
  fixture("Task tracker", { id: "tasks", label: "Tasks", fields: [{ id: "title", label: "Task", type: "text", required: true }, { id: "owner", label: "Owner", type: "text" }, { id: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High"] }, { id: "status", label: "Status", type: "status", options: ["Todo", "Doing", "Done"] }], seed: [{ title: "Plan kickoff", owner: "Mina", priority: "High", status: "Todo" }] }, [{ id: "tasks", title: "Team tasks", view: "list", collection: "tasks", primaryField: "title", search: true, filters: [{ field: "status", label: "To do", value: "Todo" }] }, { id: "new_task", title: "New task", view: "form", collection: "tasks", formMode: "create", cancelScreen: "tasks" }], [{ id: "done", label: "Completed", op: "countEquals", collection: "tasks", field: "status", value: "Done" }]),
  fixture("Campus lost and found", { id: "items", label: "Found items", fields: [{ id: "name", label: "Item", type: "text", required: true }, { id: "category", label: "Category", type: "select", options: ["Clothing", "Tech", "Other"] }, { id: "location", label: "Found at", type: "text" }, { id: "status", label: "Status", type: "status", options: ["Unclaimed", "Claimed"] }], seed: [{ name: "Blue water bottle", category: "Other", location: "Library", status: "Unclaimed" }] }, [{ id: "found", title: "Found items", view: "list", collection: "items", primaryField: "name", search: true, filters: [{ field: "status", label: "Unclaimed", value: "Unclaimed" }] }, { id: "report", title: "Report an item", view: "form", collection: "items", formMode: "create", cancelScreen: "found" }], [{ id: "unclaimed", label: "Unclaimed items", op: "countEquals", collection: "items", field: "status", value: "Unclaimed" }]),
];
