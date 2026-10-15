import { describe, expect, it } from "vitest";
import { initialMission6Progress, initialMission6State, mission6Build, mission6Definition, mission6NearbyPassed, mission6Reducer, mission6RetestPassed, mission6Scores, mission6Summary, recordMission6Attempt, type Mission6State } from "./build-it-for-real";

function stateAt(stage: number, extra: Partial<Mission6State> = {}): Mission6State {
  return { ...initialMission6State, stage, ...extra };
}

const core = mission6Definition.features.filter((item) => item.core).map((item) => item.id);

describe("Mission 6: Build It for Real", () => {
  it("lets learners investigate only what they need and preserves the answers they uncover", () => {
    const state = mission6Reducer(stateAt(1), { type: "ASK", id: "pain" });
    expect(state.questionsAsked).toEqual(["pain"]);
    expect(mission6Reducer(state, { type: "ADVANCE" }).stage).toBe(2);
    expect(mission6Scores(state).find((skill) => skill.name === "Problem definition")?.score).toBe(58);
  });

  it("produces a useful first version for focused discovery, scope, and instruction", () => {
    const build = mission6Build(stateAt(4, { questionsAsked: ["pain", "task", "edge"], selectedFeatures: core, brief: "focused" }));
    expect(build).toMatchObject({ signup: true, confirmed: true, capacity: true, coverage: true, overlap: true, extras: 0, discovery: true });
  });

  it("shows the overlap failure when the learner misses the real problem", () => {
    const build = mission6Build(stateAt(4, { selectedFeatures: ["shifts", "signup", "capacity"], brief: "vague" }));
    expect(build.overlap).toBe(false);
  });

  it("makes excessive scope visible in the product and scoring", () => {
    const state = stateAt(4, { selectedFeatures: [...core, "profiles", "announcements", "analytics", "themes"] });
    expect(mission6Build(state).extras).toBe(4);
    expect(mission6Build(state).coverage).toBe(false);
    expect(mission6Scores(state).find((skill) => skill.name === "Scope")?.score).toBe(52);
  });

  it("distinguishes a vague Builder instruction from a focused outcome", () => {
    expect(mission6Scores(stateAt(3, { selectedFeatures: core, brief: "vague" })).find((skill) => skill.name === "AI communication")?.score).toBe(20);
    expect(mission6Scores(stateAt(3, { selectedFeatures: core, brief: "focused" })).find((skill) => skill.name === "AI communication")?.score).toBe(100);
  });

  it("rewards observed signup problems over low-value feature requests", () => {
    const important = mission6Scores(stateAt(6, { feedbackChoices: ["overlap"] }));
    const lowValue = mission6Scores(stateAt(6, { feedbackChoices: ["profiles", "leaderboard"] }));
    expect(important.find((skill) => skill.name === "Feedback")?.score).toBe(100);
    expect(lowValue.find((skill) => skill.name === "Feedback")?.score).toBe(35);
  });

  it("distinguishes a focused next goal from a broad one", () => {
    expect(mission6Build(stateAt(8, { selectedFeatures: core, goal: "focused", buildCount: 1 })).overlap).toBe(true);
    expect(mission6Build(stateAt(8, { selectedFeatures: core, goal: "broad", buildCount: 1 })).overlap).toBe(false);
    expect(mission6Scores(stateAt(6, { goal: "focused" })).find((skill) => skill.name === "Iteration")?.score).toBe(65);
    expect(mission6Scores(stateAt(6, { goal: "broad" })).find((skill) => skill.name === "Iteration")?.score).toBe(30);
  });

  it("allows a focused first repair and requires the signup steps to be repeated", () => {
    const v2 = stateAt(8, { selectedFeatures: core, brief: "vague", goal: "focused", buildCount: 1, retestSignup: true, retestOverlapTried: true });
    expect(mission6RetestPassed(v2)).toBe(true);
    expect(mission6Scores(v2).find((skill) => skill.name === "Iteration")?.score).toBe(100);
    expect(mission6Reducer({ ...v2, retestOverlapTried: false }, { type: "ADVANCE" }).stage).toBe(8);
  });

  it("lets a clear follow-up repair an incomplete first change", () => {
    let state = stateAt(8, { selectedFeatures: core, goal: "vague", buildCount: 1, retestSignup: true, retestOverlapTried: true });
    expect(mission6RetestPassed(state)).toBe(false);
    state = mission6Reducer(state, { type: "FOLLOW_UP", id: "evidence" });
    state = mission6Reducer(state, { type: "BUILD" });
    expect(state.buildCount).toBe(2);
    expect(state.retestSignup).toBe(false);
    state = mission6Reducer(state, { type: "SIGNUP", area: "retest" });
    state = mission6Reducer(state, { type: "OVERLAP", area: "retest" });
    expect(mission6RetestPassed(state)).toBe(true);
  });

  it("models an implementation guess that repairs overlap but breaks the space limit", () => {
    const state = stateAt(9, { selectedFeatures: core, goal: "guess", buildCount: 1, retestSignup: true, retestOverlapTried: true, nearbyFirst: true, nearbyOverbookTried: true });
    expect(mission6RetestPassed(state)).toBe(true);
    expect(mission6NearbyPassed(state)).toBe(false);
    expect(mission6Summary(state).nearby).toContain("third volunteer");
  });

  it("requires the nearby space-limit action and catches its regression", () => {
    const before = stateAt(9, { selectedFeatures: core, goal: "guess", buildCount: 1, overlapTried: true, retestOverlapTried: true, nearbyFirst: true });
    expect(mission6NearbyPassed(before)).toBe(false);
    const after = mission6Reducer(before, { type: "OVERBOOK" });
    expect(mission6NearbyPassed(after)).toBe(false);
    expect(mission6Scores(after).find((skill) => skill.name === "Reviewing AI work")?.score).toBe(100);
  });

  it("matches the share decision to the observed final state", () => {
    const checked = stateAt(11, { selectedFeatures: core, goal: "focused", buildCount: 1, retestSignup: true, retestOverlapTried: true, nearbyFirst: true, nearbyOverbookTried: true, finalChoice: "share" });
    const incomplete = { ...checked, nearbyOverbookTried: false };
    expect(mission6Scores(checked).find((skill) => skill.name === "Shipping")?.score).toBe(100);
    expect(mission6Scores(incomplete).find((skill) => skill.name === "Shipping")?.score).toBe(20);
    expect(mission6Scores({ ...incomplete, finalChoice: "improve" }).find((skill) => skill.name === "Shipping")?.score).toBe(100);
  });

  it("scores deterministically and keeps each completed attempt with best and latest skills", () => {
    const strong = stateAt(11, { questionsAsked: ["users", "current", "pain", "task", "edge"], selectedFeatures: core, brief: "focused", goal: "focused", buildCount: 1, firstSignup: true, overlapTried: true, feedbackChoices: ["overlap"], retestSignup: true, retestOverlapTried: true, nearbyFirst: true, nearbyOverbookTried: true, finalChoice: "share" });
    const skills = mission6Scores(strong);
    expect(skills).toEqual(mission6Scores(strong));
    const first = recordMission6Attempt(initialMission6Progress, strong, 1);
    const second = recordMission6Attempt(first, { ...strong, questionsAsked: [], finalChoice: "improve" }, 2);
    expect(second.attempts).toHaveLength(2);
    expect(second.attempts[0].summary.investigation).toContain("uncovered");
    expect(second.latestSkillResults).toEqual(mission6Scores({ ...strong, questionsAsked: [], finalChoice: "improve" }));
    expect(second.bestSkillResults.find((item) => item.name === "User understanding")?.score).toBe(100);
  });

  it("keeps Mission 6 save records optional for older course saves", () => {
    const oldSave = { state: { stage: 0 }, progress: { completed: true, attempts: 1 }, activeMission: 5 };
    expect("mission6State" in oldSave).toBe(false);
    expect(initialMission6State.stage).toBe(0);
    expect(initialMission6Progress.completed).toBe(false);
  });
});
