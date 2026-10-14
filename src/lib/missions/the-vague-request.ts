import type { SkillScore } from "../learner";

export const mission2Definition = {
  metadata: { id: "vague-request", number: 2, title: "The Vague Request", description: "Turn Maya's rough idea into a focused volunteer signup app, then test and improve what the AI builds.", estimatedMinutes: 18 },
  steps: ["The request", "The first brief", "Review your brief", "Version 1", "Test the build", "Find the gap", "Give feedback", "Version 2", "Retest and ship", "Builder summary"],
  skills: ["User understanding", "Problem definition", "Scope", "AI communication", "Testing", "Feedback", "Iteration", "Shipping"],
  questions: [
    { id: "events", text: "What do students need to see?", answer: "Upcoming events, with the date, time, place, and a short description. Details are scattered across messages now.", insight: "Students need one clear list of upcoming events and their details.", useful: true },
    { id: "signup", text: "What should students be able to do?", answer: "Join an event, and organizers need to see who signed up. People currently say yes in chat and forget which event they meant.", insight: "Students join an event; organizers need a signup list.", useful: true },
    { id: "accounts", text: "Do students need accounts?", answer: "Not for the first version. A name with a signup is enough for now.", insight: "Accounts are not needed for the first version.", useful: true },
    { id: "reminders", text: "What can wait until later?", answer: "Reminders might be useful eventually, but a clear signup flow matters first.", insight: "Reminders can wait until the basic flow works.", useful: true },
    { id: "colors", text: "What colors should the app use?", answer: "We can decide that later. The event details are the real problem.", insight: "Visual polish can wait until the workflow is clear.", useful: false },
    { id: "social", text: "Should it include a club social feed?", answer: "Maybe eventually, but we need event signups to stop getting lost first.", insight: "A social feed does not solve today's signup confusion.", useful: false },
  ],
  events: [
    { id: "park", name: "Park clean-up", date: "Saturday, Oct 17", time: "9:00–11:00 AM", place: "Riverside Park", description: "Help clear litter from the river path." },
    { id: "pantry", name: "Campus food pantry", date: "Saturday, Oct 17", time: "1:00–3:00 PM", place: "Student Center, Room 104", description: "Sort donations for local families." },
    { id: "garden", name: "Community garden", date: "Sunday, Oct 18", time: "10:00 AM–12:00 PM", place: "Oak Street Garden", description: "Prepare planting beds for the season." },
  ],
  issueText: { details: "The event card is missing details Jordan needs to choose.", signup: "Jordan cannot actually join an event.", confirmation: "Jordan clicked Sign Up but got no confirmation.", complexity: "The first version has extra steps that slow down the task." },
  shipping: [
    { id: "ship", label: "Ship the focused first version now that the core task works" },
    { id: "fix-core", label: "Fix the remaining core problem and retest before shipping" },
    { id: "features", label: "Add another large feature before shipping" },
    { id: "rewrite", label: "Rewrite the whole app" },
    { id: "polish", label: "Keep tweaking cosmetic details" },
  ],
  options: {
    audience: [{ id: "students", label: "Students in Maya's volunteer club", score: 2 }, { id: "everyone", label: "Anyone on campus", score: 1 }, { id: "organizers", label: "Only club organizers", score: 0 }],
    problem: [{ id: "scattered", label: "Event details and signups get lost across messages", score: 2 }, { id: "events", label: "The club needs more events", score: 0 }, { id: "organize", label: "The club needs a better way to organize", score: 1 }],
    build: [{ id: "web", label: "A simple mobile-friendly web app", score: 2 }, { id: "platform", label: "A full native app for every platform", score: 1 }, { id: "dashboard", label: "An organizer dashboard", score: 0 }],
    features: [{ id: "details", label: "Show event date, time, place, and description", score: 2 }, { id: "signup", label: "Let a student join an event with their name", score: 2 }, { id: "roster", label: "Let organizers see the signup list", score: 2 }, { id: "reminders", label: "Send reminders and notifications", score: 0 }, { id: "accounts", label: "Create accounts and profiles", score: 0 }, { id: "feed", label: "Add a social feed and messaging", score: 0 }],
    boundaries: [{ id: "simple", label: "Keep this first version simple; no accounts or reminders", score: 2 }, { id: "accounts", label: "Add accounts, but save reminders for later", score: 1 }, { id: "everything", label: "Build every feature now", score: 0 }],
    success: [{ id: "flow", label: "A student can find an event, sign up, and see confirmation", score: 2 }, { id: "list", label: "The app shows a list of events", score: 1 }, { id: "launch", label: "The app looks polished", score: 0 }],
    feedback: [{ id: "confirmation", label: "After Sign Up, show the event name, date, and time so students know it worked.", issue: "confirmation", score: 2 }, { id: "details", label: "Show each event's date, time, and location on its card.", issue: "details", score: 2 }, { id: "vague", label: "Make it better.", issue: "none", score: 0 }, { id: "page", label: "Fix the signup page.", issue: "none", score: 1 }, { id: "features", label: "Add accounts, reminders, and a messaging page.", issue: "none", score: 0 }],
  },
} as const;

