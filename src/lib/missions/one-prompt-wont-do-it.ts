import type { SkillScore } from "../learner";

export const mission3Definition = {
  metadata: { id: "one-prompt-wont-do-it", number: 3, title: "Build, Try, Improve", description: "Give the Builder a clear goal, try the result, and share what should change.", estimatedMinutes: 14 },
  steps: ["Meet Sam", "Guide the first build", "Test version 1", "Give a follow-up", "Review the changes", "Retest", "Choose what ships", "Builder summary"],
  skills: ["User understanding", "AI communication", "Iteration", "Testing", "Scope", "Reviewing AI work"],
  prompts: [
    { id: "vague", label: "Make me a cool website.", kind: "vague", quality: 0 },
    { id: "overloaded", label: "Build the whole site plus accounts, chat, calendars, reminders, an admin dashboard, animations, and anything else useful.", kind: "overloaded", quality: 1 },
    { id: "focused", label: "Sam runs a school club. Build a simple, mobile-friendly site that explains the club, shows the next meeting, and has a clear Join Club button. Keep it easy to read; make the first useful version without extra features.", kind: "focused", quality: 2 },
  ],
  followUps: [
    { id: "vague", label: "Make it better.", kind: "vague" },
    { id: "rewrite", label: "Redo the whole website from scratch.", kind: "broad" },
    { id: "broken", label: "The Join button is broken.", kind: "partial" },
    { id: "focused", label: "When I click Join Club, nothing confirms that I joined. Add a clear success message after the click. Keep the rest of the page unchanged.", kind: "focused" },
  ],
  newIdeas: [
    { id: "ship", label: "Save the photo gallery idea for later and finish the tested first version.", kind: "focused" },
    { id: "add", label: "Add the gallery now before finishing.", kind: "broad" },
    { id: "rebuild", label: "Rebuild the page around a big gallery.", kind: "broad" },
  ],
  meeting: { date: "Thursday, October 22", time: "3:30 PM", place: "Room 214" },
} as const;

export type PromptId = "vague" | "overloaded" | "focused";
export type FollowUpId = "vague" | "rewrite" | "broken" | "focused";
export type Mission3Stage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export interface Mission3State {
  stage: Mission3Stage;
  prompt: PromptId | "";
  v1Issues: string[];
  joined: boolean;
  observed: boolean;
  followUp: FollowUpId | "";
  v2Changes: string[];
  reviewed: boolean;
  reviewMatches: boolean;
  retestTried: boolean;
  retestJoined: boolean;
  retestPassed: boolean;
  finalChoice: "ship" | "add" | "rebuild" | "";
}
export const initialMission3State: Mission3State = { stage: 0, prompt: "", v1Issues: [], joined: false, observed: false, followUp: "", v2Changes: [], reviewed: false, reviewMatches: false, retestTried: false, retestJoined: false, retestPassed: false, finalChoice: "" };
export type Mission3Action =
  | { type: "START" } | { type: "ADVANCE" } | { type: "PROMPT"; id: PromptId } | { type: "BUILD_V1" }
  | { type: "JOIN" } | { type: "OBSERVE" } | { type: "FOLLOW_UP"; id: FollowUpId }
  | { type: "BUILD_V2" } | { type: "REVIEW"; matches: boolean }
  | { type: "CHECK_RETEST" } | { type: "FINAL"; choice: "ship" | "add" | "rebuild" }
  | { type: "RETURN" };

export function buildMission3V1(prompt: PromptId): string[] {
  if (prompt === "vague") return ["description", "meeting", "confirmation", "generic"];
  if (prompt === "overloaded") return ["confirmation", "clutter", "extra-features"];
  return ["confirmation"];
}

export function buildMission3V2(followUp: FollowUpId, v1Issues: string[]): string[] {
  if (followUp === "focused") return ["confirmation"];
  if (followUp === "rewrite") return ["confirmation", "unrelated-layout"];
  if (followUp === "broken") return v1Issues.includes("confirmation") ? ["confirmation"] : [];
  return [];
}

export function mission3Reducer(state: Mission3State, action: Mission3Action): Mission3State {
  switch (action.type) {
    case "START": return { ...initialMission3State, stage: 1 };
    case "ADVANCE": return state.stage === 1 ? { ...state, stage: 2 } : state;
    case "PROMPT": return state.stage === 2 ? { ...state, prompt: action.id } : state;
    case "BUILD_V1": return state.stage === 2 && state.prompt ? { ...state, stage: 3, v1Issues: buildMission3V1(state.prompt) } : state;
    case "JOIN": return state.stage === 6
      ? { ...state, retestTried: true, retestJoined: state.v2Changes.includes("confirmation") && !state.v1Issues.includes("meeting") }
      : state.stage === 3 ? { ...state, joined: true } : state;
    case "OBSERVE": return state.stage === 3 && state.joined ? { ...state, stage: 4, observed: true } : state;
    case "FOLLOW_UP": return state.stage === 4 ? { ...state, followUp: action.id } : state;
    case "BUILD_V2": return state.stage === 4 && state.followUp ? { ...state, stage: 5, v2Changes: buildMission3V2(state.followUp, state.v1Issues), reviewed: false } : state;
    case "REVIEW": return state.stage === 5 ? { ...state, reviewed: true, reviewMatches: action.matches, stage: 6 } : state;
    case "CHECK_RETEST": return state.stage === 6 && state.reviewed ? { ...state, stage: 7, retestPassed: state.retestTried && state.retestJoined && state.v2Changes.includes("confirmation") && !state.v1Issues.includes("meeting") } : state;
    case "FINAL": return state.stage === 7 ? { ...state, stage: 8, finalChoice: action.choice } : state;
    case "RETURN": return state;
  }
}

