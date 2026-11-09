import { initialState, type MissionState } from "./mission";
import { missionReducer, type MissionAction } from "./reducer";
import { completeAttempt, initialLearnerProgress, startAttempt, type LearnerProgress } from "./learner";
import { skillScores } from "./mission";
import { initialMission2Progress, initialMission2State, mission2Reducer, recordMission2Attempt, type Mission2Action, type Mission2Progress, type Mission2State } from "./missions/the-vague-request";
import { initialMission3Progress, initialMission3State, mission3Reducer, recordMission3Attempt, type Mission3Action, type Mission3Progress, type Mission3State } from "./missions/one-prompt-wont-do-it";
import { initialMission4Progress, initialMission4State, mission4Reducer, recordMission4Attempt, type Mission4Action, type Mission4Progress, type Mission4State } from "./missions/what-next";
import { initialMission5Progress, initialMission5State, mission5Reducer, recordMission5Attempt, type Mission5Action, type Mission5Progress, type Mission5State } from "./missions/something-broken";
import { initialMission6Progress, initialMission6State, mission6Reducer, recordMission6Attempt, type Mission6Action, type Mission6Progress, type Mission6State } from "./missions/build-it-for-real";

const storageKey = "buildloop-learner-v2";
const listeners = new Set<() => void>();
let cloudSync: ((snapshot: Record<string, unknown>) => void) | null = null;
let currentState = initialState;
let learnerProgress = initialLearnerProgress;
let mission2State = initialMission2State;
let mission2Progress = initialMission2Progress;
let mission2AttemptCount = 0;
let mission3State = initialMission3State;
let mission3Progress = initialMission3Progress;
let mission4State = initialMission4State;
let mission4Progress = initialMission4Progress;
let mission5State = initialMission5State;
let mission5Progress = initialMission5Progress;
let mission6State = initialMission6State;
let mission6Progress = initialMission6Progress;
let activeMission: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1;
let loaded = false;

function safeMissionOneState() {
  return currentState.buildIssues?.includes("persistence") ? { ...currentState, equipment: initialState.equipment } : currentState;
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as { state?: MissionState; progress?: LearnerProgress; mission2State?: Mission2State; mission2Progress?: Mission2Progress; mission2AttemptCount?: number; mission3State?: Mission3State; mission3Progress?: Mission3Progress; mission4State?: Mission4State; mission4Progress?: Mission4Progress; mission5State?: Mission5State; mission5Progress?: Mission5Progress; mission6State?: Mission6State; mission6Progress?: Mission6Progress; activeMission?: 0 | 1 | 2 | 3 | 4 | 5 | 6 };
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
      if (parsed.mission4State && typeof parsed.mission4State.stage === "number") mission4State = parsed.mission4State;
      if (parsed.mission4Progress && Array.isArray(parsed.mission4Progress.attempts)) mission4Progress = parsed.mission4Progress;
      if (parsed.mission5State && typeof parsed.mission5State.stage === "number") mission5State = parsed.mission5State;
      if (parsed.mission5Progress && Array.isArray(parsed.mission5Progress.attempts)) mission5Progress = parsed.mission5Progress;
      if (parsed.mission6State && typeof parsed.mission6State.stage === "number") mission6State = { ...initialMission6State, ...parsed.mission6State };
      if (parsed.mission6Progress && Array.isArray(parsed.mission6Progress.attempts)) mission6Progress = parsed.mission6Progress;
      if (parsed.activeMission === 0) activeMission = 0;
      if (parsed.activeMission === 2 && learnerProgress.completed) activeMission = 2;
      if (parsed.activeMission === 3 && mission2Progress.completed) activeMission = 3;
      if (parsed.activeMission === 4 && mission3Progress.completed) activeMission = 4;
      if (parsed.activeMission === 5 && mission4Progress.completed) activeMission = 5;
      if (parsed.activeMission === 6 && mission5Progress.completed) activeMission = 6;
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

export function getCloudLearnerSnapshot(): Record<string, unknown> {
  ensureLoaded();
  return {
    activeMission,
    mission1State: safeMissionOneState(),
    mission1Progress: learnerProgress,
    mission2State, mission2Progress, mission2AttemptCount,
    mission3State, mission3Progress,
    mission4State, mission4Progress,
    mission5State, mission5Progress,
    mission6State, mission6Progress,
  };
}

export function getInitialCloudLearnerSnapshot(): Record<string, unknown> {
  return {
    activeMission: 1,
    mission1State: initialState, mission1Progress: initialLearnerProgress,
    mission2State: initialMission2State, mission2Progress: initialMission2Progress, mission2AttemptCount: 0,
    mission3State: initialMission3State, mission3Progress: initialMission3Progress,
    mission4State: initialMission4State, mission4Progress: initialMission4Progress,
    mission5State: initialMission5State, mission5Progress: initialMission5Progress,
    mission6State: initialMission6State, mission6Progress: initialMission6Progress,
  };
}

export function configureLearnerCloudSync(sync: ((snapshot: Record<string, unknown>) => void) | null) {
  cloudSync = sync;
}

export function readLocalLearnerSave() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey) ?? window.localStorage.getItem("buildloop-mission-v1");
  } catch { return null; }
}

