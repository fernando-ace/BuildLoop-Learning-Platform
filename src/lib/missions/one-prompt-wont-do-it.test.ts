import { describe, expect, it } from "vitest";
import { buildMission3V1, buildMission3V2, initialMission3Progress, initialMission3State, mission3Reducer, mission3Scores, mission3Summary, recordMission3Attempt } from "./one-prompt-wont-do-it";

function toRetest(followUp: "vague" | "rewrite" | "broken" | "focused" = "focused") {
  let state = mission3Reducer(initialMission3State, { type: "START" });
  state = mission3Reducer(state, { type: "ADVANCE" });
  state = mission3Reducer(state, { type: "PROMPT", id: "focused" });
  state = mission3Reducer(state, { type: "BUILD_V1" });
  state = mission3Reducer(state, { type: "JOIN" });
  state = mission3Reducer(state, { type: "OBSERVE" });
  state = mission3Reducer(state, { type: "FOLLOW_UP", id: followUp });
  state = mission3Reducer(state, { type: "BUILD_V2" });
  state = mission3Reducer(state, { type: "REVIEW", matches: followUp === "focused" });
  return state;
}

describe("Mission 3 deterministic build loop", () => {
  it("gives the vague, overloaded, and focused prompts distinct believable first builds", () => {
    expect(buildMission3V1("vague")).toEqual(["description", "meeting", "confirmation", "generic"]);
    expect(buildMission3V1("overloaded")).toEqual(["confirmation", "clutter", "extra-features"]);
    expect(buildMission3V1("focused")).toEqual(["confirmation"]);
  });

  it("applies focused, broad, partial, and vague follow-ups differently", () => {
    const issues = buildMission3V1("focused");
    expect(buildMission3V2("focused", issues)).toEqual(["confirmation"]);
    expect(buildMission3V2("rewrite", issues)).toEqual(["confirmation", "unrelated-layout"]);
    expect(buildMission3V2("broken", issues)).toEqual(["confirmation"]);
    expect(buildMission3V2("vague", issues)).toEqual([]);
    expect(buildMission3V2("focused", buildMission3V1("vague"))).toEqual(["confirmation"]);
  });

  it("requires a real repeated Join action to pass the retest", () => {
    let state = toRetest("focused");
    state = mission3Reducer(state, { type: "CHECK_RETEST" });
    expect(state.retestPassed).toBe(false);
    state = toRetest("focused");
    state = mission3Reducer(state, { type: "JOIN" });
    expect(state.retestTried).toBe(true);
    expect(state.retestJoined).toBe(true);
    state = mission3Reducer(state, { type: "CHECK_RETEST" });
    expect(state.retestPassed).toBe(true);
  });

  it("keeps a vague first build from passing when its meeting details remain missing", () => {
    let state = mission3Reducer(initialMission3State, { type: "START" });
    state = mission3Reducer(state, { type: "ADVANCE" });
    state = mission3Reducer(state, { type: "PROMPT", id: "vague" });
    state = mission3Reducer(state, { type: "BUILD_V1" });
    state = mission3Reducer(state, { type: "JOIN" });
    state = mission3Reducer(state, { type: "OBSERVE" });
    state = mission3Reducer(state, { type: "FOLLOW_UP", id: "rewrite" });
    state = mission3Reducer(state, { type: "BUILD_V2" });
    state = mission3Reducer(state, { type: "CHECK_RETEST" });
    expect(state.stage).toBe(5);
    state = mission3Reducer(state, { type: "REVIEW", matches: false });
    state = mission3Reducer(state, { type: "JOIN" });
    expect(state.retestTried).toBe(true);
    expect(state.retestJoined).toBe(false);
    state = mission3Reducer(state, { type: "CHECK_RETEST" });
    expect(state.retestPassed).toBe(false);
  });

  it("keeps review honest when a broad instruction changes the layout too", () => {
    let state = toRetest("rewrite");
    expect(state.v2Changes).toEqual(["confirmation", "unrelated-layout"]);
    expect(mission3Summary(state).changes.join(" ")).toContain("layout also changed");
    state = mission3Reducer(state, { type: "REVIEW", matches: false });
    expect(state.reviewed).toBe(true);
    expect(state.reviewMatches).toBe(false);
  });

  it("records attempt-specific skills and retains the strongest result on replay", () => {
    let focused = toRetest("focused");
    focused = mission3Reducer(focused, { type: "JOIN" });
    focused = mission3Reducer(focused, { type: "CHECK_RETEST" });
    focused = mission3Reducer(focused, { type: "FINAL", choice: "ship" });
    const first = recordMission3Attempt(initialMission3Progress, focused, 1);
    let vague = toRetest("vague");
    vague = mission3Reducer(vague, { type: "JOIN" });
    vague = mission3Reducer(vague, { type: "CHECK_RETEST" });
    vague = mission3Reducer(vague, { type: "FINAL", choice: "add" });
    const replay = recordMission3Attempt(first, vague, 2);
    expect(replay.attempts.map((item) => item.number)).toEqual([1, 2]);
    expect(replay.latestSkillResults).toEqual(mission3Scores(vague));
    expect(replay.bestSkillResults).toEqual(first.bestSkillResults);
    expect(replay.attempts[0].summary.finalChoice).toContain("tested first version is ready");
  });
});
