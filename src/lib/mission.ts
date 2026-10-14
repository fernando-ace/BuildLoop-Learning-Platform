export const stages = [
  "Meet Ari",
  "Find the problem",
  "Choose the MVP",
  "Brief the AI",
  "Review the build",
  "Test it",
  "Hear feedback",
  "Choose a change",
  "Retest",
  "Ship",
] as const;

export type StageIndex = number;
export type TestId = "checkout" | "return" | "blank-name" | "double-checkout" | "persistence";

export interface TestResult {
  passed: boolean;
  detail: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  kind: string;
  borrower: string;
  available: boolean;
}

export interface PromptQuality {
  context: number;
  behavior: number;
  boundaries: number;
  verification: number;
  total: number;
}

export interface MissionState {
  stage: StageIndex;
  questionsAsked: string[];
  problemChoice: string;
  selectedFeatures: string[];
  brief: string;
  promptQuality: PromptQuality;
  buildIssues: string[];
  testsRun: TestId[];
  testResults: Partial<Record<TestId, TestResult>>;
  equipment: EquipmentItem[];
  borrowerInput: string;
  feedbackChoices: string[];
  iterationChoice: string;
  iterationTested: boolean;
  shipped: boolean;
}

export const initialEquipment: EquipmentItem[] = [
  { id: "camera", name: "Canon EOS M50", kind: "Camera", borrower: "", available: true },
  { id: "tripod", name: "Tripod", kind: "Support", borrower: "Maya", available: false },
  { id: "mic", name: "Shotgun mic", kind: "Audio", borrower: "", available: true },
  { id: "light", name: "LED light kit", kind: "Lighting", borrower: "", available: true },
];

export const featureCatalog = [
  { id: "list", label: "View equipment list", cost: 1, core: true },
  { id: "checkout", label: "Check out an item", cost: 1, core: true },
  { id: "borrower", label: "Enter borrower name", cost: 1, core: true },
  { id: "return", label: "Return an item", cost: 1, core: true },
  { id: "persistence", label: "Save after refresh", cost: 1, core: true },
  { id: "accounts", label: "Member accounts", cost: 3, core: false },
  { id: "reservations", label: "Reservations", cost: 2, core: false },
  { id: "qr", label: "QR code scanning", cost: 3, core: false },
  { id: "analytics", label: "Analytics dashboard", cost: 2, core: false },
  { id: "profiles", label: "Member profiles", cost: 2, core: false },
  { id: "notifications", label: "Notifications", cost: 2, core: false },
  { id: "dark-mode", label: "Dark mode", cost: 1, core: false },
] as const;

export const questionCatalog = [
  {
    id: "breaks",
    text: "What goes wrong most often?",
    answer: "Someone borrows a camera for a project, then it gets left in a classroom. We spend half a meeting trying to remember who had it last.",
    insight: "Misplaced equipment is the recurring pain.",
    useful: true,
  },
  {
    id: "users",
    text: "Who needs to use this?",
    answer: "Mostly me and the other club officers. Any member should be able to borrow gear, but an officer needs to keep the list accurate.",
    insight: "Officers track it; members borrow it.",
    useful: true,
  },
  {
    id: "fast-answer",
    text: "What do you need to know quickly?",
    answer: "Whether the camera is here, and who has it if it isn't. I need that before we plan a shoot.",
    insight: "Availability and borrower are the key facts.",
    useful: true,
  },
  {
    id: "color",
    text: "What color should the app be?",
    answer: "I haven't really thought about that. Right now I just need to stop guessing where the gear went.",
    insight: "A visual detail can wait until the problem is clear.",
    useful: false,
  },
  {
    id: "animations",
    text: "Would you like animations?",
    answer: "Maybe? The bigger thing is knowing who has the camera when we need it.",
    insight: "A polish question didn't uncover the workflow.",
    useful: false,
  },
] as const;

