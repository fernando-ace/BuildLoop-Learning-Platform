import type { MissionState } from "./mission";
import { mission1Definition } from "./missions/the-missing-cameras";

export interface SkillScore {
  name: string;
  score: number;
  explanation: string;
}

export interface LearnerProgress {
  completed: boolean;
  attempts: number;
  currentAttempt: number;
  latestSkillResults: SkillScore[];
  bestSkillResults: SkillScore[];
}

export const initialLearnerProgress: LearnerProgress = {
  completed: false,
  attempts: 0,
  currentAttempt: 0,
  latestSkillResults: [],
  bestSkillResults: [],
};

export function startAttempt(progress: LearnerProgress): LearnerProgress {
  const attempts = progress.attempts + 1;
  return { ...progress, attempts, currentAttempt: attempts };
}

export function completeAttempt(progress: LearnerProgress, skills: SkillScore[]): LearnerProgress {
  const previousBest = new Map(progress.bestSkillResults.map((skill) => [skill.name, skill]));
  const bestSkillResults = skills.map((skill) => {
    const previous = previousBest.get(skill.name);
    return previous && previous.score > skill.score ? previous : skill;
  });
  return { ...progress, completed: true, latestSkillResults: skills, bestSkillResults };
}

export function skillLabel(score: number): "Developing" | "Practicing" | "Strong" {
  if (score >= 80) return "Strong";
  if (score >= 50) return "Practicing";
  return "Developing";
}

export const learnerSkills = mission1Definition.skillNames;

export function getBuilderLessons(state: MissionState): string[] {
  const lessons: string[] = [];
  const usefulQuestions = state.questionsAsked.filter((id) => {
    return mission1Definition.choices.questions.find((question) => question.id === id)?.useful;
  }).length;
  const problem = mission1Definition.choices.problems.find((choice) => choice.id === state.problemChoice);
  const coreCount = mission1Definition.scoring.coreFeatureIds.filter((id) => state.selectedFeatures.includes(id)).length;
  const focusedFeedback = state.feedbackChoices.some((id) => ["return", "blank"].includes(id));
  const focusedIteration = ["return", "blank"].includes(state.iterationChoice);

  if (usefulQuestions >= 2 && problem?.id === "equipment") {
    lessons.push(mission1Definition.summaryLessons.groundedProblem);
  } else if (problem?.id === "equipment") {
    lessons.push(mission1Definition.summaryLessons.specificProblem);
  } else {
    lessons.push(mission1Definition.summaryLessons.vagueProblem);
  }

  if (coreCount >= 5 && state.selectedFeatures.length === 5) {
    lessons.push(mission1Definition.summaryLessons.focusedScope);
  } else if (state.selectedFeatures.length > 5) {
    lessons.push(mission1Definition.summaryLessons.broadScope);
  } else {
    lessons.push(mission1Definition.summaryLessons.incompleteScope);
  }

  if (focusedFeedback && focusedIteration && state.iterationTested) {
    lessons.push(mission1Definition.summaryLessons.focusedIteration);
  } else if (state.testsRun.length > 0) {
    lessons.push(mission1Definition.summaryLessons.evidenceIteration);
  }
  return lessons.slice(0, 3);
}
