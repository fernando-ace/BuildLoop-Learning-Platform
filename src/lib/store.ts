import { initialState, type MissionState } from "./mission";
import { missionReducer, type MissionAction } from "./reducer";
import { completeAttempt, initialLearnerProgress, startAttempt, type LearnerProgress } from "./learner";
import { skillScores } from "./mission";
import { initialMission2Progress, initialMission2State, mission2Reducer, recordMission2Attempt, type Mission2Action, type Mission2Progress, type Mission2State } from "./missions/the-vague-request";
import { initialMission3Progress, initialMission3State, mission3Reducer, recordMission3Attempt, type Mission3Action, type Mission3Progress, type Mission3State } from "./missions/one-prompt-wont-do-it";

const storageKey = "buildloop-learner-v2";
const listeners = new Set<() => void>();
let currentState = initialState;
let learnerProgress = initialLearnerProgress;
let mission2State = initialMission2State;
let mission2Progress = initialMission2Progress;
let mission2AttemptCount = 0;
let mission3State = initialMission3State;
let mission3Progress = initialMission3Progress;
let activeMission: 1 | 2 | 3 = 1;
let loaded = false;

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as { state?: MissionState; progress?: LearnerProgress; mission2State?: Mission2State; mission2Progress?: Mission2Progress; mission2AttemptCount?: number; mission3State?: Mission3State; mission3Progress?: Mission3Progress; activeMission?: 1 | 2 | 3 };
      if (parsed.state && typeof parsed.state.stage === "number" && Array.isArray(parsed.state.equipment)) {
        currentState = parsed.state.buildIssues?.includes("persistence")
          ? { ...parsed.state, equipment: initialState.equipment }
          : parsed.state;
        if (parsed.progress && typeof parsed.progress.attempts === "number") learnerProgress = parsed.progress;
      }
      if (parsed.mission2State && typeof parsed.mission2State.stage === "number") mission2State = parsed.mission2State;
      if (parsed.mission2Progress && Array.isArray(parsed.mission2Progress.attempts)) mission2Progress = parsed.mission2Progress;
      if (typeof parsed.mission2AttemptCount === "number") mission2AttemptCount = parsed.mission2AttemptCount;
      if (parsed.mission3State && typeof parsed.mission3State.stage === "number") mission3State = parsed.mission3State;
      if (parsed.mission3Progress && Array.isArray(parsed.mission3Progress.attempts)) mission3Progress = parsed.mission3Progress;
      if (parsed.activeMission === 2 && learnerProgress.completed) activeMission = 2;
      if (parsed.activeMission === 3 && mission2Progress.completed) activeMission = 3;
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
export function getMission3State() { ensureLoaded(); return mission3State; }
export function getMission3Progress() { ensureLoaded(); return mission3Progress; }
export function getServerMission3State() { return initialMission3State; }
export function getServerMission3Progress() { return initialMission3Progress; }

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

export function startMission3() {
  if (!getMission2Progress().completed) return;
  activeMission = 3;
  if (mission3State.stage === 0 || mission3State.stage === 8) mission3State = mission3Reducer(mission3State, { type: "START" });
  persist();
  listeners.forEach((listener) => listener());
}

export function dispatchMission3(action: Mission3Action) {
  if (action.type === "RETURN") {
    activeMission = 1;
    persist();
    listeners.forEach((listener) => listener());
    return;
  }
  const previous = getMission3State();
  mission3State = mission3Reducer(previous, action);
  if (action.type === "FINAL" && previous.stage !== 8) mission3Progress = recordMission3Attempt(mission3Progress, mission3State, mission3Progress.attempts.length + 1);
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
    window.localStorage.setItem(storageKey, JSON.stringify({ state: savedState, progress: learnerProgress, mission2State, mission2Progress, mission2AttemptCount, mission3State, mission3Progress, activeMission }));
  } catch {
    // The mission remains playable if local storage is unavailable.
  }
}
