import type { SkillScore } from "../learner";

export const mission6Definition = {
  number: 6,
  title: "Build It for Real",
  description: "Help a campus event team make volunteer shifts easier to fill and trust.",
  estimatedMinutes: 25,
  skills: ["User understanding", "Problem definition", "Scope", "AI communication", "Testing", "Feedback", "Iteration", "Reviewing AI work", "Shipping"],
  steps: ["The event", "Choose a first version", "Brief the Builder", "Try version 1", "Read the feedback", "Set the next goal", "Build again", "Try it again", "Check another task", "Decide what ships"],
  questions: [
    { id: "users", label: "Who needs to use the signup sheet?", fact: "volunteers" },
    { id: "current", label: "How do people sign up today?", fact: "messages and a shared sheet" },
    { id: "pain", label: "What goes wrong most often?", fact: "two volunteers can choose overlapping shifts" },
    { id: "task", label: "What does a volunteer need to do?", fact: "see open jobs and know their signup was saved" },
    { id: "edge", label: "What should happen when a shift is full?", fact: "the last space should be protected" },
    { id: "extras", label: "Would profiles and a leaderboard help?", fact: "the organizer says they can wait" },
  ],
  features: [
    { id: "shifts", label: "Show jobs, times, and open spaces", core: true },
    { id: "signup", label: "Let a volunteer sign up", core: true },
    { id: "confirmation", label: "Show a clear signup confirmation", core: true },
    { id: "capacity", label: "Stop signups when a job is full", core: true },
    { id: "coverage", label: "Help organizers spot jobs with no volunteers", core: true },
    { id: "profiles", label: "Volunteer profiles", core: false },
    { id: "announcements", label: "Announcements", core: false },
    { id: "analytics", label: "Signup analytics", core: false },
    { id: "themes", label: "Custom themes", core: false },
    { id: "leaderboard", label: "A volunteer leaderboard", core: false },
    { id: "advanced", label: "Advanced scheduling tools", core: false },
  ],
  briefs: [
    { id: "vague", label: "Make a great volunteer app.", kind: "vague" },
    { id: "list", label: "Build every feature I picked, and make it look polished.", kind: "list" },
    { id: "technical", label: "Use a calendar database, a custom matching algorithm, and a dashboard.", kind: "technical" },
    { id: "focused", label: "Help volunteers see open event jobs, sign up once, avoid overlapping shifts, and know the signup saved. Keep profiles and announcements out of this first version.", kind: "focused" },
  ],
  feedback: [
    { id: "overlap", from: "Jordan · Volunteer", label: "I could sign up for the welcome table and the info booth at the same time. I thought the app would stop me.", kind: "problem" },
    { id: "confirmation", from: "Jordan · Volunteer", label: "A clear message after I sign up would help me know it worked.", kind: "useful" },
    { id: "profiles", from: "Jordan · Volunteer", label: "Could I add a profile photo and a short bio?", kind: "feature" },
    { id: "spreadsheet", from: "Lee · Organizer", label: "I still need to count spaces in the spreadsheet by hand.", kind: "problem" },
    { id: "leaderboard", from: "Lee · Organizer", label: "A leaderboard might encourage people to take more shifts.", kind: "feature" },
    { id: "algorithm", from: "Lee · Organizer", label: "Maybe the app needs a smarter scheduling algorithm.", kind: "suggestion" },
  ],
  goals: [
    { id: "focused", label: "Stop one person taking overlapping shifts, and keep the space limit working.", kind: "focused" },
    { id: "broad", label: "Improve everything and add the features people asked for.", kind: "broad" },
    { id: "vague", label: "Make the signup flow better.", kind: "vague" },
    { id: "guess", label: "Hide shifts that overlap in the list.", kind: "guess" },
  ],
} as const;

export type Mission6State = {
  stage: number;
  questionsAsked: string[];
  selectedFeatures: string[];
  brief: string;
  firstSignup: boolean;
  overlapTried: boolean;
  feedbackChoices: string[];
  goal: string;
  buildCount: number;
  retestSignup: boolean;
  retestOverlapTried: boolean;
  followUp: string;
  nearbyFirst: boolean;
  nearbyOverbookTried: boolean;
  finalChoice: "share" | "improve" | "features" | "rebuild" | "";
};

