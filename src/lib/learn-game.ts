import type {
  GameActivityPayload,
  LearnGameReview,
  LearnGameReviewStage,
} from "@/server/learn-game-types";

function buildStrength(stages: LearnGameReviewStage[], gameTitle: string) {
  const strongCount = stages.filter((stage) => stage.outcome === "strong").length;

  if (strongCount >= Math.max(stages.length - 1, 1)) {
    return `${gameTitle} is in good shape. You handled the main challenge cleanly before speaking.`;
  }

  if (strongCount >= Math.max(Math.floor(stages.length / 2), 1)) {
    return `You solved the easier parts of ${gameTitle} and kept the unit language moving.`;
  }

  return `You finished ${gameTitle} and stayed with the unit challenge all the way through.`;
}

function buildNextFocus(stages: LearnGameReviewStage[], authoredNextFocus: string) {
  return (
    stages.find((stage) => stage.outcome !== "strong")?.coachNote ??
    authoredNextFocus
  );
}

function buildReplayStageIds(stages: LearnGameReviewStage[]) {
  const replayIds = stages
    .filter((stage) => stage.outcome !== "strong")
    .map((stage) => stage.stageId)
    .slice(0, 2);

  if (replayIds.length > 0) {
    return replayIds;
  }

  return stages.slice(-2).map((stage) => stage.stageId);
}

export function buildGameReview(
  game: GameActivityPayload,
  stages: LearnGameReviewStage[]
): LearnGameReview {
  return {
    gameId: game.gameId,
    gameTitle: game.gameTitle,
    gameKind: game.gameKind,
    strength: game.summary.strength || buildStrength(stages, game.gameTitle),
    nextFocus: buildNextFocus(stages, game.summary.nextFocus),
    bridgeToSpeaking: game.summary.bridgeToSpeaking,
    replayStageIds: buildReplayStageIds(stages),
    stages,
  };
}

export function buildInternalGameScore(stages: LearnGameReviewStage[]) {
  if (stages.length === 0) {
    return 0;
  }

  const total = stages.reduce((score, stage) => {
    return score + (stage.outcome === "strong" ? 100 : 72);
  }, 0);

  return Math.round(total / stages.length);
}
