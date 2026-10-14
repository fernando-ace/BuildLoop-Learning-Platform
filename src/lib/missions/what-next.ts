import type { SkillScore } from "../learner";

export const mission4Definition = {
  metadata: { id: "what-should-we-build-next", number: 4, title: "What Should We Build Next?", description: "Use real feedback to choose a useful goal, guide a build, and try the result.", estimatedMinutes: 10 },
  steps: ["See the app", "Think it through", "Choose a goal", "Try version 2", "Send feedback", "Try it again", "Decide what’s next"],
  product: {
    name: "StudySpot",
    description: "Find a study session, join, and see how many seats are left.",
    sessions: [
      { id: "math", name: "Algebra together", time: "Today · 3:30 PM", seats: 4 },
      { id: "science", name: "Science review", time: "Today · 4:15 PM", seats: 2 },
    ],
    previousReport: "Added session cards, signup, and seat counts. Students can browse and join a session. The current signup flow works.",
    userNote: "I joined the wrong session and couldn’t undo it. Now the organizer thinks I’m coming.",
  },
  planningChoices: [
    { id: "evidence", label: "Which problem matters most from this feedback?", kind: "focused" },
    { id: "ideas", label: "What are ten fun features we could add?", kind: "ideas" },
    { id: "redesign", label: "How could we redesign the whole app?", kind: "broad" },
    { id: "code", label: "Explain every part of how the app was made.", kind: "technical" },
  ],
  goals: [
    { id: "vague", label: "Make StudySpot better.", kind: "vague" },
    { id: "broad", label: "Add chat, profiles, reminders, ratings, and a new design too.", kind: "broad" },
    { id: "micromanaged", label: "Put a tiny red X in the top-right corner. Don’t change anything else.", kind: "misdirected" },
    { id: "focused", label: "Let students leave a session they joined by mistake. Update the open-seat count and keep joining as it is. It works when a student can join, leave, and see the right count.", kind: "focused" },
  ],
  followUps: [
    { id: "focused", label: "I joined Algebra, then left. The seat count stayed at 3. Put the seat back and keep joining working.", kind: "focused" },
    { id: "vague", label: "It still feels broken. Fix it.", kind: "vague" },
    { id: "unrelated", label: "Add a chat so students can talk.", kind: "unrelated" },
    { id: "restart", label: "Start over and redesign the whole app.", kind: "broad" },
  ],
  planningReplies: {
    evidence: "The student is stuck in a signup they didn’t mean to make. Letting them leave and restoring the seat solves that real problem while keeping the working signup.",
    ideas: "There are lots of possibilities: chat, reminders, profiles, ratings, and more. The feedback doesn’t tell us which one would help this student most.",
    redesign: "A new look could change many screens, but the student’s problem is still being stuck in the wrong session.",
    code: "The app uses session cards and signup. Knowing more about its internals doesn’t answer what this student needs next.",
  },
  lessons: {
    evidence: "You used what a student said to choose the next useful change.",
    goal: "You gave the Builder a goal and a way to tell when it worked.",
    try: "You tried the app yourself instead of treating the build report as proof.",
    feedback: "You described the problem you saw so the Builder could fix that part.",
    decide: "You chose whether to share based on what you observed.",
  },
} as const;

export type PlanningId = "evidence" | "ideas" | "redesign" | "code";
export type GoalId = "vague" | "broad" | "micromanaged" | "focused";
export type FollowUpId = "focused" | "vague" | "unrelated" | "restart";
export type Mission4Stage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export interface Mission4State {
  stage: Mission4Stage;
  planning: PlanningId | "";
  goal: GoalId | "";
  joined: boolean;
  left: boolean;
  firstObserved: boolean;
  followUp: FollowUpId | "";
  retestJoined: boolean;
  retestLeft: boolean;
  finalChoice: "ship" | "improve" | "";
}
export const initialMission4State: Mission4State = { stage: 0, planning: "", goal: "", joined: false, left: false, firstObserved: false, followUp: "", retestJoined: false, retestLeft: false, finalChoice: "" };

export type Mission4Action =
  | { type: "START" } | { type: "ADVANCE" } | { type: "PLAN"; id: PlanningId } | { type: "GOAL"; id: GoalId }
  | { type: "JOIN" } | { type: "LEAVE" } | { type: "OBSERVE" } | { type: "FOLLOW_UP"; id: FollowUpId }
  | { type: "BUILD" } | { type: "SKIP_FOLLOW_UP" } | { type: "JOIN_RETEST" } | { type: "LEAVE_RETEST" } | { type: "FINAL"; choice: "ship" | "improve" } | { type: "RETURN" };

