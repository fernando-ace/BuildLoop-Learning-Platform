import { describe, expect, it } from "vitest";
import { buildMission4V2, initialMission4Progress, initialMission4State, mission4Definition, mission4Reducer, mission4Scores, mission4TaskPassed, recordMission4Attempt, type PlanningId } from "./what-next";

function throughGoal(goal: "focused" | "vague" | "broad" | "micromanaged", planning: PlanningId = "evidence") {
  let state = mission4Reducer(initialMission4State, { type: "START" });
  state = mission4Reducer(state, { type: "ADVANCE" });
  state = mission4Reducer(state, { type: "PLAN", id: planning });
  state = mission4Reducer(state, { type: "ADVANCE" });
  state = mission4Reducer(state, { type: "GOAL", id: goal });
  return mission4Reducer(state, { type: "ADVANCE" });
}

describe("Mission 4: What Should We Build Next?", () => {
  it("uses the planning choice to select a distinct deterministic reply", () => {
    expect(new Set(mission4Definition.planningChoices.map((choice) => mission4Definition.planningReplies[choice.id]))).toHaveProperty("size", 4);
  });

  it("makes vague, overbroad, micromanaged, and focused goals change the build differently", () => {
    expect(buildMission4V2("vague").canLeave).toBe(false);
    expect(buildMission4V2("broad")).toMatchObject({ hasExtras: true, canLeave: true, restoresSeat: false });
    expect(buildMission4V2("micromanaged")).toMatchObject({ hasTinyControl: true, canLeave: true, restoresSeat: false });
    expect(buildMission4V2("focused")).toMatchObject({ canLeave: true, restoresSeat: true, hasExtras: false });
  });

  it("requires the learner to interact with both versions before the task can be recorded", () => {
    let state = throughGoal("focused");
    state = mission4Reducer(state, { type: "JOIN" });
    expect(state.firstObserved).toBe(false);
    state = mission4Reducer(state, { type: "LEAVE" });
    state = mission4Reducer(state, { type: "OBSERVE" });
    expect(state.firstObserved).toBe(true);
    state = mission4Reducer(state, { type: "FOLLOW_UP", id: "focused" });
    state = mission4Reducer(state, { type: "BUILD" });
    expect(mission4Reducer(state, { type: "ADVANCE" }).stage).toBe(6);
    state = mission4Reducer(state, { type: "JOIN_RETEST" });
    expect(mission4Reducer(state, { type: "ADVANCE" }).stage).toBe(6);
    state = mission4Reducer(state, { type: "LEAVE_RETEST" });
    state = mission4Reducer(state, { type: "ADVANCE" });
    expect(state.stage).toBe(7);
    expect(mission4TaskPassed(state, true)).toBe(true);
  });

  it("uses focused feedback to fix a failed seat count and preserves the signup flow", () => {
    expect(buildMission4V2("broad").restoresSeat).toBe(false);
    expect(buildMission4V2("broad", "focused")).toEqual({ canLeave: true, restoresSeat: true, hasExtras: true, hasTinyControl: false });
  });

  it("allows stopping after a successful first try, but not after a failed one", () => {
    let state = throughGoal("focused");
    state = mission4Reducer(state, { type: "JOIN" });
    state = mission4Reducer(state, { type: "LEAVE" });
    state = mission4Reducer(state, { type: "OBSERVE" });
    expect(mission4Reducer(state, { type: "SKIP_FOLLOW_UP" }).stage).toBe(7);
    let weak = throughGoal("vague");
    weak = mission4Reducer(weak, { type: "JOIN" });
    weak = mission4Reducer(weak, { type: "LEAVE" });
    weak = mission4Reducer(weak, { type: "OBSERVE" });
    expect(mission4Reducer(weak, { type: "SKIP_FOLLOW_UP" }).stage).toBe(5);
  });

  it("rewards a final choice that matches the observed result", () => {
    const passed = { ...throughGoal("focused"), joined: true, left: true, firstObserved: true, retestJoined: true, retestLeft: true, followUp: "focused" as const, finalChoice: "ship" as const };
    const failed = { ...throughGoal("vague"), joined: true, left: true, firstObserved: true, retestJoined: true, retestLeft: true, followUp: "vague" as const, finalChoice: "ship" as const };
    expect(mission4Scores(passed).find((skill) => skill.name === "Shipping")?.score).toBe(100);
    expect(mission4Scores(failed).find((skill) => skill.name === "Shipping")?.score).toBe(25);
  });

  it("records attempts, latest scores, and per-skill best scores without replacing history", () => {
    const state = { ...throughGoal("focused"), planning: "evidence" as const, followUp: "focused" as const, firstObserved: true, retestJoined: true, retestLeft: true };
    const first = recordMission4Attempt(initialMission4Progress, state, 1);
    const replay = recordMission4Attempt(first, { ...state, planning: "ideas", goal: "vague", finalChoice: "improve" }, 2);
    expect(replay.attempts.map((attempt) => attempt.number)).toEqual([1, 2]);
    expect(replay.latestSkillResults).toEqual(mission4Scores({ ...state, planning: "ideas", goal: "vague", finalChoice: "improve" }));
    expect(replay.bestSkillResults.find((item) => item.name === "User understanding")?.score).toBe(100);
  });
});
