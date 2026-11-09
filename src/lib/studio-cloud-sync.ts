"use client";

import { buildStudioProjectsFromCloud, configureStudioCloudSync, getStudioLearnerSnapshot, getStudioState, replaceStudioProjectsFromCloud } from "./studio-store";
import type { StudioProject } from "./studio";

type StudioRecord = Record<string, unknown> & { appId: string; revision: number };
type StudioLibrary = { learnerId: string; applications: unknown[]; learningRecords: StudioRecord[] };
type SyncState = "loading" | "local" | "syncing" | "synced" | "conflict" | "unavailable";

const listeners = new Set<() => void>();
let state: SyncState = "loading";
let accountId: string | null = null;
let revisions = new Map<string, number>();
let apps = new Set<string>();
let pendingLibrary: StudioLibrary | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let pendingProjects: StudioProject[] = [];
const pendingArchives = new Set<string>();
let initialized = false;

function setState(next: SyncState) { state = next; listeners.forEach((listener) => listener()); }
export function getStudioSyncState() { return state; }
export function subscribeStudioSync(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }

async function requestLibrary(): Promise<StudioLibrary | null> {
  const response = await fetch("/api/learner/studio", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Could not load your Studio projects.");
  return await response.json() as StudioLibrary;
}

async function writeProject(project: StudioProject, expectedRevision: number | null) {
  const response = await fetch("/api/learner/studio", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId: project.id, expectedRevision, learningRecord: getStudioLearnerSnapshot(project) }),
  });
  if (response.status === 409) return null;
  if (!response.ok) throw new Error("Could not save Studio learning notes.");
  return (await response.json() as { record: StudioRecord }).record;
}

function localSignatures(projects: StudioProject[]) {
  return Object.fromEntries(projects.filter((project) => apps.has(project.id)).map((project) => [project.id, JSON.stringify(getStudioLearnerSnapshot(project))]));
}

function getLink() {
  try { return JSON.parse(window.localStorage.getItem("buildloop-studio-v1:cloud-link") ?? "null") as { userId?: unknown; signatures?: Record<string, string> } | null; }
  catch { return null; }
}

function savePendingArchives() {
  try { window.localStorage.setItem("buildloop-studio-v1:pending-archives", JSON.stringify([...pendingArchives])); } catch { /* The local removal remains in effect; the caller can retry account sync. */ }
}

function loadPendingArchives() {
  try {
    const values = JSON.parse(window.localStorage.getItem("buildloop-studio-v1:pending-archives") ?? "[]") as unknown;
    if (Array.isArray(values)) for (const id of values) if (typeof id === "string" && id.startsWith("app_") && id.length <= 80) pendingArchives.add(id);
  } catch { /* Ignore a malformed retry queue; the app remains available through the account library. */ }
}

function setLink(userId: string, projects: StudioProject[]) {
  accountId = userId;
  try { window.localStorage.setItem("buildloop-studio-v1:cloud-link", JSON.stringify({ userId, signatures: localSignatures(projects) })); }
  catch { /* Studio still syncs in this session if browser storage is full. */ }
}

function preserveLocal() {
  try {
    const current = window.localStorage.getItem("buildloop-studio-v1");
    if (current) window.localStorage.setItem("buildloop-studio-v1:pre-cloud-backup", current);
    return true;
  } catch { return false; }
}

function installLibrary(library: StudioLibrary, keepLocalWhenUninitialized = false) {
  accountId = library.learnerId;
  apps = new Set(library.applications.flatMap((application) => application && typeof application === "object" && typeof (application as Record<string, unknown>).id === "string" ? [(application as Record<string, unknown>).id as string] : []));
  revisions = new Map(library.learningRecords.map((record) => [record.appId, record.revision]));
  const local = getStudioState().projects;
  const localById = new Map(local.map((project) => [project.id, project]));
  const recordIds = new Set(library.learningRecords.map((record) => record.appId));
  const archivedIds = [...new Set([...library.learningRecords.filter((record) => record.archived).map((record) => record.appId), ...pendingArchives])];
  const remoteProjects = buildStudioProjectsFromCloud(library.applications, library.learningRecords);
  const projects = remoteProjects.map((project) => keepLocalWhenUninitialized && !recordIds.has(project.id) && localById.has(project.id) ? localById.get(project.id)! : project);
  replaceStudioProjectsFromCloud(projects, archivedIds);
  setLink(library.learnerId, getStudioState().projects);
  pendingLibrary = library;
}

async function drain() {
  if (running || state === "conflict") return;
  running = true;
  try {
    while (pendingProjects.length) {
      const projects = pendingProjects;
      pendingProjects = [];
      setState("syncing");
      for (const project of projects) {
        if (!apps.has(project.id) && !project.id.startsWith("app_")) continue;
        const saved = await writeProject(project, revisions.get(project.id) ?? null);
        if (!saved) {
          revisions = new Map((await requestLibrary())?.learningRecords.map((record) => [record.appId, record.revision]) ?? []);
          pendingProjects = projects;
          const library = await requestLibrary();
          if (library) pendingLibrary = library;
          preserveLocal();
          setState("conflict");
          return;
        }
        revisions.set(project.id, saved.revision);
      }
      setLink(accountId!, getStudioState().projects);
      setState("synced");
    }
  } catch { setState("unavailable"); }
  finally {
    running = false;
    if (pendingProjects.length && getStudioSyncState() !== "conflict") void drain();
  }
}

