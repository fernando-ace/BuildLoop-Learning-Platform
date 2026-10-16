"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { RuntimeData } from "@/lib/builder/v2";
import { evaluateV3Expression, getComputedValues, unmetWorkflowRule } from "@/lib/builder/v3";
import { canUsePermission, filterVisibleRows, toV3Artifact, type GeneratedAppV4, type V4AppUser } from "@/lib/builder/v4";

type AppView = { published: true; versionId: string; versionNumber: number; artifact: GeneratedAppV4; user: V4AppUser; data: RuntimeData; activity: Array<{ id: number; actorName: string; createdAt: string; operation: string; collection: string; recordIds: string[] }> };
type Collection = GeneratedAppV4["collections"][number];

function RecordEditor({ collection, artifact, data, row, onSave, onCancel }: { collection: Collection; artifact: GeneratedAppV4; data: RuntimeData; row?: Record<string, unknown>; onSave: (values: Record<string, unknown>) => void; onCancel: () => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values: Record<string, unknown> = {};
    for (const field of collection.fields) {
      const raw = String(new FormData(event.currentTarget).get(field.id) ?? "");
      if (raw === "" && !field.required) continue;
      values[field.id] = field.type === "number" ? Number(raw) : field.type === "boolean" ? raw === "true" : raw;
    }
    for (const relation of collection.relationships) {
      const raw = String(new FormData(event.currentTarget).get(relation.field) ?? "");
      if (raw) values[relation.field] = raw;
    }
    onSave(values);
  }
  const editableFields = collection.fields.filter((field) => field.type !== "reference");
  return <form className="published-editor" onSubmit={submit}>
    {editableFields.map((field) => <label key={field.id} htmlFor={`published-${collection.id}-${field.id}`}><span>{field.label}{field.required ? " *" : ""}</span>
      {field.type === "boolean" ? <select id={`published-${collection.id}-${field.id}`} name={field.id} defaultValue={String(row?.[field.id] ?? field.default ?? false)}><option value="true">Yes</option><option value="false">No</option></select> : field.type === "select" || field.type === "status" ? <select id={`published-${collection.id}-${field.id}`} name={field.id} required={field.required} defaultValue={String(row?.[field.id] ?? field.default ?? "")}><option value="">Choose {field.label.toLowerCase()}</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input id={`published-${collection.id}-${field.id}`} name={field.id} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} required={field.required} min={field.type === "number" ? field.min : undefined} max={field.type === "number" ? field.max : undefined} maxLength={field.type === "text" || field.type === "longText" ? field.maxLength : undefined} defaultValue={String(row?.[field.id] ?? field.default ?? "")} />}
    </label>)}
    {collection.relationships.map((relation) => {
      const target = artifact.collections.find((item) => item.id === relation.targetCollection);
      const options = data[relation.targetCollection] ?? [];
      return <label key={relation.id} htmlFor={`published-${collection.id}-${relation.field}`}><span>{relation.label}{relation.required ? " *" : ""}</span><select id={`published-${collection.id}-${relation.field}`} name={relation.field} required={relation.required} defaultValue={String(row?.[relation.field] ?? "")}><option value="">Choose {relation.label.toLowerCase()}</option>{options.map((option) => <option key={String(option.id)} value={String(option.id)}>{String(option[target?.fields[0]?.id ?? "name"] ?? option.id)}</option>)}</select></label>;
    })}
    <div className="published-form-actions"><button className="button button-primary" type="submit">{row ? "Save changes" : `Add ${collection.label.toLowerCase()}`}</button><button className="button button-quiet" type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

