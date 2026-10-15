import { initialStudioState, type StudioProject, type StudioState, type StudioStage } from "./studio";

const key = "buildloop-studio-v1";
const listeners = new Set<() => void>();
let state: StudioState = initialStudioState;
let loaded = false;
let storageMessage = "";
export function getStudioStorageMessage() { return storageMessage; }
export function migrateStudioProject(value: unknown): StudioProject | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<StudioProject>;
  if (typeof p.id !== "string" || typeof p.name !== "string" || !Array.isArray(p.versions) || !Array.isArray(p.features) || !Array.isArray(p.observations) || !Array.isArray(p.feedback)) return null;
  const project = { ...p, user: typeof p.user === "string" ? p.user : "", problem: typeof p.problem === "string" ? p.problem : "", why: typeof p.why === "string" ? p.why : "", behavior: typeof p.behavior === "string" ? p.behavior : "", constraints: typeof p.constraints === "string" ? p.constraints : "", instruction: typeof p.instruction === "string" ? p.instruction : "", brief: p.brief && typeof p.brief === "object" ? p.brief : null, nextGoal: typeof p.nextGoal === "string" ? p.nextGoal : "", shareDecision: p.shareDecision === "ready" || p.shareDecision === "keep_working" ? p.shareDecision : "", stage: ["idea", "scope", "brief", "try", "feedback", "goal", "retest", "summary"].includes(String(p.stage)) ? p.stage! : "idea", createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date(0).toISOString(), updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date(0).toISOString(), versions: p.versions.filter((v) => v && typeof v === "object" && typeof v.instruction === "string" && v.result && typeof v.result === "object" && typeof v.result.title === "string" && typeof v.result.description === "string").map((v) => ({ ...v, observations: Array.isArray(v.observations) ? v.observations : [], feedback: Array.isArray(v.feedback) ? v.feedback : [] })), build: p.build?.status === "building" || p.build?.status === "validating" ? { status: "failed" as const, attempts: p.build.attempts ?? 1, message: "The last build stopped when Studio was closed. Your work is safe; try again." } : p.build } as StudioProject;
  return project;
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
function save(next: StudioState) {
  state = next;
  if (typeof window !== "undefined") {
    try { const serialized = JSON.stringify(state); if (serialized.length > 2_000_000) throw new Error("limit"); window.localStorage.setItem(key, serialized); storageMessage = ""; }
    catch { storageMessage = "Studio reached this browser’s 2 MB project history limit. Your current changes remain open, but remove an older version or clear browser storage before continuing."; }
  }
  listeners.forEach((listener) => listener());
}
export function updateStudioProject(id: string, update: (project: StudioProject) => StudioProject) {
  const current = getStudioState();
  const now = new Date().toISOString();
  save({ ...current, projects: current.projects.map((project) => project.id === id ? { ...update(project), updatedAt: now } : project) });
}
export function createStudioProject(project: StudioProject) {
  const current = getStudioState();
  save({ projects: [project, ...current.projects], activeId: project.id, screen: "project" });
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
}
export function setStudioStage(id: string, stage: StudioStage) { updateStudioProject(id, (project) => ({ ...project, stage })); }
