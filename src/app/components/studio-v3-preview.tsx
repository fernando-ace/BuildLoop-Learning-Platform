"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { RuntimeData } from "@/lib/builder/v2";
import { applyActionV3, applyWorkflow, evaluateV3Expression, getComputedValues, nextRecordId, resolveRelationship, seedRuntimeDataV3, unmetWorkflowRule, validateRuntimeDataV3, type GeneratedAppV3, type V3Relationship, type V3Value, type V3Workflow } from "@/lib/builder/v3";
import { applyRuntimeMigrationV3, planRuntimeMigrationV3, validateMigrationSource, type MigrationSourceArtifact } from "@/lib/builder/migration-v3";
import type { StudioMigrationProvenance } from "@/lib/studio";
import type { GeneratedAppV2 } from "@/lib/builder/v2";
import { seedRuntimeData, type V2Action } from "@/lib/builder/v2";

const storageVersion = "buildloop-runtime-snapshot-v1";
const countRecords = (data: RuntimeData) => Object.values(data).reduce((sum, rows) => sum + rows.length, 0);
const fieldAt = (artifact: GeneratedAppV3, collectionId: string, fieldId: string) => artifact.collections.find((item) => item.id === collectionId)?.fields.find((item) => item.id === fieldId);
const relationshipAt = (artifact: GeneratedAppV3, collectionId: string, fieldId: string) => artifact.collections.find((item) => item.id === collectionId)?.relationships.find((item) => item.field === fieldId);

function labelFor(artifact: GeneratedAppV3, collectionId: string, row: Record<string, unknown>) {
  const collection = artifact.collections.find((item) => item.id === collectionId);
  const primary = collection?.fields.find((field) => field.id === artifact.screens.find((screen) => screen.collection === collectionId)?.primaryField) ?? collection?.fields[0];
  return String(primary ? row[primary.id] ?? "Untitled" : "Untitled");
}

function readSaved(raw: string | null, projectId: string, version: number, format: "buildloop-app-v2" | "buildloop-app-v3", artifact: MigrationSourceArtifact) {
  if (!raw) return { data: null as unknown, invalid: false };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { data: null, invalid: true };
    const envelope = parsed as Record<string, unknown>;
    const data = envelope.format === storageVersion
      ? envelope.projectId === projectId && envelope.version === version && envelope.artifactFormat === format ? envelope.data : null
      : parsed;
    const checked = validateMigrationSource(artifact, data);
    return checked.ok ? { data: checked.data, invalid: false } : { data: null, invalid: true };
  } catch { return { data: null, invalid: true }; }
}

