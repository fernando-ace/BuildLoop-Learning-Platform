import { initialStudioState, type StudioMigrationProvenance, type StudioProject, type StudioState, type StudioStage } from "./studio";

const key = "buildloop-studio-v1";
const cloudLinkKey = `${key}:cloud-link`;
const listeners = new Set<() => void>();
let state: StudioState = initialStudioState;
let loaded = false;
let storageMessage = "";
let cloudSync: ((projects: StudioProject[]) => void) | null = null;
let cloudArchive: ((projectId: string) => void) | null = null;
let applyingCloud = false;
export function getStudioStorageMessage() { return storageMessage; }
export function migrateStudioProject(value: unknown): StudioProject | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<StudioProject>;
  if (typeof p.id !== "string" || typeof p.name !== "string" || !Array.isArray(p.versions) || !Array.isArray(p.features) || !Array.isArray(p.observations) || !Array.isArray(p.feedback)) return null;
  const project = { ...p, user: typeof p.user === "string" ? p.user : "", problem: typeof p.problem === "string" ? p.problem : "", why: typeof p.why === "string" ? p.why : "", behavior: typeof p.behavior === "string" ? p.behavior : "", constraints: typeof p.constraints === "string" ? p.constraints : "", instruction: typeof p.instruction === "string" ? p.instruction : "", brief: p.brief && typeof p.brief === "object" ? p.brief : null, nextGoal: typeof p.nextGoal === "string" ? p.nextGoal : "", shareDecision: p.shareDecision === "ready" || p.shareDecision === "keep_working" ? p.shareDecision : "", stage: ["idea", "scope", "brief", "try", "feedback", "goal", "retest", "summary"].includes(String(p.stage)) ? p.stage! : "idea", createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date(0).toISOString(), updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date(0).toISOString(), versions: p.versions.filter((v) => v && typeof v === "object" && typeof v.instruction === "string" && v.result && typeof v.result === "object" && typeof v.result.title === "string" && typeof v.result.description === "string").map((v) => ({ ...v, observations: Array.isArray(v.observations) ? v.observations : [], feedback: Array.isArray(v.feedback) ? v.feedback : [] })), build: p.build?.status === "building" || p.build?.status === "validating" ? { status: "failed" as const, attempts: p.build.attempts ?? 1, message: "The last build stopped when Studio was closed. Your work is safe; try again." } : p.build } as StudioProject;
  return project;
}
function isMigrationProvenance(value: unknown): value is StudioMigrationProvenance {
  if (!value || typeof value !== "object") return false;
  const migration = value as Partial<StudioMigrationProvenance>;
  return Number.isInteger(migration.sourceVersion) && Number.isInteger(migration.targetVersion) && typeof migration.completedAt === "string"
    && Number.isInteger(migration.sourceRecords) && Number.isInteger(migration.migratedRecords) && Number.isInteger(migration.createdRecords)
    && Number.isInteger(migration.removedRecords) && Number.isInteger(migration.defaultedValues)
    && ["migrated", "initialized", "warning", "fallback"].includes(String(migration.status))
    && Array.isArray(migration.changes) && migration.changes.every((item) => item && typeof item.kind === "string")
    && Array.isArray(migration.warnings) && migration.warnings.every((item) => typeof item === "string");
}
export function migrateStudioState(value: unknown): StudioState {
  if (!value || typeof value !== "object" || !Array.isArray((value as Partial<StudioState>).projects)) return initialStudioState;
  const stored = value as Partial<StudioState>;
  const projects = stored.projects!.map(migrateStudioProject).filter((p): p is StudioProject => p !== null);
  const activeId = typeof stored.activeId === "string" && projects.some((p) => p.id === stored.activeId) ? stored.activeId : null;
  const screen = ["missions", "hub", "new", "project"].includes(String(stored.screen)) ? stored.screen! : "hub";
  return { projects, activeId, screen };
}
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const value = window.localStorage.getItem(key);
    if (value) {
      state = migrateStudioState(JSON.parse(value));
    }
  } catch { state = initialStudioState; storageMessage = "Saved Studio data could not be read. This device’s original save has been left untouched."; }
}
export function getStudioState() { load(); return state; }
export function getServerStudioState() { return initialStudioState; }
export function subscribeStudio(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function configureStudioCloudSync(sync: ((projects: StudioProject[]) => void) | null, archive?: (projectId: string) => void) { cloudSync = sync; cloudArchive = archive ?? null; }

export function getStudioLearnerSnapshot(project: StudioProject) {
  return {
    stage: project.stage,
    projectNotes: {
      user: project.user, problem: project.problem, why: project.why, behavior: project.behavior, constraints: project.constraints,
      instruction: project.instruction, brief: project.brief, nextGoal: project.nextGoal, shareDecision: project.shareDecision,
    },
    features: project.features,
    observations: project.observations,
    feedback: project.feedback,
    versionNotes: project.versions.map(({ number, instruction, builtAt, notes, tested, observations, feedback, retestedVersion, migration }) => ({ number, instruction, builtAt, notes, tested, observations: observations ?? [], feedback: feedback ?? [], retestedVersion: retestedVersion ?? null, ...(migration ? { migration } : {}) })),
  };
}

export function buildStudioProjectsFromCloud(applications: unknown, learningRecords: unknown): StudioProject[] {
  if (!Array.isArray(applications)) return [];
  const records = new Map<string, Record<string, unknown>>();
  if (Array.isArray(learningRecords)) for (const value of learningRecords) {
    if (value && typeof value === "object" && typeof (value as Record<string, unknown>).appId === "string") records.set((value as Record<string, unknown>).appId as string, value as Record<string, unknown>);
  }
  return applications.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const app = value as Record<string, unknown>;
    if (typeof app.id !== "string" || typeof app.name !== "string") return [];
    const record = records.get(app.id);
    const notes = record && record.projectNotes && typeof record.projectNotes === "object" ? record.projectNotes as Record<string, unknown> : {};
    const brief = app.brief && typeof app.brief === "object" ? app.brief as Record<string, unknown> : {};
    const versionNotes = Array.isArray(record?.versionNotes) ? record.versionNotes as Record<string, unknown>[] : [];
    const versions = Array.isArray(app.versions) ? app.versions.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const version = item as Record<string, unknown>;
      const number = Number(version.number);
      if (!Number.isInteger(number) || number < 1 || typeof version.title !== "string" || typeof version.description !== "string") return [];
      const learner = versionNotes.find((note) => note.number === number) ?? {};
      const provider = version.provider === "openai" || version.provider === "deterministic" ? version.provider : "demo";
      return [{
        number, versionId: typeof version.versionId === "string" ? version.versionId : `v${number}`, instruction: typeof learner.instruction === "string" ? learner.instruction : "", builtAt: typeof version.builtAt === "string" ? version.builtAt : new Date(0).toISOString(), status: "complete" as const,
        notes: typeof learner.notes === "string" ? learner.notes : "", tested: learner.tested === true,
        observations: Array.isArray(learner.observations) ? learner.observations.filter((note): note is string => typeof note === "string") : [],
        feedback: Array.isArray(learner.feedback) ? learner.feedback.filter((note): note is string => typeof note === "string") : [],
        retestedVersion: typeof learner.retestedVersion === "number" ? learner.retestedVersion : undefined,
        migration: isMigrationProvenance(learner.migration) ? learner.migration : undefined,
        result: { title: version.title, description: version.description, instruction: typeof version.instruction === "string" ? version.instruction : "", provider, attempts: typeof version.attempts === "number" ? version.attempts : 1 },
      }];
    }) : [];
    const project = migrateStudioProject({
      id: app.id, name: app.name, user: notes.user ?? brief.user, problem: notes.problem ?? brief.problem, why: notes.why ?? brief.why,
      behavior: notes.behavior, constraints: notes.constraints, instruction: notes.instruction, brief: notes.brief,
      nextGoal: notes.nextGoal, shareDecision: notes.shareDecision, stage: record?.stage ?? "idea",
      features: record?.features ?? [], observations: record?.observations ?? [], feedback: record?.feedback ?? [],
      versions, createdAt: app.createdAt, updatedAt: record?.updatedAt ?? app.createdAt,
    });
    return project ? [project] : [];
  });
}

