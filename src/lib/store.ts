import { initialState, type MissionState } from "./mission";
import { missionReducer, type MissionAction } from "./reducer";
import { completeAttempt, initialLearnerProgress, startAttempt, type LearnerProgress } from "./learner";
import { skillScores } from "./mission";
import { initialMission2Progress, initialMission2State, mission2Reducer, recordMission2Attempt, type Mission2Action, type Mission2Progress, type Mission2State } from "./missions/the-vague-request";

const storageKey = "buildloop-learner-v2";
const listeners = new Set<() => void>();
let currentState = initialState;
let learnerProgress = initialLearnerProgress;
let mission2State = initialMission2State;
let mission2Progress = initialMission2Progress;
let mission2AttemptCount = 0;
let activeMission: 1 | 2 = 1;
let loaded = false;

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as { state?: MissionState; progress?: LearnerProgress; mission2State?: Mission2State; mission2Progress?: Mission2Progress; mission2AttemptCount?: number; activeMission?: 1 | 2 };
      if (parsed.state && typeof parsed.state.stage === "number" && Array.isArray(parsed.state.equipment)) {
        currentState = parsed.state.buildIssues?.includes("persistence")
          ? { ...parsed.state, equipment: initialState.equipment }
          : parsed.state;
        if (parsed.progress && typeof parsed.progress.attempts === "number") learnerProgress = parsed.progress;
      }
      if (parsed.mission2State && typeof parsed.mission2State.stage === "number") mission2State = parsed.mission2State;
      if (parsed.mission2Progress && Array.isArray(parsed.mission2Progress.attempts)) mission2Progress = parsed.mission2Progress;
      if (typeof parsed.mission2AttemptCount === "number") mission2AttemptCount = parsed.mission2AttemptCount;
      if (parsed.activeMission === 2 && learnerProgress.completed) activeMission = 2;
      return;
    }
    // Keep progress from existing Mission 1 installations when upgrading the save format.
    const legacy = window.localStorage.getItem("buildloop-mission-v1");
    if (legacy) {
      const parsed = JSON.parse(legacy) as MissionState;
      if (parsed && typeof parsed.stage === "number" && Array.isArray(parsed.equipment)) {
        currentState = parsed.buildIssues?.includes("persistence") ? { ...parsed, equipment: initialState.equipment } : parsed;
        const migratedProgress = { ...initialLearnerProgress, attempts: parsed.stage > 0 ? 1 : 0, currentAttempt: parsed.stage > 0 ? 1 : 0 };
        learnerProgress = parsed.shipped ? completeAttempt(migratedProgress, skillScores(parsed)) : migratedProgress;
        persist();
      }
    }
  } catch {
    window.localStorage.removeItem(storageKey);
  }
}

export function getMissionState() {
  ensureLoaded();
  return currentState;
}

export function getLearnerProgress() {
  ensureLoaded();
  return learnerProgress;
}

export function getServerLearnerProgress() {
  return initialLearnerProgress;
}

export function getServerMissionState() {
  return initialState;
}

export function getActiveMission() { ensureLoaded(); return activeMission; }
export function getMission2State() { ensureLoaded(); return mission2State; }
export function getMission2Progress() { ensureLoaded(); return mission2Progress; }
export function getServerMission2State() { return initialMission2State; }
export function getServerMission2Progress() { return initialMission2Progress; }

export function startMission2() {
  if (!getLearnerProgress().completed) return;
  activeMission = 2;
  if (mission2State.stage === 0 || mission2State.stage === 10) {
    mission2State = mission2Reducer(mission2State, { type: "START" });
    mission2AttemptCount += 1;
  }
  persist();
  listeners.forEach((listener) => listener());
}

export function dispatchMission2(action: Mission2Action) {
  const previous = getMission2State();
  mission2State = mission2Reducer(previous, action);
  if (action.type === "SHIP" && previous.stage !== 10) {
    mission2Progress = recordMission2Attempt(mission2Progress, mission2State, mission2AttemptCount);
  }
  if (action.type === "RETURN") activeMission = 1;
  persist();
  listeners.forEach((listener) => listener());
}

export function subscribeMission(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dispatchMission(action: MissionAction) {
  const previous = getMissionState();
  currentState = missionReducer(previous, action);
  if (action.type === "START") learnerProgress = startAttempt(learnerProgress);
  if (action.type === "START") activeMission = 1;
  if (action.type === "SHIP" && !previous.shipped) learnerProgress = completeAttempt(learnerProgress, skillScores(currentState));
  persist();
  listeners.forEach((listener) => listener());
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const savedState = currentState.buildIssues.includes("persistence")
      ? { ...currentState, equipment: initialState.equipment }
      : currentState;
    window.localStorage.setItem(storageKey, JSON.stringify({ state: savedState, progress: learnerProgress, mission2State, mission2Progress, mission2AttemptCount, activeMission }));
  } catch {
    // The mission remains playable if local storage is unavailable.
  }
}
