"use client";

import { useCallback, useEffect, useState } from "react";
import type { GeneratedAppV4 } from "@/lib/builder/v4";

type Member = { id: string; name: string; email: string; platformRole: "owner" | "administrator" | "member"; appRole: string | null };
type Invitation = { id: string; email: string | null; appRole: string; status: string; expiresAt: string };

export function AppMembers({ appId, artifact }: { appId: string; artifact: GeneratedAppV4 }) {
  const [members, setMembers] = useState<Member[]>([]), [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [email, setEmail] = useState(""), [role, setRole] = useState(artifact.roles[0]?.id ?? ""), [shareUrl, setShareUrl] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const base = `/api/apps/${encodeURIComponent(appId)}`;
  const refresh = useCallback(async () => {
    const [memberResponse, invitationResponse, sessionResponse] = await Promise.all([fetch(`${base}/members`, { cache: "no-store" }), fetch(`${base}/invitations`, { cache: "no-store" }), fetch("/api/session", { cache: "no-store" })]);
    const [memberBody, invitationBody, sessionBody] = await Promise.all([memberResponse.json(), invitationResponse.json(), sessionResponse.json()]);
    if (!memberResponse.ok) throw new Error(memberBody.error || "Members could not be loaded.");
    setMembers(memberBody.members); setInvitations(invitationBody.invitations ?? []); setCurrentUserId(sessionBody.user?.id ?? "");
  }, [base]);
  useEffect(() => { void Promise.resolve().then(refresh).catch((error) => setMessage(error.message)); }, [refresh]);
  async function send(path: string, method: string, data: unknown) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${base}/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "That change could not be saved.");
      return body;
    } catch (error) { setMessage(error instanceof Error ? error.message : "That change could not be saved."); return null; }
    finally { setBusy(false); }
  }
  async function invite() {
    const result = await send("invitations", "POST", { email: email.trim() || undefined, appRole: role });
    if (!result) return;
    setShareUrl(result.invitation.url); setMessage("Invitation created. Share the link with the intended collaborator."); setEmail(""); await refresh();
  }
  const currentMember = members.find((item) => item.id === currentUserId);
  return <details className="studio-rollback app-members"><summary>People and access</summary>
    <p>Platform access controls who can manage this app. App roles control what each person can do inside it.</p>
    <form onSubmit={(event) => { event.preventDefault(); void invite(); }} className="studio-form">
      <label htmlFor={`invite-email-${appId}`}>Invite by email (optional)<input id={`invite-email-${appId}`} type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
      <label htmlFor={`invite-role-${appId}`}>App role<select id={`invite-role-${appId}`} value={role} onChange={(event) => setRole(event.target.value)}>{artifact.roles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <button className="button button-primary" type="submit" disabled={busy || !role}>Create invitation link</button>
    </form>
    {shareUrl && <p>Invitation link: <a href={shareUrl}>{shareUrl}</a></p>}
    {message && <p role="status">{message}</p>}
    <h3>Members</h3><ul>{members.map((member) => <li key={member.id}><strong>{member.name}</strong> · {member.email} · {member.platformRole} · {artifact.roles.find((item) => item.id === member.appRole)?.label ?? "No app role"}
      {member.platformRole !== "owner" && member.id !== currentUserId && <label htmlFor={`role-${member.id}`}>Change app role<select id={`role-${member.id}`} value={member.appRole ?? ""} disabled={busy} onChange={async (event) => { if (await send("members", "PATCH", { memberId: member.id, appRole: event.target.value })) await refresh(); }}><option value="" disabled>Choose role</option>{artifact.roles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      {member.platformRole !== "owner" && member.id !== currentUserId && (currentMember?.platformRole === "owner" || member.platformRole === "member") && <button type="button" disabled={busy} onClick={async () => { if (await send("members", "DELETE", { memberId: member.id })) await refresh(); }}>Remove access</button>}
      {currentMember?.platformRole === "owner" && member.platformRole !== "owner" && <><label htmlFor={`platform-role-${member.id}`}>Platform access<select id={`platform-role-${member.id}`} value={member.platformRole} disabled={busy} onChange={async (event) => { if (await send("members", "PATCH", { memberId: member.id, platformRole: event.target.value })) await refresh(); }}><option value="member">Member</option><option value="administrator">Administrator</option></select></label><button type="button" disabled={busy} onClick={async () => { if (confirm(`Transfer app ownership to ${member.name}?`)) { const response = await fetch(`${base}/ownership`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ newOwnerId: member.id }) }); const result = await response.json(); setMessage(response.ok ? "Ownership transferred." : result.error || "Ownership could not be transferred."); await refresh(); } }}>Transfer ownership</button></>}
    </li>)}</ul>
    <h3>Invitations</h3><ul>{invitations.map((invitation) => <li key={invitation.id}>{invitation.email || "Anyone with the link"} · {artifact.roles.find((item) => item.id === invitation.appRole)?.label ?? invitation.appRole} · {invitation.status}{invitation.status === "pending" && <button type="button" disabled={busy} onClick={async () => { if (await send("invitations", "DELETE", { invitationId: invitation.id })) await refresh(); }}>Revoke</button>}</li>)}</ul>
  </details>;
}
