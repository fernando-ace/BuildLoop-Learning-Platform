"use client";

import { applyCloudLearnerSnapshot, captureLocalLearnerCopy, configureLearnerCloudSync, getCloudLearnerSnapshot, getInitialCloudLearnerSnapshot, readLocalLearnerSave, restoreLocalLearnerCopy } from "./store";

type CloudRecord = Record<string, unknown> & { revision: number; updatedAt: string };
type SyncState = "loading" | "local" | "syncing" | "synced" | "conflict" | "unavailable" | "switching";
type CloudResponse = { learnerId: string; progress: CloudRecord | null };

const listeners = new Set<() => void>();
let state: SyncState = "loading";
let revision: number | null = null;
let pending: Record<string, unknown> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let initialized = false;
let accountId: string | null = null;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const snapshotKeys = ["activeMission", "mission1State", "mission1Progress", "mission2State", "mission2Progress", "mission2AttemptCount", "mission3State", "mission3Progress", "mission4State", "mission4Progress", "mission5State", "mission5Progress", "mission6State", "mission6Progress"];
function localSignature(snapshot: Record<string, unknown>) { return canonical(Object.fromEntries(snapshotKeys.map((key) => [key, snapshot[key]]))); }

function linkedUserId() {
  try {
    const value = JSON.parse(window.localStorage.getItem("buildloop-learner-v2:cloud-link") ?? "null") as { userId?: unknown } | null;
    return typeof value?.userId === "string" ? value.userId : null;
  } catch { return null; }
}

function writeLink(userId: string, snapshot: Record<string, unknown>) {
  accountId = userId;
  try { window.localStorage.setItem("buildloop-learner-v2:cloud-link", JSON.stringify({ userId, cleanSnapshot: localSignature(snapshot) })); } catch { /* Account sync remains available for this session if the browser is full. */ }
}

function hasUnchangedLinkedCopy(userId: string, snapshot: Record<string, unknown>) {
  try {
    const link = JSON.parse(window.localStorage.getItem("buildloop-learner-v2:cloud-link") ?? "null") as { userId?: unknown; cleanSnapshot?: unknown } | null;
    return link?.userId === userId && link.cleanSnapshot === localSignature(snapshot);
  } catch { return false; }
}

function setState(next: SyncState) { state = next; listeners.forEach((listener) => listener()); }
export function getLearnerSyncState() { return state; }
export function subscribeLearnerSync(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }

async function requestCurrent(): Promise<CloudResponse | null> {
  const response = await fetch("/api/learner/progress", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Could not load account learning progress.");
  const result = await response.json() as CloudResponse;
  return result;
}

async function write(snapshot: Record<string, unknown>, expectedRevision: number | null) {
  const response = await fetch("/api/learner/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision, progress: snapshot }),
  });
  if (response.status === 409) return null;
  if (!response.ok) throw new Error("Could not save account learning progress.");
  return (await response.json() as { progress: CloudRecord }).progress;
}

function preserveLocal() {
  const save = readLocalLearnerSave();
  if (!save) return true;
  try { window.localStorage.setItem("buildloop-learner-v2:pre-cloud-backup", save); } catch { return false; }
  return true;
}

async function drain() {
  if (running || !pending || state === "conflict") return;
  running = true;
  try {
    while (pending) {
      const snapshot = pending;
      pending = null;
      setState("syncing");
      const stored = await write(snapshot, revision);
      if (!stored) {
        revision = (await requestCurrent())?.progress?.revision ?? null;
        pending = snapshot;
        setState("conflict");
        return;
      }
      revision = stored.revision;
      writeLink(accountId!, snapshot);
      setState("synced");
    }
  } catch {
    setState("unavailable");
  } finally {
    running = false;
    if (pending && getLearnerSyncState() !== "conflict") void drain();
  }
}

function queue(snapshot: Record<string, unknown>) {
  pending = snapshot;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void drain(); }, 350);
}

export async function initializeLearnerCloudSync() {
  if (initialized) return;
  initialized = true;
  try {
    const server = await requestCurrent();
    if (!server) { setState("local"); return; }
    const previousUserId = linkedUserId();
    if (previousUserId && previousUserId !== server.learnerId) {
      setState("switching");
      pending = null;
      if (timer) clearTimeout(timer);
      timer = null;
      if (!captureLocalLearnerCopy(previousUserId) && !preserveLocal()) return;
      if (!restoreLocalLearnerCopy(server.learnerId)) return;
    }
    accountId = server.learnerId;
    if (!server.progress) {
      if (readLocalLearnerSave() && linkedUserId() && linkedUserId() !== server.learnerId) {
        setState("conflict");
        return;
      }
      const snapshot = getCloudLearnerSnapshot();
      const stored = await write(snapshot, null);
      if (!stored) {
        const concurrent = await requestCurrent();
        if (concurrent?.progress) {
          revision = concurrent.progress.revision;
          preserveLocal();
          setState("conflict");
          return;
        }
        setState("unavailable");
        return;
      }
      revision = stored.revision;
      writeLink(server.learnerId, snapshot);
      configureLearnerCloudSync(queue);
      setState("synced");
      return;
    }
    revision = server.progress.revision;
    const hadLocalSave = Boolean(readLocalLearnerSave());
    const localSnapshot = getCloudLearnerSnapshot();
    if (hadLocalSave && !hasUnchangedLinkedCopy(server.learnerId, localSnapshot)) {
      if (!preserveLocal()) { setState("unavailable"); return; }
      setState("conflict");
      return;
    }
    applyCloudLearnerSnapshot(server.progress);
    writeLink(server.learnerId, server.progress);
    configureLearnerCloudSync(queue);
    setState("synced");
  } catch {
    setState(linkedUserId() ? "switching" : "unavailable");
  }
}

export function retryLearnerCloudSync() {
  initialized = false;
  setState("loading");
  void initializeLearnerCloudSync();
}

export async function keepThisBrowserProgress() {
  if (state !== "conflict") return;
  try {
    const response = await requestCurrent();
    if (!response) { setState("local"); return; }
    accountId = response.learnerId;
    const remote = response.progress;
    if (remote) {
      try { window.localStorage.setItem("buildloop-learner-v2:account-backup", JSON.stringify(remote)); }
      catch { setState("unavailable"); return; }
    }
    revision = remote?.revision ?? null;
    const stored = await write(getCloudLearnerSnapshot(), revision);
    if (!stored) { revision = (await requestCurrent())?.progress?.revision ?? revision; return; }
    revision = stored.revision;
    writeLink(accountId!, getCloudLearnerSnapshot());
    configureLearnerCloudSync(queue);
    setState("synced");
  } catch { setState("unavailable"); }
}

export async function selectAccountProgress() {
  try {
    const server = await requestCurrent();
    if (!server) { setState("local"); return; }
    if (!preserveLocal()) { setState("unavailable"); return; }
    accountId = server.learnerId;
    revision = server.progress?.revision ?? null;
    pending = null;
    if (timer) clearTimeout(timer);
    configureLearnerCloudSync(null);
    const accountSnapshot = server.progress ?? getInitialCloudLearnerSnapshot();
    applyCloudLearnerSnapshot(accountSnapshot);
    if (!server.progress) {
      const stored = await write(accountSnapshot, null);
      if (!stored) { setState("conflict"); return; }
      revision = stored.revision;
    }
    writeLink(server.learnerId, accountSnapshot);
    configureLearnerCloudSync(queue);
    setState("synced");
  } catch { setState("unavailable"); }
}