export type Mission2Stage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type BriefField = "audience" | "problem" | "build" | "features" | "boundaries" | "success";
export type Mission2Brief = Partial<Record<Exclude<BriefField, "features">, string>> & { features?: string[] };
export interface Mission2State {
  stage: Mission2Stage; questionsAsked: string[]; briefChoices: Mission2Brief; brief: string;
  v1Issues: string[]; selectedEvent: string; joined: boolean; observedProblem: string; feedback: string; v2Changes: string[]; retestTried: boolean; retestJoined: boolean; retested: boolean; retestPassed: boolean; shipChoice: string;
}
export const initialMission2State: Mission2State = { stage: 0, questionsAsked: [], briefChoices: {}, brief: "", v1Issues: [], selectedEvent: "", joined: false, observedProblem: "", feedback: "", v2Changes: [], retestTried: false, retestJoined: false, retested: false, retestPassed: false, shipChoice: "" };
export interface Mission2Attempt { number: number; skills: SkillScore[]; summary: ReturnType<typeof mission2Summary>; }
export interface Mission2Progress { attempts: Mission2Attempt[]; latestSkillResults: SkillScore[]; bestSkillResults: SkillScore[]; completed: boolean; }
export const initialMission2Progress: Mission2Progress = { attempts: [], latestSkillResults: [], bestSkillResults: [], completed: false };
export type Mission2Action = { type: "START" } | { type: "ASK"; id: string } | { type: "BRIEF"; field: BriefField; id: string } | { type: "PREVIEW_BRIEF" } | { type: "ADVANCE" } | { type: "BUILD" } | { type: "SELECT_EVENT"; event: string } | { type: "SIGN_UP" } | { type: "OBSERVE"; problem: string } | { type: "FEEDBACK"; id: string } | { type: "BUILD_V2" } | { type: "RETEST" } | { type: "SHIP"; choice: string } | { type: "RETURN" };

