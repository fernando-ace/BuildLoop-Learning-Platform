import { describe, expect, it } from "vitest";
import { completeAttempt, initialLearnerProgress } from "../learner";
import { buildMission2V1, initialMission2Progress, initialMission2State, mission2Definition, mission2Reducer, mission2Scores, mission2Summary, recordMission2Attempt, type Mission2State } from "./the-vague-request";

const strongChoices = { audience: "students", problem: "scattered", build: "web", features: ["details", "signup", "roster"], boundaries: "simple", success: "flow" };
function toRetest(feedback = "confirmation") {
  let state: Mission2State = { ...initialMission2State, stage: 3, briefChoices: strongChoices, questionsAsked: ["events", "signup", "accounts"] };
  state = mission2Reducer(state, { type: "BUILD" });
  state = mission2Reducer(state, { type: "SELECT_EVENT", event: "park" });
  state = mission2Reducer(state, { type: "SIGN_UP" });
  state = mission2Reducer(state, { type: "ADVANCE" });
  state = mission2Reducer(state, { type: "OBSERVE", problem: "confirmation" });
  state = mission2Reducer(state, { type: "FEEDBACK", id: feedback });
  state = mission2Reducer(state, { type: "BUILD_V2" });
  state = mission2Reducer(state, { type: "ADVANCE" });
  state = mission2Reducer(state, { type: "SELECT_EVENT", event: "park" });
  state = mission2Reducer(state, { type: "SIGN_UP" });
  return mission2Reducer(state, { type: "RETEST" });
}

