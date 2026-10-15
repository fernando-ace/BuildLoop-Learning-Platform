import type { SkillScore } from "../learner";

export const mission5Definition = {
  metadata: {
    id: "something-is-broken",
    number: 5,
    title: "Something’s Broken",
    description: "Try an app, show the Builder what happened, and check the repair before sharing.",
    estimatedMinutes: 9,
  },
  steps: ["Meet the student", "Try ClubBoard", "Tell the Builder", "Check the repair", "Check another club", "Decide"],
  reportChoices: [
    { id: "vague", label: "Leaving clubs is broken. Fix it.", kind: "vague" },
    { id: "assumption", label: "The leave button’s saved-data part is wrong. Rewrite it.", kind: "assumption" },
    { id: "evidence", label: "I joined Art Club and it appeared in My Clubs. After I pressed Leave, its seat opened up, but Art Club still appeared in My Clubs. I expected it to disappear there too.", kind: "evidence" },
  ],
  followUps: [
    { id: "evidence", label: "I left Art Club. It still appears in My Clubs, and its seat count should update too. Please make both match what I saw.", kind: "evidence" },
    { id: "vague", label: "It still isn’t right. Fix the club list.", kind: "vague" },
  ],
  skills: ["User understanding", "AI communication", "Testing", "Feedback", "Iteration", "Reviewing AI work", "Shipping"],
  product: {
    name: "ClubBoard",
    clubs: [
      { id: "art", name: "Art Club", meeting: "Thursday · 3:30 PM", seats: 2 },
      { id: "robotics", name: "Robotics Club", meeting: "Friday · 3:45 PM", seats: 1 },
    ],
    report: "Students can browse clubs, join one, and see the clubs they joined. The new Leave action was just added.",
  },
} as const;

export type Mission5ReportId = "vague" | "assumption" | "evidence";
export type Mission5FollowUpId = "vague" | "evidence";
export type Mission5Stage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export interface Mission5State {
  stage: Mission5Stage;
  report: Mission5ReportId | "";
  followUp: Mission5FollowUpId | "";
  firstJoined: boolean;
  firstLeft: boolean;
  reportSent: boolean;
  retestJoined: boolean;
  retestLeft: boolean;
  secondBuild: boolean;
  nearbyJoined: boolean;
  nearbyLeft: boolean;
  finalChoice: "share" | "test" | "change" | "";
}

export const initialMission5State: Mission5State = {
  stage: 0, report: "", followUp: "", firstJoined: false, firstLeft: false,
  reportSent: false, retestJoined: false, retestLeft: false,
  secondBuild: false, nearbyJoined: false, nearbyLeft: false, finalChoice: "",
};

export type Mission5Action =
  | { type: "START" }
  | { type: "ADVANCE" }
  | { type: "JOIN_FIRST" }
  | { type: "LEAVE_FIRST" }
  | { type: "SELECT_REPORT"; id: Mission5ReportId }
  | { type: "SEND_REPORT" }
  | { type: "JOIN_RETEST" }
  | { type: "LEAVE_RETEST" }
  | { type: "FOLLOW_UP"; id: Mission5FollowUpId }
  | { type: "BUILD_AGAIN" }
  | { type: "JOIN_NEARBY" }
  | { type: "LEAVE_NEARBY" }
  | { type: "DECIDE"; choice: "share" | "change" }
  | { type: "RETURN" };

export function mission5Build(state: Pick<Mission5State, "report" | "followUp" | "secondBuild">) {
  if (state.secondBuild && state.followUp === "evidence") return { artMembership: true, artSeat: true, nearbyWorks: state.report !== "assumption" };
  if (state.report === "evidence") return { artMembership: true, artSeat: true, nearbyWorks: true };
  if (state.report === "assumption") return { artMembership: true, artSeat: false, nearbyWorks: false };
  return { artMembership: false, artSeat: true, nearbyWorks: true };
}

export function mission5RetestPassed(state: Mission5State) {
  const build = mission5Build(state);
  return state.retestJoined && state.retestLeft && build.artMembership && build.artSeat;
}

export function mission5NearbyPassed(state: Mission5State) {
  return state.nearbyJoined && state.nearbyLeft && mission5Build(state).nearbyWorks;
}