export const problemOptions = [
  { id: "tech", text: "Photography clubs need better technology.", quality: 0, reason: "It names a broad topic, but not Ari's actual difficulty." },
  { id: "organize", text: "Ari needs a better way to organize the club.", quality: 1, reason: "It points toward a need, but could describe many different problems." },
  { id: "equipment", text: "Ari cannot quickly tell whether equipment is available or who has it.", quality: 2, reason: "It names Ari, the missing information, and why the current process is frustrating." },
] as const;

export const iterationOptions = [
  { id: "return", text: "Make Return easier to find, then watch Ari try it again.", signal: "Observed Ari pause while returning gear" },
  { id: "blank", text: "Fix blank-name checkout and verify it is rejected.", signal: "A blank borrower name slipped through testing" },
  { id: "reservations", text: "Add reservations because Ari asked for them.", signal: "Ari asked about reservations" },
  { id: "dark", text: "Add dark mode because another student asked for it.", signal: "A student said dark mode would be cool" },
  { id: "rewrite", text: "Rebuild the whole app with accounts and a new layout.", signal: "No evidence calls for replacing the parts that work" },
] as const;

export const initialState: MissionState = {
  stage: 0,
  questionsAsked: [],
  problemChoice: "",
  selectedFeatures: [],
  brief: "",
  promptQuality: { context: 0, behavior: 0, boundaries: 0, verification: 0, total: 0 },
  buildIssues: [],
  testsRun: [],
  testResults: {},
  equipment: initialEquipment,
  borrowerInput: "",
  feedbackChoices: [],
  iterationChoice: "",
  iterationTested: false,
  shipped: false,
};

const patterns = {
  context: /ari|photography club|officer|equipment|borrow/i,
  behavior: /check.?out|borrow|return|available|borrower|name|track/i,
  boundaries: /do not|don't|only|no account|no reservation|keep it simple|small|without/i,
  verification: /test|check|verify|blank|invalid|unavailable|refresh|persist|definition of done|done when/i,
};

export function evaluateBrief(brief: string): PromptQuality {
  const points = Object.fromEntries(
    Object.entries(patterns).map(([key, pattern]) => [key, pattern.test(brief) ? 25 : 0]),
  ) as Omit<PromptQuality, "total">;
  return { ...points, total: Object.values(points).reduce((sum, value) => sum + value, 0) };
}

export function costOf(features: string[]): number {
  return featureCatalog.reduce((sum, feature) => sum + (features.includes(feature.id) ? feature.cost : 0), 0);
}

export function getBuildIssues(state: Pick<MissionState, "selectedFeatures" | "brief" | "promptQuality">): string[] {
  const issues: string[] = [];
  const brief = state.brief.toLowerCase();
  if (!/blank|empty|name.*required|required.*name|invalid input/.test(brief)) {
    issues.push("blank-name");
  }
  if (!/unavailable|already borrowed|already checked out|prevent.*double|one borrower/.test(brief)) {
    issues.push("double-checkout");
  }
  if (!/easy to find|easy to spot|clear return|obvious return|return button.*visible|visible.*return button/.test(brief)) {
    issues.push("return-confusing");
  }
  if (!state.selectedFeatures.includes("persistence")) {
    issues.push("persistence");
  }
  if (state.promptQuality.boundaries === 0) {
    issues.push("extra-feature");
  }
  return issues;
}

export function runTest(state: MissionState, test: TestId): TestResult {
  const issues = state.buildIssues;
  const has = (id: string) => issues.includes(id);
  switch (test) {
    case "checkout":
      return { passed: state.selectedFeatures.includes("checkout") && state.selectedFeatures.includes("borrower"), detail: "The item should show its borrower and become unavailable." };
    case "return":
      return { passed: state.selectedFeatures.includes("return"), detail: "The borrower should clear and the item should become available." };
    case "blank-name":
      return { passed: !has("blank-name"), detail: has("blank-name") ? "The build accepted an empty borrower name." : "Empty names are rejected without changing the item." };
    case "double-checkout":
      return { passed: !has("double-checkout"), detail: has("double-checkout") ? "The build lets someone check out an item that is already borrowed." : "An unavailable item cannot be checked out again." };
    case "persistence":
      return { passed: !has("persistence"), detail: has("persistence") ? "The item state resets when the page refreshes." : "The checkout remains after a refresh." };
  }
}