export function mission3Scores(state: Mission3State): SkillScore[] {
  const prompt = mission3Definition.prompts.find((option) => option.id === state.prompt);
  const followUp = mission3Definition.followUps.find((option) => option.id === state.followUp);
  return [
    { name: "User understanding", score: prompt?.kind === "focused" ? 100 : prompt?.kind === "overloaded" ? 55 : 25, explanation: prompt?.kind === "focused" ? "You gave the AI Sam’s context and the student’s main task." : prompt?.kind === "overloaded" ? "You named a goal, but extra features distracted from the student’s task." : "The AI had little information about Sam or what students needed." },
    { name: "AI communication", score: prompt?.quality === 2 ? 100 : prompt?.quality === 1 ? 55 : 20, explanation: "A concrete goal and a few clear limits help the AI make a useful first version." },
    { name: "Iteration", score: followUp?.kind === "focused" && state.retestPassed ? 100 : followUp?.kind === "partial" && state.retestPassed ? 75 : state.v2Changes.length ? 50 : 20, explanation: followUp?.kind === "focused" ? "You described what happened, what should happen, and what should stay unchanged." : followUp?.kind === "partial" ? "You pointed to the button, but did not describe the result you expected." : "The follow-up was broad or vague, so the AI had to guess what to change." },
    { name: "Testing", score: state.retestTried ? state.retestPassed ? 100 : 55 : state.joined ? 40 : 0, explanation: state.retestTried ? state.retestPassed ? "You clicked Join again and saw that the success message appeared." : "You repeated the task, and it still did not confirm the join." : "Repeat the same student task after the update to check the result." },
    { name: "Scope", score: state.finalChoice === "ship" ? 100 : 30, explanation: state.finalChoice === "ship" ? "You recorded the gallery as a future idea and kept the tested first version focused." : "The gallery added work before the simple club site was ready to finish." },
    { name: "Reviewing AI work", score: state.reviewed && state.reviewMatches ? 100 : state.reviewed ? 60 : 0, explanation: state.reviewed ? state.reviewMatches ? "You checked the change list against what you asked for." : "You inspected the change list and noticed it did not fully match your request." : "Review the AI’s change list before deciding it is done." },
  ];
}

export function mission3Summary(state: Mission3State) {
  const prompt = mission3Definition.prompts.find((option) => option.id === state.prompt);
  const followUp = mission3Definition.followUps.find((option) => option.id === state.followUp);
  return {
    prompt: prompt?.label ?? "No first instruction selected",
    promptQuality: prompt?.kind === "focused" ? "Gave Sam’s context, a clear goal, and limits." : prompt?.kind === "overloaded" ? "Asked for the club site plus many features at once." : "Gave the AI very little context or direction.",
    v1: state.v1Issues.map(issueLabel),
    tested: state.joined,
    followUp: followUp?.label ?? "No follow-up selected",
    changes: state.v2Changes.map((change) => change === "confirmation" ? "Join Club now shows a success message." : "The page layout also changed, even though that was not needed for the button fix."),
    reviewed: state.reviewed,
    reviewMatches: state.reviewMatches,
    retestPassed: state.retestPassed,
    finalChoice: state.finalChoice === "ship" ? "Photo gallery saved for later; the tested first version is ready." : state.finalChoice === "add" ? "The gallery was added before the core site was finished." : "The page was rebuilt around the gallery before finishing the tested task.",
    lessons: mission3Scores(state).map((item) => item.explanation),
  };
}

function issueLabel(issue: string) {
  const labels: Record<string, string> = { description: "The club description was missing.", meeting: "The next meeting time was missing.", confirmation: "Join Club did not confirm success.", generic: "The site looked generic because the instruction had no club context.", clutter: "The site was cluttered by the long feature list.", "extra-features": "Extra screens distracted from the simple club task." };
  return labels[issue] ?? issue;
}

export interface Mission3Attempt { number: number; skills: SkillScore[]; summary: ReturnType<typeof mission3Summary> }
export interface Mission3Progress { attempts: Mission3Attempt[]; latestSkillResults: SkillScore[]; bestSkillResults: SkillScore[]; completed: boolean }
export const initialMission3Progress: Mission3Progress = { attempts: [], latestSkillResults: [], bestSkillResults: [], completed: false };
export function recordMission3Attempt(progress: Mission3Progress, state: Mission3State, number: number): Mission3Progress {
  const skills = mission3Scores(state);
  const best = new Map(progress.bestSkillResults.map((item) => [item.name, item]));
  return { completed: true, latestSkillResults: skills, bestSkillResults: skills.map((item) => (best.get(item.name)?.score ?? -1) > item.score ? best.get(item.name)! : item), attempts: [...progress.attempts, { number, skills, summary: mission3Summary(state) }] };
}