export const initialMission6State: Mission6State = {
  stage: 0, questionsAsked: [], selectedFeatures: [], brief: "", firstSignup: false, overlapTried: false,
  feedbackChoices: [], goal: "", buildCount: 0, retestSignup: false, retestOverlapTried: false,
  followUp: "", nearbyFirst: false, nearbyOverbookTried: false, finalChoice: "",
};

export type Mission6Action =
  | { type: "START" } | { type: "ADVANCE" } | { type: "ASK"; id: string }
  | { type: "FEATURE"; id: string } | { type: "BRIEF"; id: string }
  | { type: "SIGNUP"; area: "first" | "retest" | "nearby" }
  | { type: "OVERLAP"; area: "first" | "retest" }
  | { type: "FEEDBACK"; id: string } | { type: "GOAL"; id: string }
  | { type: "FOLLOW_UP"; id: string } | { type: "BUILD" }
  | { type: "OVERBOOK" } | { type: "DECIDE"; choice: Mission6State["finalChoice"] } | { type: "RETURN" };

export function mission6Build(state: Pick<Mission6State, "selectedFeatures" | "brief" | "questionsAsked" | "goal" | "buildCount" | "followUp">) {
  const has = (id: string) => state.selectedFeatures.includes(id);
  const briefKind = mission6Definition.briefs.find((brief) => brief.id === state.brief)?.kind;
  const selectedExtras = state.selectedFeatures.filter((id) => !mission6Definition.features.find((feature) => feature.id === id)?.core).length;
  const extras = selectedExtras + (state.buildCount > 0 && state.goal === "broad" ? 2 : 0);
  const discovery = state.questionsAsked.includes("pain") && state.questionsAsked.includes("task");
  const signup = has("shifts") && has("signup");
  const confirmed = has("confirmation") || briefKind === "focused";
  const capacity = has("capacity");
  const coverage = has("coverage") && extras < 3 && state.questionsAsked.includes("task");
  let overlap = state.buildCount === 0 && briefKind === "focused";
  let v2Regression = false;
  if (state.buildCount > 0) {
    if (state.goal === "focused" || (state.followUp === "evidence" && state.buildCount > 1)) overlap = true;
    if (state.goal === "guess") { overlap = true; v2Regression = true; }
  }
  return { signup, confirmed, capacity: capacity && !v2Regression, coverage, overlap, extras, discovery, briefKind, v2Regression };
}

export function mission6RetestPassed(state: Mission6State) {
  const build = mission6Build(state);
  return state.retestSignup && state.retestOverlapTried && build.signup && build.overlap;
}

export function mission6NearbyPassed(state: Mission6State) {
  const build = mission6Build(state);
  return state.nearbyFirst && state.nearbyOverbookTried && build.capacity;
}

export function mission6Reducer(state: Mission6State, action: Mission6Action): Mission6State {
  switch (action.type) {
    case "START": return { ...initialMission6State, stage: 1 };
    case "ADVANCE":
      if (state.stage === 1) return { ...state, stage: 2 };
      if (state.stage === 2 && state.selectedFeatures.length) return { ...state, stage: 3 };
      if (state.stage === 3 && state.brief) return { ...state, stage: 4 };
      if (state.stage === 4 && state.firstSignup && state.overlapTried) return { ...state, stage: 5 };
      if (state.stage === 5 && state.feedbackChoices.length) return { ...state, stage: 6 };
      if (state.stage === 6 && state.goal) return { ...state, stage: 7, buildCount: 1 };
      if (state.stage === 8 && mission6RetestPassed(state)) return { ...state, stage: 9 };
      if (state.stage === 9 && state.nearbyFirst && state.nearbyOverbookTried) return { ...state, stage: 10 };
      return state;
    case "ASK": return state.stage === 1 ? { ...state, questionsAsked: state.questionsAsked.includes(action.id) ? state.questionsAsked : [...state.questionsAsked, action.id] } : state;
    case "FEATURE": return state.stage === 2 ? { ...state, selectedFeatures: state.selectedFeatures.includes(action.id) ? state.selectedFeatures.filter((id) => id !== action.id) : [...state.selectedFeatures, action.id] } : state;
    case "BRIEF": return state.stage === 3 ? { ...state, brief: action.id } : state;
    case "SIGNUP":
      if (action.area === "first" && state.stage === 4) return { ...state, firstSignup: true };
      if (action.area === "retest" && state.stage === 8) return { ...state, retestSignup: true };
      if (action.area === "nearby" && state.stage === 9) return { ...state, nearbyFirst: true };
      return state;
    case "OVERLAP":
      if (action.area === "first" && state.stage === 4 && state.firstSignup) return { ...state, overlapTried: true };
      if (action.area === "retest" && state.stage === 8 && state.retestSignup) return { ...state, retestOverlapTried: true };
      return state;
    case "FEEDBACK": return state.stage === 5 ? { ...state, feedbackChoices: state.feedbackChoices.includes(action.id) ? state.feedbackChoices.filter((id) => id !== action.id) : [...state.feedbackChoices, action.id] } : state;
    case "GOAL": return state.stage === 6 ? { ...state, goal: action.id } : state;
    case "FOLLOW_UP": return state.stage === 8 && state.retestOverlapTried && !mission6RetestPassed(state) ? { ...state, followUp: action.id } : state;
    case "BUILD": return state.stage === 7 || (state.stage === 8 && Boolean(state.followUp)) ? { ...state, stage: 8, buildCount: state.buildCount + (state.stage === 8 ? 1 : 0), retestSignup: false, retestOverlapTried: false } : state;
    case "OVERBOOK": return state.stage === 9 && state.nearbyFirst ? { ...state, nearbyOverbookTried: true } : state;
    case "DECIDE": return state.stage === 10 ? { ...state, finalChoice: action.choice, stage: 11 } : state;
    case "RETURN": return state;
  }
}

