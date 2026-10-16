"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GeneratedAppV4 } from "@/lib/builder/v4";
import { describeV4Permissions } from "@/lib/builder/v4";
import type { PublicationAnalysis, PublicationResult } from "@/lib/shared-apps/store";
import { AppMembers } from "@/app/components/app-members";

export function StudioV4Publish({ appId, versionNumber, artifact }: { appId: string; versionNumber: number; artifact: GeneratedAppV4 }) {
  const [analysis, setAnalysis] = useState<PublicationAnalysis | null>(null);
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [savedVersions, setSavedVersions] = useState<Array<{ versionId: string; versionNumber: number; title: string }>>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState("");
  const [rollbackAnalysis, setRollbackAnalysis] = useState<PublicationAnalysis | null>(null);
  const usersByRole = describeV4Permissions(artifact);

  const refreshVersionList = useCallback(async () => {
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/publish`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) return;
      setActiveVersionId(result.current?.versionId ?? null);
      setSavedVersions(result.versions ?? []);
      setPublished(result.current?.versionId === `v${versionNumber}`);
    } catch { /* The learner can still publish; retry on the next visit. */ }
  }, [appId, versionNumber]);
  useEffect(() => { void Promise.resolve().then(() => refreshVersionList()); }, [refreshVersionList]);

  async function publish(confirmWarnings: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish", versionId: `v${versionNumber}`, expectedPublishedVersion: activeVersionId, confirmWarnings }), cache: "no-store" });
      const result = await response.json() as PublicationResult;
      if (!result.published) { setMessage(result.blockedReason || result.warnings?.join(" ") || "This version could not be published."); return; }
      setPublished(true); setAnalysis(result); setMessage(`Version ${versionNumber} is now the shared app.`); await refreshVersionList();
    } catch { setMessage("Could not reach the app server. Check the connection and try again."); }
    finally { setBusy(false); }
  }

  async function beginPublish() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "analyze", versionId: `v${versionNumber}`, expectedPublishedVersion: activeVersionId }), cache: "no-store" });
      const result = await response.json() as PublicationAnalysis;
      setAnalysis(result);
      if (!result.ok) { setMessage(result.blockedReason || "Fix the version checks before publishing."); return; }
      if (result.requiresConfirmation) { setMessage("Review the changes before you publish this version."); return; }
      await publish(false);
    } catch { setMessage("Could not check this version. Check the connection and try again."); }
    finally { setBusy(false); }
  }

  async function analyzeRollback() {
    if (!rollbackTarget) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "analyzeRollback", versionId: rollbackTarget, expectedPublishedVersion: activeVersionId }), cache: "no-store" });
      const result = await response.json() as PublicationAnalysis;
      setRollbackAnalysis(result);
      setMessage(result.ok ? result.requiresConfirmation ? "Review the shared data changes before restoring this version." : "The saved records can move back safely." : result.blockedReason || "This version cannot be restored safely.");
    } catch { setMessage("Could not check that saved version. Try again."); }
    finally { setBusy(false); }
  }

  async function rollback() {
    if (!rollbackTarget) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "rollback", versionId: rollbackTarget, expectedPublishedVersion: activeVersionId, confirmWarnings: rollbackAnalysis?.requiresConfirmation === true }), cache: "no-store" });
      const result = await response.json() as PublicationResult;
      if (!result.published) { setMessage(result.blockedReason || result.warnings?.join(" ") || "This version could not be restored."); return; }
      setPublished(true); setMessage(`Restored the saved app from Version ${savedVersions.find((version) => version.versionId === rollbackTarget)?.versionNumber ?? "earlier"}.`); setRollbackAnalysis(null); await refreshVersionList();
    } catch { setMessage("Could not restore this version. The current shared app is still active."); }
    finally { setBusy(false); }
  }

  return <section className="studio-publish" aria-labelledby="studio-publish-title">
    <div><span className="eyebrow">SHARED APP</span><h2 id="studio-publish-title">Publish Version {versionNumber}</h2><p>Published apps share saved data. The server checks each action against the app’s roles.</p></div>
    <div className="studio-permission-summary" aria-label="App roles and permissions">{usersByRole.map((item) => <article key={item.role}><h3>{item.role}</h3>{item.can.length ? <ul>{item.can.map((permission) => <li key={permission}>{permission}</li>)}</ul> : <p>No actions are enabled yet.</p>}</article>)}</div>
    <p className="studio-nudge">Preview as each test user, and try one action they should not be allowed to take.</p>
    {analysis?.changes.length ? <div className="studio-publish-changes"><strong>Changes in this version</strong><ul>{analysis.changes.map((change, index) => <li key={`${change.kind}-${index}`}><span>{change.risk === "security" || change.risk === "destructive" ? "Permission or data change: " : ""}</span>{change.label}</li>)}</ul></div> : null}
    {analysis?.warnings.length ? <div className="studio-migration-warning" role="alert"><strong>Review before publishing</strong><ul>{analysis.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div> : null}
    {message && <p className={published ? "studio-publish-success" : "studio-publish-message"} role={published ? "status" : "alert"}>{message}</p>}
    {published ? <><Link className="button button-primary" href={`/apps/${encodeURIComponent(appId)}`} target="_blank" rel="noreferrer">Open the shared app</Link>{savedVersions.filter((version) => version.versionId !== activeVersionId).length > 0 && <details className="studio-rollback"><summary>Restore an earlier published version</summary><p>BuildLoop keeps the latest shared records. If the older schema cannot hold them, the restore will be blocked.</p><label htmlFor={`rollback-${appId}`}>Saved version</label><select id={`rollback-${appId}`} value={rollbackTarget} onChange={(event) => { setRollbackTarget(event.target.value); setRollbackAnalysis(null); setMessage(""); }}><option value="">Choose a version</option>{savedVersions.filter((version) => version.versionId !== activeVersionId).map((version) => <option key={version.versionId} value={version.versionId}>Version {version.versionNumber} · {version.title}</option>)}</select><button className="button button-quiet" type="button" disabled={!rollbackTarget || busy} onClick={() => void analyzeRollback()}>Check before restoring</button>{rollbackAnalysis?.warnings.length ? <div className="studio-migration-warning" role="alert"><strong>Review these changes</strong><ul>{rollbackAnalysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}{rollbackAnalysis?.ok && <button className="button button-primary" type="button" disabled={busy} onClick={() => void rollback()}>{busy ? "Restoring…" : rollbackAnalysis.requiresConfirmation ? "I reviewed these changes. Restore version" : "Restore this version"}</button>}{rollbackAnalysis && !rollbackAnalysis.ok && <p role="alert">{rollbackAnalysis.blockedReason}</p>}</details>}</> : analysis?.requiresConfirmation && analysis.ok ? <button className="button button-primary" type="button" disabled={busy} onClick={() => void publish(true)}>{busy ? "Publishing…" : "I reviewed these changes. Publish"}</button> : <button className="button button-primary" type="button" disabled={busy} onClick={() => void beginPublish()}>{busy ? "Checking this version…" : "Publish this version"}</button>}
    <AppMembers appId={appId} artifact={artifact} />
  </section>;
}
