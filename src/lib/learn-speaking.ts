export type LearnMissionTurn = {
  speaker: "ai" | "student";
  text: string;
};

const SUBSTANTIVE_FOLLOW_UP_MIN_WORDS = 5;

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function getRequiredTurns(isBenchmark: boolean) {
  return isBenchmark ? 5 : 3;
}

export function getRequiredSubstantiveFollowUps(isBenchmark: boolean) {
  return isBenchmark ? 2 : 1;
}

export function countStudentTurns(turns: LearnMissionTurn[]) {
  return turns.filter((turn) => turn.speaker === "student").length;
}

export function countSubstantiveFollowUpResponses(turns: LearnMissionTurn[]) {
  const studentTurns = turns.filter((turn) => turn.speaker === "student");

  return studentTurns.slice(1).filter((turn) => countWords(turn.text) >= SUBSTANTIVE_FOLLOW_UP_MIN_WORDS)
    .length;
}

export function canFinishLearnMission({
  turns,
  isBenchmark,
}: {
  turns: LearnMissionTurn[];
  isBenchmark: boolean;
}) {
  return (
    countStudentTurns(turns) >= getRequiredTurns(isBenchmark) &&
    countSubstantiveFollowUpResponses(turns) >= getRequiredSubstantiveFollowUps(isBenchmark)
  );
}
