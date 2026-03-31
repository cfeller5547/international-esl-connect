import type {
  ArcadeInteractionModel,
  GameCompletionPath,
  GameFailureReason,
  GameMedal,
  GameStage,
  GameStageResult,
  LaneRunnerGameStage,
  LearnGameReviewStage,
  ReactionPickGameStage,
  RouteRaceGameStage,
  SortRushGameStage,
  VoiceBurstGameStage,
} from "@/server/learn-game-types";
import {
  clampMedalToCap,
  getStageChallenge,
  medalCapForAttempt,
} from "@/lib/learn-game-challenge";

export const ARCADE_AUDIO_MUTE_STORAGE_KEY = "learn-arcade-muted";

export const ARCADE_STAGE_KINDS = [
  "lane_runner",
  "sort_rush",
  "route_race",
  "reaction_pick",
  "voice_burst",
] as const;

export function isArcadeStage(
  stage: GameStage | LearnGameReviewStage | null | undefined
): stage is
  | LaneRunnerGameStage
  | SortRushGameStage
  | RouteRaceGameStage
  | ReactionPickGameStage
  | VoiceBurstGameStage {
  if (!stage) {
    return false;
  }

  const stageKind = "stageKind" in stage ? stage.stageKind : stage.kind;
  return ARCADE_STAGE_KINDS.includes(stageKind as (typeof ARCADE_STAGE_KINDS)[number]);
}

export function getArcadeActionCount(stage: GameStage) {
  switch (stage.kind) {
    case "lane_runner":
      return stage.targetSequenceIds.length;
    case "sort_rush":
      return stage.correctAssignments.length;
    case "route_race":
      return stage.correctPathIds.length;
    case "reaction_pick":
      return stage.rounds.length;
    case "voice_burst":
      return 1;
    default:
      return 0;
  }
}

export function getArcadeCompletionPath(
  stage: GameStage,
  options?: {
    inputMode?: "voice" | "fallback" | null;
    completionPath?: GameCompletionPath | null;
  }
): GameCompletionPath {
  if (stage.kind === "voice_burst") {
    if (options?.inputMode === "voice") {
      return "voice";
    }

    if (options?.inputMode === "fallback") {
      return "fallback";
    }
  }

  return options?.completionPath ?? "arcade";
}

export function getArcadeInteractionModel(
  stage: GameStage | LearnGameReviewStage | null | undefined
): ArcadeInteractionModel | "structural" {
  if (!stage) {
    return "structural";
  }

  if ("interactionModel" in stage && typeof stage.interactionModel === "string") {
    return stage.interactionModel;
  }

  if ("stageKind" in stage) {
    switch (stage.stageKind) {
      case "lane_runner":
        return "cross_dash";
      case "sort_rush":
        return "conveyor_bins";
      case "route_race":
        return "grid_runner";
      case "reaction_pick":
        return "split_decision";
      case "voice_burst":
        return "burst_callout";
      default:
        return "structural";
    }
  }

  return "structural";
}

export function deriveArcadeStageStats(
  stage: GameStage,
  options: {
    solved: boolean;
    attemptNumber?: number;
    mistakeCount?: number;
    timeRemainingMs?: number;
    comboPeak?: number;
    livesRemaining?: number;
    inputMode?: "voice" | "fallback" | null;
    completionPath?: GameCompletionPath | null;
    timeExpired?: boolean;
  }
): {
  scoreDelta: number;
  combo: number;
  livesRemaining: number;
  stageResult: GameStageResult;
  completionPath: GameCompletionPath;
  medal: GameMedal;
  medalCap: Exclude<GameMedal, "retry">;
  timeExpired: boolean;
  failureReason: GameFailureReason;
} {
  if (!isArcadeStage(stage)) {
    return {
      scoreDelta: 0,
      combo: 0,
      livesRemaining: 0,
      stageResult: options.solved ? ("cleared" as GameStageResult) : ("retry" as GameStageResult),
      completionPath: getArcadeCompletionPath(stage, {
        inputMode: options.inputMode,
        completionPath: options.completionPath,
      }),
      medal: options.solved ? ("bronze" as GameMedal) : ("retry" as GameMedal),
      medalCap: medalCapForAttempt(options.attemptNumber ?? 1),
      timeExpired: options.timeExpired ?? false,
      failureReason: options.timeExpired ? "timeout" : options.solved ? null : "incorrect",
    };
  }

  const mistakes = Math.max(0, options.mistakeCount ?? 0);
  const maxLives = Math.max(1, stage.lives);
  const livesRemaining = Math.max(
    0,
    Math.min(maxLives, options.livesRemaining ?? maxLives - mistakes)
  );
  const combo = Math.max(
    0,
    Math.min(stage.comboRules.maxCombo, options.comboPeak ?? Math.max(1, getArcadeActionCount(stage) - mistakes))
  );
  const timeRemainingMs = Math.max(0, options.timeRemainingMs ?? 0);
  const timeBonus = Math.round(
    timeRemainingMs * (stage.scoreRules.timeBonusMultiplier ?? 0)
  );
  const scoreDelta = options.solved
    ? Math.max(
        0,
        getArcadeActionCount(stage) * stage.scoreRules.correct +
          combo * stage.scoreRules.streakBonus +
          stage.scoreRules.clearBonus +
          timeBonus -
          mistakes * stage.scoreRules.miss
      )
    : 0;
  const stageResult: GameStageResult = options.solved ? "cleared" : "retry";
  const accuracy = getArcadeActionCount(stage) === 0
    ? 1
    : (getArcadeActionCount(stage) - mistakes) / getArcadeActionCount(stage);

  let medal: GameMedal = "retry";
  if (options.solved) {
    if (mistakes === 0 && timeRemainingMs >= stage.timerMs * 0.3 && combo >= Math.min(3, stage.comboRules.maxCombo)) {
      medal = "gold";
    } else if (livesRemaining >= Math.ceil(maxLives / 2) && accuracy >= 0.66) {
      medal = "silver";
    } else {
      medal = "bronze";
    }
  }

  const challenge = getStageChallenge(stage);
  const attemptCap = medalCapForAttempt(options.attemptNumber ?? 1);
  const fallbackCap = options.inputMode === "fallback" ? challenge.fallbackMedalCap : undefined;
  const effectiveCap =
    fallbackCap && fallbackCap !== "gold"
      ? (attemptCap === "bronze" ? "bronze" : fallbackCap)
      : attemptCap;
  medal = clampMedalToCap(medal, effectiveCap);

  return {
    scoreDelta,
    combo,
    livesRemaining,
    stageResult,
    completionPath: getArcadeCompletionPath(stage, {
      inputMode: options.inputMode,
      completionPath: options.completionPath,
    }),
    medal,
    medalCap: effectiveCap,
    timeExpired: options.timeExpired ?? timeRemainingMs <= 0,
    failureReason: !options.solved
      ? timeRemainingMs <= 0 || options.timeExpired
        ? "timeout"
        : livesRemaining <= 0
          ? "lives_depleted"
          : "incorrect"
      : null,
  };
}