export function mission6Scores(state: Mission6State): SkillScore[] {
  const build = mission6Build(state);
  const focused = mission6Definition.briefs.find((item) => item.id === state.brief)?.kind === "focused";
  const core = mission6Definition.features.filter((item) => item.core);
  const selectedCore = core.filter((item) => state.selectedFeatures.includes(item.id)).length;
  const asked = state.questionsAsked.filter((id) => ["users", "current", "pain", "task", "edge"].includes(id)).length;
  const feedback = state.feedbackChoices.some((id) => id === "overlap" || id === "spreadsheet");
  const focusedGoal = state.goal === "focused";
  const retest = mission6RetestPassed(state);
  const nearby = mission6NearbyPassed(state);
  const ready = retest && nearby;
  const shipMatches = (state.finalChoice === "share") === ready;
  return [
    { name: "User understanding", score: Math.min(100, asked * 20 + (build.discovery ? 20 : 0)), explanation: build.discovery ? "You asked how the work happens and what goes wrong before choosing a solution." : "A few questions about volunteers’ current steps would have made the problem clearer." },
    { name: "Problem definition", score: state.questionsAsked.includes("pain") && state.questionsAsked.includes("task") ? 100 : state.questionsAsked.includes("pain") ? 58 : 25, explanation: state.questionsAsked.includes("pain") && state.questionsAsked.includes("task") ? "You uncovered the overlap problem and what volunteers need to do." : "Finding both the painful failure and the user’s task gives the product a clearer purpose." },
    { name: "Scope", score: Math.max(0, Math.round(selectedCore / core.length * 100) - build.extras * 12), explanation: `${selectedCore} of 5 core parts made the first version; ${build.extras} extra feature${build.extras === 1 ? "" : "s"} added complexity.` },
    { name: "AI communication", score: focused ? 100 : state.brief === "list" ? 42 : state.brief === "technical" ? 35 : 20, explanation: focused ? "Your instruction says who needs help, what they need, and how the first version should behave." : "The Builder had to guess because the instruction did not describe the volunteer’s outcome clearly." },
    { name: "Testing", score: (state.firstSignup ? 20 : 0) + (state.overlapTried ? 25 : 0) + (retest ? 30 : state.retestSignup ? 10 : 0) + (nearby ? 25 : state.nearbyFirst ? 10 : 0), explanation: retest && nearby ? "You tried the original task again and checked that the space limit still worked." : "Your checks left some important behavior unconfirmed." },
    { name: "Feedback", score: feedback ? 100 : state.feedbackChoices.length ? 35 : 0, explanation: feedback ? "You acted on an observed problem instead of treating every request as equally urgent." : "The feedback included a signup or organizer problem that affects event day." },
    { name: "Iteration", score: focusedGoal && retest ? 100 : focusedGoal ? 65 : state.buildCount > 1 && retest ? 55 : state.goal ? 30 : 0, explanation: focusedGoal && retest ? "Your focused change fixed overlapping signups, and you checked it again." : "A narrower change tied to what you saw would make the next build easier to judge." },
    { name: "Reviewing AI work", score: state.overlapTried && state.retestOverlapTried && state.nearbyOverbookTried ? 100 : state.overlapTried && state.retestOverlapTried ? 70 : state.overlapTried ? 40 : 0, explanation: state.overlapTried && state.retestOverlapTried && state.nearbyOverbookTried ? "You checked both the repair and a nearby signup limit." : "Trying the app after each change gives evidence beyond the Builder’s report." },
    { name: "Shipping", score: shipMatches ? 100 : state.finalChoice ? 20 : 0, explanation: shipMatches ? ready ? "You shared after the main task and space limit both worked." : "You held it back after your checks found a problem." : "Your choice to share did not match what the volunteer and organizer checks showed." },
  ];
}

