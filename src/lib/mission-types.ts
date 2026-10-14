export interface MissionStepDefinition {
  id: string;
  label: string;
  learningConcept: string;
}

export interface MissionDefinition<TChoices = unknown> {
  metadata: {
    id: string;
    number: number;
    title: string;
    description: string;
    estimatedMinutes: number;
  };
  steps: readonly MissionStepDefinition[];
  characters: readonly { id: string; name: string; role: string; introduction: string }[];
  choices: TChoices;
  skillNames: readonly string[];
  scoring: {
    featureBudget: number;
    coreFeatureIds: readonly string[];
    briefSignals: Readonly<Record<string, RegExp>>;
    buildIssueRules: readonly (
      | { id: string; source: "brief"; pattern: RegExp }
      | { id: string; source: "feature"; featureId: string }
      | { id: string; source: "signal"; signal: string }
    )[];
    scopeWeights: { startingPoints: number; coreFeaturePoints: number; extraFeaturePenalty: number; maxExtraPenalty: number };
  };
  consequences: {
    buildIssues: Readonly<Record<string, string>>;
    tests: Readonly<Record<string, { label: string; passed: string; failed: string }>>;
    shipped: string;
  };
  summaryLessons: Readonly<Record<string, string>>;
}
