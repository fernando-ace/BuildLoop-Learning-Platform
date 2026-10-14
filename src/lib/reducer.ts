import { initialEquipment, initialState, runTest, type MissionState, type TestId } from "./mission";

export type MissionAction =
  | { type: "START" }
  | { type: "ADVANCE" }
  | { type: "ASK"; question: string }
  | { type: "SELECT_PROBLEM"; problem: string }
  | { type: "TOGGLE_FEATURE"; feature: string }
  | { type: "SET_BRIEF"; brief: string }
  | { type: "BUILD"; issues: string[]; quality: MissionState["promptQuality"] }
  | { type: "SET_BORROWER"; borrower: string }
  | { type: "CHECKOUT"; itemId: string; invalid?: boolean }
  | { type: "RETURN"; itemId: string }
  | { type: "RUN_TEST"; test: TestId }
  | { type: "SIMULATE_REFRESH" }
  | { type: "SELECT_FEEDBACK"; feedback: string }
  | { type: "SELECT_ITERATION"; iteration: string }
  | { type: "RETEST" }
  | { type: "SHIP" }
  | { type: "RESTORE"; state: MissionState }
  | { type: "RESET" };

export function missionReducer(state: MissionState, action: MissionAction): MissionState {
  switch (action.type) {
    case "START": return { ...initialState, stage: 1 };
    case "ADVANCE": return { ...state, stage: Math.min(state.stage + 1, 9) };
    case "ASK": return { ...state, questionsAsked: [...state.questionsAsked, action.question] };
    case "SELECT_PROBLEM": return { ...state, problemChoice: action.problem };
    case "TOGGLE_FEATURE": {
      const selectedFeatures = state.selectedFeatures.includes(action.feature)
        ? state.selectedFeatures.filter((id) => id !== action.feature)
        : [...state.selectedFeatures, action.feature];
      return { ...state, selectedFeatures };
    }
    case "SET_BRIEF": return { ...state, brief: action.brief };
    case "BUILD": return { ...state, stage: 5, buildIssues: action.issues, promptQuality: action.quality, equipment: initialEquipment };
    case "SET_BORROWER": return { ...state, borrowerInput: action.borrower };
    case "CHECKOUT": return {
      ...state,
      equipment: state.equipment.map((item) => item.id === action.itemId &&
        (!action.invalid || state.buildIssues.includes("blank-name")) &&
        (item.available || state.buildIssues.includes("double-checkout"))
        ? { ...item, borrower: state.borrowerInput.trim() || "", available: false }
        : item),
    };
    case "RETURN": return {
      ...state,
      equipment: state.equipment.map((item) => item.id === action.itemId ? { ...item, borrower: "", available: true } : item),
    };
    case "RUN_TEST": return {
      ...state,
      testsRun: state.testsRun.includes(action.test) ? state.testsRun : [...state.testsRun, action.test],
      testResults: { ...state.testResults, [action.test]: runTest(state, action.test) },
    };
    case "SIMULATE_REFRESH": return {
      ...state,
      equipment: state.buildIssues.includes("persistence") ? initialEquipment : state.equipment,
      testsRun: state.testsRun.includes("persistence") ? state.testsRun : [...state.testsRun, "persistence"],
      testResults: { ...state.testResults, persistence: runTest(state, "persistence") },
    };
    case "SELECT_FEEDBACK": {
      const feedbackChoices = state.feedbackChoices.includes(action.feedback)
        ? state.feedbackChoices.filter((id) => id !== action.feedback)
        : [...state.feedbackChoices, action.feedback];
      return { ...state, feedbackChoices };
    }
    case "SELECT_ITERATION": return { ...state, iterationChoice: action.iteration, iterationTested: false };
    case "RETEST": {
      const buildIssues = state.buildIssues.filter((issue) =>
        !(state.iterationChoice === "blank" && issue === "blank-name") &&
        !(state.iterationChoice === "return" && issue === "return-confusing"));
      const test: TestId | undefined = state.iterationChoice === "blank" ? "blank-name" : state.iterationChoice === "return" ? "return" : undefined;
      const retested = { ...state, buildIssues, iterationTested: true };
      return test ? {
        ...retested,
        testsRun: state.testsRun.includes(test) ? state.testsRun : [...state.testsRun, test],
        testResults: { ...state.testResults, [test]: runTest(retested, test) },
      } : retested;
    }
    case "SHIP": return { ...state, stage: 9, shipped: true };
    case "RESTORE": return action.state;
    case "RESET": return initialState;
  }
}
