"use client";

import { useMemo, useState } from "react";
import type { RuntimeData } from "@/lib/builder/v2";
import { applyWorkflow, getComputedValues, seedRuntimeDataV3, validateRuntimeDataV3 } from "@/lib/builder/v3";
import { describeV4Permissions, filterVisibleRows, getV4User, stampOwnedFields, toV3Artifact, type GeneratedAppV4 } from "@/lib/builder/v4";

export function StudioV4Preview({ artifact, version }: { artifact: GeneratedAppV4; version: number }) {
  const initialData = useMemo(() => seedRuntimeDataV3(toV3Artifact(artifact)), [artifact]);
  const [data, setData] = useState<RuntimeData>(() => structuredClone(initialData));
  const [userId, setUserId] = useState(artifact.users[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const user = getV4User(artifact, userId);
  const roleSummary = user ? describeV4Permissions(artifact).filter((row) => user.roles.some((role) => artifact.roles.find((item) => item.id === role)?.label === row.role)) : [];

  function runWorkflow(workflowId: string, recordId: string) {
    if (!user) return;
    const workflow = artifact.workflows.find((item) => item.id === workflowId);
    if (!workflow || !artifact.workflowPermissions.some((permission) => permission.workflow === workflowId && permission.roles.some((role) => user.roles.includes(role)))) { setMessage("This role cannot run that action."); return; }
    const inputs = Object.fromEntries((workflow.inputs ?? []).map((field) => [field, user.id]));
    const result = applyWorkflow(toV3Artifact(artifact), data, workflow, recordId, inputs);
    if (!result.ok) { setMessage(result.feedback); return; }
    const stamped = { ...result.data };
    for (const collection of artifact.collections) {
      const previousIds = new Set((data[collection.id] ?? []).map((row) => row.id));
      stamped[collection.id] = (stamped[collection.id] ?? []).map((row) => previousIds.has(row.id) ? row : stampOwnedFields(artifact, user, collection.id, row));
    }
    const checked = validateRuntimeDataV3(toV3Artifact(artifact), stamped);
    if (!checked.ok) { setMessage("That action would break one of this app’s rules."); return; }
    setData(checked.data); setMessage(`${workflow.label} completed as ${user.displayName}.`);
  }

  function testDeniedEdit(collectionId: string, row: Record<string, unknown>) {
    if (!user) return;
    setMessage(`Blocked: ${user.roles.map((role) => artifact.roles.find((item) => item.id === role)?.label).filter(Boolean).join(", ")} cannot edit this record.`);
    void collectionId; void row;
  }

  return <section className="studio-preview studio-v4-preview" aria-label={`Version ${version} shared app preview`}>
    <header className="studio-preview-head"><div><span className="eyebrow">VERSION {version} · ROLE PREVIEW</span><h2>{artifact.title}</h2><p>{artifact.summary}</p></div><button className="text-button" type="button" onClick={() => { setData(structuredClone(initialData)); setMessage("Preview data was reset to its sample records."); }}>Reset preview data</button></header>
    <div className="studio-v4-controls"><label htmlFor={`preview-user-${version}`}>Preview as</label><select id={`preview-user-${version}`} value={userId} onChange={(event) => { setUserId(event.target.value); setMessage(""); }}>
      {artifact.users.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName} · {candidate.roles.map((role) => artifact.roles.find((item) => item.id === role)?.label ?? role).join(", ")}</option>)}
    </select><p>The server checks these same rules after you publish. Preview records stay separate from shared app data.</p></div>
    {roleSummary.map((summary) => <section className="studio-v4-role-summary" key={summary.role}><h3>{summary.role} can</h3>{summary.can.length ? <ul>{summary.can.map((permission) => <li key={permission}>{permission}</li>)}</ul> : <p>No actions are enabled.</p>}</section>)}
    {message && <p className="studio-v4-feedback" role="status">{message}</p>}
    <div className="studio-v4-collections">{artifact.collections.map((collection) => {
      const source = data[collection.id] ?? [];
      const rows = user ? filterVisibleRows(artifact, user, collection.id, source) : [];
      const workflows = user ? artifact.workflows.filter((workflow) => workflow.collection === collection.id && artifact.workflowPermissions.some((permission) => permission.workflow === workflow.id && permission.roles.some((role) => user.roles.includes(role)))) : [];
      const fields = collection.fields.filter((field) => rows.some((row) => Object.hasOwn(row, field.id)));
      return rows.length || artifact.permissions.some((permission) => permission.collection === collection.id && permission.operations.includes("read") && user?.roles.includes(permission.role)) ? <section className="studio-v4-list" key={collection.id}>
        <h3>{collection.label}</h3>
        {rows.length ? <ul>{rows.map((row) => <li key={String(row.id)}><div><strong>{String(row[collection.fields[0]?.id] ?? row.id)}</strong>{fields.filter((field) => field.id !== collection.fields[0]?.id).map((field) => <span key={field.id}>{field.label}: {String(row[field.id] ?? "—")}</span>)}{collection.computed?.map((field) => <span key={field.id}>{field.label}: {String(getComputedValues(toV3Artifact(artifact), data, collection.id, row)[field.id] ?? "—")}</span>)}</div>
          <div className="studio-v4-row-actions">{workflows.map((workflow) => <button className="button button-quiet" type="button" key={workflow.id} onClick={() => runWorkflow(workflow.id, String(row.id))}>{workflow.label}</button>)}{user && !artifact.permissions.some((permission) => permission.collection === collection.id && permission.operations.includes("update") && user.roles.includes(permission.role)) && <button className="text-button" type="button" onClick={() => testDeniedEdit(collection.id, row)}>Test blocked edit</button>}</div>
        </li>)}</ul> : <p>No records are visible to this user.</p>}
      </section> : null;
    })}</div>
  </section>;
}