function queueStudioProjects(projects: StudioProject[]) {
  const queued = new Map(pendingProjects.map((project) => [project.id, project]));
  for (const project of projects) queued.set(project.id, project);
  pendingProjects = [...queued.values()];
  if (!pendingProjects.length) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void drain(); }, 700);
}

export async function initializeStudioCloudSync() {
  if (initialized) return;
  initialized = true;
  try {
    loadPendingArchives();
    const library = await requestLibrary();
    if (!library) { setState("local"); return; }
    accountId = library.learnerId;
    apps = new Set(library.applications.flatMap((application) => application && typeof application === "object" && typeof (application as Record<string, unknown>).id === "string" ? [(application as Record<string, unknown>).id as string] : []));
    revisions = new Map(library.learningRecords.map((record) => [record.appId, record.revision]));
    const localProjects = getStudioState().projects;
    const recordMap = new Map(library.learningRecords.map((record) => [record.appId, record]));
    const link = getLink();
    const signatures = localSignatures(localProjects);
    const changedLocal = localProjects.some((project) => {
      const record = recordMap.get(project.id);
      if (!record) return false;
      return link?.userId !== library.learnerId || link.signatures?.[project.id] !== signatures[project.id];
    });
    if (changedLocal) {
      if (!preserveLocal()) { setState("unavailable"); return; }
      pendingLibrary = library;
      setState("conflict");
      return;
    }
    installLibrary(library, true);
    configureStudioCloudSync(queueStudioProjects, archiveStudioProject);
    setState("synced");
    for (const appId of [...pendingArchives]) await archiveStudioProject(appId);
    const missingRecords = library.applications.some((application) => application && typeof application === "object" && typeof (application as Record<string, unknown>).id === "string" && !recordMap.has((application as Record<string, unknown>).id as string));
    const localAppMissingFromResponse = getStudioState().projects.some((project) => project.id.startsWith("app_") && !apps.has(project.id));
    if (missingRecords || localAppMissingFromResponse) queueStudioProjects(getStudioState().projects);
  } catch { setState("unavailable"); }
}

export function retryStudioCloudSync() {
  initialized = false;
  setState("loading");
  void initializeStudioCloudSync();
}

export async function selectStudioAccountCopy() {
  if (!pendingLibrary) return;
  try {
    if (!preserveLocal()) { setState("unavailable"); return; }
    installLibrary(pendingLibrary);
    configureStudioCloudSync(queueStudioProjects, archiveStudioProject);
    setState("synced");
  } catch { setState("unavailable"); }
}

export async function keepStudioThisDeviceCopy() {
  if (!pendingLibrary) return;
  try {
    const library = await requestLibrary();
    if (!library) { setState("local"); return; }
    const localProjects = getStudioState().projects;
    try { window.localStorage.setItem("buildloop-studio-v1:account-backup", JSON.stringify(library.learningRecords)); }
    catch { setState("unavailable"); return; }
    accountId = library.learnerId;
    apps = new Set(library.applications.flatMap((application) => application && typeof application === "object" && typeof (application as Record<string, unknown>).id === "string" ? [(application as Record<string, unknown>).id as string] : []));
    revisions = new Map(library.learningRecords.map((record) => [record.appId, record.revision]));
    for (const project of localProjects) {
      if (!apps.has(project.id)) continue;
      const saved = await writeProject(project, revisions.get(project.id) ?? null);
      if (!saved) { pendingLibrary = await requestLibrary(); setState("conflict"); return; }
      revisions.set(project.id, saved.revision);
    }
    const remoteProjects = buildStudioProjectsFromCloud(library.applications, library.learningRecords);
    const merged = [...localProjects, ...remoteProjects.filter((project) => !localProjects.some((local) => local.id === project.id))];
    replaceStudioProjectsFromCloud(merged);
    setLink(library.learnerId, merged);
    pendingLibrary = library;
    configureStudioCloudSync(queueStudioProjects, archiveStudioProject);
    setState("synced");
  } catch { setState("unavailable"); }
}

async function archiveStudioProject(appId: string) {
  pendingArchives.add(appId);
  savePendingArchives();
  if (!accountId) return;
  let response: Response;
  try { response = await fetch(`/api/learner/studio?appId=${encodeURIComponent(appId)}`, { method: "DELETE" }); }
  catch { setState("unavailable"); return; }
  if (!response.ok) { setState("unavailable"); return; }
  pendingArchives.delete(appId);
  savePendingArchives();
  apps.delete(appId);
  revisions.delete(appId);
  setState("synced");
}