export function StudioV3Preview({ artifact, previousArtifact, projectId, version, onMigration }: { artifact: GeneratedAppV3; previousArtifact?: MigrationSourceArtifact; projectId: string; version: number; onMigration?: (migration: StudioMigrationProvenance) => void }) {
  const [data, setData] = useState<RuntimeData | null>(null);
  const [screenId, setScreenId] = useState(artifact.defaultScreen);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<{ field: string; value: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [activeWorkflow, setActiveWorkflow] = useState<{ workflow: V3Workflow; recordId: string } | null>(null);
  const [workflowInputs, setWorkflowInputs] = useState<Record<string, V3Value>>({});
  const [formDraft, setFormDraft] = useState<Record<string, V3Value>>({});
  const callback = useRef(onMigration);
  useEffect(() => { callback.current = onMigration; }, [onMigration]);
  const key = `buildloop-runtime-v3:${encodeURIComponent(projectId)}:${version}`;

  useEffect(() => {
    let active = true;
    const saveSnapshot = (snapshot: RuntimeData) => {
      const serializedData = JSON.stringify(snapshot);
      if (new TextEncoder().encode(serializedData).length > 64_000) throw new Error("size");
      const envelope = JSON.stringify({ format: storageVersion, projectId, version, artifactFormat: "buildloop-app-v3", savedAt: new Date().toISOString(), data: snapshot });
      const prefix = `buildloop-runtime-v3:${encodeURIComponent(projectId)}:`;
      let bytes = 0;
      for (let index = 0; index < window.localStorage.length; index += 1) { const itemKey = window.localStorage.key(index); if (itemKey?.startsWith(prefix)) bytes += window.localStorage.getItem(itemKey)?.length ?? 0; }
      bytes -= window.localStorage.getItem(key)?.length ?? 0;
      if (bytes + envelope.length > 1_600_000) throw new Error("size");
      window.localStorage.setItem(key, envelope);
    };
    queueMicrotask(() => {
      if (!active) return;
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const saved = readSaved(raw, projectId, version, "buildloop-app-v3", artifact);
      if (saved.data) setData(saved.data as RuntimeData);
      else { setData(seedRuntimeDataV3(artifact)); setError("This version’s saved data could not be checked. The original save was left untouched and sample data is shown."); }
      return;
    }
    if (!previousArtifact || version < 2) { setData(seedRuntimeDataV3(artifact)); return; }
    const previousVersion = version - 1;
    const previousFormat = previousArtifact.format;
    const previousKey = `buildloop-runtime-${previousFormat === "buildloop-app-v3" ? "v3" : "v2"}:${encodeURIComponent(projectId)}:${previousVersion}`;
    const previousRaw = window.localStorage.getItem(previousKey);
    const previousSeed = previousFormat === "buildloop-app-v3" ? seedRuntimeDataV3(previousArtifact) : seedRuntimeData(previousArtifact as GeneratedAppV2);
    const source = previousRaw ? readSaved(previousRaw, projectId, previousVersion, previousFormat, previousArtifact) : { data: previousSeed, invalid: false };
    const plan = planRuntimeMigrationV3(previousArtifact, artifact, source.data, previousVersion, version);
    const migrated = applyRuntimeMigrationV3(previousArtifact, artifact, source.data, plan);
    const warnings = [...migrated.warnings];
    if (source.invalid) warnings.push(`Version ${previousVersion} data could not be checked; its saved copy was left untouched.`);
    let persisted = false;
    try { saveSnapshot(migrated.data); persisted = true; }
    catch { warnings.push("This browser could not save the new version’s records. Recent changes may not survive a refresh."); }
    callback.current?.({
      sourceVersion: previousVersion, targetVersion: version, completedAt: new Date().toISOString(), ...migrated.counts,
      status: !migrated.ok ? "fallback" : warnings.length ? "warning" : previousRaw ? "migrated" : "initialized",
      changes: plan.changes.slice(0, 40).map(({ kind, collectionId, itemId, risk }) => ({ kind, collectionId, itemId, destructive: risk === "destructive" || risk === "incompatible" })),
      warnings: warnings.slice(0, 12),
    });
    setData(migrated.data);
    if (warnings.length) setError(warnings.join(" "));
    else if (!persisted) setError("The new version’s records could not be saved in this browser.");
    // A version snapshot is initialized once; later renders must not retry or overwrite it.
    });
    return () => { active = false; };
  }, [artifact, key, previousArtifact, projectId, version]);

  const save = (next: RuntimeData, successText?: string) => {
    const checked = validateRuntimeDataV3(artifact, next);
    if (!checked.ok) { setFormError(checked.issues[0] ?? "That change does not fit this app’s rules."); return false; }
    setData(checked.data); setFormError("");
    try {
      const serializedData = JSON.stringify(checked.data);
      if (new TextEncoder().encode(serializedData).length > 64_000) throw new Error("size");
      const envelope = JSON.stringify({ format: storageVersion, projectId, version, artifactFormat: "buildloop-app-v3", savedAt: new Date().toISOString(), data: checked.data });
      const prefix = `buildloop-runtime-v3:${encodeURIComponent(projectId)}:`;
      let bytes = 0;
      for (let index = 0; index < window.localStorage.length; index += 1) { const itemKey = window.localStorage.key(index); if (itemKey?.startsWith(prefix)) bytes += window.localStorage.getItem(itemKey)?.length ?? 0; }
      bytes -= window.localStorage.getItem(key)?.length ?? 0;
      if (bytes + envelope.length > 1_600_000) throw new Error("size");
      window.localStorage.setItem(key, envelope);
    } catch { setError("This version reached this browser’s local save limit. The change is visible for now but may not survive a refresh."); }
    if (successText) setNotice(successText);
    return true;
  };

  const reset = () => { const seeded = seedRuntimeDataV3(artifact); setData(seeded); setScreenId(artifact.defaultScreen); setSelectedId(null); setError(""); setNotice("Preview data reset to this version’s sample records."); save(seeded); };
  const screen = artifact.screens.find((item) => item.id === screenId) ?? artifact.screens.find((item) => item.id === artifact.defaultScreen);
  if (!data || !screen) return <div className="studio-preview"><div className="studio-preview-head"><strong>RELATIONAL APP PREVIEW · VERSION {version}</strong><span>Preparing this version’s records…</span></div><div className="v3-preview-loading" role="status">Loading sample records</div></div>;
  const collection = screen.collection ? artifact.collections.find((item) => item.id === screen.collection) : undefined;
  const rows = collection ? data[collection.id] ?? [] : [];
  const current = selectedId ? rows.find((row) => row.id === selectedId) : undefined;
  const visibleFields = screen.fields?.length ? screen.fields.map((id) => ({ id, field: fieldAt(artifact, collection?.id ?? "", id), relationship: relationshipAt(artifact, collection?.id ?? "", id), computed: collection?.computed?.find((item) => item.id === id) })).filter((item) => item.field || item.relationship || item.computed) : (collection?.fields ?? []).map((field) => ({ id: field.id, field, relationship: undefined, computed: undefined }));

  const resolvedText = (row: Record<string, unknown>, fieldId: string) => {
    const rel = relationshipAt(artifact, collection?.id ?? "", fieldId);
    if (rel) {
      const linked = resolveRelationship(artifact, data, collection!.id, row, rel.id);
      return rel.cardinality === "many" ? (linked as Record<string, unknown>[]).map((item) => labelFor(artifact, rel.targetCollection, item)).join(", ") : linked ? labelFor(artifact, rel.targetCollection, linked as Record<string, unknown>) : "No linked record";
    }
    const stored = fieldAt(artifact, collection?.id ?? "", fieldId);
    if (stored?.type === "reference") { const target = (data[stored.collection] ?? []).find((item) => item.id === row[fieldId]); return target ? labelFor(artifact, stored.collection, target) : "No linked record"; }
    const computed = collection?.computed?.find((item) => item.id === fieldId);
    const value = computed ? getComputedValues(artifact, data, collection!.id, row)[fieldId] : row[fieldId];
    return typeof value === "boolean" ? value ? "Yes" : "No" : value === undefined || value === null || value === "" ? "—" : Array.isArray(value) ? value.join(", ") : String(value);
  };

  const relationControl = (rel: V3Relationship, value: V3Value | undefined, update: (next: V3Value) => void) => {
    const options = data[rel.targetCollection] ?? [];
    const selectedValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    return <select aria-label={rel.label} required={Boolean(rel.required)} multiple={rel.cardinality === "many"} size={rel.cardinality === "many" ? Math.min(4, Math.max(2, options.length)) : undefined} value={rel.cardinality === "many" ? selectedValues : selectedValues[0] ?? ""} onChange={(event) => update(rel.cardinality === "many" ? Array.from(event.currentTarget.selectedOptions, (item) => item.value) : event.currentTarget.value)}>
      {rel.cardinality === "one" && <option value="">Choose {rel.label.toLowerCase()}</option>}{options.map((item) => <option key={String(item.id)} value={String(item.id)}>{labelFor(artifact, rel.targetCollection, item)}</option>)}
    </select>;
  };

  const inputControl = (collectionId: string, fieldId: string, value: V3Value | undefined, update: (next: V3Value) => void) => {
    const relation = relationshipAt(artifact, collectionId, fieldId);
    if (relation) return relationControl(relation, value, update);
    const field = fieldAt(artifact, collectionId, fieldId);
    if (!field) return null;
    if (field.type === "reference") return <select aria-label={field.label} value={String(value ?? "")} onChange={(event) => update(event.currentTarget.value)}><option value="">Choose {field.label.toLowerCase()}</option>{(data[field.collection] ?? []).map((item) => <option key={String(item.id)} value={String(item.id)}>{labelFor(artifact, field.collection, item)}</option>)}</select>;
    if (field.type === "select" || field.type === "status") return <select aria-label={field.label} required={Boolean(field.required)} value={String(value ?? "")} onChange={(event) => update(event.currentTarget.value)}><option value="">Choose {field.label.toLowerCase()}</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
    if (field.type === "boolean") return <select aria-label={field.label} value={String(value ?? field.default ?? false)} onChange={(event) => update(event.currentTarget.value === "true")}><option value="false">No</option><option value="true">Yes</option></select>;
    return <input aria-label={field.label} required={Boolean(field.required)} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} min={field.type === "number" ? field.min : undefined} max={field.type === "number" ? field.max : undefined} maxLength={field.type === "text" || field.type === "longText" ? field.maxLength : undefined} value={String(value ?? field.default ?? "")} onChange={(event) => update(field.type === "number" ? event.currentTarget.value === "" ? null : Number(event.currentTarget.value) : event.currentTarget.value)} />;
  };

  const visibleRows = rows.filter((row) => {
    const matchesQuery = !query || visibleFields.some(({ id }) => resolvedText(row, id).toLowerCase().includes(query.toLowerCase()));
    const matchesFilter = !filter || (filter.value === "__empty__" ? row[filter.field] === undefined || row[filter.field] === null || row[filter.field] === "" : relationshipAt(artifact, collection?.id ?? "", filter.field) ? (row[filter.field] === filter.value || Array.isArray(row[filter.field]) && (row[filter.field] as unknown[]).includes(filter.value)) : row[filter.field] === filter.value);
    return matchesQuery && matchesFilter;
  });
  const goTo = (id: string, keepRecord = false) => { setScreenId(id); if (!keepRecord) setSelectedId(null); setActiveWorkflow(null); setQuery(""); setFilter(null); };
  const detailScreen = collection ? artifact.screens.find((item) => item.collection === collection.id && item.view === "detail") : undefined;
  const setDraft = (fieldId: string, value: V3Value) => setFormDraft((old) => ({ ...old, [fieldId]: value }));
  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!collection) return;
    const existing = screen.formMode === "edit" && selectedId ? (data[collection.id] ?? []).find((item) => item.id === selectedId) : undefined;
    const values: Record<string, unknown> = { ...(existing ?? {}) };
    for (const field of collection.fields) { const value = formDraft[field.id] ?? field.default; if (value === undefined || value === "") delete values[field.id]; else values[field.id] = value; }
    for (const rel of collection.relationships) { const value = formDraft[rel.field]; if (value === undefined || value === "") delete values[rel.field]; else values[rel.field] = value; }
    const id = existing?.id ?? nextRecordId(data, collection.id);
    const next = { ...data, [collection.id]: existing ? (data[collection.id] ?? []).map((item) => item.id === id ? { ...values, id } : item) : [...(data[collection.id] ?? []), { ...values, id }] };
    if (!existing && next[collection.id].length > 500) { setFormError(`${collection.label} has reached its 500-record limit.`); return; }
    if (save(next, existing ? "Changes saved." : "Record added.")) goTo(screen.cancelScreen ?? artifact.defaultScreen);
  };

  const startWorkflow = (workflow: V3Workflow, recordId: string) => { setActiveWorkflow({ workflow, recordId }); setWorkflowInputs({}); setFormError(""); };
  const runWorkflow = () => {
    if (!activeWorkflow) return;
    const result = applyWorkflow(artifact, data, activeWorkflow.workflow, activeWorkflow.recordId, workflowInputs);
    if (!result.ok) { setFormError(result.feedback); return; }
    if (save(result.data, result.feedback)) { setActiveWorkflow(null); if (result.navigation) goTo(result.navigation); }
  };
  const resetForm = () => { setFormDraft({}); setFormError(""); };
  const recordAction = (action: V2Action, record: Record<string, unknown>) => { const next = applyActionV3(data, action, String(record.id), artifact); if (next === data) setFormError("This record cannot be removed while another record is linked to it."); else if (save(next, action.type === "delete" ? "Record removed." : "Record updated.")) setSelectedId(null); };

  return <div className="studio-preview v3-preview"><div className="studio-preview-head"><strong>RELATIONAL APP PREVIEW · VERSION {version}</strong><button className="text-button" type="button" onClick={reset}>Reset this version’s sample records</button></div>
    <main className="v3-app" aria-label={`${artifact.title} application`}>
      <header className="v3-app-header"><h2>{artifact.title}</h2><p>{artifact.summary}</p></header>
      {error && <p className="v3-feedback v3-warning" role="status">{error}</p>}{notice && <p className="v3-feedback" role="status">{notice}</p>}
      {artifact.metrics.length > 0 && <section className="v3-metrics" aria-label="App summary">{artifact.metrics.map((metric) => <article key={metric.id}><span>{metric.label}</span><strong>{metric.op === "count" ? data[metric.collection]?.length ?? 0 : metric.op === "sum" ? (data[metric.collection] ?? []).reduce((sum, row) => sum + (Number(row[metric.field ?? ""]) || 0), 0) : (data[metric.collection] ?? []).filter((row) => row[metric.field ?? ""] === metric.value).length}</strong></article>)}</section>}
      <nav className="v3-nav" aria-label="Application screens">{artifact.navigation.map((item) => <button className={item.screen === screen.id ? "is-active" : ""} key={`${item.screen}:${item.label}`} type="button" onClick={() => goTo(item.screen)}>{item.label}</button>)}
        {artifact.screens.filter((item) => item.view === "form" && item.formMode === "create").map((item) => <button key={item.id} type="button" onClick={() => { resetForm(); goTo(item.id); }}>{item.title}</button>)}
      </nav>
      <section className="v3-screen" aria-labelledby="v3-screen-heading"><h3 id="v3-screen-heading" tabIndex={-1}>{screen.title}</h3>
        {screen.view === "about" && <p>{artifact.summary}</p>}
        {screen.view === "form" && collection && <form className="v3-form" onSubmit={submitForm} onReset={resetForm}>
          {collection.fields.map((field) => <label key={field.id}><span>{field.label}</span>{inputControl(collection.id, field.id, formDraft[field.id], (value) => setDraft(field.id, value))}</label>)}
          {collection.relationships.map((rel) => <label key={rel.id}><span>{rel.label}{rel.required ? " (required)" : " (optional)"}</span>{inputControl(collection.id, rel.field, formDraft[rel.field], (value) => setDraft(rel.field, value))}</label>)}
          {formError && <p className="v3-feedback v3-warning" role="alert">{formError}</p>}<div className="v3-actions"><button className="v3-primary" type="submit">{screen.formMode === "edit" ? "Save changes" : "Add record"}</button><button type="reset">Clear form</button><button type="button" onClick={() => goTo(screen.cancelScreen ?? artifact.defaultScreen)}>Cancel</button></div>
        </form>}
        {screen.view === "detail" && collection && current && <>
          <article className="v3-detail-record"><h4>{labelFor(artifact, collection.id, current)}</h4>{visibleFields.map(({ id, field, relationship, computed }) => {
            const value = resolvedText(current, id);
            if (relationship) { const linked = resolveRelationship(artifact, data, collection.id, current, relationship.id); const linkedRecords = Array.isArray(linked) ? linked : linked ? [linked] : []; return <p key={id}><strong>{relationship.label}:</strong> {linkedRecords.length ? linkedRecords.map((row) => <button key={String(row.id)} className="v3-link" type="button" onClick={() => { const target = artifact.screens.find((item) => item.collection === relationship.targetCollection && item.view !== "form"); if (target) { setSelectedId(String(row.id)); goTo(target.id, true); } }}>{labelFor(artifact, relationship.targetCollection, row)}</button>) : "No linked records"}</p>; }
            return <p key={id}><strong>{field?.label ?? computed?.label}:</strong> {value}</p>;
          })}</article>
          {artifact.workflows.filter((item) => item.collection === collection.id).map((workflow) => { const blocked = workflowBlocked(artifact, data, workflow, current); return <div className="v3-detail-actions" key={workflow.id}><button type="button" disabled={blocked.disabled} aria-describedby={blocked.disabled ? `v3-disabled-${workflow.id}` : undefined} onClick={() => startWorkflow(workflow, String(current.id))}>{workflow.label}</button>{blocked.disabled && <span id={`v3-disabled-${workflow.id}`} className="v3-disabled-reason">{blocked.reason}</span>}</div>; })}
          {artifact.collections.filter((child) => child.relationships.some((rel) => rel.targetCollection === collection.id)).map((child) => {
            const linked = child.relationships.filter((rel) => rel.targetCollection === collection.id).flatMap((rel) => (data[child.id] ?? []).filter((row) => row[rel.field] === current.id).map((row) => ({ row, rel })));
            const primary = child.fields[0];
            return <section className="v3-related" key={child.id}><h4>{child.label} <span>({linked.length})</span></h4>{linked.length ? <ul>{linked.map(({ row, rel }) => <li key={String(row.id)}><span>{String(row[primary?.id ?? "id"] ?? row.id)} <small>· {rel.label}</small></span>{artifact.screens.find((item) => item.collection === child.id && item.view === "detail") && <button type="button" onClick={() => { const target = artifact.screens.find((item) => item.collection === child.id && item.view === "detail")!; setSelectedId(String(row.id)); goTo(target.id, true); }}>View</button>}</li>)}</ul> : <p className="v3-empty">No {child.label.toLowerCase()} linked yet.</p>}</section>;
          })}
          {formError && <p className="v3-feedback v3-warning" role="alert">{formError}</p>}
        </>}
        {screen.view !== "form" && screen.view !== "about" && collection && screen.view !== "detail" && <>
          {screen.search && <label className="v3-search"><span>Search {collection.label.toLowerCase()}</span><input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={`Search ${collection.label.toLowerCase()}`} /></label>}
          {screen.filters?.length ? <div className="v3-filters" aria-label={`${screen.title} filters`}>{screen.filters.map((item) => <button key={`${item.field}:${item.value}`} aria-pressed={filter?.field === item.field && filter.value === item.value} type="button" onClick={() => setFilter(filter?.field === item.field && filter.value === item.value ? null : { field: item.field, value: item.value })}>{item.label}</button>)}</div> : null}
          {formError && <p className="v3-feedback v3-warning" role="alert">{formError}</p>}
          {visibleRows.length === 0 ? <p className="v3-empty">{query || filter ? "No matching records. Clear search or filters to see everything." : screen.emptyText ?? `No ${collection.label.toLowerCase()} yet.`}</p> : screen.view === "table" ? <div className="v3-table-wrap"><table><thead><tr>{visibleFields.map(({ id, field, relationship, computed }) => <th key={id}>{field?.label ?? relationship?.label ?? computed?.label}</th>)}<th>Actions</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={String(row.id)}>{visibleFields.map(({ id, relationship }) => <td key={id} data-label={relationship?.label ?? fieldAt(artifact, collection.id, id)?.label ?? collection.computed?.find((item) => item.id === id)?.label}>{resolvedText(row, id)}</td>)}<td data-label="Actions"><div className="v3-actions-inline">{detailScreen && <button type="button" onClick={() => { setSelectedId(String(row.id)); goTo(detailScreen.id, true); }}>View details</button>}{artifact.screens.some((item) => item.collection === collection.id && item.view === "form" && item.formMode === "edit") && <button type="button" onClick={() => { setSelectedId(String(row.id)); setFormDraft({ ...row } as Record<string, V3Value>); goTo(artifact.screens.find((item) => item.collection === collection.id && item.view === "form" && item.formMode === "edit")!.id, true); }}>Edit</button>}{artifact.workflows.filter((item) => item.collection === collection.id).map((workflow) => { const blocked = workflowBlocked(artifact, data, workflow, row); return <span className="v3-action-slot" key={workflow.id}><button type="button" disabled={blocked.disabled} aria-describedby={blocked.disabled ? `v3-disabled-${workflow.id}-${String(row.id)}` : undefined} onClick={() => startWorkflow(workflow, String(row.id))}>{workflow.label}</button>{blocked.disabled && <span id={`v3-disabled-${workflow.id}-${String(row.id)}`} className="v3-disabled-reason">{blocked.reason}</span>}</span>; })}{artifact.actions.filter((action) => action.type !== "navigate" && action.collection === collection.id).map((action) => <button type="button" key={action.id} onClick={() => recordAction(action, row)}>{action.label}</button>)}</div></td></tr>)}</tbody></table></div> : <div className="v3-record-grid">{visibleRows.map((row) => <article className="v3-record-card" key={String(row.id)}><h4>{labelFor(artifact, collection.id, row)}</h4>{visibleFields.filter(({ id }) => id !== screen.primaryField).map(({ id, field, relationship, computed }) => <p key={id}><strong>{field?.label ?? relationship?.label ?? computed?.label}:</strong> {resolvedText(row, id)}</p>)}{detailScreen && <button type="button" onClick={() => { setSelectedId(String(row.id)); goTo(detailScreen.id, true); }}>View details</button>}{artifact.workflows.filter((item) => item.collection === collection.id).map((workflow) => { const blocked = workflowBlocked(artifact, data, workflow, row); return <span className="v3-action-slot" key={workflow.id}><button type="button" disabled={blocked.disabled} aria-describedby={blocked.disabled ? `v3-disabled-${workflow.id}-${String(row.id)}` : undefined} onClick={() => startWorkflow(workflow, String(row.id))}>{workflow.label}</button>{blocked.disabled && <span id={`v3-disabled-${workflow.id}-${String(row.id)}`} className="v3-disabled-reason">{blocked.reason}</span>}</span>; })}{artifact.actions.filter((action) => action.type !== "navigate" && action.collection === collection.id).map((action) => <button type="button" key={action.id} onClick={() => recordAction(action, row)}>{action.label}</button>)}</article>)}</div>}
        </>}
      </section>
      {activeWorkflow && <section className="v3-workflow" aria-labelledby="v3-workflow-title"><h4 id="v3-workflow-title">{activeWorkflow.workflow.label}</h4><p>Complete the details to run this action.</p>
        {activeWorkflow.workflow.inputs?.map((inputId) => { const targetCollection = activeWorkflow.workflow.steps.find((step) => step.type === "create" && (Object.hasOwn(step.values, inputId) || activeWorkflow.workflow.inputs?.includes(inputId))); const outputId = targetCollection?.type === "create" ? targetCollection.collection : activeWorkflow.workflow.collection; const relation = relationshipAt(artifact, outputId, inputId); const field = fieldAt(artifact, outputId, inputId); return <label key={inputId}><span>{relation?.label ?? field?.label ?? inputId}</span>{inputControl(outputId, inputId, workflowInputs[inputId], (value) => setWorkflowInputs((old) => ({ ...old, [inputId]: value })))}</label>; })}
        {formError && <p className="v3-feedback v3-warning" role="alert">{formError}</p>}<div className="v3-actions"><button className="v3-primary" type="button" onClick={runWorkflow}>Run {activeWorkflow.workflow.label.toLowerCase()}</button><button type="button" onClick={() => { setActiveWorkflow(null); setFormError(""); }}>Cancel</button></div>
      </section>}
      <footer className="v3-app-footer">{countRecords(data)} saved records · This version has its own local data.</footer>
    </main>
  </div>;
}

function workflowBlocked(artifact: GeneratedAppV3, data: RuntimeData, workflow: V3Workflow, row: Record<string, unknown>) {
  const constraint = unmetWorkflowRule(artifact, data, workflow.collection, row);
  if (constraint) return { disabled: true, reason: constraint };
  if (workflow.enabledWhen && !evaluateV3Expression(artifact, data, workflow.collection, row, workflow.enabledWhen)) return { disabled: true, reason: "This action is not available for this record yet." };
  return { disabled: false, reason: "" };
}