describe("Mission 2: The Vague Request", () => {
  it("keeps the second mission locked until Mission 1 is completed", () => {
    expect(initialLearnerProgress.completed).toBe(false);
    expect(initialMission2Progress.completed).toBe(false);
    expect(completeAttempt(initialLearnerProgress, []).completed).toBe(true);
  });

  it("starts at Maya's request and resumes from the saved mission state", () => {
    const started = mission2Reducer(initialMission2State, { type: "START" });
    expect(started.stage).toBe(1);
    const resumed = mission2Reducer(started, { type: "ASK", id: "events" });
    expect(resumed.questionsAsked).toEqual(["events"]);
    expect(mission2Reducer(resumed, { type: "RETURN" })).toEqual(resumed);
  });

  it("keeps the mission definition distinct from Mission 1", () => {
    expect(mission2Definition.metadata.title).toBe("The Vague Request");
    expect(mission2Definition.steps).toHaveLength(10);
    expect(mission2Definition.skills).toEqual(["User understanding", "Problem definition", "Scope", "AI communication", "Testing", "Feedback", "Iteration", "Shipping"]);
  });

  it("gathers choices and renders a brief from them", () => {
    let state = mission2Reducer(initialMission2State, { type: "START" });
    for (const id of ["events", "signup", "accounts"]) state = mission2Reducer(state, { type: "ASK", id });
    for (const [field, id] of [["audience", "students"], ["problem", "scattered"], ["build", "web"], ["boundaries", "simple"], ["success", "flow"]] as const) state = mission2Reducer(state, { type: "BRIEF", field, id });
    for (const id of ["details", "signup", "roster"]) state = mission2Reducer(state, { type: "BRIEF", field: "features", id });
    state = mission2Reducer(state, { type: "PREVIEW_BRIEF" });
    state = mission2Reducer(state, { type: "PREVIEW_BRIEF" });
    state = mission2Reducer(state, { type: "BUILD" });
    expect(state.brief).toContain("students in maya's volunteer club");
    expect(state.brief).toContain("organizers see the signup list");
  });

  it("produces different deterministic Version 1 outcomes from different briefs", () => {
    expect(buildMission2V1(strongChoices, ["events", "signup"])).toEqual(["confirmation"]);
    const weak = buildMission2V1({ audience: "everyone", problem: "events", build: "dashboard", features: ["feed"], boundaries: "everything", success: "launch" }, []);
    expect(weak).toEqual(["details", "signup", "confirmation", "complexity"]);
  });

  it("requires selecting a Saturday event and makes signup behavior reflect the brief", () => {
    const weak = mission2Reducer({ ...initialMission2State, v1Issues: ["signup"] }, { type: "SIGN_UP" });
    expect(weak.joined).toBe(false);
    const selected = mission2Reducer({ ...weak, selectedEvent: "park" }, { type: "SIGN_UP" });
    expect(selected.joined).toBe(false);
    const working = mission2Reducer({ ...initialMission2State, selectedEvent: "park" }, { type: "SIGN_UP" });
    expect(working.joined).toBe(true);
  });

  it("applies specific feedback to Version 2 and does not repair vague feedback", () => {
    const clear = toRetest("confirmation");
    const vague = toRetest("vague");
    expect(clear.v2Changes).toContain("confirmation");
    expect(clear.retestPassed).toBe(true);
    expect(vague.v2Changes).toEqual([]);
    expect(vague.retestPassed).toBe(false);
    const overbuilt = toRetest("features");
    expect(overbuilt.v2Changes).toEqual(["added-features"]);
    expect(overbuilt.retestPassed).toBe(false);
    expect(mission2Summary(overbuilt).changes.join(" ")).toContain("creating more steps");
  });

  it("records the retest result for each actual build outcome", () => {
    expect(toRetest("confirmation").retestPassed).toBe(true);
    expect(toRetest("page").retestPassed).toBe(false);
    let notRetested: Mission2State = { ...toRetest("confirmation"), retestJoined: false, retestTried: false, stage: 8 };
    notRetested = mission2Reducer(notRetested, { type: "RETEST" });
    expect(notRetested.retestPassed).toBe(false);
  });

  it("scores canonical skills from choices, tests, iteration, and ship decision", () => {
    const state = { ...toRetest("confirmation"), shipChoice: "ship", stage: 9 as const };
    const scores = mission2Scores(state);
    expect(scores.map((skill) => skill.name)).toEqual([...mission2Definition.skills]);
    expect(scores.find((skill) => skill.name === "Testing")?.score).toBe(100);
    expect(scores.find((skill) => skill.name === "Shipping")?.score).toBe(100);
    expect(mission2Scores({ ...toRetest("confirmation"), observedProblem: "details" }).find((skill) => skill.name === "Feedback")?.score).toBe(40);
    const notReady = { ...toRetest("vague"), shipChoice: "fix-core" };
    expect(mission2Scores(notReady).find((skill) => skill.name === "Shipping")?.score).toBe(80);
  });

  it("retains separate attempt summaries and the best skill results on replay", () => {
    const firstState = { ...toRetest("confirmation"), shipChoice: "ship" };
    const firstRun = recordMission2Attempt(initialMission2Progress, firstState, 1);
    const replayState = { ...toRetest("vague"), shipChoice: "features" };
    const replay = recordMission2Attempt(firstRun, replayState, 2);
    expect(replay.completed).toBe(true);
    expect(replay.attempts.map((attempt) => attempt.number)).toEqual([1, 2]);
    expect(replay.attempts[0].summary.changes).toEqual(["Signup now confirms the event name, date, and time."]);
    expect(replay.bestSkillResults).toEqual(firstRun.bestSkillResults);
  });

  it("summarizes Maya's answers, the brief, the observed gap, and the follow-up", () => {
    const state = { ...toRetest(), questionsAsked: ["events", "signup"], feedback: "confirmation", shipChoice: "ship" };
    const summary = mission2Summary(state);
    expect(summary.original).toContain("signing up for volunteer events");
    expect(summary.learned.join(" ")).toContain("event");
    expect(summary.v1.join(" ")).toContain("confirmation");
    expect(summary.changes.join(" ")).toContain("confirms");
  });
});
