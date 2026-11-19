"use client";

import { useState, useSyncExternalStore } from "react";

const subscribeToLocation = () => () => {};
const getResetNotice = () => new URLSearchParams(window.location.search).get("reset") === "success" ? "Your password was updated. Sign in with your new password." : "";
const getResetToken = () => new URLSearchParams(window.location.search).get("token") ?? "";

export function AuthForm({ publicAppUrl, allowUnverifiedPreviewSignup }: { publicAppUrl: string; allowUnverifiedPreviewSignup: boolean }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const resetNotice = useSyncExternalStore(subscribeToLocation, getResetNotice, () => "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "forgot") {
        await fetch("/api/auth/request-password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), redirectTo: `${publicAppUrl}/reset-password` }) });
        setMessage("If that address has a BuildLoop account, a password reset link will be sent.");
        return;
      }
      const response = await fetch(`/api/auth/${mode === "sign-up" ? "sign-up" : "sign-in"}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(mode === "sign-up" ? { name } : {}), email: email.trim(), password }),
      });
      const body = await response.json() as { message?: string; token?: string | null; error?: { message?: string } };
      if (!response.ok) throw new Error(body.message ?? body.error?.message ?? "We could not sign you in. Check your details and try again.");
      if (mode === "sign-up" && !body.token) {
        if (allowUnverifiedPreviewSignup) {
          setMode("sign-in");
          setMessage("Continue by signing in with the email and password you entered.");
        } else {
          setMessage("Check your email for a verification link before signing in.");
        }
        return;
      }
      const requested = new URLSearchParams(window.location.search).get("returnTo");
      const returnTo = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      window.location.assign(returnTo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not reach BuildLoop. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/send-verification-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), callbackURL: publicAppUrl }) });
      if (!response.ok) throw new Error();
      setMessage("If the account needs verification, a link will be sent.");
    } catch { setMessage("We could not send a verification link right now. Try again shortly."); }
    finally { setBusy(false); }
  }

  const title = mode === "sign-in" ? "Welcome back" : mode === "sign-up" ? "Create your account" : "Reset your password";
  const unverified = /email.?not verified|email_not_verified/i.test(message);

  return <main className="auth-page"><section className="auth-card" aria-labelledby="auth-title">
    <span className="eyebrow">BUILDLOOP ACCOUNT</span>
    <h1 id="auth-title">{title}</h1>
    <p>{mode === "forgot" ? "We’ll send a password reset link if an account matches that address." : "Your account keeps your Studio projects and app access connected to you."}</p>
    <form onSubmit={submit}>
      {mode === "sign-up" && <label htmlFor="auth-name">Name<input id="auth-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required /></label>}
      <label htmlFor="auth-email">Email<input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
      {mode !== "forgot" && <label htmlFor="auth-password">Password<input id="auth-password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "sign-in" ? 1 : 12} maxLength={128} required /></label>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Working…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Send reset link"}</button>
    </form>
    {message && <p role="alert" className="auth-error">{message}</p>}
    {resetNotice && <p role="status">{resetNotice}</p>}
    {unverified && <button className="button-link" type="button" disabled={busy} onClick={() => void resendVerification()}>Resend verification email</button>}
    {mode === "sign-in" && <button className="button-link" type="button" onClick={() => { setMode("forgot"); setMessage(""); }}>Forgot password?</button>}
    <p className="auth-switch">{mode === "sign-in" ? "New to BuildLoop?" : mode === "sign-up" ? "Already have an account?" : "Remembered your password?"} <button className="button-link" type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(""); }}>{mode === "sign-in" ? "Create an account" : "Sign in"}</button></p>
  </section></main>;
}

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const token = useSyncExternalStore(subscribeToLocation, getResetToken, () => "");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: password, token }) });
      if (!response.ok) throw new Error("This reset link is invalid or expired. Request another link and try again.");
      window.location.assign("/sign-in?reset=success");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The password could not be reset."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card" aria-labelledby="reset-title"><span className="eyebrow">BUILDLOOP ACCOUNT</span><h1 id="reset-title">Choose a new password</h1><p>Use at least 12 characters. Your existing sessions will be signed out.</p>
    {token ? <form onSubmit={submit}><label htmlFor="reset-password">New password<input id="reset-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form> : <p role="alert">This reset link is incomplete. Request another link from the sign-in page.</p>}
    {message && <p role="alert" className="auth-error">{message}</p>}</section></main>;
}