export function replaceStudioProjectsFromCloud(projects: StudioProject[], archivedIds: string[] = [], preserveUnlinkedLocal = true) {
  applyingCloud = true;
  try {
    const local = getStudioState();
    const cloudIds = new Set(projects.map((project) => project.id));
    const excluded = new Set(archivedIds);
    const retainedLocal = preserveUnlinkedLocal ? local.projects.filter((project) => !cloudIds.has(project.id) && !excluded.has(project.id)) : [];
    const hydratedProjects = projects.map((project) => {
      const previous = local.projects.find((item) => item.id === project.id);
      if (!previous) return project;
      return { ...project, versions: project.versions.map((version) => {
        const localVersion = previous.versions.find((item) => item.number === version.number);
        return localVersion?.result.artifact ? { ...version, result: { ...version.result, artifact: localVersion.result.artifact } } : version;
      }) };
    });
    const projectsWithLocal = [...hydratedProjects, ...retainedLocal];
    const activeExists = local.activeId !== null && projectsWithLocal.some((project) => project.id === local.activeId);
    state = { ...local, projects: projectsWithLocal, activeId: activeExists ? local.activeId : null, screen: local.activeId && !activeExists ? "hub" : local.screen };
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(key, JSON.stringify(state)); storageMessage = ""; }
      catch { storageMessage = "The account copy loaded, but this browser could not save its local backup."; }
    }
    listeners.forEach((listener) => listener());
  } finally { applyingCloud = false; }
}

