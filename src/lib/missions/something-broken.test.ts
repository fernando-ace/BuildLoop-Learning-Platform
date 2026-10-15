import { describe, expect, it } from "vitest";
import {
  initialMission5Progress,
  initialMission5State,
  mission5Build,
  mission5Reducer,
  mission5RetestPassed,
  mission5Scores,
  mission5Summary,
  recordMission5Attempt,
} from "./something-broken";

function reproduce() {
  let state = mission5Reducer(initialMission5State, { type: "START" });
  state = mission5Reducer(state, { type: "ADVANCE" });
  state = mission5Reducer(state, { type: "JOIN_FIRST" });
  state = mission5Reducer(state, { type: "LEAVE_FIRST" });
  state = mission5Reducer(state, { type: "ADVANCE" });
  return state;
}

function retest(state: ReturnType<typeof reproduce>) {
  state = mission5Reducer(state, { type: "JOIN_RETEST" });
  return mission5Reducer(state, { type: "LEAVE_RETEST" });
}

describe("Mission 5 deterministic repair loop", () => {
  it("requires joining and leaving to reproduce the original bug", () => {
    let state = mission5Reducer(initialMission5State, { type: "START" });
    state = mission5Reducer(state, { type: "ADVANCE" });
    expect(mission5Reducer(state, { type: "ADVANCE" }).stage).toBe(2);
    state = mission5Reducer(state, { type: "JOIN_FIRST" });
    expect(mission5Reducer(state, { type: "ADVANCE" }).stage).toBe(2);
    state = mission5Reducer(state, { type: "LEAVE_FIRST" });
    expect(mission5Reducer(state, { type: "ADVANCE" }).stage).toBe(3);
  });

  it("uses observed behavior as evidence to fix both membership and seat count", () => {
    let state = mission5Reducer(mission5Reducer(reproduce(), { type: "SELECT_REPORT", id: "evidence" }), { type: "SEND_REPORT" });
    expect(mission5Build(state)).toEqual({ artMembership: true, artSeat: true, nearbyWorks: true });
    expect(mission5RetestPassed(state)).toBe(false);
    state = retest(state);
    expect(mission5RetestPassed(state)).toBe(true);
    expect(mission5Reducer(state, { type: "ADVANCE" }).stage).toBe(7);
  });

  it("makes the vague first repair incomplete and the evidence follow-up effective", () => {
    let state = mission5Reducer(mission5Reducer(reproduce(), { type: "SELECT_REPORT", id: "vague" }), { type: "SEND_REPORT" });
    state = retest(state);
    expect(mission5RetestPassed(state)).toBe(false);
    state = mission5Reducer(state, { type: "FOLLOW_UP", id: "evidence" });
    state = mission5Reducer(state, { type: "BUILD_AGAIN" });
    expect(mission5RetestPassed(state)).toBe(false);
    state = retest(state);
    expect(mission5RetestPassed(state)).toBe(true);
    expect(mission5Summary(state).lessons[1]).toContain("less useful evidence");
  });

  it("makes the internal-code assumption fix one part while breaking nearby behavior", () => {
    let state = mission5Reducer(mission5Reducer(reproduce(), { type: "SELECT_REPORT", id: "assumption" }), { type: "SEND_REPORT" });
    expect(mission5Build(state)).toEqual({ artMembership: true, artSeat: false, nearbyWorks: false });
    state = retest(state);
    state = mission5Reducer(state, { type: "FOLLOW_UP", id: "evidence" });
    state = mission5Reducer(state, { type: "BUILD_AGAIN" });
    state = retest(state);
    expect(mission5RetestPassed(state)).toBe(true);
    expect(mission5Build(state).nearbyWorks).toBe(false);
  });

  it("scores the whole loop and retains attempt history and best scores", () => {
    let state = mission5Reducer(mission5Reducer(reproduce(), { type: "SELECT_REPORT", id: "evidence" }), { type: "SEND_REPORT" });
    state = retest(state);
    state = mission5Reducer(state, { type: "ADVANCE" });
    state = mission5Reducer(state, { type: "JOIN_NEARBY" });
    state = mission5Reducer(state, { type: "LEAVE_NEARBY" });
    state = mission5Reducer(state, { type: "ADVANCE" });
    state = mission5Reducer(state, { type: "DECIDE", choice: "share" });
    const scores = mission5Scores(state);
    expect(scores.map(({ name, score }) => [name, score])).toEqual([
      ["User understanding", 100], ["AI communication", 100], ["Testing", 100],
      ["Feedback", 100], ["Iteration", 100], ["Reviewing AI work", 100], ["Shipping", 100],
    ]);
    const first = recordMission5Attempt(initialMission5Progress, state, 1);
    const weaker = recordMission5Attempt(first, reproduce(), 2);
    expect(weaker.attempts).toHaveLength(2);
    expect(weaker.latestSkillResults.find((skill) => skill.name === "Testing")?.score).toBe(0);
    expect(weaker.bestSkillResults.find((skill) => skill.name === "Testing")?.score).toBe(100);
  });
});
