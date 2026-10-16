"use client";

import { useEffect, useState } from "react";

export function InvitationAccept({ token }: { token: string }) {
  const [message, setMessage] = useState("Checking your invitation…");
  useEffect(() => {
    let live = true;
    fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) { window.location.assign(`/sign-in?returnTo=${encodeURIComponent(window.location.pathname)}`); return; }
        if (!response.ok) throw new Error(result.error || "This invitation could not be accepted.");
        if (live) { setMessage("You joined the app. Opening it now…"); window.location.assign(`/apps/${encodeURIComponent(result.invitation.appId)}`); }
      })
      .catch((error) => { if (live) setMessage(error instanceof Error ? error.message : "This invitation could not be accepted."); });
    return () => { live = false; };
  }, [token]);
  return <main className="auth-page"><section className="auth-card"><span className="eyebrow">APP INVITATION</span><h1>Join this app</h1><p role="status">{message}</p><a href="/sign-in">Sign in</a></section></main>;
}
