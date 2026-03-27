export type MissionEvidenceTarget = {
  key: string;
  label: string;
  kind: "task" | "language" | "detail" | "follow_up";
  cues: string[];
};

export type SpeakingMissionPayload = {
  scenarioTitle: string;
  scenarioSetup: string;
  counterpartRole: string;
  openingQuestion: string;
  warmupPrompts: string[];
  targetPhrases: string[];
  followUpPrompts: string[];
  successCriteria: string[];
  modelExample: string;
  isBenchmark: boolean;
  requiredTurns: number;
  minimumFollowUpResponses: number;
  evidenceTargets: MissionEvidenceTarget[];
  followUpObjectives: string[];
  benchmarkFocus: string[];
};

export type MissionEvidenceSummary = {
  observed: string[];
  missing: string[];
  nextFocus: string;
  benchmarkFocus: string | null;
  followUpResponsesObserved: number;
  followUpResponsesRequired: number;
};