export function PublishedApp({ appId }: { appId: string }) {
  const [view, setView] = useState<AppView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState<{ collection: string; recordId?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "This app could not be opened."); setView(null); return; }
      setView(result as AppView);
      setMessage("");
    } catch { setMessage("Could not reach this shared app. Check your connection and refresh."); }
    finally { setLoading(false); }
  }, [appId]);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  async function send(operation: unknown) {
    if (!view) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ versionId: view.versionId, operation }), cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "That change was not saved."); await load(); return; }
      setEditor(null);
      await load();
      setMessage("Saved. Other users will see this change when they refresh.");
    } catch { setMessage("Could not save that change. Refresh and try again."); }
    finally { setBusy(false); }
  }

  const baseArtifact = view ? toV3Artifact(view.artifact) : null;
  if (loading) return <main className="published-app"><p role="status">Opening the shared app…</p></main>;
  if (!view) return <main className="published-app"><h1>Shared app</h1><p role="alert">{message || "This app is not available."}</p>{message.includes("Sign in") ? <a className="button button-primary" href={`/sign-in?returnTo=${encodeURIComponent(`/apps/${appId}`)}`}>Sign in</a> : <a href="/">Return to BuildLoop</a>}</main>;
  if (!view || !baseArtifact) return null;

  const user = view.user;
  return <main className="published-app">
    <header className="published-header"><div><span>Shared app · Version {view.versionNumber}</span><h1>{view.artifact.title}</h1><p>{view.artifact.summary}</p></div><p className="published-user-switch">Signed in as <strong>{user.displayName}</strong><br />{user.roles.map((role) => view.artifact.roles.find((item) => item.id === role)?.label ?? role).join(", ")}</p></header>
    <p className="published-education">Each change is checked by the app server. Shared records appear here after refresh.</p>
    {message && <p className="published-feedback" role="status">{message}</p>}
    {view.artifact.collections.map((collection) => {
      const rows = filterVisibleRows(view.artifact, user, collection.id, view.data[collection.id] ?? []);
      const canRead = view.artifact.permissions.some((permission) => permission.collection === collection.id && permission.operations.includes("read") && user.roles.includes(permission.role));
      if (!canRead) return null;
      const canCreate = view.artifact.permissions.some((permission) => permission.collection === collection.id && permission.operations.includes("create") && user.roles.includes(permission.role));
      const workflows = view.artifact.workflows.filter((workflow) => workflow.collection === collection.id && view.artifact.workflowPermissions.some((permission) => permission.workflow === workflow.id && permission.roles.some((role) => user.roles.includes(role))));
      return <section className="published-collection" key={collection.id}>
        <div className="published-collection-heading"><div><h2>{collection.label}</h2><p>{rows.length} visible record{rows.length === 1 ? "" : "s"}</p></div>{canCreate && <button className="button button-primary" type="button" disabled={busy} onClick={() => setEditor({ collection: collection.id })}>Add {collection.label.toLowerCase()}</button>}</div>
        {editor?.collection === collection.id && !editor.recordId && <RecordEditor collection={collection} artifact={view.artifact} data={view.data} onCancel={() => setEditor(null)} onSave={(values) => void send({ type: "create", collection: collection.id, values })} />}
        {rows.length ? <ul className="published-record-list">{rows.map((row) => {
          const updatePermission = canUsePermission(view.artifact, user, collection.id, "update", row);
          const canDelete = Boolean(canUsePermission(view.artifact, user, collection.id, "delete", row));
          const computed = getComputedValues(baseArtifact, view.data, collection.id, row);
          const fields = collection.fields.filter((field) => Object.hasOwn(row, field.id));
          const rowEditor = editor?.collection === collection.id && editor.recordId === row.id;
          const rowWorkflows = workflows.filter((workflow) => !workflow.enabledWhen || evaluateV3Expression(baseArtifact, view.data, collection.id, row, workflow.enabledWhen));
          return <li key={String(row.id)}><article><h3>{String(row[collection.fields[0]?.id ?? "id"] ?? row.id)}</h3><dl>{fields.filter((field) => field.id !== collection.fields[0]?.id).map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{String(row[field.id] ?? "—")}</dd></div>)}{collection.computed?.filter((field) => Object.hasOwn(row, field.id)).map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{String(computed[field.id] ?? "—")}</dd></div>)}</dl>
            <div className="published-record-actions">{rowWorkflows.map((workflow) => <button className="button button-quiet" type="button" key={workflow.id} disabled={busy || Boolean(unmetWorkflowRule(baseArtifact, view.data, collection.id, row))} title={unmetWorkflowRule(baseArtifact, view.data, collection.id, row) ?? undefined} onClick={() => { const inputs = Object.fromEntries((workflow.inputs ?? []).map((field) => [field, /user|member|volunteer|borrower|owner/i.test(field) ? user.id : ""])); void send({ type: "workflow", workflow: workflow.id, recordId: row.id, inputs }); }}>{workflow.label}</button>)}{updatePermission && !rowEditor && <button className="text-button" type="button" disabled={busy} onClick={() => setEditor({ collection: collection.id, recordId: String(row.id) })}>Edit</button>}{canDelete && <button className="text-button" type="button" disabled={busy} onClick={() => void send({ type: "delete", collection: collection.id, recordId: row.id })}>Remove</button>}</div>
            {rowEditor && updatePermission && <RecordEditor collection={collection} artifact={view.artifact} data={view.data} row={row} onCancel={() => setEditor(null)} onSave={(values) => void send({ type: "update", collection: collection.id, recordId: row.id, values })} />}
          </article></li>;
        })}</ul> : <p className="published-empty">No records are visible to this role.</p>}
      </section>;
    })}
    {view.activity.length > 0 && <section className="published-collection"><h2>Recent activity</h2><ul className="published-activity">{view.activity.map((entry) => <li key={entry.id}><span>{entry.actorName} · {entry.operation.replace("workflow:", "")}</span><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time></li>)}</ul></section>}
  </main>;
}