export function buildMission4V2(goal: GoalId, followUp: FollowUpId | "" = ""): { canLeave: boolean; restoresSeat: boolean; hasExtras: boolean; hasTinyControl: boolean } {
  const fix = followUp === "focused";
  if (fix) return { canLeave: true, restoresSeat: true, hasExtras: goal === "broad", hasTinyControl: false };
  if (goal === "focused") return { canLeave: true, restoresSeat: true, hasExtras: false, hasTinyControl: false };
  if (goal === "broad") return { canLeave: true, restoresSeat: false, hasExtras: true, hasTinyControl: false };
  if (goal === "micromanaged") return { canLeave: true, restoresSeat: false, hasExtras: false, hasTinyControl: true };
  return { canLeave: false, restoresSeat: false, hasExtras: false, hasTinyControl: false };
}

export function mission4TaskPassed(state: Mission4State, retest = false): boolean {
  if (retest && !state.followUp) return mission4TaskPassed(state, false);
  const product = buildMission4V2(state.goal || "vague", state.followUp);
  return retest
    ? state.retestJoined && state.retestLeft && product.canLeave && product.restoresSeat
    : state.joined && state.left && buildMission4V2(state.goal || "vague").canLeave && buildMission4V2(state.goal || "vague").restoresSeat;
}

export function mission4Reducer(state: Mission4State, action: Mission4Action): Mission4State {
  switch (action.type) {
    case "START": return { ...initialMission4State, stage: 1 };
    case "ADVANCE": return state.stage === 1 ? { ...state, stage: 2 } : state.stage === 2 && state.planning ? { ...state, stage: 3 } : state.stage === 3 && state.goal ? { ...state, stage: 4 } : state.stage === 6 && state.retestJoined && state.retestLeft ? { ...state, stage: 7 } : state;
    case "PLAN": return state.stage === 2 ? { ...state, planning: action.id } : state;
    case "GOAL": return state.stage === 3 ? { ...state, goal: action.id } : state;
    case "JOIN": return state.stage === 4 ? { ...state, joined: true } : state;
    case "LEAVE": return state.stage === 4 && state.joined ? { ...state, left: true } : state;
    case "OBSERVE": return state.stage === 4 && state.joined && (state.left || !buildMission4V2(state.goal || "vague").canLeave) ? { ...state, firstObserved: true, stage: 5 } : state;
    case "FOLLOW_UP": return state.stage === 5 ? { ...state, followUp: action.id } : state;
    case "BUILD": return state.stage === 5 && state.followUp ? { ...state, stage: 6, retestJoined: false, retestLeft: false } : state;
    case "SKIP_FOLLOW_UP": return state.stage === 5 && mission4TaskPassed(state) ? { ...state, stage: 7 } : state;
    case "JOIN_RETEST": return state.stage === 6 ? { ...state, retestJoined: true } : state;
    case "LEAVE_RETEST": return state.stage === 6 && state.retestJoined ? { ...state, retestLeft: true } : state;
    case "FINAL": return state.stage === 7 ? { ...state, stage: 8, finalChoice: action.choice } : state;
    case "RETURN": return state;
  }
}

