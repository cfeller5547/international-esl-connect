import {
  countSubstantiveFollowUpResponses,
  type LearnMissionTurn,
} from "@/lib/learn-speaking";

import type {
  MissionEvidenceSummary,
  MissionEvidenceTarget,
} from "./learn-speaking-types";

type EvidenceContext = {
  targetPhrases: string[];
  evidenceTargets: MissionEvidenceTarget[];
  followUpObjectives: string[];
  benchmarkFocus: string[];
  followUpPrompts: string[];
  minimumFollowUpResponses: number;
  successCriteria: string[];
};

export type MissionEvidenceAnalysis = {
  observedTargetIds: string[];
  missingTargetIds: string[];
  observedLabels: string[];
  missingLabels: string[];
  substantiveFollowUpCount: number;
  nextFollowUpPrompt: string | null;
  nextFocus: string;
};

function normalizeText(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesCue(text: string, phrase: string) {
  const normalizedPhrase = normalizeText(phrase.replace(/\.\.\.$/, ""));
  return normalizedPhrase.length > 0 && normalizeText(text).includes(normalizedPhrase);
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function turnHasDetailSignal(text: string) {
  return /\b(because|for example|for instance|then|after that|later|finally|so|but|also|first)\b/i.test(
    text
  );
}

function studentTurns(turns: LearnMissionTurn[]) {
  return turns.filter((turn) => turn.speaker === "student");
}

function isTargetCovered({
  target,
  turns,
  targetPhrases,
  minimumFollowUpResponses,
}: {
  target: MissionEvidenceTarget;
  turns: LearnMissionTurn[];
  targetPhrases: string[];
  minimumFollowUpResponses: number;
}) {
  const studentOnlyTurns = studentTurns(turns);
  const combinedStudentText = studentOnlyTurns.map((turn) => turn.text).join(" ").trim();
  const cues = [...target.cues, ...(target.kind === "language" ? targetPhrases : [])];

  switch (target.kind) {
    case "language":
      return cues.some((phrase) => includesCue(combinedStudentText, phrase));
    case "detail":
      return (
        cues.some((phrase) => includesCue(combinedStudentText, phrase)) ||
        studentOnlyTurns.some((turn) => countWords(turn.text) >= 8) ||
        studentOnlyTurns.some((turn) => turnHasDetailSignal(turn.text))
      );
    case "follow_up":
      return countSubstantiveFollowUpResponses(turns) >= minimumFollowUpResponses;
    case "task":
    default:
      return (
        cues.some((phrase) => includesCue(combinedStudentText, phrase)) ||
        countWords(combinedStudentText) >= 8
      );
  }
}

export function analyzeMissionEvidence({
  context,
  turns,
}: {
  context: EvidenceContext;
  turns: LearnMissionTurn[];
}): MissionEvidenceAnalysis {
  const substantiveFollowUpCount = countSubstantiveFollowUpResponses(turns);
  const observedTargetIds: string[] = [];
  const missingTargetIds: string[] = [];
  const observedLabels: string[] = [];
  const missingLabels: string[] = [];

  for (const target of context.evidenceTargets) {
    if (
      isTargetCovered({
        target,
        turns,
        targetPhrases: context.targetPhrases,
        minimumFollowUpResponses: context.minimumFollowUpResponses,
      })
    ) {
      observedTargetIds.push(target.key);
      observedLabels.push(target.label);
    } else {
      missingTargetIds.push(target.key);
      missingLabels.push(target.label);
    }
  }

  const nextObjective =
    context.followUpObjectives[missingLabels.length > 0 ? 0 : -1] ??
    context.followUpPrompts.find((prompt) => prompt.trim().length > 0) ??
    null;

  return {
    observedTargetIds,
    missingTargetIds,
    observedLabels,
    missingLabels,
    substantiveFollowUpCount,
    nextFollowUpPrompt: nextObjective,
    nextFocus:
      missingLabels[0] ??
      context.successCriteria[0] ??
      "Keep the next answer specific and connected to the task.",
  };
}

export function buildMissionEvidenceSummary(
  analysis: MissionEvidenceAnalysis
): MissionEvidenceSummary {
  return {
    observed: analysis.observedLabels,
    missing: analysis.missingLabels,
    nextFocus: analysis.nextFocus,
    benchmarkFocus: null,
    followUpResponsesObserved: analysis.substantiveFollowUpCount,
    followUpResponsesRequired: 0,
  };
}
