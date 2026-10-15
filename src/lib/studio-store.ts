import { initialStudioState, type StudioProject, type StudioState, type StudioStage } from "./studio";

const key = "buildloop-studio-v1";
const listeners = new Set<() => void>();
let state: StudioState = initialStudioState;
let loaded = false;
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const value = window.localStorage.getItem(key);
    if (value) {
      const parsed = JSON.parse(value) as StudioState;
      if (parsed && Array.isArray(parsed.projects)) state = parsed;
    }
  } catch { state = initialStudioState; }
}
export function getStudioState() { load(); return state; }
export function getServerStudioState() { return initialStudioState; }
export function subscribeStudio(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
function save(next: StudioState) {
  state = next;
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(state));
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
export function openStudioProject(id: string | null) { save({ ...getStudioState(), activeId: id, screen: id ? "project" : "new" }); }
export function showStudioHub() { save({ ...getStudioState(), activeId: null, screen: "hub" }); }
export function showMissions() { save({ ...getStudioState(), activeId: null, screen: "missions" }); }
export function deleteStudioProject(id: string) {
  const current = getStudioState();
  const projects = current.projects.filter((project) => project.id !== id);
  save({ projects, activeId: current.activeId === id ? null : current.activeId, screen: current.activeId === id ? "hub" : current.screen });
}
export function setStudioStage(id: string, stage: StudioStage) { updateStudioProject(id, (project) => ({ ...project, stage })); }