export function mission5Reducer(state: Mission5State, action: Mission5Action): Mission5State {
  switch (action.type) {
    case "START": return { ...initialMission5State, stage: 1 };
    case "ADVANCE":
      if (state.stage === 1) return { ...state, stage: 2 };
      if (state.stage === 2 && state.firstJoined && state.firstLeft) return { ...state, stage: 3 };
      if (state.stage === 3 && state.reportSent) return { ...state, stage: 4 };
      if (state.stage === 4 && mission5RetestPassed(state)) return { ...state, stage: 7 };
      if (state.stage === 6 && state.retestJoined && state.retestLeft) return { ...state, stage: 7 };
      if (state.stage === 7 && state.nearbyJoined && state.nearbyLeft) return { ...state, stage: 8 };
      return state;
    case "JOIN_FIRST": return state.stage === 2 ? { ...state, firstJoined: true } : state;
    case "LEAVE_FIRST": return state.stage === 2 && state.firstJoined ? { ...state, firstLeft: true } : state;
    case "SELECT_REPORT": return state.stage === 3 ? { ...state, report: action.id } : state;
    case "SEND_REPORT": return state.stage === 3 && state.report ? { ...state, reportSent: true, stage: 4, retestJoined: false, retestLeft: false } : state;
    case "JOIN_RETEST": return [4, 6].includes(state.stage) ? { ...state, retestJoined: true } : state;
    case "LEAVE_RETEST": return [4, 6].includes(state.stage) && state.retestJoined ? { ...state, retestLeft: true } : state;
    case "FOLLOW_UP": return state.stage === 4 && state.retestLeft && !mission5RetestPassed(state) ? { ...state, followUp: action.id, stage: 5 } : state;
    case "BUILD_AGAIN": return state.stage === 5 && state.followUp ? { ...state, secondBuild: true, stage: 6, retestJoined: false, retestLeft: false } : state;
    case "JOIN_NEARBY": return state.stage === 7 ? { ...state, nearbyJoined: true } : state;
    case "LEAVE_NEARBY": return state.stage === 7 && state.nearbyJoined ? { ...state, nearbyLeft: true } : state;
    case "DECIDE": return state.stage === 8 ? { ...state, finalChoice: action.choice, stage: 8 } : state;
    case "RETURN": return state;
  }
}

export function mission5Scores(state: Mission5State): SkillScore[] {
  const originalTest = mission5RetestPassed(state);
  const nearbyTest = mission5NearbyPassed(state);
  const evidenceReport = state.report === "evidence";
  const evidenceFollowUp = state.followUp === "evidence";
  const shareMatchesEvidence = (state.finalChoice === "share") === (originalTest && nearbyTest);
  return [
    { name: "User understanding", score: state.firstJoined && state.firstLeft ? 100 : 0, explanation: state.firstJoined && state.firstLeft ? "You tried joining and leaving before asking the Builder for help." : "Trying the student’s task helps show what needs to work." },
    { name: "AI communication", score: evidenceReport ? 100 : state.report === "assumption" ? 30 : state.report ? 38 : 0, explanation: evidenceReport ? "You described your action, what happened, and what you expected." : state.report === "assumption" ? "Guessing what is wrong inside the app sent the Builder toward the wrong repair." : "The Builder had little detail about what you saw." },
    { name: "Testing", score: originalTest && nearbyTest ? 100 : originalTest || state.retestJoined ? 58 : 0, explanation: originalTest && nearbyTest ? "You repeated the same steps and checked another club." : originalTest ? "You checked the original problem; another club still needs a check." : "Repeat the same actions after the change to see whether it worked." },
    { name: "Feedback", score: evidenceFollowUp || (evidenceReport && originalTest) ? 100 : state.followUp ? 35 : state.report ? 45 : 0, explanation: evidenceFollowUp ? "You used what happened in the new version to guide the next repair." : evidenceReport && originalTest ? "Your evidence helped the Builder make a repair that worked on the first try." : state.followUp ? "The follow-up left some room for the Builder to guess." : "When a repair misses, describe the new result you saw." },
    { name: "Iteration", score: evidenceReport && originalTest || state.secondBuild && evidenceFollowUp && originalTest ? 100 : state.secondBuild && originalTest ? 70 : state.reportSent ? 45 : 0, explanation: evidenceReport && originalTest ? "Your clear report led to a focused repair, and you checked it again." : state.secondBuild && evidenceFollowUp && originalTest ? "You gave a focused follow-up and checked the new version again." : state.secondBuild ? "You built again; repeat the original steps to check the repair." : "A repair should be followed by another try." },
    { name: "Reviewing AI work", score: originalTest && nearbyTest ? 100 : originalTest ? 75 : state.reportSent ? 40 : 0, explanation: originalTest && nearbyTest ? "You checked the repair and made sure a nearby action still worked." : originalTest ? "The main problem passed, but a nearby action was not checked." : "A Builder’s report does not prove the app works." },
    { name: "Shipping", score: shareMatchesEvidence ? 100 : state.finalChoice ? 30 : 0, explanation: shareMatchesEvidence ? originalTest ? "You shared after both the original and nearby behavior worked." : "You held the version back because your checks showed it was not ready." : "Match your sharing decision to the behavior you actually checked." },
  ];
}