export function mission4Scores(state: Mission4State): SkillScore[] {
  const planning = mission4Definition.planningChoices.find((item) => item.id === state.planning);
  const goal = mission4Definition.goals.find((item) => item.id === state.goal);
  const product = buildMission4V2(state.goal || "vague", state.followUp);
  const passed = mission4TaskPassed(state, true);
  return [
    { name: "User understanding", score: planning?.id === "evidence" ? 100 : 30, explanation: planning?.id === "evidence" ? "You followed the student’s experience to the problem that matters." : "The student’s comment pointed to the most useful next change." },
    { name: "Problem definition", score: planning?.id === "evidence" ? 100 : 35, explanation: planning?.id === "evidence" ? "You turned the student’s comment into a clear problem to solve." : "The student’s comment could guide a more specific next goal." },
    { name: "AI communication", score: goal?.id === "focused" ? 100 : goal?.id === "vague" ? 30 : 45, explanation: goal?.id === "focused" ? "Your goal says what the student can do and what success looks like." : "A clear outcome helps the Builder focus on the student’s problem." },
    { name: "Testing", score: passed ? 100 : state.retestJoined ? 60 : 20, explanation: passed ? "You repeated join and leave and saw the seat count recover." : "The repeated task showed the app still needs work." },
    { name: "Feedback", score: state.followUp === "focused" ? 100 : state.followUp ? 30 : 0, explanation: state.followUp === "focused" ? "You described the observed problem and the result you wanted." : "A specific description of what happened gives the Builder clearer direction." },
    { name: "Iteration", score: state.followUp === "focused" && passed ? 100 : state.followUp === "focused" ? 70 : state.followUp ? 30 : 0, explanation: state.followUp === "focused" ? "You tied a focused change to what you observed." : "Your follow-up did not clearly explain the behavior you saw." },
    { name: "Scope", score: goal?.id === "focused" ? 100 : goal?.id === "broad" ? 25 : 60, explanation: product.hasExtras ? "Extra features made the update wider than the student’s problem." : goal?.id === "focused" ? "You kept the update centered on one useful outcome." : "The goal left room for the Builder to guess." },
    { name: "Reviewing AI work", score: state.firstObserved && state.retestJoined ? 100 : state.firstObserved ? 65 : 20, explanation: state.firstObserved ? "You used the app after the Builder reported finishing." : "Trying the product gives you evidence beyond the report." },
    { name: "Shipping", score: (state.finalChoice === "ship") === passed ? 100 : 25, explanation: (state.finalChoice === "ship") === passed ? passed ? "You shared the version after the student’s task worked." : "You held the version back after the test showed a problem." : "Your final choice did not match what the repeated test showed." },
  ];
}

export function mission4Summary(state: Mission4State) {
  const plan = mission4Definition.planningChoices.find((item) => item.id === state.planning);
  const goal = mission4Definition.goals.find((item) => item.id === state.goal);
  const followUp = mission4Definition.followUps.find((item) => item.id === state.followUp);
  const passed = mission4TaskPassed(state, true);
  return {
    planning: plan?.label ?? "No question selected",
    planningResult: mission4Definition.planningReplies[state.planning || "code"],
    goal: goal?.label ?? "No goal selected",
    firstTry: state.firstObserved ? mission4TaskPassed(state) ? "You joined, left, and saw the correct seat count." : buildMission4V2(state.goal || "vague").canLeave ? "You left, but the seat count did not return correctly." : "You joined but could not find a way to leave the session." : "The app was not fully tried.",
    followUp: followUp?.label ?? "No focused follow-up selected",
    retest: !state.followUp && mission4TaskPassed(state) ? "Your test showed the student could join, leave, and see the right seat count. No update was needed." : state.retestJoined ? passed ? "You repeated join and leave; the seat count was correct." : "You repeated the task, but the seat count was still wrong." : "You did not repeat the task after the update.",
    decision: state.finalChoice === "ship" ? passed ? "Share the version you checked; the task worked." : "You chose to share, even though the repeated task still showed a problem." : passed ? "Keep improving, even though the repeated task worked." : "Keep improving because the student’s task still needs work.",
    lessons: [state.planning === "evidence" ? mission4Definition.lessons.evidence : "The student’s comment helped you compare other ideas with the real problem.", state.goal === "focused" ? mission4Definition.lessons.goal : "The Builder had to guess because the goal did not describe the result clearly.", mission4Definition.lessons.try, state.followUp === "focused" ? mission4Definition.lessons.feedback : "Your follow-up left the Builder guessing about the problem you saw.", state.finalChoice === "ship" && passed ? mission4Definition.lessons.decide : state.finalChoice === "improve" && !passed ? "You kept the product in progress because the student’s task still failed." : "Your final choice did not fully match what you observed."],
  };
}

export interface Mission4Attempt { number: number; skills: SkillScore[]; summary: ReturnType<typeof mission4Summary> }
export interface Mission4Progress { attempts: Mission4Attempt[]; latestSkillResults: SkillScore[]; bestSkillResults: SkillScore[]; completed: boolean }
export const initialMission4Progress: Mission4Progress = { attempts: [], latestSkillResults: [], bestSkillResults: [], completed: false };
export function recordMission4Attempt(progress: Mission4Progress, state: Mission4State, number: number): Mission4Progress {
  const skills = mission4Scores(state);
  const best = new Map(progress.bestSkillResults.map((skill) => [skill.name, skill]));
  return { completed: true, latestSkillResults: skills, bestSkillResults: skills.map((skill) => (best.get(skill.name)?.score ?? -1) > skill.score ? best.get(skill.name)! : skill), attempts: [...progress.attempts, { number, skills, summary: mission4Summary(state) }] };
}
