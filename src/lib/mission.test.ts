import { describe, expect, it } from "vitest";
import {
  costOf,
  evaluateBrief,
  featureCatalog,
  getBuildIssues,
  initialState,
  makeBuilderSummary,
  runTest,
  skillScores,
  type MissionState,
} from "./mission";
import { missionReducer } from "./reducer";

const fullCore = ["list", "checkout", "borrower", "return", "persistence"];
const clearBrief = "Build an equipment tracker for Ari's photography club officers. Show the list. Members can check out an available item with a borrower name and return it with an easy to find button. Reject blank names and prevent checkout when already unavailable. Do not add accounts or reservations. Test checkout, return, blank names, double checkout, and refresh; done when all pass.";

describe("Mission 1 learning mechanics", () => {
  it("starts a mission and records discovery questions", () => {
    let state = missionReducer(initialState, { type: "START" });
    state = missionReducer(state, { type: "ASK", question: "breaks" });
    expect(state.stage).toBe(1);
    expect(state.questionsAsked).toEqual(["breaks"]);
  });

  it("records the selected problem statement", () => {
    const state = missionReducer(initialState, { type: "SELECT_PROBLEM", problem: "equipment" });
    expect(state.problemChoice).toBe("equipment");
  });

  it("calculates MVP budget and exposes a non-unique set of viable choices", () => {
    expect(costOf(fullCore)).toBe(5);
    expect(costOf([...fullCore, "dark-mode"])).toBe(6);
    expect(costOf([...fullCore, "reservations"])).toBe(7);
    expect(costOf([...fullCore, "accounts"])).toBe(8);
    expect(featureCatalog.length).toBeGreaterThan(5);
  });

  it("toggles feature scope without mutating the original state", () => {
    const once = missionReducer(initialState, { type: "TOGGLE_FEATURE", feature: "list" });
    const twice = missionReducer(once, { type: "TOGGLE_FEATURE", feature: "list" });
    expect(once.selectedFeatures).toEqual(["list"]);
    expect(twice.selectedFeatures).toEqual([]);
    expect(initialState.selectedFeatures).toEqual([]);
  });

  it("evaluates a brief by clear content, not exact wording", () => {
    const quality = evaluateBrief(clearBrief);
    expect(quality).toEqual({ context: 25, behavior: 25, boundaries: 25, verification: 25, total: 100 });
    expect(evaluateBrief("Make a little app please.").total).toBe(0);
  });

  it("build outcome changes deterministically with the brief and selected scope", () => {
    const wellDirected = getBuildIssues({ selectedFeatures: fullCore, brief: clearBrief, promptQuality: evaluateBrief(clearBrief) });
    expect(wellDirected).toEqual([]);
    expect(getBuildIssues({ selectedFeatures: fullCore, brief: "Build a tracker.", promptQuality: evaluateBrief("Build a tracker.") })).toEqual([
      "blank-name", "double-checkout", "return-confusing", "extra-feature",
    ]);
  });

  it("sends the evaluated build to the next stage with the measured brief quality", () => {
    const quality = evaluateBrief(clearBrief);
    const issues = getBuildIssues({ selectedFeatures: fullCore, brief: clearBrief, promptQuality: quality });
    const built = missionReducer(initialState, { type: "BUILD", issues, quality });
    expect(built.stage).toBe(5);
    expect(built.promptQuality.total).toBe(100);
    expect(built.buildIssues).toEqual([]);
  });

  it("allows working interactions and reproduces build defects", () => {
    let state: MissionState = {
      ...initialState,
      selectedFeatures: fullCore,
      buildIssues: ["blank-name", "double-checkout"],
      borrowerInput: "",
    };
    state = missionReducer(state, { type: "CHECKOUT", itemId: "camera", invalid: true });
    expect(state.equipment.find((item) => item.id === "camera")?.available).toBe(false);
    state = missionReducer(state, { type: "RETURN", itemId: "camera" });
    expect(state.equipment.find((item) => item.id === "camera")?.available).toBe(true);
    expect(state.equipment.find((item) => item.id === "camera")?.borrower).toBe("");
  });

  it("reports failures when tests detect the simulated defects", () => {
    const state: MissionState = { ...initialState, selectedFeatures: fullCore, buildIssues: ["blank-name", "double-checkout", "persistence"] };
    expect(runTest(state, "checkout").passed).toBe(true);
    expect(runTest(state, "return").passed).toBe(true);
    expect(runTest(state, "blank-name").passed).toBe(false);
    expect(runTest(state, "double-checkout").passed).toBe(false);
    expect(runTest(state, "persistence").passed).toBe(false);
  });

  it("simulates state loss after refresh when persistence was not built", () => {
    const state: MissionState = {
      ...initialState,
      buildIssues: ["persistence"],
      equipment: initialState.equipment.map((item) => item.id === "camera" ? { ...item, available: false, borrower: "Ari" } : item),
    };
    const refreshed = missionReducer(state, { type: "SIMULATE_REFRESH" });
    expect(refreshed.equipment.find((item) => item.id === "camera")?.available).toBe(true);
    expect(refreshed.testResults.persistence?.passed).toBe(false);
    expect(refreshed.testsRun).toContain("persistence");
  });

  it("records tests and deterministic results", () => {
    const state = missionReducer(initialState, { type: "RUN_TEST", test: "blank-name" });
    expect(state.testsRun).toEqual(["blank-name"]);
    expect(state.testResults["blank-name"]).toEqual(runTest(initialState, "blank-name"));
  });

  it("uses selected feedback to evaluate judgment", () => {
    const state: MissionState = { ...initialState, feedbackChoices: ["return"] };
    expect(skillScores(state).find((score) => score.name === "Feedback judgment")?.score).toBe(100);
    const suggestionOnly: MissionState = { ...initialState, feedbackChoices: ["dark"] };
    expect(skillScores(suggestionOnly).find((score) => score.name === "Feedback judgment")?.score).toBe(48);
  });

  it("rewards a focused core MVP over spending spare points on extra features", () => {
    const focused: MissionState = { ...initialState, selectedFeatures: fullCore };
    const padded: MissionState = { ...initialState, selectedFeatures: [...fullCore, "dark-mode"] };
    expect(skillScores(focused).find((score) => score.name === "Scope discipline")?.score).toBe(100);
    expect(skillScores(padded).find((score) => score.name === "Scope discipline")?.score).toBe(92);
  });

  it("does not claim an unrelated iteration checked Ari's key evidence", () => {
    const state: MissionState = { ...initialState, iterationChoice: "dark", iterationTested: true };
    const iterationScore = skillScores(state).find((score) => score.name === "Iteration");
    expect(iterationScore?.score).toBe(42);
    expect(iterationScore?.explanation).toContain("did not address the clearest evidence");
  });

  it("focused retest repairs the selected issue while preserving the other build behavior", () => {
    const state: MissionState = { ...initialState, buildIssues: ["blank-name", "double-checkout", "persistence"], iterationChoice: "blank" };
    const result = missionReducer(state, { type: "RETEST" });
    expect(result.iterationTested).toBe(true);
    expect(result.buildIssues).toEqual(["double-checkout", "persistence"]);
  });

  it("generates skill scores and builder summary from the player's actual choices", () => {
    const state: MissionState = {
      ...initialState,
      stage: 9,
      shipped: true,
      problemChoice: "equipment",
      selectedFeatures: fullCore,
      testsRun: ["checkout", "blank-name"],
      testResults: { checkout: { passed: true, detail: "ok" }, "blank-name": { passed: false, detail: "bug" } },
      feedbackChoices: ["return"],
      iterationChoice: "return",
      iterationTested: true,
    };
    expect(skillScores(state).map((score) => score.score)).toEqual([0, 100, 100, 0, 40, 100, 100]);
    expect(skillScores(state)).toEqual(skillScores(state));
    const summary = makeBuilderSummary(state);
    expect(summary.problem).toContain("Ari cannot quickly tell");
    expect(summary.mvp).toHaveLength(5);
    expect(summary.tests.map((test) => test.id)).toEqual(["checkout", "blank-name"]);
    expect(summary.feedback).toContain("Observed Ari pause while returning gear");
    expect(summary.iteration).toContain("Return easier to find");
    expect(summary.iterationReason).toContain("Observed Ari pause");
    expect(summary.finalEquipment).toHaveLength(4);
  });
});