export function makeFirstBrief(choices: Mission2Brief, questionIds: string[]): string {
  const chosen = (field: "audience" | "problem" | "build" | "boundaries" | "success") => mission2Definition.options[field].find((option) => option.id === choices[field]);
  const features = mission2Definition.options.features.filter((feature) => choices.features?.includes(feature.id)).map((feature) => feature.label.toLowerCase());
  const context = questionIds.length ? questionIds.map((id) => mission2Definition.questions.find((question) => question.id === id)?.insight).filter(Boolean).join(" ") : "";
  return [chosen("build")?.label ?? "Build a simple web app", `for ${chosen("audience")?.label.toLowerCase() ?? "students in the club"}`, `to help with this problem: ${chosen("problem")?.label.toLowerCase() ?? "event sign-ups getting lost"}.`, context, `Include: ${features.length ? features.join("; ") : "a basic event list"}.`, chosen("boundaries")?.label ?? "Keep the first version focused.", `Success means: ${chosen("success")?.label.toLowerCase() ?? "a student can complete the signup task"}.`].filter(Boolean).join(" ");
}
export function buildMission2V1(choices: Mission2Brief, questions: string[]): string[] {
  const features = choices.features ?? [];
  const issues: string[] = [];
  if (!features.includes("details") && !questions.includes("events")) issues.push("details");
  if (!features.includes("signup")) issues.push("signup");
  // Version 1 always has one useful gap: the prompt has not yet asked for an explicit confirmation state.
  issues.push("confirmation");
  if (choices.boundaries !== "simple" || features.some((id) => ["reminders", "accounts", "feed"].includes(id))) issues.push("complexity");
  return issues;
}
export function mission2Reducer(state: Mission2State, action: Mission2Action): Mission2State {
  switch (action.type) {
    case "START": return { ...initialMission2State, stage: 1 };
    case "ASK": return state.questionsAsked.includes(action.id) ? state : { ...state, questionsAsked: [...state.questionsAsked, action.id] };
    case "BRIEF": {
      if (action.field === "features") {
        const current = state.briefChoices.features ?? [];
        const features = current.includes(action.id) ? current.filter((id) => id !== action.id) : [...current, action.id];
        return { ...state, briefChoices: { ...state.briefChoices, features } };
      }
      return { ...state, briefChoices: { ...state.briefChoices, [action.field]: action.id } };
    }
    case "PREVIEW_BRIEF": return { ...state, stage: (state.stage === 1 ? 2 : 3) as Mission2Stage };
    case "ADVANCE": return { ...state, stage: Math.min(state.stage + 1, 10) as Mission2Stage };
    case "BUILD": return { ...state, stage: 4, brief: makeFirstBrief(state.briefChoices, state.questionsAsked), v1Issues: buildMission2V1(state.briefChoices, state.questionsAsked) };
    case "SELECT_EVENT": return { ...state, selectedEvent: action.event };
    case "SIGN_UP": {
      if (!state.selectedEvent) return state;
      if (state.v1Issues.includes("signup")) return state.stage === 8 ? { ...state, retestTried: true } : state;
      return { ...state, joined: true, retestTried: state.stage === 8 ? true : state.retestTried, retestJoined: state.stage === 8 ? true : state.retestJoined };
    }
    case "OBSERVE": return { ...state, observedProblem: action.problem, stage: 6 };
    case "FEEDBACK": return { ...state, feedback: action.id };
    case "BUILD_V2": {
      const feedback = mission2Definition.options.feedback.find((option) => option.id === state.feedback);
      const v2Changes = feedback?.id === "confirmation" ? ["confirmation"] : feedback?.id === "details" ? ["details"] : feedback?.id === "features" ? ["added-features"] : [];
      return { ...state, stage: 7, v2Changes };
    }
    case "RETEST": return { ...state, stage: 9, retested: true, retestPassed: state.retestJoined && !state.v2Changes.includes("added-features") && !state.v1Issues.some((issue) => !state.v2Changes.includes(issue) && ["confirmation", "signup", "details"].includes(issue)) };
    case "SHIP": return { ...state, stage: 10, shipChoice: action.choice };
    case "RETURN": return state;
  }
}
export function mission2Scores(state: Mission2State): SkillScore[] {
  const questionScore = Math.round(state.questionsAsked.filter((id) => mission2Definition.questions.find((question) => question.id === id)?.useful).length / 3 * 100);
  const choiceScore = (field: "audience" | "problem" | "build" | "boundaries" | "success") => {
    const options = mission2Definition.options[field];
    return options.find((option) => option.id === state.briefChoices[field])?.score ?? 0;
  };
  const featureScore = (state.briefChoices.features ?? []).filter((id) => ["details", "signup", "roster"].includes(id)).length;
  const extras = (state.briefChoices.features ?? []).filter((id) => ["reminders", "accounts", "feed"].includes(id)).length;
  const prompt = Math.round((choiceScore("audience") + choiceScore("problem") + choiceScore("build") + Math.min(featureScore, 3) * 2 + choiceScore("boundaries") + choiceScore("success")) / 16 * 100);
  const selectedFeedback = mission2Definition.options.feedback.find((option) => option.id === state.feedback);
  const feedbackMatchesObservation = selectedFeedback?.issue !== "none" && selectedFeedback?.issue === state.observedProblem;
  const shipped = state.shipChoice === "ship" && state.retested && state.retestPassed;
  const shippingScore = shipped ? 100 : state.shipChoice === "fix-core" && state.retested && !state.retestPassed ? 80 : state.shipChoice === "ship" && state.retestPassed ? 90 : state.shipChoice ? 20 : 0;
  const iterationScore = !state.retested
    ? state.v2Changes.length ? feedbackMatchesObservation ? 55 : 30 : 20
    : feedbackMatchesObservation ? state.retestPassed ? 100 : 70 : state.v2Changes.length ? 30 : 20;
  return [
    { name: "User understanding", score: questionScore, explanation: `${state.questionsAsked.length} questions recorded; useful answers add context to your brief.` },
    { name: "Problem definition", score: choiceScore("problem") ? Math.round(choiceScore("problem") / 2 * 100) : 0, explanation: "Your problem choice shaped which needs the first build understood." },
    { name: "Scope", score: Math.max(0, Math.min(100, Math.round((choiceScore("boundaries") * 25 + Math.min(featureScore, 3) * 16 - extras * 12)))), explanation: `${featureScore} core features and ${extras} extras were included.` },
    { name: "AI communication", score: prompt, explanation: "Specific audience, behavior, boundaries, and success criteria give the AI useful direction." },
    { name: "Testing", score: state.retested ? 100 : state.selectedEvent ? 40 : 0, explanation: state.retested ? "You repeated the task after the change and recorded what happened." : "Test the same student task before and after the change." },
    { name: "Feedback", score: feedbackMatchesObservation ? 100 : selectedFeedback?.id === "page" ? 35 : selectedFeedback?.id === "confirmation" || selectedFeedback?.id === "details" ? 40 : 0, explanation: feedbackMatchesObservation ? "Your follow-up named a concrete outcome tied to what you observed." : "Feedback tied to the issue you observed is easier for the AI to act on." },
    { name: "Iteration", score: iterationScore, explanation: "A follow-up is a hypothesis; retesting checks whether the product changed as intended." },
    { name: "Shipping", score: shippingScore, explanation: shipped ? "You shipped after retesting the core flow." : state.shipChoice === "fix-core" && !state.retestPassed ? "You held shipping until the core issue is fixed and retested." : "Ship after checking the core flow works." },
  ];
}
export function recordMission2Attempt(progress: Mission2Progress, state: Mission2State, attemptNumber: number): Mission2Progress {
  const skills = mission2Scores(state);
  const previousBest = new Map(progress.bestSkillResults.map((skill) => [skill.name, skill]));
  const bestSkillResults = skills.map((skill) => {
    const previous = previousBest.get(skill.name);
    return previous && previous.score > skill.score ? previous : skill;
  });
  return { completed: true, latestSkillResults: skills, bestSkillResults, attempts: [...progress.attempts, { number: attemptNumber, skills, summary: mission2Summary(state) }] };
}
export function mission2Summary(state: Mission2State) {
  const observed = state.observedProblem ? state.observedProblem === "details" ? "You spotted that key event details were missing." : state.observedProblem === "signup" ? "You spotted that students could not join an event." : state.observedProblem === "complexity" ? "You spotted extra steps that made the task harder." : "You spotted that the signup gave no clear confirmation." : "No issue was selected.";
  return { original: "We need something that makes signing up for volunteer events easier.", learned: state.questionsAsked.map((id) => mission2Definition.questions.find((question) => question.id === id)?.insight).filter(Boolean), brief: state.brief, v1: state.v1Issues.map((issue) => issue === "details" ? "Event date, time, and location were missing." : issue === "signup" ? "Students could not complete a signup." : issue === "confirmation" ? "Signup gave no clear confirmation." : "The first version included more than the core flow needed."), observed, feedback: mission2Definition.options.feedback.find((option) => option.id === state.feedback)?.label ?? "No specific follow-up selected", changes: state.v2Changes.map((change) => change === "confirmation" ? "Signup now confirms the event name, date, and time." : change === "details" ? "Event cards now show the date, time, and location." : "The AI added accounts, reminders, and messaging, creating more steps."), ship: mission2Definition.shipping.find((option) => option.id === state.shipChoice)?.label ?? "No ship decision recorded", lessons: mission2Scores(state).map((skill) => skill.explanation) };
}