export function skillScores(state: MissionState): { name: string; score: number; explanation: string }[] {
  const usefulQuestions = state.questionsAsked.filter((id) => questionCatalog.find((question) => question.id === id)?.useful).length;
  const problem = problemOptions.find((option) => option.id === state.problemChoice);
  const coreSelected = featureCatalog.filter((feature) => feature.core && state.selectedFeatures.includes(feature.id)).length;
  const extraCost = Math.max(0, costOf(state.selectedFeatures) - coreSelected);
  const goodFeedback = state.feedbackChoices.includes("return") || state.feedbackChoices.includes("blank");
  const evidenceIteration = state.iterationChoice === "return" || state.iterationChoice === "blank";
  const relevantTests = state.testsRun.filter((id) => ["checkout", "return", "blank-name", "double-checkout", "persistence"].includes(id)).length;
  return [
    { name: "User understanding", score: Math.min(100, usefulQuestions * 34), explanation: `${usefulQuestions} questions uncovered how Ari tracks gear and what they need to know.` },
    { name: "Problem definition", score: problem ? problem.quality === 2 ? 100 : problem.quality === 1 ? 58 : 24 : 0, explanation: problem?.reason ?? "You haven't picked a problem statement yet." },
    { name: "Scope discipline", score: Math.round(Math.max(0, (coreSelected / 5) * 80 + 20 - Math.min(20, extraCost * 8))), explanation: `${coreSelected} of 5 useful MVP features made the cut; ${costOf(state.selectedFeatures)} of 7 build points used.` },
    { name: "AI direction", score: state.promptQuality.total, explanation: `Your brief covered ${Object.values(state.promptQuality).filter((score) => score === 25).length} of 4 parts: context, behavior, boundaries, and checks.` },
    { name: "Verification", score: Math.min(100, relevantTests * 20), explanation: `You ran ${relevantTests} checks. Each one gives you evidence about the build.` },
    { name: "Feedback judgment", score: goodFeedback ? 100 : state.feedbackChoices.length ? 48 : 0, explanation: goodFeedback ? "You prioritized an observed pause or a concrete product failure." : "You chose feedback, but missed the clearest evidence about Ari's task." },
    { name: "Iteration", score: evidenceIteration && state.iterationTested ? 100 : evidenceIteration ? 75 : state.iterationTested ? 42 : 20, explanation: evidenceIteration && state.iterationTested ? "You retested a focused change tied to the evidence." : evidenceIteration ? "You chose an evidence-based change, but did not retest it." : state.iterationTested ? "You built a change, but it did not address the clearest evidence." : "A focused change should be retested before shipping." },
  ];
}

export function makeBuilderSummary(state: MissionState) {
  return {
    user: "Ari, photography club officer",
    problem: problemOptions.find((option) => option.id === state.problemChoice)?.text ?? "Not selected",
    mvp: featureCatalog.filter((feature) => state.selectedFeatures.includes(feature.id)).map((feature) => feature.label),
    tests: state.testsRun.map((id) => ({ id, name: testLabels[id], result: state.testResults[id] })),
    feedback: state.feedbackChoices.map((id) => iterationOptions.find((option) => option.id === id)?.signal ?? id),
    iteration: iterationOptions.find((option) => option.id === state.iterationChoice)?.text ?? "No change selected",
    iterationReason: iterationOptions.find((option) => option.id === state.iterationChoice)?.signal ?? "No evidence selected",
    finalEquipment: state.equipment.map((item) => ({ name: item.name, borrower: item.borrower || "Available", available: item.available })),
  };
}

export const testLabels: Record<TestId, string> = {
  checkout: "Happy path checkout",
  return: "Return an item",
  "blank-name": "Blank borrower name",
  "double-checkout": "Double checkout",
  persistence: "State after refresh",
};
