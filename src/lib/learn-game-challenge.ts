import type {
  GameChallengeProfile,
  GameDifficultyBand,
  GameMedal,
  GameStage,
  GameStageChallenge,
  LearnGameReviewStage,
} from "@/server/learn-game-types";

const ARCADE_STAGE_KINDS = [
  "lane_runner",
  "sort_rush",
  "route_race",
  "reaction_pick",
  "voice_burst",
] as const;

const RECALL_STAGE_KINDS = ["choice", "match", "spotlight", "map"] as const;
const CONSTRUCTION_STAGE_KINDS = ["assemble", "priority_board", "state_switch", "sequence"] as const;
const VOICE_STAGE_KINDS = ["voice_prompt"] as const;

type StageKind = GameStage["kind"] | LearnGameReviewStage["stageKind"];

export function getChallengeProfileForStageKind(kind: StageKind): GameChallengeProfile {
  if (ARCADE_STAGE_KINDS.includes(kind as (typeof ARCADE_STAGE_KINDS)[number])) {
    return "arcade";
  }

  if (RECALL_STAGE_KINDS.includes(kind as (typeof RECALL_STAGE_KINDS)[number])) {
    return "recall";
  }

  if (CONSTRUCTION_STAGE_KINDS.includes(kind as (typeof CONSTRUCTION_STAGE_KINDS)[number])) {
    return "construction";
  }

  if (VOICE_STAGE_KINDS.includes(kind as (typeof VOICE_STAGE_KINDS)[number])) {
    return "voice";
  }

  return "construction";
}

export function defaultChallengeProfileForStageKind(kind: StageKind) {
  return getChallengeProfileForStageKind(kind);
}

export function getStageDecisionCount(stage: Pick<GameStage, "kind"> & Record<string, unknown>) {
  switch (stage.kind) {
    case "choice":
    case "voice_prompt":
    case "voice_burst":
      return 1;
    case "match":
      return Array.isArray(stage.correctMatches) ? stage.correctMatches.length : 0;
    case "spotlight":
      return Array.isArray(stage.correctHotspotIds) ? stage.correctHotspotIds.length : 0;
    case "map":
    case "route_race":
      return Array.isArray(stage.correctPathIds) ? stage.correctPathIds.length : 0;
    case "assemble":
    case "state_switch":
    case "priority_board":
    case "sort_rush":
      return Array.isArray(stage.correctAssignments) ? stage.correctAssignments.length : 0;
    case "sequence":
      return Array.isArray(stage.correctOrderIds) ? stage.correctOrderIds.length : 0;
    case "reaction_pick":
      return Array.isArray(stage.rounds) ? stage.rounds.length : 0;
    case "lane_runner":
      return Array.isArray(stage.targetSequenceIds) ? stage.targetSequenceIds.length : 0;
    default:
      return 0;
  }
}

function getArcadeTimerFactor(difficultyBand: GameDifficultyBand) {
  switch (difficultyBand) {
    case "very_basic":
      return 0.82;
    case "basic":
      return 0.72;
    case "intermediate":
      return 0.7;
    case "advanced":
      return 0.66;
  }
}

function getArcadePerActionWindow(difficultyBand: GameDifficultyBand) {
  switch (difficultyBand) {
    case "very_basic":
      return 2600;
    case "basic":
      return 2100;
    case "intermediate":
      return 1800;
    case "advanced":
      return 1500;
  }
}

function getRecallTimerMs(difficultyBand: GameDifficultyBand, decisionCount: number) {
  const stepCount = Math.max(decisionCount, 1);

  switch (difficultyBand) {
    case "very_basic":
      return 11000 + stepCount * 1800;
    case "basic":
      return 9500 + stepCount * 1600;
    case "intermediate":
      return 8500 + stepCount * 1450;
    case "advanced":
      return 7500 + stepCount * 1300;
  }
}

export function buildStageChallenge(options: {
  kind: StageKind;
  difficultyBand: GameDifficultyBand;
  decisionCount: number;
  timerMs?: number;
  lives?: number;
  medalWindowAttempts?: number;
  perActionWindowMs?: number;
}): GameStageChallenge {
  const profile = getChallengeProfileForStageKind(options.kind);

  if (profile === "arcade") {
    const speedRampStepMs =
      options.difficultyBand === "very_basic"
        ? 24
        : options.difficultyBand === "basic"
          ? 32
          : options.difficultyBand === "intermediate"
            ? 40
            : 48;

    return {
      difficultyBand: options.difficultyBand,
      timerMs: Math.max(
        7000,
        Math.round((options.timerMs ?? 18000) * getArcadeTimerFactor(options.difficultyBand))
      ),
      lives: 2,
      medalWindowAttempts: Math.max(3, options.medalWindowAttempts ?? 3),
      perActionWindowMs: options.perActionWindowMs ?? getArcadePerActionWindow(options.difficultyBand),
      speedRampStepMs,
      fallbackMedalCap: options.kind === "voice_burst" ? "silver" : undefined,
      voiceOnlyGold: options.kind === "voice_burst",
    };
  }

  if (profile === "recall") {
    return {
      difficultyBand: options.difficultyBand,
      timerMs: options.timerMs ?? getRecallTimerMs(options.difficultyBand, options.decisionCount),
      lives: options.lives ?? 2,
      medalWindowAttempts: Math.max(3, options.medalWindowAttempts ?? 3),
    };
  }

  if (profile === "voice") {
    return {
      difficultyBand: options.difficultyBand,
      lives: options.lives ?? 2,
      medalWindowAttempts: Math.max(3, options.medalWindowAttempts ?? 3),
      fallbackMedalCap: "silver",
      voiceOnlyGold: true,
    };
  }

  return {
    difficultyBand: options.difficultyBand,
    lives: options.lives ?? (options.decisionCount >= 3 ? 3 : 2),
    medalWindowAttempts: Math.max(3, options.medalWindowAttempts ?? 3),
  };
}

export function getStageChallenge(stage: GameStage | LearnGameReviewStage): GameStageChallenge {
  if ("challenge" in stage && stage.challenge) {
    return stage.challenge;
  }

  const kind = "stageKind" in stage ? stage.stageKind : stage.kind;
  return buildStageChallenge({
    kind,
    difficultyBand: "intermediate",
    decisionCount: "stageKind" in stage ? 1 : getStageDecisionCount(stage),
    timerMs: "timerMs" in stage && typeof stage.timerMs === "number" ? stage.timerMs : undefined,
    lives: "lives" in stage && typeof stage.lives === "number" ? stage.lives : undefined,
    medalWindowAttempts: 3,
    perActionWindowMs:
      "failWindowMs" in stage && typeof stage.failWindowMs === "number" ? stage.failWindowMs : undefined,
  });
}

export function isTimedChallengeStage(stage: GameStage | LearnGameReviewStage) {
  const challenge = getStageChallenge(stage);
  return Boolean(challenge.timerMs && challenge.timerMs > 0);
}

export function medalCapForAttempt(attemptNumber: number): Exclude<GameMedal, "retry"> {
  if (attemptNumber <= 1) {
    return "gold";
  }

  if (attemptNumber === 2) {
    return "silver";
  }

  return "bronze";
}

export function clampMedalToCap(
  medal: GameMedal,
  medalCap: Exclude<GameMedal, "retry">
): GameMedal {
  if (medal === "retry") {
    return medal;
  }

  const rank: Record<Exclude<GameMedal, "retry">, number> = {
    bronze: 0,
    silver: 1,
    gold: 2,
  };

  return rank[medal] > rank[medalCap] ? medalCap : medal;
}