export function applyCloudLearnerSnapshot(value: Record<string, unknown>) {
  if (typeof value.activeMission !== "number" || value.activeMission < 0 || value.activeMission > 6) return false;
  const isRecord = (item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item));
  const isMissionState = (item: unknown) => isRecord(item) && typeof item.stage === "number";
  const isProgress = (item: unknown) => isRecord(item) && Array.isArray(item.attempts);
  const isMissionOneProgress = (item: unknown) => isRecord(item) && typeof item.attempts === "number";
  if (!isMissionState(value.mission1State) || !isMissionOneProgress(value.mission1Progress)) return false;
  if (![2, 3, 4, 5, 6].every((number) => isMissionState(value[`mission${number}State`]) && isProgress(value[`mission${number}Progress`]))) return false;
  ensureLoaded();
  currentState = value.mission1State as unknown as MissionState;
  currentState = safeMissionOneState();
  learnerProgress = value.mission1Progress as unknown as LearnerProgress;
  mission2State = value.mission2State as unknown as Mission2State;
  mission2Progress = value.mission2Progress as unknown as Mission2Progress;
  mission2AttemptCount = typeof value.mission2AttemptCount === "number" ? value.mission2AttemptCount : mission2Progress.attempts.length;
  mission3State = value.mission3State as unknown as Mission3State;
  mission3Progress = value.mission3Progress as unknown as Mission3Progress;
  mission4State = value.mission4State as unknown as Mission4State;
  mission4Progress = value.mission4Progress as unknown as Mission4Progress;
  mission5State = value.mission5State as unknown as Mission5State;
  mission5Progress = value.mission5Progress as unknown as Mission5Progress;
  mission6State = value.mission6State as unknown as Mission6State;
  mission6Progress = value.mission6Progress as unknown as Mission6Progress;
  activeMission = value.activeMission as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  persist();
  listeners.forEach((listener) => listener());
  return true;
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
export function getMission4State() { ensureLoaded(); return mission4State; }
export function getMission4Progress() { ensureLoaded(); return mission4Progress; }
export function getServerMission4State() { return initialMission4State; }
export function getServerMission4Progress() { return initialMission4Progress; }
export function getMission5State() { ensureLoaded(); return mission5State; }
export function getMission5Progress() { ensureLoaded(); return mission5Progress; }
export function getServerMission5State() { return initialMission5State; }
export function getServerMission5Progress() { return initialMission5Progress; }
export function getMission6State() { ensureLoaded(); return mission6State; }
export function getMission6Progress() { ensureLoaded(); return mission6Progress; }
export function getServerMission6State() { return initialMission6State; }
export function getServerMission6Progress() { return initialMission6Progress; }

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

export function startMission4() {
  if (!getMission3Progress().completed) return;
  activeMission = 4;
  if (mission4State.stage === 0 || mission4State.stage === 8) mission4State = mission4Reducer(mission4State, { type: "START" });
  persist();
  listeners.forEach((listener) => listener());
}

export function startMission5() {
  if (!getMission4Progress().completed) return;
  activeMission = 5;
  if (mission5State.stage === 0 || mission5State.stage === 8) mission5State = mission5Reducer(mission5State, { type: "START" });
  persist();
  listeners.forEach((listener) => listener());
}

export function startMission6() {
  if (!getMission5Progress().completed) return;
  activeMission = 6;
  if (mission6State.stage === 0 || mission6State.stage === 11) mission6State = mission6Reducer(mission6State, { type: "START" });
  persist();
  listeners.forEach((listener) => listener());
}

export function dispatchMission6(action: Mission6Action) {
  if (action.type === "RETURN") activeMission = 0;
  else {
    const previous = getMission6State();
    mission6State = mission6Reducer(previous, action);
    if (action.type === "START" && (previous.stage === 0 || previous.stage === 11)) activeMission = 6;
    if (action.type === "DECIDE" && previous.stage === 10 && !previous.finalChoice) {
      mission6Progress = recordMission6Attempt(mission6Progress, mission6State, mission6Progress.attempts.length + 1);
    }
  }
  persist();
  listeners.forEach((listener) => listener());
}

export function dispatchMission5(action: Mission5Action) {
  if (action.type === "RETURN") activeMission = 0;
  else {
    const previous = getMission5State();
    mission5State = mission5Reducer(previous, action);
    if (action.type === "START" && (previous.stage === 0 || previous.stage === 8)) activeMission = 5;
    if (action.type === "DECIDE" && previous.stage === 8 && !previous.finalChoice) {
      mission5Progress = recordMission5Attempt(mission5Progress, mission5State, mission5Progress.attempts.length + 1);
    }
  }
  persist();
  listeners.forEach((listener) => listener());
}

export function dispatchMission4(action: Mission4Action) {
  const previous = getMission4State();
  if (action.type === "RETURN") activeMission = 0;
  else mission4State = mission4Reducer(previous, action);
  if (action.type === "FINAL" && previous.stage === 7) mission4Progress = recordMission4Attempt(mission4Progress, mission4State, mission4Progress.attempts.length + 1);
  if (action.type === "START") activeMission = 4;
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
    const savedState = safeMissionOneState();
    const snapshot = { state: savedState, progress: learnerProgress, mission2State, mission2Progress, mission2AttemptCount, mission3State, mission3Progress, mission4State, mission4Progress, mission5State, mission5Progress, mission6State, mission6Progress, activeMission };
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // The mission remains playable if local storage is unavailable.
  }
  try { cloudSync?.(getCloudLearnerSnapshot()); } catch { /* A sync callback must not interrupt local learner actions. */ }
}
