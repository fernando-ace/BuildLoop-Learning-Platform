"use client";

import { useState } from "react";

export function AuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/auth/${mode === "sign-up" ? "sign-up" : "sign-in"}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(mode === "sign-up" ? { name } : {}), email: email.trim(), password }),
      });
      const body = await response.json() as { message?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(body.message ?? body.error?.message ?? "We could not sign you in. Check your details and try again.");
      const requested = new URLSearchParams(window.location.search).get("returnTo");
      const returnTo = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      window.location.assign(returnTo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not reach BuildLoop. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card" aria-labelledby="auth-title">
    <span className="eyebrow">BUILDLOOP ACCOUNT</span>
    <h1 id="auth-title">{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
    <p>Your account keeps your Studio projects and app access connected to you.</p>
    <form onSubmit={submit}>
      {mode === "sign-up" && <label htmlFor="auth-name">Name<input id="auth-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required /></label>}
      <label htmlFor="auth-email">Email<input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
      <label htmlFor="auth-password">Password<input id="auth-password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "sign-in" ? 1 : 12} maxLength={128} required /></label>
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}</button>
    </form>
    {message && <p role="alert" className="auth-error">{message}</p>}
    <p className="auth-switch">{mode === "sign-in" ? "New to BuildLoop?" : "Already have an account?"} <button className="button-link" type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(""); }}>{mode === "sign-in" ? "Create an account" : "Sign in"}</button></p>
  </section></main>;
}
