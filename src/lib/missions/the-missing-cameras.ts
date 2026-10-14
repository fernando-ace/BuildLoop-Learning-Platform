import type { MissionDefinition } from "../mission-types";
import type { EquipmentItem, MissionState } from "../mission";

export const stages = [
  "Meet Ari", "Find the problem", "First version", "Give the AI a goal", "Review the build",
  "Test it", "Hear feedback", "Choose a change", "Retest", "Ship",
] as const;

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
  { id: "breaks", text: "What goes wrong most often?", answer: "Someone borrows a camera for a project, then it gets left in a classroom. We spend half a meeting trying to remember who had it last.", insight: "Misplaced equipment is the recurring pain.", useful: true },
  { id: "users", text: "Who needs to use this?", answer: "Mostly me and the other club officers. Any member should be able to borrow gear, but an officer needs to keep the list accurate.", insight: "Officers track it; members borrow it.", useful: true },
  { id: "fast-answer", text: "What do you need to know quickly?", answer: "Whether the camera is here, and who has it if it isn't. I need that before we plan a shoot.", insight: "Availability and borrower are the key facts.", useful: true },
  { id: "color", text: "What color should the app be?", answer: "I haven't really thought about that. Right now I just need to stop guessing where the gear went.", insight: "A visual detail can wait until the problem is clear.", useful: false },
  { id: "animations", text: "Would you like animations?", answer: "Maybe? The bigger thing is knowing who has the camera when we need it.", insight: "A polish question didn't uncover the workflow.", useful: false },
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

const briefSignals = {
  context: /ari|photography club|officer|equipment|borrow/i,
  behavior: /check.?out|borrow|return|available|borrower|name|track/i,
  boundaries: /do not|don't|only|no account|no reservation|keep it simple|small|without/i,
  verification: /test|check|verify|blank|invalid|unavailable|refresh|persist|definition of done|done when/i,
};

const buildIssueRules = [
  { id: "blank-name", source: "brief", pattern: /blank|empty|name.*required|required.*name|invalid input/ },
  { id: "double-checkout", source: "brief", pattern: /unavailable|already borrowed|already checked out|prevent.*double|one borrower/ },
  { id: "return-confusing", source: "brief", pattern: /easy to find|easy to spot|clear return|obvious return|return button.*visible|visible.*return button/ },
  { id: "persistence", source: "feature", featureId: "persistence" },
  { id: "extra-feature", source: "signal", signal: "boundaries" },
] as const;

export const testLabels = {
  checkout: { label: "Happy path checkout", passed: "The item shows its borrower and becomes unavailable.", failed: "The item should show its borrower and become unavailable." },
  return: { label: "Return an item", passed: "The borrower clears and the item becomes available.", failed: "The borrower should clear and the item should become available." },
  "blank-name": { label: "Blank borrower name", passed: "Empty names are rejected without changing the item.", failed: "The build accepted an empty borrower name." },
  "double-checkout": { label: "Double checkout", passed: "An unavailable item cannot be checked out again.", failed: "The build lets someone check out an item that is already borrowed." },
  persistence: { label: "State after refresh", passed: "The checkout remains after a refresh.", failed: "The item state resets when the page refreshes." },
} as const;

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

export const mission1Definition = {
  metadata: {
    id: "missing-cameras",
    number: 1,
    title: "The Missing Cameras",
    description: "Help a school photography club stop losing track of its cameras.",
    estimatedMinutes: 20,
  },
  steps: [
    { id: "discover", label: "Meet Ari", learningConcept: "Understand the user" },
    { id: "define", label: "Define", learningConcept: "Describe the real problem" },
    { id: "scope", label: "First version", learningConcept: "Choose what to build first" },
    { id: "brief", label: "Brief", learningConcept: "Give clear instructions" },
    { id: "build", label: "Build", learningConcept: "Check what was built" },
    { id: "test", label: "Test", learningConcept: "Test the product" },
    { id: "feedback", label: "Feedback", learningConcept: "Use feedback" },
    { id: "iterate", label: "Iterate", learningConcept: "Improve with evidence" },
    { id: "retest", label: "Ship", learningConcept: "Retest and ship" },
  ],
  characters: [{ id: "ari", name: "Ari", role: "Photography club officer", introduction: "We keep track in the group chat, but nobody can tell who has the camera." }],
  choices: { questions: questionCatalog, problems: problemOptions, features: featureCatalog, iterations: iterationOptions },
  skillNames: ["User understanding", "Problem definition", "Scope", "AI communication", "Testing", "Feedback", "Iteration", "Shipping"],
  scoring: {
    featureBudget: 7,
    coreFeatureIds: featureCatalog.filter((feature) => feature.core).map((feature) => feature.id),
    briefSignals,
    buildIssueRules,
    scopeWeights: { startingPoints: 20, coreFeaturePoints: 80, extraFeaturePenalty: 8, maxExtraPenalty: 20 },
  },
  consequences: {
    buildIssues: {
      "blank-name": "Blank borrower names are accepted",
      "double-checkout": "An already borrowed item can be checked out again",
      "return-confusing": "The Return action is hard to spot",
      persistence: "Changes disappear after a refresh",
      "extra-feature": "The AI added an extra feature you did not ask for",
    },
    tests: testLabels,
    shipped: "You brought the product through a final check and shipped it.",
  },
  summaryLessons: {
    groundedProblem: "You asked how the work happens before choosing features. That helped you name Ari’s real problem.",
    specificProblem: "You named the missing information Ari needs. Next time, ask another question before you settle on a solution.",
    vagueProblem: "A more specific problem would make it easier to choose the first useful thing to build.",
    focusedScope: "You kept the first version focused on the basic equipment handoff.",
    broadScope: "You added extra features before testing the basic handoff. Next time, prove the smallest version first.",
    incompleteScope: "Your choices shaped what the AI could build. Check that the basic equipment handoff is covered.",
    focusedIteration: "You used Ari’s feedback to make one focused change, then checked it again.",
    evidenceIteration: "Your tests gave you evidence about the build. Tie your next change to the clearest result, then retest it.",
  },
} satisfies MissionDefinition;
