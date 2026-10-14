import { initialState, type MissionState } from "./mission";
import { missionReducer, type MissionAction } from "./reducer";

const storageKey = "buildloop-mission-v1";
const listeners = new Set<() => void>();
let currentState = initialState;
let loaded = false;

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    const parsed = JSON.parse(saved) as MissionState;
    if (parsed && typeof parsed.stage === "number" && Array.isArray(parsed.equipment)) {
      currentState = parsed.buildIssues?.includes("persistence")
        ? { ...parsed, equipment: initialState.equipment }
        : parsed;
    }
  } catch {
    window.localStorage.removeItem(storageKey);
  }
}

export function getMissionState() {
  ensureLoaded();
  return currentState;
}

export function getServerMissionState() {
  return initialState;
}

export function subscribeMission(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dispatchMission(action: MissionAction) {
  currentState = missionReducer(getMissionState(), action);
  if (typeof window !== "undefined") {
    try {
      const savedState = currentState.buildIssues.includes("persistence")
        ? { ...currentState, equipment: initialState.equipment }
        : currentState;
      window.localStorage.setItem(storageKey, JSON.stringify(savedState));
    } catch {
      // The mission remains playable if local storage is unavailable.
    }
  }
  listeners.forEach((listener) => listener());
}