export function captureStudioLocalCopy(userId: string): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    const current = window.localStorage.getItem(key) ?? JSON.stringify(getStudioState());
    const link = window.localStorage.getItem(cloudLinkKey);
    window.localStorage.setItem(`${key}:account-copy:${encodeURIComponent(userId)}`, JSON.stringify({ current, link }));
    return true;
  } catch { return false; }
}

/** Switch the browser's visible Studio cache to one learner without merging another learner's local projects. */
export function restoreStudioLocalCopy(userId: string): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    const stored = window.localStorage.getItem(`${key}:account-copy:${encodeURIComponent(userId)}`);
    let next = initialStudioState;
    let link: string | null = null;
    if (stored) {
      const copy = JSON.parse(stored) as { current?: unknown; link?: unknown };
      if (typeof copy.current === "string") next = migrateStudioState(JSON.parse(copy.current));
      if (typeof copy.link === "string") link = copy.link;
    }
    state = next;
    loaded = true;
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(cloudLinkKey);
    window.localStorage.setItem(key, JSON.stringify(state));
    if (link) window.localStorage.setItem(cloudLinkKey, link);
    listeners.forEach((listener) => listener());
    return true;
  } catch { return false; }
}
function save(next: StudioState, syncProjectId?: string) {
  state = next;
  if (typeof window !== "undefined") {
    try { const serialized = JSON.stringify(state); if (serialized.length > 2_000_000) throw new Error("limit"); window.localStorage.setItem(key, serialized); storageMessage = ""; }
    catch { storageMessage = "Studio reached this browser’s 2 MB project history limit. Your current changes remain open, but remove an older version or clear browser storage before continuing."; }
  }
  listeners.forEach((listener) => listener());
  if (!applyingCloud) {
    try { cloudSync?.(syncProjectId ? state.projects.filter((project) => project.id === syncProjectId) : []); } catch { /* A cloud failure must not interrupt Studio work. */ }
  }
}
export function updateStudioProject(id: string, update: (project: StudioProject) => StudioProject) {
  const current = getStudioState();
  const now = new Date().toISOString();
  save({ ...current, projects: current.projects.map((project) => project.id === id ? { ...update(project), updatedAt: now } : project) }, id);
}
export function createStudioProject(project: StudioProject) {
  const current = getStudioState();
  save({ projects: [project, ...current.projects], activeId: project.id, screen: "project" }, project.id);
}
export function openStudioProject(id: string | null) {
  const current = getStudioState();
  const projects = current.projects.map((project) => project.id === id && (project.build?.status === "building" || project.build?.status === "validating") ? { ...project, build: { status: "failed" as const, attempts: project.build.attempts, message: "The last build stopped before Studio could save it. Your project is safe; try again." } } : project);
  save({ ...current, projects, activeId: id, screen: id ? "project" : "new" });
}
export function showStudioHub() { save({ ...getStudioState(), activeId: null, screen: "hub" }); }
export function showMissions() { save({ ...getStudioState(), activeId: null, screen: "missions" }); }
export function deleteStudioProject(id: string) {
  const current = getStudioState();
  const projects = current.projects.filter((project) => project.id !== id);
  save({ projects, activeId: current.activeId === id ? null : current.activeId, screen: current.activeId === id ? "hub" : current.screen });
  if (typeof window !== "undefined") {
    const prefix = `buildloop-runtime-v2:${encodeURIComponent(id)}:`;
    try { for (let index = window.localStorage.length - 1; index >= 0; index -= 1) { const keyAtIndex = window.localStorage.key(index); if (keyAtIndex?.startsWith(prefix)) window.localStorage.removeItem(keyAtIndex); } } catch { /* Removing the project still succeeds if browser storage is unavailable. */ }
  }
  try { cloudArchive?.(id); } catch { /* Removing the local project still succeeds while account sync recovers. */ }
}
export function setStudioStage(id: string, stage: StudioStage) { updateStudioProject(id, (project) => ({ ...project, stage })); }
