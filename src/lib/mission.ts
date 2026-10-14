import { initialEquipment, initialState, featureCatalog, iterationOptions, mission1Definition, problemOptions, questionCatalog, stages, testLabels } from "./missions/the-missing-cameras";
import type { SkillScore } from "./learner";
import { getBuilderLessons } from "./learner";

export { initialEquipment, initialState, featureCatalog, iterationOptions, mission1Definition, problemOptions, questionCatalog, stages, testLabels };

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

export function evaluateBrief(brief: string): PromptQuality {
  const points = Object.fromEntries(
    Object.entries(mission1Definition.scoring.briefSignals).map(([key, pattern]) => [key, pattern.test(brief) ? 25 : 0]),
  ) as Omit<PromptQuality, "total">;
  return { ...points, total: Object.values(points).reduce((sum, value) => sum + value, 0) };
}

export function costOf(features: string[]): number {
  return featureCatalog.reduce((sum, feature) => sum + (features.includes(feature.id) ? feature.cost : 0), 0);
}

export function getBuildIssues(state: Pick<MissionState, "selectedFeatures" | "brief" | "promptQuality">): string[] {
  const issues: string[] = [];
  const brief = state.brief.toLowerCase();
  for (const rule of mission1Definition.scoring.buildIssueRules) {
    let missing: boolean;
    if (rule.source === "brief") missing = !rule.pattern.test(brief);
    else if (rule.source === "feature") missing = !state.selectedFeatures.includes(rule.featureId);
    else missing = state.promptQuality[rule.signal as keyof Pick<PromptQuality, "context" | "behavior" | "boundaries" | "verification">] === 0;
    if (missing) issues.push(rule.id);
  }
  return issues;
}

export function runTest(state: MissionState, test: TestId): TestResult {
  const issues = state.buildIssues;
  const has = (id: string) => issues.includes(id);
  let passed: boolean;
  switch (test) {
    case "checkout": passed = state.selectedFeatures.includes("checkout") && state.selectedFeatures.includes("borrower"); break;
    case "return": passed = state.selectedFeatures.includes("return"); break;
    case "blank-name": passed = !has("blank-name"); break;
    case "double-checkout": passed = !has("double-checkout"); break;
    case "persistence": passed = !has("persistence"); break;
  }
  const consequence = mission1Definition.consequences.tests[test];
  return { passed, detail: passed ? consequence.passed : consequence.failed };
}

export function skillScores(state: MissionState): SkillScore[] {
  const usefulQuestions = state.questionsAsked.filter((id) => questionCatalog.find((question) => question.id === id)?.useful).length;
  const problem = problemOptions.find((option) => option.id === state.problemChoice);
  const coreSelected = mission1Definition.scoring.coreFeatureIds.filter((id) => state.selectedFeatures.includes(id)).length;
  const extraCost = Math.max(0, costOf(state.selectedFeatures) - coreSelected);
  const goodFeedback = state.feedbackChoices.includes("return") || state.feedbackChoices.includes("blank");
  const evidenceIteration = state.iterationChoice === "return" || state.iterationChoice === "blank";
  const relevantTests = state.testsRun.filter((id) => ["checkout", "return", "blank-name", "double-checkout", "persistence"].includes(id)).length;
  return [
    { name: "User understanding", score: Math.min(100, usefulQuestions * 34), explanation: `${usefulQuestions} questions uncovered how Ari tracks gear and what they need to know.` },
    { name: "Problem definition", score: problem ? problem.quality === 2 ? 100 : problem.quality === 1 ? 58 : 24 : 0, explanation: problem?.reason ?? "You haven't picked a problem statement yet." },
    { name: "Scope", score: Math.round(Math.max(0, (coreSelected / mission1Definition.scoring.coreFeatureIds.length) * mission1Definition.scoring.scopeWeights.coreFeaturePoints + mission1Definition.scoring.scopeWeights.startingPoints - Math.min(mission1Definition.scoring.scopeWeights.maxExtraPenalty, extraCost * mission1Definition.scoring.scopeWeights.extraFeaturePenalty))), explanation: `${coreSelected} of ${mission1Definition.scoring.coreFeatureIds.length} useful MVP features made the cut; ${costOf(state.selectedFeatures)} of ${mission1Definition.scoring.featureBudget} build points used.` },
    { name: "AI communication", score: state.promptQuality.total, explanation: `Your brief covered ${Object.values(state.promptQuality).filter((score) => score === 25).length} of 4 parts: context, behavior, boundaries, and checks.` },
    { name: "Testing", score: Math.min(100, relevantTests * 20), explanation: `You ran ${relevantTests} checks. Each one gives you evidence about the build.` },
    { name: "Feedback", score: goodFeedback ? 100 : state.feedbackChoices.length ? 48 : 0, explanation: goodFeedback ? "You prioritized an observed pause or a concrete product failure." : "You chose feedback, but missed the clearest evidence about Ari's task." },
    { name: "Iteration", score: evidenceIteration && state.iterationTested ? 100 : evidenceIteration ? 75 : state.iterationTested ? 42 : 20, explanation: evidenceIteration && state.iterationTested ? "You retested a focused change tied to the evidence." : evidenceIteration ? "You chose an evidence-based change, but did not retest it." : state.iterationTested ? "You built a change, but it did not address the clearest evidence." : "A focused change should be retested before shipping." },
    { name: "Shipping", score: state.shipped ? 100 : 0, explanation: state.shipped ? "You brought the product through a final check and shipped it." : "Shipping comes after checking that the product is ready." },
  ];
}

export function makeBuilderSummary(state: MissionState) {
  return {
    user: "Ari, photography club officer",
    problem: problemOptions.find((option) => option.id === state.problemChoice)?.text ?? "Not selected",
    mvp: featureCatalog.filter((feature) => state.selectedFeatures.includes(feature.id)).map((feature) => feature.label),
    brief: state.brief.trim() || "No build brief written",
    buildOutcome: state.buildIssues.length ? `The first build missed ${state.buildIssues.length} details from your instructions.` : "The first build followed your brief without any flagged gaps.",
    tests: state.testsRun.map((id) => ({ id, name: testLabels[id].label, result: state.testResults[id] })),
    feedback: state.feedbackChoices.map((id) => iterationOptions.find((option) => option.id === id)?.signal ?? id),
    feedbackActedOn: state.feedbackChoices.includes(state.iterationChoice)
      ? iterationOptions.find((option) => option.id === state.iterationChoice)?.signal ?? "No feedback selected"
      : "No selected feedback signal directly guided this change.",
    iteration: iterationOptions.find((option) => option.id === state.iterationChoice)?.text ?? "No change selected",
    iterationReason: iterationOptions.find((option) => option.id === state.iterationChoice)?.signal ?? "No evidence selected",
    changeMade: state.iterationTested ? iterationOptions.find((option) => option.id === state.iterationChoice)?.text ?? "No change selected" : "No change was retested",
    shipped: state.shipped ? mission1Definition.consequences.shipped : "Not shipped",
    lessons: getBuilderLessons(state),
    finalEquipment: state.equipment.map((item) => ({ name: item.name, borrower: item.borrower || "Available", available: item.available })),
  };
}

export const testLabelText: Record<TestId, string> = Object.fromEntries(
  Object.entries(testLabels).map(([id, definition]) => [id, definition.label]),
) as Record<TestId, string>;