export function mission5Summary(state: Mission5State) {
  const build = mission5Build(state);
  const retestPassed = mission5RetestPassed(state);
  const nearbyPassed = mission5NearbyPassed(state);
  const evidenceReport = state.report === "evidence";
  const reportText = mission5Definition.reportChoices.find((choice) => choice.id === state.report)?.label ?? "No report sent";
  return {
    report: reportText,
    firstTry: state.firstJoined && state.firstLeft ? "You joined Art Club, left it, saw the seat open, and noticed it still in My Clubs." : "You did not finish trying the original problem.",
    builder: state.report === "evidence" ? "The Builder used your observed steps and expected result to remove Art Club from My Clubs and keep the seat count right." : state.report === "assumption" ? "The Builder followed your guess about saved data. Art Club disappeared, but the seat count stopped updating." : "The Builder had little detail and updated the seat count, but Art Club still appeared in My Clubs.",
    retest: !state.retestJoined ? "You did not repeat the original steps after the build." : retestPassed ? "You joined and left Art Club again; it disappeared from My Clubs and the seat count was right." : !build.artMembership ? "You repeated join and leave, but Art Club still appeared in My Clubs." : "You repeated join and leave, but the seat count was still wrong.",
    followUp: state.followUp ? mission5Definition.followUps.find((item) => item.id === state.followUp)?.label ?? "" : "No follow-up needed",
    nearby: !state.nearbyJoined ? "You did not check another club." : nearbyPassed ? "You joined and left Robotics Club; its list and seat count still worked." : "You checked Robotics Club and found that its seat count did not update.",
    decision: state.finalChoice === "share" ? retestPassed && nearbyPassed ? "Share the version you checked." : "You chose to share before all checks passed." : state.finalChoice === "test" ? "Test another important action before sharing." : state.finalChoice === "change" ? "Ask the Builder for another change before sharing." : "No sharing decision recorded.",
    lessons: [
      state.firstJoined && state.firstLeft ? "You reproduced the problem before asking for a fix." : "Trying the same steps helps make a problem clear.",
      evidenceReport ? "You told the Builder what happened instead of guessing which part was wrong." : "The Builder had less useful evidence, so its first repair missed part of the problem.",
      state.retestJoined ? "You tried the original steps again after the Builder changed the app." : "Try the same steps again after a repair.",
      state.nearbyJoined ? nearbyPassed ? "You also checked another club before deciding." : "Your extra check found a problem in another club." : "Check one nearby action before you share.",
    ],
  };
}

export interface Mission5Attempt { number: number; skills: SkillScore[]; summary: ReturnType<typeof mission5Summary> }
export interface Mission5Progress { attempts: Mission5Attempt[]; latestSkillResults: SkillScore[]; bestSkillResults: SkillScore[]; completed: boolean }
export const initialMission5Progress: Mission5Progress = { attempts: [], latestSkillResults: [], bestSkillResults: [], completed: false };
export function recordMission5Attempt(progress: Mission5Progress, state: Mission5State, number: number): Mission5Progress {
  const skills = mission5Scores(state);
  const best = new Map(progress.bestSkillResults.map((skill) => [skill.name, skill]));
  return { completed: true, latestSkillResults: skills, bestSkillResults: skills.map((skill) => (best.get(skill.name)?.score ?? -1) > skill.score ? best.get(skill.name)! : skill), attempts: [...progress.attempts, { number, skills, summary: mission5Summary(state) }] };
}