export function mission6Summary(state: Mission6State) {
  const build = mission6Build(state);
  const retest = mission6RetestPassed(state);
  const nearby = mission6NearbyPassed(state);
  const brief = mission6Definition.briefs.find((item) => item.id === state.brief)?.label ?? "No instruction chosen";
  const goal = mission6Definition.goals.find((item) => item.id === state.goal)?.label ?? "No next goal chosen";
  return {
    investigation: `${state.questionsAsked.length} questions asked. ${build.discovery ? "You uncovered the overlap failure and volunteer task." : "The real cause was still partly hidden."}`,
    version: `${state.selectedFeatures.filter((id) => mission6Definition.features.find((item) => item.id === id)?.core).length} core parts and ${build.extras} extras selected.`,
    instruction: brief,
    firstTry: !state.overlapTried ? "You did not try the overlapping shift." : build.overlap ? "The app stopped the second overlapping signup." : "Jordan could take two shifts that overlap.",
    feedback: state.feedbackChoices.map((id) => mission6Definition.feedback.find((item) => item.id === id)?.label ?? id),
    goal,
    followUp: state.followUp === "evidence" ? "You described Jordan’s new result and what should happen." : state.followUp ? "You asked for another change without explaining what happened." : "The first change worked; no follow-up was needed.",
    builder: state.goal === "focused" ? "The Builder added an overlap check and kept the space limit." : state.goal === "guess" ? "The Builder hid overlapping shifts, but the space limit stopped working." : state.goal === "broad" ? "The Builder changed several parts at once; the space limit needs another check." : "The Builder made a small unclear change, and overlapping signups may still get through.",
    retest: !state.retestOverlapTried ? "You did not repeat the overlapping signup after the change." : retest ? "You repeated the steps; the overlapping signup was stopped." : "You repeated the steps, but the overlapping signup was still accepted.",
    nearby: !state.nearbyOverbookTried ? "You did not check the last open space." : nearby ? "The app stopped a third volunteer from taking a full shift." : "A third volunteer could take a shift after its spaces were full.",
    decision: state.finalChoice === "share" ? retest && nearby ? "You shared after both checks worked." : "You shared even though a check still showed a problem." : state.finalChoice === "improve" ? "You held the version for another focused improvement." : state.finalChoice === "features" ? "You chose more features before the event-day checks were all clear." : "You chose to rebuild, even though a smaller change could address the evidence.",
  };
}

export interface Mission6Attempt { number: number; skills: SkillScore[]; summary: ReturnType<typeof mission6Summary> }
export interface Mission6Progress { attempts: Mission6Attempt[]; latestSkillResults: SkillScore[]; bestSkillResults: SkillScore[]; completed: boolean }
export const initialMission6Progress: Mission6Progress = { attempts: [], latestSkillResults: [], bestSkillResults: [], completed: false };
export function recordMission6Attempt(progress: Mission6Progress, state: Mission6State, number: number): Mission6Progress {
  const skills = mission6Scores(state);
  const best = new Map(progress.bestSkillResults.map((skill) => [skill.name, skill]));
  return { completed: true, latestSkillResults: skills, bestSkillResults: skills.map((skill) => (best.get(skill.name)?.score ?? -1) > skill.score ? best.get(skill.name)! : skill), attempts: [...progress.attempts, { number, skills, summary: mission6Summary(state) }] };
}
