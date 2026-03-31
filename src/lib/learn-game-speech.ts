import type {
  GameActivityPayload,
  GameStage,
  LaneRunnerGameStage,
} from "@/server/learn-game-types";

function normalizeSpeechText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function laneRunnerFallbackSpeechText(stage: LaneRunnerGameStage) {
  const orderedLabels = stage.targetSequenceIds
    .map((tokenId) => stage.tokens.find((token) => token.id === tokenId)?.label ?? null)
    .filter((label): label is string => Boolean(label))
    .map((label) => normalizeSpeechText(label));

  if (orderedLabels.length === 0) {
    return null;
  }

  return orderedLabels.join(" ");
}

export function getStageResolvedSpeechText(stage: GameStage) {
  const authoredText = stage.presentation?.resolvedSpeechText;
  if (typeof authoredText === "string" && authoredText.trim()) {
    return normalizeSpeechText(authoredText);
  }

  if (stage.kind === "voice_prompt" || stage.kind === "voice_burst") {
    return normalizeSpeechText(stage.targetPhrase);
  }

  if (stage.kind === "lane_runner") {
    return laneRunnerFallbackSpeechText(stage);
  }

  return null;
}

export function getGamePreviewSpeechText(game: GameActivityPayload) {
  const preferredText = game.stages
    .map((stage) => getStageResolvedSpeechText(stage))
    .find((text): text is string => Boolean(text));

  if (preferredText) {
    return preferredText;
  }

  const fallbackText = game.stages
    .map((stage) =>
      normalizeSpeechText(
        stage.kind === "voice_prompt" || stage.kind === "voice_burst"
          ? stage.targetPhrase
          : stage.title
      )
    )
    .filter(Boolean)
    .join(". ");

  return fallbackText || null;
}
