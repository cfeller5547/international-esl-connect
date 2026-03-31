import { env } from "@/server/env";
import { prisma } from "@/server/prisma";
import { deriveArcadeStageStats, isArcadeStage } from "@/lib/learn-arcade";
import {
  clampMedalToCap,
  defaultChallengeProfileForStageKind,
  getStageChallenge,
  getStageDecisionCount,
  medalCapForAttempt,
} from "@/lib/learn-game-challenge";

import type {
  ArcadeHitBoxes,
  ArcadeInteractionModel,
  ArcadeMotionRules,
  ArcadeRewardFx,
  ArcadeSpawnTimeline,
  ArcadeSpriteRefs,
  ArcadeTransitionFx,
  AssembleGameStage,
  ChoiceGameStage,
  GameCompletionPath,
  GameFailureReason,
  GameActivityPayload,
  GameChoiceOption,
  GameChallengeProfile,
  GameMedal,
  GameStageChallenge,
  GameStage,
  GameStagePresentation,
  LaneRunnerGameStage,
  LearnGameEvaluation,
  LearnGameReview,
  LearnGameReviewStage,
  MapGameStage,
  MatchGameStage,
  PriorityBoardGameStage,
  ReactionPickGameStage,
  RouteRaceGameStage,
  SequenceGameStage,
  SortRushGameStage,
  SpotlightGameStage,
  StateSwitchGameStage,
  VoiceBurstGameStage,
  VoicePromptGameStage,
} from "../learn-game-types";
import { AppError } from "../errors";
import { trackEvent } from "../analytics";
import { transcribeAudioInput } from "../ai/openai-conversation";

import { CurriculumService } from "./curriculum-service";
import { UsageService } from "./usage-service";

function normalizePrompt(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getLevenshteinDistance(left: string, right: string) {
  const matrix = Array.from({ length: left.length + 1 }, (_, rowIndex) =>
    Array.from({ length: right.length + 1 }, (_, columnIndex) =>
      rowIndex === 0 ? columnIndex : columnIndex === 0 ? rowIndex : 0
    )
  );

  for (let rowIndex = 1; rowIndex <= left.length; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex <= right.length; columnIndex += 1) {
      const substitutionCost = left[rowIndex - 1] === right[columnIndex - 1] ? 0 : 1;

      matrix[rowIndex]![columnIndex] = Math.min(
        matrix[rowIndex - 1]![columnIndex]! + 1,
        matrix[rowIndex]![columnIndex - 1]! + 1,
        matrix[rowIndex - 1]![columnIndex - 1]! + substitutionCost
      );
    }
  }

  return matrix[left.length]![right.length]!;
}

function getSimilarity(expected: string, actual: string) {
  if (!expected || !actual) {
    return 0;
  }

  const distance = getLevenshteinDistance(expected, actual);
  return 1 - distance / Math.max(expected.length, actual.length, 1);
}

function buildLegacyGameFromDrillPayload(
  payload: Record<string, unknown>,
  unitTitle: string
): GameActivityPayload {
  const items = Array.isArray(payload.items)
    ? payload.items
        .map((item, index) => {
          const typedItem = item as Record<string, unknown>;
          const promptText =
            typeof typedItem.promptText === "string" ? typedItem.promptText : `word ${index + 1}`;

          return {
            id: `legacy-game-stage-${index + 1}`,
            kind: "voice_prompt",
            title: `Word ${index + 1}`,
            prompt: `Say the target word clearly.`,
            targetPhrase: promptText,
            coachFocus:
              typeof typedItem.coachFocus === "string"
                ? typedItem.coachFocus
                : `Say "${promptText}" clearly and keep it steady.`,
            fallbackOptions: [
              { id: "correct", label: promptText },
              { id: "alt-1", label: "Try again" },
              { id: "alt-2", label: "Keep going" },
            ],
            correctOptionId: "correct",
            correctMessage: `Good. You are ready to use "${promptText}" in speaking.`,
            retryMessage: `Stay closer to "${promptText}" and try again.`,
          } satisfies VoicePromptGameStage;
        })
        .slice(0, 5)
    : [];

  return {
    gameId: `legacy-${unitTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    gameTitle: "Unit Game",
    gameKind: "legacy_warmup",
    theme: "teal",
    layoutVariant: "generic",
    assetRefs: {
      hero: "/games/stage1/name-tag-mixer.svg",
    },
    introText:
      typeof payload.introText === "string"
        ? payload.introText
        : `Play a quick unit challenge before you move into speaking.`,
    stages: items.map((stage) => withNormalizedChallenge(stage)),
    summary: {
      strength: "You kept the unit challenge moving and stayed ready for speaking.",
      nextFocus: "Carry the same clear language into speaking.",
      bridgeToSpeaking: "Use the same key language in the conversation that opens next.",
    },
    completionRule: {
      requiredStageCount: items.length,
      maxRetriesPerStage:
        typeof (payload.completionRule as Record<string, unknown> | undefined)
          ?.maxRetriesPerItem === "number"
          ? Number((payload.completionRule as Record<string, unknown>).maxRetriesPerItem)
          : 1,
    },
  };
}

function normalizePresentation(
  value: Record<string, unknown> | null | undefined
): GameStagePresentation | undefined {
  if (!value || typeof value.layoutVariant !== "string") {
    return undefined;
  }

  return {
    layoutVariant: value.layoutVariant as GameStagePresentation["layoutVariant"],
    assetRef: typeof value.assetRef === "string" ? value.assetRef : undefined,
    boardTitle: typeof value.boardTitle === "string" ? value.boardTitle : undefined,
    helperLabel: typeof value.helperLabel === "string" ? value.helperLabel : undefined,
    helperText: typeof value.helperText === "string" ? value.helperText : undefined,
    callToAction: typeof value.callToAction === "string" ? value.callToAction : undefined,
    ctaLabel: typeof value.ctaLabel === "string" ? value.ctaLabel : undefined,
    resolvedTitle: typeof value.resolvedTitle === "string" ? value.resolvedTitle : undefined,
    resolvedNote: typeof value.resolvedNote === "string" ? value.resolvedNote : undefined,
    answerRevealMode:
      value.answerRevealMode === "postanswer" ? "postanswer" : "preanswer",
    scenePrompt: typeof value.scenePrompt === "string" ? value.scenePrompt : undefined,
    dialoguePrompt: typeof value.dialoguePrompt === "string" ? value.dialoguePrompt : undefined,
    sceneHotspots: Array.isArray(value.sceneHotspots)
      ? value.sceneHotspots
          .map((hotspot) => hotspot as Record<string, unknown>)
          .filter(
            (hotspot) =>
              typeof hotspot.id === "string" &&
              typeof hotspot.optionId === "string" &&
              typeof hotspot.label === "string" &&
              typeof hotspot.x === "number" &&
              typeof hotspot.y === "number"
          )
          .map((hotspot) => ({
            id: String(hotspot.id),
            optionId: String(hotspot.optionId),
            label: String(hotspot.label),
            x: Number(hotspot.x),
            y: Number(hotspot.y),
          }))
      : undefined,
    lanes: Array.isArray(value.lanes)
      ? value.lanes
          .map((lane) => lane as Record<string, unknown>)
          .filter((lane) => typeof lane.id === "string" && typeof lane.label === "string")
          .map((lane) => ({
            id: String(lane.id),
            label: String(lane.label),
          }))
      : undefined,
    connections: Array.isArray(value.connections)
      ? value.connections
          .map((connection) => connection as Record<string, unknown>)
          .filter(
            (connection) =>
              typeof connection.fromId === "string" && typeof connection.toId === "string"
          )
          .map((connection) => ({
            fromId: String(connection.fromId),
            toId: String(connection.toId),
          }))
      : undefined,
  };
}

function normalizeArcadeInteractionModel(
  value: unknown,
  fallback: ArcadeInteractionModel
): ArcadeInteractionModel {
  if (
    value === "cross_dash" ||
    value === "conveyor_bins" ||
    value === "grid_runner" ||
    value === "target_tag" ||
    value === "split_decision" ||
    value === "burst_callout"
  ) {
    return value;
  }

  return fallback;
}

function normalizeArcadeSpriteRefs(value: unknown): ArcadeSpriteRefs | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const refs = value as Record<string, unknown>;
  return {
    player: typeof refs.player === "string" ? String(refs.player) : undefined,
    target: typeof refs.target === "string" ? String(refs.target) : undefined,
    hazard: typeof refs.hazard === "string" ? String(refs.hazard) : undefined,
    board: typeof refs.board === "string" ? String(refs.board) : undefined,
    accent: typeof refs.accent === "string" ? String(refs.accent) : undefined,
    neutral: typeof refs.neutral === "string" ? String(refs.neutral) : undefined,
  };
}

function normalizeArcadeMotionRules(value: unknown): ArcadeMotionRules | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const rules = value as Record<string, unknown>;
  return {
    dashStep: typeof rules.dashStep === "number" ? Number(rules.dashStep) : undefined,
    driftPx: typeof rules.driftPx === "number" ? Number(rules.driftPx) : undefined,
    travelMs: typeof rules.travelMs === "number" ? Number(rules.travelMs) : undefined,
    conveyorSpeed:
      typeof rules.conveyorSpeed === "number" ? Number(rules.conveyorSpeed) : undefined,
    routeSnapMs: typeof rules.routeSnapMs === "number" ? Number(rules.routeSnapMs) : undefined,
    targetFloatPx:
      typeof rules.targetFloatPx === "number" ? Number(rules.targetFloatPx) : undefined,
  };
}

function normalizeArcadeHitBoxes(value: unknown): ArcadeHitBoxes | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const boxes = value as Record<string, unknown>;
  return {
    targetRadius:
      typeof boxes.targetRadius === "number" ? Number(boxes.targetRadius) : undefined,
    lanePadding: typeof boxes.lanePadding === "number" ? Number(boxes.lanePadding) : undefined,
    binPadding: typeof boxes.binPadding === "number" ? Number(boxes.binPadding) : undefined,
    nodeRadius: typeof boxes.nodeRadius === "number" ? Number(boxes.nodeRadius) : undefined,
  };
}

function normalizeArcadeSpawnTimeline(value: unknown): ArcadeSpawnTimeline | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const timeline = value as Record<string, unknown>;
  return {
    spawnEveryMs:
      typeof timeline.spawnEveryMs === "number" ? Number(timeline.spawnEveryMs) : undefined,
    closeLaneEveryMs:
      typeof timeline.closeLaneEveryMs === "number"
        ? Number(timeline.closeLaneEveryMs)
        : undefined,
    rampEveryMs:
      typeof timeline.rampEveryMs === "number" ? Number(timeline.rampEveryMs) : undefined,
    introMs: typeof timeline.introMs === "number" ? Number(timeline.introMs) : undefined,
  };
}

function normalizeArcadeRewardFx(value: unknown): ArcadeRewardFx | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const fx = value as Record<string, unknown>;
  return {
    hitBurst: typeof fx.hitBurst === "string" ? String(fx.hitBurst) : undefined,
    missFlash: typeof fx.missFlash === "string" ? String(fx.missFlash) : undefined,
    comboGlow: typeof fx.comboGlow === "string" ? String(fx.comboGlow) : undefined,
    medalReveal: typeof fx.medalReveal === "string" ? String(fx.medalReveal) : undefined,
  };
}

function normalizeArcadeTransitionFx(value: unknown): ArcadeTransitionFx | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const fx = value as Record<string, unknown>;
  return {
    introMs: typeof fx.introMs === "number" ? Number(fx.introMs) : undefined,
    clearMs: typeof fx.clearMs === "number" ? Number(fx.clearMs) : undefined,
    stageSwapMs: typeof fx.stageSwapMs === "number" ? Number(fx.stageSwapMs) : undefined,
  };
}

function defaultStageChallenge(stage: GameStage): GameStageChallenge {
  const profile = defaultChallengeProfileForStageKind(stage.kind);
  const decisionCount = Math.max(1, getStageDecisionCount(stage));
  const timerMs = "timerMs" in stage && typeof stage.timerMs === "number" ? stage.timerMs : undefined;
  const lives = "lives" in stage && typeof stage.lives === "number"
    ? stage.lives
    : profile === "construction"
      ? decisionCount >= 3
        ? 3
        : 2
      : 2;
  const perActionWindowMs =
    "failWindowMs" in stage && typeof stage.failWindowMs === "number" ? stage.failWindowMs : undefined;

  return {
    difficultyBand: "intermediate",
    timerMs:
      timerMs ??
      (profile === "recall" ? Math.max(9000, decisionCount * 3200) : undefined),
    lives,
    medalWindowAttempts: 3,
    perActionWindowMs,
    speedRampStepMs: profile === "arcade" ? 120 : undefined,
    fallbackMedalCap:
      stage.kind === "voice_prompt" || stage.kind === "voice_burst" ? "silver" : undefined,
    voiceOnlyGold: stage.kind === "voice_prompt" || stage.kind === "voice_burst",
  };
}

function withNormalizedChallenge<T extends GameStage>(
  stage: T
): T & { challengeProfile: GameChallengeProfile; challenge: GameStageChallenge } {
  const profile =
    typeof stage.challengeProfile === "string"
      ? stage.challengeProfile
      : defaultChallengeProfileForStageKind(stage.kind);
  const defaults = defaultStageChallenge(stage);

  return {
    ...stage,
    challengeProfile: profile,
    challenge: {
      ...defaults,
      ...(stage.challenge ?? {}),
      difficultyBand: stage.challenge?.difficultyBand ?? defaults.difficultyBand,
      timerMs: stage.challenge?.timerMs ?? defaults.timerMs,
      lives: stage.challenge?.lives ?? defaults.lives,
      medalWindowAttempts:
        stage.challenge?.medalWindowAttempts ?? defaults.medalWindowAttempts,
      perActionWindowMs:
        stage.challenge?.perActionWindowMs ?? defaults.perActionWindowMs,
      speedRampStepMs: stage.challenge?.speedRampStepMs ?? defaults.speedRampStepMs,
      fallbackMedalCap:
        stage.challenge?.fallbackMedalCap ?? defaults.fallbackMedalCap,
      voiceOnlyGold: stage.challenge?.voiceOnlyGold ?? defaults.voiceOnlyGold,
    },
  };
}

function normalizeAssembleStage(stage: Record<string, unknown>): AssembleGameStage | null {
  if (
    stage.kind !== "assemble" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.slots) ||
    !Array.isArray(stage.options) ||
    !Array.isArray(stage.correctAssignments)
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "assemble",
    title: stage.title,
    prompt: stage.prompt,
    slots: stage.slots
      .map((slot) => slot as Record<string, unknown>)
      .filter((slot) => typeof slot.id === "string" && typeof slot.label === "string")
      .map((slot) => ({
        id: String(slot.id),
        label: String(slot.label),
        detail: typeof slot.detail === "string" ? slot.detail : undefined,
      })),
        options: stage.options
          .map((option) => option as Record<string, unknown>)
          .filter((option) => typeof option.id === "string" && typeof option.label === "string")
          .map((option) => ({
            id: String(option.id),
            label: String(option.label),
            detail: typeof option.detail === "string" ? option.detail : undefined,
            isNearMiss: option.isNearMiss === true,
          })),
    correctAssignments: stage.correctAssignments
      .map((entry) => entry as Record<string, unknown>)
      .filter((entry) => typeof entry.slotId === "string" && typeof entry.optionId === "string")
      .map((entry) => ({
        slotId: String(entry.slotId),
        optionId: String(entry.optionId),
      })),
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. That board is assembled clearly.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Rebuild the board so each piece lands in the right place.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeChoiceStage(stage: Record<string, unknown>): ChoiceGameStage | null {
  if (
    stage.kind !== "choice" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.options) ||
    typeof stage.correctOptionId !== "string"
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "choice",
    title: stage.title,
    prompt: stage.prompt,
    options: stage.options
      .map((option) => option as Record<string, unknown>)
      .filter((option) => typeof option.id === "string" && typeof option.label === "string")
      .map((option) => ({
        id: String(option.id),
        label: String(option.label),
        detail: typeof option.detail === "string" ? option.detail : undefined,
      })),
    correctOptionId: stage.correctOptionId,
    correctMessage:
      typeof stage.correctMessage === "string" ? stage.correctMessage : "Good. That fits.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Try the option that fits the unit more directly.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeSpotlightStage(stage: Record<string, unknown>): SpotlightGameStage | null {
  if (
    stage.kind !== "spotlight" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.hotspots) ||
    !Array.isArray(stage.correctHotspotIds)
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "spotlight",
    title: stage.title,
    prompt: stage.prompt,
    hotspots: stage.hotspots
      .map((spot) => spot as Record<string, unknown>)
      .filter(
        (spot) =>
          typeof spot.id === "string" &&
          typeof spot.label === "string" &&
          typeof spot.x === "number" &&
          typeof spot.y === "number"
      )
      .map((spot) => ({
        id: String(spot.id),
        label: String(spot.label),
        detail: typeof spot.detail === "string" ? spot.detail : undefined,
        x: Number(spot.x),
        y: Number(spot.y),
      })),
    correctHotspotIds: stage.correctHotspotIds.map(String),
    selectionMode: stage.selectionMode === "multiple" ? "multiple" : "single",
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. You found the right part of the scene.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Spot the part of the scene that matches the clue.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeMatchStage(stage: Record<string, unknown>): MatchGameStage | null {
  if (
    stage.kind !== "match" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.leftItems) ||
    !Array.isArray(stage.rightItems) ||
    !Array.isArray(stage.correctMatches)
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "match",
    title: stage.title,
    prompt: stage.prompt,
    leftItems: stage.leftItems
      .map((item) => item as Record<string, unknown>)
      .filter((item) => typeof item.id === "string" && typeof item.label === "string")
      .map((item) => ({
        id: String(item.id),
        label: String(item.label),
        detail: typeof item.detail === "string" ? item.detail : undefined,
      })),
    rightItems: stage.rightItems
      .map((item) => item as Record<string, unknown>)
      .filter((item) => typeof item.id === "string" && typeof item.label === "string")
      .map((item) => ({
        id: String(item.id),
        label: String(item.label),
        detail: typeof item.detail === "string" ? item.detail : undefined,
      })),
    correctMatches: stage.correctMatches
      .map((pair) => pair as Record<string, unknown>)
      .filter((pair) => typeof pair.leftId === "string" && typeof pair.rightId === "string")
      .map((pair) => ({
        leftId: String(pair.leftId),
        rightId: String(pair.rightId),
      })),
    correctMessage:
      typeof stage.correctMessage === "string" ? stage.correctMessage : "Good. Those matches fit.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Try matching each item to the line that fits it best.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeStateSwitchStage(stage: Record<string, unknown>): StateSwitchGameStage | null {
  if (
    stage.kind !== "state_switch" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.states) ||
    !Array.isArray(stage.responseOptions) ||
    !Array.isArray(stage.correctAssignments)
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "state_switch",
    title: stage.title,
    prompt: stage.prompt,
    states: stage.states
      .map((state) => state as Record<string, unknown>)
      .filter((state) => typeof state.id === "string" && typeof state.label === "string")
      .map((state) => ({
        id: String(state.id),
        label: String(state.label),
        detail: typeof state.detail === "string" ? state.detail : undefined,
        assetRef: typeof state.assetRef === "string" ? state.assetRef : undefined,
      })),
    responseOptions: stage.responseOptions
      .map((option) => option as Record<string, unknown>)
      .filter((option) => typeof option.id === "string" && typeof option.label === "string")
      .map((option) => ({
        id: String(option.id),
        label: String(option.label),
        detail: typeof option.detail === "string" ? option.detail : undefined,
      })),
    correctAssignments: stage.correctAssignments
      .map((entry) => entry as Record<string, unknown>)
      .filter((entry) => typeof entry.stateId === "string" && typeof entry.optionId === "string")
      .map((entry) => ({
        stateId: String(entry.stateId),
        optionId: String(entry.optionId),
      })),
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. You adapted the scene clearly.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Switch the plan so each state has the best response.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeSequenceStage(stage: Record<string, unknown>): SequenceGameStage | null {
  if (
    stage.kind !== "sequence" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.items) ||
    !Array.isArray(stage.correctOrderIds)
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "sequence",
    title: stage.title,
    prompt: stage.prompt,
    items: stage.items
      .map((item) => item as Record<string, unknown>)
      .filter((item) => typeof item.id === "string" && typeof item.label === "string")
      .map((item) => ({
        id: String(item.id),
        label: String(item.label),
        detail: typeof item.detail === "string" ? item.detail : undefined,
      })),
    correctOrderIds: stage.correctOrderIds.map(String),
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. The order sounds clear.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Try an order that feels easier to follow.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizePriorityBoardStage(stage: Record<string, unknown>): PriorityBoardGameStage | null {
  if (
    stage.kind !== "priority_board" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.lanes) ||
    !Array.isArray(stage.cards) ||
    !Array.isArray(stage.correctAssignments)
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "priority_board",
    title: stage.title,
    prompt: stage.prompt,
    lanes: stage.lanes
      .map((lane) => lane as Record<string, unknown>)
      .filter((lane) => typeof lane.id === "string" && typeof lane.label === "string")
      .map((lane) => ({
        id: String(lane.id),
        label: String(lane.label),
      })),
    cards: stage.cards
      .map((card) => card as Record<string, unknown>)
      .filter((card) => typeof card.id === "string" && typeof card.label === "string")
      .map((card) => ({
        id: String(card.id),
        label: String(card.label),
        detail: typeof card.detail === "string" ? card.detail : undefined,
      })),
    correctAssignments: stage.correctAssignments
      .map((entry) => entry as Record<string, unknown>)
      .filter((entry) => typeof entry.cardId === "string" && typeof entry.laneId === "string")
      .map((entry) => ({
        cardId: String(entry.cardId),
        laneId: String(entry.laneId),
      })),
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. The board priorities now make sense.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Move the cards until the board shows the clearest priorities.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeLaneRunnerStage(stage: Record<string, unknown>): LaneRunnerGameStage | null {
  if (
    stage.kind !== "lane_runner" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.lanes) ||
    !Array.isArray(stage.tokens) ||
    !Array.isArray(stage.targetSequenceIds) ||
    typeof stage.timerMs !== "number" ||
    typeof stage.lives !== "number"
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "lane_runner",
    title: stage.title,
    prompt: stage.prompt,
    lanes: stage.lanes
      .map((lane) => lane as Record<string, unknown>)
      .filter((lane) => typeof lane.id === "string" && typeof lane.label === "string")
      .map((lane) => ({
        id: String(lane.id),
        label: String(lane.label),
      })),
    tokens: stage.tokens
      .map((token) => token as Record<string, unknown>)
      .filter(
        (token) =>
          typeof token.id === "string" &&
          typeof token.label === "string" &&
          typeof token.lane === "number" &&
          (token.role === "target" || token.role === "hazard")
      )
      .map((token) => ({
        id: String(token.id),
        label: String(token.label),
        detail: typeof token.detail === "string" ? token.detail : undefined,
        lane: Number(token.lane),
        column: typeof token.column === "number" ? Number(token.column) : undefined,
        role: token.role as "target" | "hazard",
        color: typeof token.color === "string" ? token.color : undefined,
      })),
    targetSequenceIds: stage.targetSequenceIds.map(String),
    timerMs: Number(stage.timerMs),
    lives: Number(stage.lives),
    scoreRules: {
      correct: Number((stage.scoreRules as Record<string, unknown> | undefined)?.correct ?? 120),
      miss: Number((stage.scoreRules as Record<string, unknown> | undefined)?.miss ?? 40),
      streakBonus: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.streakBonus ?? 18
      ),
      clearBonus: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.clearBonus ?? 140
      ),
      timeBonusMultiplier: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.timeBonusMultiplier ?? 0.02
      ),
    },
    comboRules: {
      maxCombo: Number((stage.comboRules as Record<string, unknown> | undefined)?.maxCombo ?? 6),
      breakOnMiss: Boolean(
        (stage.comboRules as Record<string, unknown> | undefined)?.breakOnMiss ?? true
      ),
    },
    hudVariant: "lane_runner",
    interactionModel: normalizeArcadeInteractionModel(stage.interactionModel, "cross_dash"),
    soundSet:
      typeof stage.soundSet === "string" ? (stage.soundSet as LaneRunnerGameStage["soundSet"]) : "hallway",
    theme: typeof stage.theme === "string" ? (stage.theme as LaneRunnerGameStage["theme"]) : undefined,
    assetRefs:
      stage.assetRefs && typeof stage.assetRefs === "object"
        ? {
            hero:
              typeof (stage.assetRefs as Record<string, unknown>).hero === "string"
                ? String((stage.assetRefs as Record<string, unknown>).hero)
                : undefined,
            scene:
              typeof (stage.assetRefs as Record<string, unknown>).scene === "string"
                ? String((stage.assetRefs as Record<string, unknown>).scene)
                : undefined,
            summary:
              typeof (stage.assetRefs as Record<string, unknown>).summary === "string"
                ? String((stage.assetRefs as Record<string, unknown>).summary)
                : undefined,
          }
        : undefined,
    spriteRefs: normalizeArcadeSpriteRefs(stage.spriteRefs),
    spawnRules:
      stage.spawnRules && typeof stage.spawnRules === "object"
        ? {
            spawnRateMs: Number((stage.spawnRules as Record<string, unknown>).spawnRateMs ?? 1000),
            speed: Number((stage.spawnRules as Record<string, unknown>).speed ?? 1),
            laneCount:
              typeof (stage.spawnRules as Record<string, unknown>).laneCount === "number"
                ? Number((stage.spawnRules as Record<string, unknown>).laneCount)
                : undefined,
            waveSize:
              typeof (stage.spawnRules as Record<string, unknown>).waveSize === "number"
                ? Number((stage.spawnRules as Record<string, unknown>).waveSize)
                : undefined,
          }
        : undefined,
    motionRules: normalizeArcadeMotionRules(stage.motionRules),
    hitBoxes: normalizeArcadeHitBoxes(stage.hitBoxes),
    spawnTimeline: normalizeArcadeSpawnTimeline(stage.spawnTimeline),
    failWindowMs: typeof stage.failWindowMs === "number" ? Number(stage.failWindowMs) : undefined,
    rewardFx: normalizeArcadeRewardFx(stage.rewardFx),
    transitionFx: normalizeArcadeTransitionFx(stage.transitionFx),
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. You crossed cleanly and collected the right language.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Run it again and collect the right language without drifting into the decoys.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeSortRushStage(stage: Record<string, unknown>): SortRushGameStage | null {
  if (
    stage.kind !== "sort_rush" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.lanes) ||
    !Array.isArray(stage.cards) ||
    !Array.isArray(stage.correctAssignments) ||
    typeof stage.timerMs !== "number" ||
    typeof stage.lives !== "number"
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "sort_rush",
    title: stage.title,
    prompt: stage.prompt,
    lanes: stage.lanes
      .map((lane) => lane as Record<string, unknown>)
      .filter((lane) => typeof lane.id === "string" && typeof lane.label === "string")
      .map((lane) => ({
        id: String(lane.id),
        label: String(lane.label),
      })),
    cards: stage.cards
      .map((card) => card as Record<string, unknown>)
      .filter((card) => typeof card.id === "string" && typeof card.label === "string")
      .map((card) => ({
        id: String(card.id),
        label: String(card.label),
        detail: typeof card.detail === "string" ? card.detail : undefined,
      })),
    correctAssignments: stage.correctAssignments
      .map((entry) => entry as Record<string, unknown>)
      .filter((entry) => typeof entry.cardId === "string" && typeof entry.laneId === "string")
      .map((entry) => ({
        cardId: String(entry.cardId),
        laneId: String(entry.laneId),
      })),
    timerMs: Number(stage.timerMs),
    lives: Number(stage.lives),
    scoreRules: {
      correct: Number((stage.scoreRules as Record<string, unknown> | undefined)?.correct ?? 100),
      miss: Number((stage.scoreRules as Record<string, unknown> | undefined)?.miss ?? 35),
      streakBonus: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.streakBonus ?? 16
      ),
      clearBonus: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.clearBonus ?? 120
      ),
      timeBonusMultiplier: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.timeBonusMultiplier ?? 0.02
      ),
    },
    comboRules: {
      maxCombo: Number((stage.comboRules as Record<string, unknown> | undefined)?.maxCombo ?? 5),
      breakOnMiss: Boolean(
        (stage.comboRules as Record<string, unknown> | undefined)?.breakOnMiss ?? true
      ),
    },
    hudVariant: "sort_rush",
    interactionModel: normalizeArcadeInteractionModel(stage.interactionModel, "conveyor_bins"),
    soundSet:
      typeof stage.soundSet === "string" ? (stage.soundSet as SortRushGameStage["soundSet"]) : "planner",
    theme: typeof stage.theme === "string" ? (stage.theme as SortRushGameStage["theme"]) : undefined,
    assetRefs:
      stage.assetRefs && typeof stage.assetRefs === "object"
        ? {
            hero:
              typeof (stage.assetRefs as Record<string, unknown>).hero === "string"
                ? String((stage.assetRefs as Record<string, unknown>).hero)
                : undefined,
            scene:
              typeof (stage.assetRefs as Record<string, unknown>).scene === "string"
                ? String((stage.assetRefs as Record<string, unknown>).scene)
                : undefined,
            summary:
              typeof (stage.assetRefs as Record<string, unknown>).summary === "string"
                ? String((stage.assetRefs as Record<string, unknown>).summary)
                : undefined,
          }
        : undefined,
    spriteRefs: normalizeArcadeSpriteRefs(stage.spriteRefs),
    spawnRules:
      stage.spawnRules && typeof stage.spawnRules === "object"
        ? {
            spawnRateMs: Number((stage.spawnRules as Record<string, unknown>).spawnRateMs ?? 950),
            speed: Number((stage.spawnRules as Record<string, unknown>).speed ?? 1),
            laneCount:
              typeof (stage.spawnRules as Record<string, unknown>).laneCount === "number"
                ? Number((stage.spawnRules as Record<string, unknown>).laneCount)
                : undefined,
            waveSize:
              typeof (stage.spawnRules as Record<string, unknown>).waveSize === "number"
                ? Number((stage.spawnRules as Record<string, unknown>).waveSize)
                : undefined,
          }
        : undefined,
    motionRules: normalizeArcadeMotionRules(stage.motionRules),
    hitBoxes: normalizeArcadeHitBoxes(stage.hitBoxes),
    spawnTimeline: normalizeArcadeSpawnTimeline(stage.spawnTimeline),
    failWindowMs: typeof stage.failWindowMs === "number" ? Number(stage.failWindowMs) : undefined,
    rewardFx: normalizeArcadeRewardFx(stage.rewardFx),
    transitionFx: normalizeArcadeTransitionFx(stage.transitionFx),
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. You sorted the rush cleanly.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Run it again and sort the cards into the strongest lanes.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeRouteRaceStage(stage: Record<string, unknown>): RouteRaceGameStage | null {
  if (
    stage.kind !== "route_race" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.nodes) ||
    !Array.isArray(stage.correctPathIds) ||
    typeof stage.timerMs !== "number" ||
    typeof stage.lives !== "number"
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "route_race",
    title: stage.title,
    prompt: stage.prompt,
    nodes: stage.nodes
      .map((node) => node as Record<string, unknown>)
      .filter((node) => typeof node.id === "string" && typeof node.label === "string")
      .map((node) => ({
        id: String(node.id),
        label: String(node.label),
        detail: typeof node.detail === "string" ? node.detail : undefined,
        x: typeof node.x === "number" ? Number(node.x) : undefined,
        y: typeof node.y === "number" ? Number(node.y) : undefined,
      })),
    correctPathIds: stage.correctPathIds.map(String),
    timerMs: Number(stage.timerMs),
    lives: Number(stage.lives),
    scoreRules: {
      correct: Number((stage.scoreRules as Record<string, unknown> | undefined)?.correct ?? 110),
      miss: Number((stage.scoreRules as Record<string, unknown> | undefined)?.miss ?? 40),
      streakBonus: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.streakBonus ?? 18
      ),
      clearBonus: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.clearBonus ?? 140
      ),
      timeBonusMultiplier: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.timeBonusMultiplier ?? 0.02
      ),
    },
    comboRules: {
      maxCombo: Number((stage.comboRules as Record<string, unknown> | undefined)?.maxCombo ?? 5),
      breakOnMiss: Boolean(
        (stage.comboRules as Record<string, unknown> | undefined)?.breakOnMiss ?? true
      ),
    },
    hudVariant: "route_race",
    interactionModel: normalizeArcadeInteractionModel(stage.interactionModel, "grid_runner"),
    soundSet:
      typeof stage.soundSet === "string" ? (stage.soundSet as RouteRaceGameStage["soundSet"]) : "route",
    theme: typeof stage.theme === "string" ? (stage.theme as RouteRaceGameStage["theme"]) : undefined,
    assetRefs:
      stage.assetRefs && typeof stage.assetRefs === "object"
        ? {
            hero:
              typeof (stage.assetRefs as Record<string, unknown>).hero === "string"
                ? String((stage.assetRefs as Record<string, unknown>).hero)
                : undefined,
            scene:
              typeof (stage.assetRefs as Record<string, unknown>).scene === "string"
                ? String((stage.assetRefs as Record<string, unknown>).scene)
                : undefined,
            summary:
              typeof (stage.assetRefs as Record<string, unknown>).summary === "string"
                ? String((stage.assetRefs as Record<string, unknown>).summary)
                : undefined,
          }
        : undefined,
    spriteRefs: normalizeArcadeSpriteRefs(stage.spriteRefs),
    pathRules:
      stage.pathRules && typeof stage.pathRules === "object"
        ? {
            startNodeId:
              typeof (stage.pathRules as Record<string, unknown>).startNodeId === "string"
                ? String((stage.pathRules as Record<string, unknown>).startNodeId)
                : undefined,
            finishNodeId:
              typeof (stage.pathRules as Record<string, unknown>).finishNodeId === "string"
                ? String((stage.pathRules as Record<string, unknown>).finishNodeId)
                : undefined,
            branchPenalty:
              typeof (stage.pathRules as Record<string, unknown>).branchPenalty === "number"
                ? Number((stage.pathRules as Record<string, unknown>).branchPenalty)
                : undefined,
            allowBacktrack:
              typeof (stage.pathRules as Record<string, unknown>).allowBacktrack === "boolean"
                ? Boolean((stage.pathRules as Record<string, unknown>).allowBacktrack)
                : undefined,
          }
        : undefined,
    motionRules: normalizeArcadeMotionRules(stage.motionRules),
    hitBoxes: normalizeArcadeHitBoxes(stage.hitBoxes),
    spawnTimeline: normalizeArcadeSpawnTimeline(stage.spawnTimeline),
    failWindowMs: typeof stage.failWindowMs === "number" ? Number(stage.failWindowMs) : undefined,
    rewardFx: normalizeArcadeRewardFx(stage.rewardFx),
    transitionFx: normalizeArcadeTransitionFx(stage.transitionFx),
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. You raced the clean route.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Run it again and stay on the route that supports the task cleanly.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeReactionPickStage(stage: Record<string, unknown>): ReactionPickGameStage | null {
  if (
    stage.kind !== "reaction_pick" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.rounds) ||
    typeof stage.timerMs !== "number" ||
    typeof stage.lives !== "number"
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "reaction_pick",
    title: stage.title,
    prompt: stage.prompt,
    rounds: stage.rounds
      .map((round) => round as Record<string, unknown>)
      .filter(
        (round) =>
          typeof round.id === "string" &&
          typeof round.prompt === "string" &&
          Array.isArray(round.options) &&
          typeof round.correctOptionId === "string"
      )
      .map((round) => ({
        id: String(round.id),
        prompt: String(round.prompt),
        correctOptionId: String(round.correctOptionId),
        dialoguePrompt:
          typeof round.dialoguePrompt === "string" ? String(round.dialoguePrompt) : undefined,
        options: (round.options as Array<Record<string, unknown>>)
          .filter((option) => typeof option.id === "string" && typeof option.label === "string")
          .map((option) => ({
            id: String(option.id),
            label: String(option.label),
            detail: typeof option.detail === "string" ? option.detail : undefined,
            isNearMiss: option.isNearMiss === true,
          })),
      })),
    timerMs: Number(stage.timerMs),
    lives: Number(stage.lives),
    scoreRules: {
      correct: Number((stage.scoreRules as Record<string, unknown> | undefined)?.correct ?? 95),
      miss: Number((stage.scoreRules as Record<string, unknown> | undefined)?.miss ?? 30),
      streakBonus: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.streakBonus ?? 15
      ),
      clearBonus: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.clearBonus ?? 110
      ),
      timeBonusMultiplier: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.timeBonusMultiplier ?? 0.02
      ),
    },
    comboRules: {
      maxCombo: Number((stage.comboRules as Record<string, unknown> | undefined)?.maxCombo ?? 5),
      breakOnMiss: Boolean(
        (stage.comboRules as Record<string, unknown> | undefined)?.breakOnMiss ?? true
      ),
    },
    hudVariant: "reaction_pick",
    interactionModel: normalizeArcadeInteractionModel(stage.interactionModel, "split_decision"),
    soundSet:
      typeof stage.soundSet === "string"
        ? (stage.soundSet as ReactionPickGameStage["soundSet"])
        : "comparison",
    theme: typeof stage.theme === "string" ? (stage.theme as ReactionPickGameStage["theme"]) : undefined,
    assetRefs:
      stage.assetRefs && typeof stage.assetRefs === "object"
        ? {
            hero:
              typeof (stage.assetRefs as Record<string, unknown>).hero === "string"
                ? String((stage.assetRefs as Record<string, unknown>).hero)
                : undefined,
            scene:
              typeof (stage.assetRefs as Record<string, unknown>).scene === "string"
                ? String((stage.assetRefs as Record<string, unknown>).scene)
                : undefined,
            summary:
              typeof (stage.assetRefs as Record<string, unknown>).summary === "string"
                ? String((stage.assetRefs as Record<string, unknown>).summary)
                : undefined,
          }
        : undefined,
    spriteRefs: normalizeArcadeSpriteRefs(stage.spriteRefs),
    spawnRules:
      stage.spawnRules && typeof stage.spawnRules === "object"
        ? {
            spawnRateMs: Number((stage.spawnRules as Record<string, unknown>).spawnRateMs ?? 900),
            speed: Number((stage.spawnRules as Record<string, unknown>).speed ?? 1),
            laneCount:
              typeof (stage.spawnRules as Record<string, unknown>).laneCount === "number"
                ? Number((stage.spawnRules as Record<string, unknown>).laneCount)
                : undefined,
            waveSize:
              typeof (stage.spawnRules as Record<string, unknown>).waveSize === "number"
                ? Number((stage.spawnRules as Record<string, unknown>).waveSize)
                : undefined,
          }
        : undefined,
    motionRules: normalizeArcadeMotionRules(stage.motionRules),
    hitBoxes: normalizeArcadeHitBoxes(stage.hitBoxes),
    spawnTimeline: normalizeArcadeSpawnTimeline(stage.spawnTimeline),
    failWindowMs: typeof stage.failWindowMs === "number" ? Number(stage.failWindowMs) : undefined,
    rewardFx: normalizeArcadeRewardFx(stage.rewardFx),
    transitionFx: normalizeArcadeTransitionFx(stage.transitionFx),
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. Your reactions fit the scene.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Run it again and react with the strongest option each time.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeMapStage(stage: Record<string, unknown>): MapGameStage | null {
  if (
    stage.kind !== "map" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    !Array.isArray(stage.nodes) ||
    !Array.isArray(stage.correctPathIds)
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "map",
    title: stage.title,
    prompt: stage.prompt,
    nodes: stage.nodes
      .map((node) => node as Record<string, unknown>)
      .filter((node) => typeof node.id === "string" && typeof node.label === "string")
      .map((node) => ({
        id: String(node.id),
        label: String(node.label),
        detail: typeof node.detail === "string" ? node.detail : undefined,
        x: typeof node.x === "number" ? Number(node.x) : undefined,
        y: typeof node.y === "number" ? Number(node.y) : undefined,
      })),
    correctPathIds: stage.correctPathIds.map(String),
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. That route fits the task.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Try building the route in a clearer order.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeVoicePromptStage(stage: Record<string, unknown>): VoicePromptGameStage | null {
  if (
    stage.kind !== "voice_prompt" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    typeof stage.targetPhrase !== "string" ||
    !Array.isArray(stage.fallbackOptions) ||
    typeof stage.correctOptionId !== "string"
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "voice_prompt",
    title: stage.title,
    prompt: stage.prompt,
    targetPhrase: stage.targetPhrase,
    coachFocus:
      typeof stage.coachFocus === "string"
        ? stage.coachFocus
        : `Say "${stage.targetPhrase}" clearly.`,
    requiredPhrases: Array.isArray(stage.requiredPhrases)
      ? stage.requiredPhrases.map(String)
      : undefined,
    acceptedResponses: Array.isArray(stage.acceptedResponses)
      ? stage.acceptedResponses.map(String)
      : undefined,
    fallbackOptions: stage.fallbackOptions
      .map((option) => option as Record<string, unknown>)
      .filter((option) => typeof option.id === "string" && typeof option.label === "string")
      .map((option) => ({
        id: String(option.id),
        label: String(option.label),
        detail: typeof option.detail === "string" ? option.detail : undefined,
        isNearMiss: option.isNearMiss === true,
      })),
    correctOptionId: stage.correctOptionId,
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. You are ready to use that line in speaking.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Stay closer to the target phrase and try again.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeVoiceBurstStage(stage: Record<string, unknown>): VoiceBurstGameStage | null {
  if (
    stage.kind !== "voice_burst" ||
    typeof stage.id !== "string" ||
    typeof stage.title !== "string" ||
    typeof stage.prompt !== "string" ||
    typeof stage.targetPhrase !== "string" ||
    !Array.isArray(stage.fallbackOptions) ||
    typeof stage.correctOptionId !== "string" ||
    typeof stage.timerMs !== "number" ||
    typeof stage.lives !== "number"
  ) {
    return null;
  }

  return {
    id: stage.id,
    kind: "voice_burst",
    title: stage.title,
    prompt: stage.prompt,
    targetPhrase: stage.targetPhrase,
    coachFocus:
      typeof stage.coachFocus === "string"
        ? stage.coachFocus
        : `Say "${stage.targetPhrase}" clearly and keep it moving.`,
    requiredPhrases: Array.isArray(stage.requiredPhrases)
      ? stage.requiredPhrases.map(String)
      : undefined,
    acceptedResponses: Array.isArray(stage.acceptedResponses)
      ? stage.acceptedResponses.map(String)
      : undefined,
    fallbackOptions: stage.fallbackOptions
      .map((option) => option as Record<string, unknown>)
      .filter((option) => typeof option.id === "string" && typeof option.label === "string")
      .map((option) => ({
        id: String(option.id),
        label: String(option.label),
        detail: typeof option.detail === "string" ? option.detail : undefined,
        isNearMiss: option.isNearMiss === true,
      })),
    correctOptionId: stage.correctOptionId,
    timerMs: Number(stage.timerMs),
    lives: Number(stage.lives),
    scoreRules: {
      correct: Number((stage.scoreRules as Record<string, unknown> | undefined)?.correct ?? 120),
      miss: Number((stage.scoreRules as Record<string, unknown> | undefined)?.miss ?? 25),
      streakBonus: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.streakBonus ?? 20
      ),
      clearBonus: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.clearBonus ?? 160
      ),
      timeBonusMultiplier: Number(
        (stage.scoreRules as Record<string, unknown> | undefined)?.timeBonusMultiplier ?? 0.01
      ),
    },
    comboRules: {
      maxCombo: Number((stage.comboRules as Record<string, unknown> | undefined)?.maxCombo ?? 3),
      breakOnMiss: Boolean(
        (stage.comboRules as Record<string, unknown> | undefined)?.breakOnMiss ?? false
      ),
    },
    hudVariant: "voice_burst",
    interactionModel: normalizeArcadeInteractionModel(stage.interactionModel, "burst_callout"),
    soundSet:
      typeof stage.soundSet === "string" ? (stage.soundSet as VoiceBurstGameStage["soundSet"]) : "neutral",
    theme: typeof stage.theme === "string" ? (stage.theme as VoiceBurstGameStage["theme"]) : undefined,
    assetRefs:
      stage.assetRefs && typeof stage.assetRefs === "object"
        ? {
            hero:
              typeof (stage.assetRefs as Record<string, unknown>).hero === "string"
                ? String((stage.assetRefs as Record<string, unknown>).hero)
                : undefined,
            scene:
              typeof (stage.assetRefs as Record<string, unknown>).scene === "string"
                ? String((stage.assetRefs as Record<string, unknown>).scene)
                : undefined,
            summary:
              typeof (stage.assetRefs as Record<string, unknown>).summary === "string"
                ? String((stage.assetRefs as Record<string, unknown>).summary)
                : undefined,
          }
        : undefined,
    spriteRefs: normalizeArcadeSpriteRefs(stage.spriteRefs),
    motionRules: normalizeArcadeMotionRules(stage.motionRules),
    hitBoxes: normalizeArcadeHitBoxes(stage.hitBoxes),
    spawnTimeline: normalizeArcadeSpawnTimeline(stage.spawnTimeline),
    failWindowMs: typeof stage.failWindowMs === "number" ? Number(stage.failWindowMs) : undefined,
    rewardFx: normalizeArcadeRewardFx(stage.rewardFx),
    transitionFx: normalizeArcadeTransitionFx(stage.transitionFx),
    correctMessage:
      typeof stage.correctMessage === "string"
        ? stage.correctMessage
        : "Good. That burst line is ready to use.",
    retryMessage:
      typeof stage.retryMessage === "string"
        ? stage.retryMessage
        : "Keep the line short and clear, then burst it out one more time.",
    presentation: normalizePresentation((stage.presentation as Record<string, unknown>) ?? null),
  };
}

function normalizeGamePayload(
  payload: Record<string, unknown>,
  unitTitle: string
): GameActivityPayload {
  if (typeof payload.gameTitle !== "string" || !Array.isArray(payload.stages)) {
    return buildLegacyGameFromDrillPayload(payload, unitTitle);
  }

  const stages = payload.stages
    .map((stage) => {
      const typedStage = stage as Record<string, unknown>;

      return (
        normalizeLaneRunnerStage(typedStage) ??
        normalizeSortRushStage(typedStage) ??
        normalizeRouteRaceStage(typedStage) ??
        normalizeReactionPickStage(typedStage) ??
        normalizeVoiceBurstStage(typedStage) ??
        normalizeAssembleStage(typedStage) ??
        normalizeChoiceStage(typedStage) ??
        normalizeSpotlightStage(typedStage) ??
        normalizeMatchStage(typedStage) ??
        normalizeStateSwitchStage(typedStage) ??
        normalizeSequenceStage(typedStage) ??
        normalizePriorityBoardStage(typedStage) ??
        normalizeMapStage(typedStage) ??
        normalizeVoicePromptStage(typedStage)
      );
    })
    .filter((stage): stage is GameStage => Boolean(stage))
    .map((stage) => withNormalizedChallenge(stage));

  return {
    gameId:
      typeof payload.gameId === "string"
        ? payload.gameId
        : unitTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    gameTitle: payload.gameTitle,
    gameKind: typeof payload.gameKind === "string" ? payload.gameKind : "unit_challenge",
    theme: typeof payload.theme === "string" ? (payload.theme as GameActivityPayload["theme"]) : "teal",
    layoutVariant:
      typeof payload.layoutVariant === "string"
        ? (payload.layoutVariant as GameActivityPayload["layoutVariant"])
        : "generic",
    ambientSet:
      typeof payload.ambientSet === "string"
        ? (payload.ambientSet as GameActivityPayload["ambientSet"])
        : "neutral",
    celebrationVariant:
      payload.celebrationVariant === "arcade_pulse" ||
      payload.celebrationVariant === "structured_glow"
        ? payload.celebrationVariant
        : stages.some((stage) => isArcadeStage(stage))
          ? "arcade_pulse"
          : "structured_glow",
    assetRefs: {
      hero:
        typeof (payload.assetRefs as Record<string, unknown> | undefined)?.hero === "string"
          ? String((payload.assetRefs as Record<string, unknown>).hero)
          : "/games/stage1/name-tag-mixer.svg",
      scene:
        typeof (payload.assetRefs as Record<string, unknown> | undefined)?.scene === "string"
          ? String((payload.assetRefs as Record<string, unknown>).scene)
          : undefined,
      summary:
        typeof (payload.assetRefs as Record<string, unknown> | undefined)?.summary === "string"
          ? String((payload.assetRefs as Record<string, unknown>).summary)
          : undefined,
    },
    introText:
      typeof payload.introText === "string"
        ? payload.introText
        : `Play the unit game before speaking.`,
    stages,
    summary: {
      strength:
        typeof (payload.summary as Record<string, unknown> | undefined)?.strength === "string"
          ? String((payload.summary as Record<string, unknown>).strength)
          : "You kept the game moving and stayed ready for speaking.",
      nextFocus:
        typeof (payload.summary as Record<string, unknown> | undefined)?.nextFocus === "string"
          ? String((payload.summary as Record<string, unknown>).nextFocus)
          : "Carry the same clear language into the speaking step.",
      bridgeToSpeaking:
        typeof (payload.summary as Record<string, unknown> | undefined)?.bridgeToSpeaking ===
        "string"
          ? String((payload.summary as Record<string, unknown>).bridgeToSpeaking)
          : "Use the same language in the speaking task that opens next.",
    },
    completionRule: {
      requiredStageCount:
        typeof (payload.completionRule as Record<string, unknown> | undefined)
          ?.requiredStageCount === "number"
          ? Number((payload.completionRule as Record<string, unknown>).requiredStageCount)
          : stages.length,
      maxRetriesPerStage:
        typeof (payload.completionRule as Record<string, unknown> | undefined)
          ?.maxRetriesPerStage === "number"
          ? Number((payload.completionRule as Record<string, unknown>).maxRetriesPerStage)
          : 1,
    },
  };
}

function normalizeLegacyReview(
  payload: Record<string, unknown> | null | undefined,
  game: GameActivityPayload
): LearnGameReview | null {
  const saved = (payload?.gameReview ?? payload?.drillReview ?? null) as Record<string, unknown> | null;

  if (!saved) {
    return null;
  }

  if (Array.isArray(saved.stages)) {
    return {
      gameId: typeof saved.gameId === "string" ? saved.gameId : game.gameId,
      gameTitle: typeof saved.gameTitle === "string" ? saved.gameTitle : game.gameTitle,
      gameKind: typeof saved.gameKind === "string" ? saved.gameKind : game.gameKind,
      strength:
        typeof saved.strength === "string"
          ? saved.strength
          : "You finished the unit game and kept the challenge moving.",
      nextFocus:
        typeof saved.nextFocus === "string"
          ? saved.nextFocus
          : "Carry the same clear language into speaking.",
      bridgeToSpeaking:
        typeof saved.bridgeToSpeaking === "string"
          ? saved.bridgeToSpeaking
          : "Use the same language in the speaking step that opens next.",
      replayStageIds: Array.isArray(saved.replayStageIds) ? saved.replayStageIds.map(String) : [],
      stages: saved.stages
        .map((stage) => stage as Record<string, unknown>)
        .filter((stage) => typeof stage.stageId === "string" || typeof stage.itemId === "string")
        .map((stage) => ({
          stageId:
            typeof stage.stageId === "string"
              ? stage.stageId
              : typeof stage.itemId === "string"
                ? stage.itemId
                : "stage",
          stageKind:
            game.stages.find((entry) => entry.id === stage.stageId)?.kind ??
            game.stages.find((entry) => entry.id === stage.itemId)?.kind ??
            (stage.stageKind as LearnGameReviewStage["stageKind"] | undefined) ??
            "voice_prompt",
          challengeProfile:
            game.stages.find((entry) => entry.id === stage.stageId)?.challengeProfile ??
            game.stages.find((entry) => entry.id === stage.itemId)?.challengeProfile ??
            defaultChallengeProfileForStageKind(
              (game.stages.find((entry) => entry.id === stage.stageId)?.kind ??
                game.stages.find((entry) => entry.id === stage.itemId)?.kind ??
                (stage.stageKind as LearnGameReviewStage["stageKind"] | undefined) ??
                "voice_prompt") as LearnGameReviewStage["stageKind"]
            ),
          stageTitle:
            typeof stage.stageTitle === "string"
              ? stage.stageTitle
              : typeof stage.promptText === "string"
                ? stage.promptText
                : "Game stage",
          outcome: stage.outcome === "strong" ? "strong" : "practice_more",
          coachNote:
            typeof stage.coachNote === "string"
              ? stage.coachNote
              : "Carry this same language into speaking.",
          transcriptText: typeof stage.transcriptText === "string" ? stage.transcriptText : null,
          resolvedInputMode:
            stage.resolvedInputMode === "voice" || stage.resolvedInputMode === "fallback"
              ? stage.resolvedInputMode
              : stage.inputMode === "voice" || stage.inputMode === "fallback"
                ? stage.inputMode
                : null,
          nearMiss: stage.nearMiss === true,
          interactionModel:
            stage.interactionModel === "cross_dash" ||
            stage.interactionModel === "conveyor_bins" ||
            stage.interactionModel === "grid_runner" ||
            stage.interactionModel === "target_tag" ||
            stage.interactionModel === "split_decision" ||
            stage.interactionModel === "burst_callout" ||
            stage.interactionModel === "structural"
              ? stage.interactionModel
              : undefined,
          retryCount: typeof stage.retryCount === "number" ? Number(stage.retryCount) : undefined,
          muteEnabled: typeof stage.muteEnabled === "boolean" ? stage.muteEnabled : undefined,
          scoreDelta: typeof stage.scoreDelta === "number" ? Number(stage.scoreDelta) : undefined,
          combo: typeof stage.combo === "number" ? Number(stage.combo) : undefined,
          livesRemaining:
            typeof stage.livesRemaining === "number" ? Number(stage.livesRemaining) : undefined,
          stageResult:
            stage.stageResult === "cleared" || stage.stageResult === "retry"
              ? stage.stageResult
              : undefined,
          completionPath:
            stage.completionPath === "structural" ||
            stage.completionPath === "arcade" ||
            stage.completionPath === "voice" ||
            stage.completionPath === "fallback" ||
            stage.completionPath === "mixed"
              ? stage.completionPath
              : undefined,
          medal:
            stage.medal === "gold" ||
            stage.medal === "silver" ||
            stage.medal === "bronze" ||
            stage.medal === "retry"
              ? stage.medal
              : undefined,
        })),
    };
  }

  const legacyItems = Array.isArray(saved.items) ? saved.items : [];

  return {
    gameId: game.gameId,
    gameTitle: game.gameTitle,
    gameKind: game.gameKind,
    strength:
      typeof saved.strength === "string"
        ? saved.strength
        : "You finished the unit challenge and kept moving into speaking.",
    nextFocus:
      typeof saved.nextFocus === "string"
        ? saved.nextFocus
        : "Carry the same clear language into speaking.",
    bridgeToSpeaking:
      typeof saved.bridgeToSpeaking === "string"
        ? saved.bridgeToSpeaking
        : "Use the same language in the speaking step that opens next.",
    replayStageIds: Array.isArray(saved.replayStageIds) ? saved.replayStageIds.map(String) : [],
    stages: legacyItems
      .map((item) => item as Record<string, unknown>)
      .filter((item) => typeof item.itemId === "string")
      .map((item) => ({
        stageId: String(item.itemId),
        stageKind: "voice_prompt" as const,
        challengeProfile: "voice" as const,
        stageTitle:
          typeof item.promptText === "string" ? item.promptText : "Legacy word check",
        outcome: item.outcome === "strong" ? "strong" : "practice_more",
        coachNote:
          typeof item.coachNote === "string"
            ? item.coachNote
            : "Carry this same line into speaking.",
        transcriptText: typeof item.transcriptText === "string" ? item.transcriptText : null,
        resolvedInputMode:
          item.inputMode === "voice" || item.inputMode === "fallback" ? item.inputMode : null,
        nearMiss: item.nearMiss === true,
        interactionModel:
          item.interactionModel === "cross_dash" ||
          item.interactionModel === "conveyor_bins" ||
          item.interactionModel === "grid_runner" ||
          item.interactionModel === "target_tag" ||
          item.interactionModel === "split_decision" ||
          item.interactionModel === "burst_callout" ||
          item.interactionModel === "structural"
            ? item.interactionModel
            : undefined,
        retryCount: typeof item.retryCount === "number" ? Number(item.retryCount) : undefined,
        muteEnabled: typeof item.muteEnabled === "boolean" ? item.muteEnabled : undefined,
        scoreDelta: typeof item.scoreDelta === "number" ? Number(item.scoreDelta) : undefined,
        combo: typeof item.combo === "number" ? Number(item.combo) : undefined,
        livesRemaining:
          typeof item.livesRemaining === "number" ? Number(item.livesRemaining) : undefined,
        stageResult:
          item.stageResult === "cleared" || item.stageResult === "retry"
            ? item.stageResult
            : undefined,
        completionPath:
          item.completionPath === "structural" ||
          item.completionPath === "arcade" ||
          item.completionPath === "voice" ||
          item.completionPath === "fallback" ||
          item.completionPath === "mixed"
            ? item.completionPath
            : undefined,
        medal:
          item.medal === "gold" ||
          item.medal === "silver" ||
          item.medal === "bronze" ||
          item.medal === "retry"
            ? item.medal
            : undefined,
      })),
  };
}

function stageRoute(unitSlug: string, activityType: string) {
  return `/app/learn/unit/${unitSlug}/${activityType}`;
}

function compareMatches(
  stage: MatchGameStage,
  submittedMatches: Array<{ leftId: string; rightId: string }>
) {
  if (submittedMatches.length !== stage.correctMatches.length) {
    return false;
  }

  const submitted = new Map(submittedMatches.map((pair) => [pair.leftId, pair.rightId]));
  return stage.correctMatches.every((pair) => submitted.get(pair.leftId) === pair.rightId);
}

function compareAssembleAssignments(
  stage: AssembleGameStage,
  submittedAssignments: Array<{ slotId: string; optionId: string }>
) {
  if (submittedAssignments.length !== stage.correctAssignments.length) {
    return false;
  }

  const submitted = new Map(submittedAssignments.map((entry) => [entry.slotId, entry.optionId]));
  return stage.correctAssignments.every(
    (entry) => submitted.get(entry.slotId) === entry.optionId
  );
}

function compareSpotlightSelection(stage: SpotlightGameStage, hotspotIds: string[]) {
  if (hotspotIds.length !== stage.correctHotspotIds.length) {
    return false;
  }

  return stage.correctHotspotIds.every((id) => hotspotIds.includes(id));
}

function compareStateAssignments(
  stage: StateSwitchGameStage,
  submittedAssignments: Array<{ stateId: string; optionId: string }>
) {
  if (submittedAssignments.length !== stage.correctAssignments.length) {
    return false;
  }

  const submitted = new Map(submittedAssignments.map((entry) => [entry.stateId, entry.optionId]));
  return stage.correctAssignments.every(
    (entry) => submitted.get(entry.stateId) === entry.optionId
  );
}

function comparePriorityAssignments(
  stage: PriorityBoardGameStage,
  submittedAssignments: Array<{ cardId: string; laneId: string }>
) {
  if (submittedAssignments.length !== stage.correctAssignments.length) {
    return false;
  }

  const submitted = new Map(submittedAssignments.map((entry) => [entry.cardId, entry.laneId]));
  return stage.correctAssignments.every(
    (entry) => submitted.get(entry.cardId) === entry.laneId
  );
}

function compareSortRushAssignments(
  stage: SortRushGameStage,
  submittedAssignments: Array<{ cardId: string; laneId: string }>
) {
  if (submittedAssignments.length !== stage.correctAssignments.length) {
    return false;
  }

  const submitted = new Map(submittedAssignments.map((entry) => [entry.cardId, entry.laneId]));
  return stage.correctAssignments.every(
    (entry) => submitted.get(entry.cardId) === entry.laneId
  );
}

function compareLaneRunnerCollects(stage: LaneRunnerGameStage, collectedIds: string[]) {
  return (
    collectedIds.length === stage.targetSequenceIds.length &&
    collectedIds.every((id, index) => id === stage.targetSequenceIds[index])
  );
}

function compareRouteRacePath(stage: RouteRaceGameStage, pathIds: string[]) {
  return (
    pathIds.length === stage.correctPathIds.length &&
    pathIds.every((id, index) => id === stage.correctPathIds[index])
  );
}

function compareReactionSelections(
  stage: ReactionPickGameStage,
  selections: Array<{ roundId: string; optionId: string }>
) {
  if (selections.length !== stage.rounds.length) {
    return false;
  }

  const submitted = new Map(selections.map((entry) => [entry.roundId, entry.optionId]));
  return stage.rounds.every((round) => submitted.get(round.id) === round.correctOptionId);
}

function isNearMissChoice(
  options: GameChoiceOption[] | undefined,
  optionId: string | undefined | null
) {
  if (!options || !optionId) {
    return false;
  }

  return options.some((option) => option.id === optionId && option.isNearMiss === true);
}

function isNearMissReactionSelection(
  stage: ReactionPickGameStage,
  selections: Array<{ roundId: string; optionId: string }>
) {
  if (selections.length === 0) {
    return false;
  }

  const selectionMap = new Map(selections.map((entry) => [entry.roundId, entry.optionId]));
  const incorrectSelections = stage.rounds
    .map((round) => {
      const selectedOptionId = selectionMap.get(round.id);
      if (!selectedOptionId || selectedOptionId === round.correctOptionId) {
        return null;
      }

      return round.options.find((option) => option.id === selectedOptionId) ?? null;
    })
    .filter((option): option is GameChoiceOption => Boolean(option));

  return incorrectSelections.length > 0 && incorrectSelections.every((option) => option.isNearMiss);
}

function getStageLayoutVariant(stage: GameStage, game: GameActivityPayload) {
  return stage.presentation?.layoutVariant ?? game.layoutVariant;
}

function createStageReview(
  stage: GameStage,
  outcome: "strong" | "practice_more",
  coachNote: string,
  options?: Partial<
    Pick<
      LearnGameReviewStage,
      | "nearMiss"
      | "resolvedInputMode"
      | "transcriptText"
      | "interactionModel"
      | "retryCount"
      | "muteEnabled"
      | "scoreDelta"
      | "combo"
      | "livesRemaining"
      | "stageResult"
      | "completionPath"
      | "medal"
      | "attemptNumber"
      | "medalCap"
      | "failureReason"
      | "timeExpired"
      | "nextAllowedAction"
    >
  >
): LearnGameEvaluation {
  const defaultCompletionPath =
    options?.resolvedInputMode === "voice"
      ? "voice"
      : options?.resolvedInputMode === "fallback"
        ? "fallback"
        : isArcadeStage(stage)
          ? "arcade"
          : "structural";

  return {
    stageId: stage.id,
    stageKind: stage.kind,
    stageTitle: stage.title,
    challengeProfile: stage.challengeProfile ?? defaultChallengeProfileForStageKind(stage.kind),
    outcome,
    coachNote,
    transcriptText: options?.transcriptText ?? null,
    resolvedInputMode: options?.resolvedInputMode ?? null,
    attemptNumber: options?.attemptNumber ?? 1,
    nearMiss: options?.nearMiss ?? false,
    interactionModel: options?.interactionModel ?? (isArcadeStage(stage) ? stage.interactionModel : "structural"),
    retryCount: options?.retryCount ?? 0,
    muteEnabled: options?.muteEnabled ?? false,
    scoreDelta: options?.scoreDelta ?? 0,
    combo: options?.combo ?? 0,
    livesRemaining: options?.livesRemaining ?? getStageChallenge(stage).lives,
    stageResult: options?.stageResult ?? (outcome === "strong" ? "cleared" : "retry"),
    completionPath: options?.completionPath ?? defaultCompletionPath,
    medal: options?.medal ?? (outcome === "strong" ? "bronze" : "retry"),
    medalCap: options?.medalCap ?? medalCapForAttempt(options?.attemptNumber ?? 1),
    failureReason: options?.failureReason ?? null,
    timeExpired: options?.timeExpired ?? false,
    nextAllowedAction:
      options?.nextAllowedAction ?? (outcome === "strong" ? "advance" : "retry"),
    retryAllowed:
      (options?.nextAllowedAction ?? (outcome === "strong" ? "advance" : "retry")) === "retry",
    fallbackRecommended: false,
  };
}

function lowerMedalCap(
  left: Exclude<GameMedal, "retry">,
  right: Exclude<GameMedal, "retry">
) {
  const rank: Record<Exclude<GameMedal, "retry">, number> = {
    bronze: 0,
    silver: 1,
    gold: 2,
  };

  return rank[left] <= rank[right] ? left : right;
}

function resolveMedalCap(
  stage: GameStage,
  attemptNumber: number,
  resolvedInputMode?: "voice" | "fallback" | null
) {
  const challenge = getStageChallenge(stage);
  let medalCap = medalCapForAttempt(attemptNumber);

  if (resolvedInputMode === "fallback" && challenge.fallbackMedalCap) {
    medalCap = lowerMedalCap(medalCap, challenge.fallbackMedalCap);
  }

  if (challenge.voiceOnlyGold && resolvedInputMode !== "voice") {
    medalCap = lowerMedalCap(medalCap, "silver");
  }

  return medalCap;
}

function deriveStructuredStageStats(
  stage: GameStage,
  options: {
    solved: boolean;
    attemptNumber: number;
    timeRemainingMs?: number;
    livesRemaining?: number;
    resolvedInputMode?: "voice" | "fallback" | null;
    nearMiss?: boolean;
    timeExpired?: boolean;
  }
): {
  scoreDelta: number;
  combo: number;
  livesRemaining: number;
  stageResult: "cleared" | "retry";
  completionPath: GameCompletionPath;
  medal: GameMedal;
  medalCap: Exclude<GameMedal, "retry">;
  failureReason: GameFailureReason;
  timeExpired: boolean;
} {
  const challenge = getStageChallenge(stage);
  const timeRemainingMs = Math.max(0, options.timeRemainingMs ?? challenge.timerMs ?? 0);
  const timeExpired =
    options.timeExpired ?? Boolean(challenge.timerMs && timeRemainingMs <= 0);
  const baseLives = Math.max(1, options.livesRemaining ?? challenge.lives);
  const livesRemaining = options.solved ? baseLives : Math.max(0, baseLives - 1);
  const medalCap = resolveMedalCap(stage, options.attemptNumber, options.resolvedInputMode);
  const failureReason: GameFailureReason = !options.solved
    ? timeExpired
      ? "timeout"
      : livesRemaining <= 0
        ? "lives_depleted"
        : "incorrect"
    : null;
  const timeRatio =
    challenge.timerMs && challenge.timerMs > 0
      ? timeRemainingMs / challenge.timerMs
      : 0;

  let medal: GameMedal = "retry";
  if (options.solved) {
    if (stage.challengeProfile === "voice") {
      medal = options.resolvedInputMode === "voice" ? "gold" : "silver";
    } else if (stage.challengeProfile === "construction") {
      medal = options.attemptNumber === 1 && livesRemaining >= Math.ceil(challenge.lives / 2)
        ? "gold"
        : "silver";
    } else {
      medal =
        options.attemptNumber === 1 && !timeExpired && timeRatio >= 0.22
          ? "gold"
          : "silver";
    }
  }

  medal = clampMedalToCap(
    options.solved ? (medal === "retry" ? "bronze" : medal) : "retry",
    medalCap
  );

  const completionPath: GameCompletionPath =
    options.resolvedInputMode === "voice"
      ? "voice"
      : options.resolvedInputMode === "fallback"
        ? "fallback"
        : "structural";

  const scoreBase =
    stage.challengeProfile === "construction"
      ? 92
      : stage.challengeProfile === "voice"
        ? options.resolvedInputMode === "voice"
          ? 100
          : 88
        : 90;
  const attemptPenalty = Math.max(0, options.attemptNumber - 1) * 12;
  const timeBonus = challenge.timerMs ? Math.round(timeRatio * 18) : 0;
  const lifeBonus = Math.max(0, livesRemaining) * 4;
  const nearMissPenalty = options.nearMiss ? 6 : 0;

  return {
    scoreDelta: options.solved
      ? Math.max(0, Math.min(100, scoreBase + timeBonus + lifeBonus - attemptPenalty - nearMissPenalty))
      : 0,
    combo: 0,
    livesRemaining,
    stageResult: options.solved ? ("cleared" as const) : ("retry" as const),
    completionPath,
    medal,
    medalCap,
    failureReason,
    timeExpired,
  };
}

async function trackStageResolution({
  evaluation,
  game,
  level,
  route,
  stage,
  unitSlug,
  userId,
}: {
  evaluation: LearnGameEvaluation;
  game: GameActivityPayload;
  level: string;
  route: string;
  stage: GameStage;
  unitSlug: string;
  userId: string;
}) {
  const baseProperties = {
    unit_slug: unitSlug,
    level,
    game_kind: game.gameKind,
    stage_id: stage.id,
    stage_kind: stage.kind,
    challenge_profile: evaluation.challengeProfile,
    attempt_number: evaluation.attemptNumber,
    medal: evaluation.medal,
    medal_cap: evaluation.medalCap,
    failure_reason: evaluation.failureReason,
    time_expired: evaluation.timeExpired,
    lives_remaining: evaluation.livesRemaining,
    score_delta: evaluation.scoreDelta,
    combo_peak: evaluation.combo,
    input_mode: evaluation.resolvedInputMode ?? evaluation.completionPath,
  };

  if (evaluation.stageResult === "retry") {
    await trackEvent({
      eventName: "learn_game_stage_failed",
      route,
      userId,
      properties: baseProperties,
    });
  }

  if (evaluation.timeExpired) {
    await trackEvent({
      eventName: "learn_game_stage_timed_out",
      route,
      userId,
      properties: baseProperties,
    });
  }

  if (evaluation.medal !== "retry") {
    await trackEvent({
      eventName: "learn_game_stage_medal_awarded",
      route,
      userId,
      properties: baseProperties,
    });
  }
}

function shouldAllowRetry(
  outcome: "strong" | "practice_more",
  _attemptNumber?: number,
  _maxRetriesPerStage?: number
) {
  return outcome !== "strong";
}

function matchesAcceptedResponse(expected: string, actual: string) {
  const similarity = getSimilarity(expected, actual);
  return expected === actual || actual.includes(expected) || similarity >= 0.72;
}

function matchesVoiceStage(stage: VoicePromptGameStage | VoiceBurstGameStage, transcriptText: string) {
  const normalizedTranscript = normalizePrompt(transcriptText);
  const normalizedTarget = normalizePrompt(stage.targetPhrase);
  const acceptedResponses = (stage.acceptedResponses ?? [])
    .map(normalizePrompt)
    .filter(Boolean);
  const requiredPhrases = (stage.requiredPhrases ?? [])
    .map(normalizePrompt)
    .filter(Boolean);

  const acceptedResponseMatch = acceptedResponses.some((response) =>
    matchesAcceptedResponse(response, normalizedTranscript)
  );
  const requiredPhraseMatch =
    requiredPhrases.length > 0 &&
    requiredPhrases.every((phrase) => normalizedTranscript.includes(phrase));
  const targetMatch = matchesAcceptedResponse(normalizedTarget, normalizedTranscript);

  return {
    matchedTarget: acceptedResponseMatch || requiredPhraseMatch || targetMatch,
    transcriptText,
  };
}

export const LearnGameService = {
  async getGameView(userId: string, unitSlug: string) {
    const { unit, activity } = await CurriculumService.getUnitActivity(userId, unitSlug, "game");
    const progress = await prisma.userUnitActivityProgress.findUniqueOrThrow({
      where: {
        userId_activityId: {
          userId,
          activityId: activity.id,
        },
      },
    });
    const subscription = await UsageService.getOrCreateSubscription(userId);
    const game = normalizeGamePayload(activity.payload, unit.title);
    const savedReview = normalizeLegacyReview(
      progress.responsePayload as Record<string, unknown> | null,
      game
    );

    return {
      unit,
      activity,
      game,
      plan: subscription.plan as "free" | "pro",
      voiceEnabled: subscription.plan === "pro" && Boolean(env.OPENAI_API_KEY),
      progressStatus: progress.status,
      savedReview,
    };
  },

  async evaluateAttempt({
    userId,
    unitSlug,
    stageId,
    inputMode,
    attemptNumber,
    answer,
  }: {
    userId: string;
    unitSlug: string;
    stageId: string;
    inputMode?: "voice" | "fallback";
    attemptNumber: number;
    answer: {
      selectedOptionId?: string;
      assembleAssignments?: Array<{ slotId: string; optionId: string }>;
      matches?: Array<{ leftId: string; rightId: string }>;
      hotspotIds?: string[];
      stateAssignments?: Array<{ stateId: string; optionId: string }>;
      orderedIds?: string[];
      priorityAssignments?: Array<{ cardId: string; laneId: string }>;
      pathIds?: string[];
      collectedIds?: string[];
      sortAssignments?: Array<{ cardId: string; laneId: string }>;
      reactionSelections?: Array<{ roundId: string; optionId: string }>;
      arcadeMetrics?: {
        mistakeCount?: number;
        timeRemainingMs?: number;
        comboPeak?: number;
        livesRemaining?: number;
        completionPath?: GameCompletionPath;
        muteEnabled?: boolean;
        interactionModel?: ArcadeInteractionModel;
        timeExpired?: boolean;
      };
      structuralMetrics?: {
        timeRemainingMs?: number;
        livesRemaining?: number;
        timeExpired?: boolean;
      };
      audioDataUrl?: string;
      audioMimeType?: string;
      fallbackOptionId?: string;
    };
  }): Promise<LearnGameEvaluation> {
    const { curriculum, unit, activity } = await CurriculumService.getUnitActivity(userId, unitSlug, "game");
    const game = normalizeGamePayload(activity.payload, unit.title);
    const stage = game.stages.find((entry) => entry.id === stageId);

    if (!stage) {
      throw new AppError("NOT_FOUND", "Game stage not found.", 404);
    }

    const commonReviewOptions = {
      interactionModel: isArcadeStage(stage)
        ? answer.arcadeMetrics?.interactionModel ?? stage.interactionModel
        : ("structural" as const),
      retryCount: Math.max(0, attemptNumber - 1),
      muteEnabled: answer.arcadeMetrics?.muteEnabled ?? false,
    };
    const sharedAnalytics = {
      interaction_model: commonReviewOptions.interactionModel,
      surface_family: isArcadeStage(stage) ? "arcade" : "structured",
      level: curriculum.level,
      challenge_profile: stage.challengeProfile,
      answer_reveal_mode: stage.presentation?.answerRevealMode ?? "preanswer",
      ambient_set: game.ambientSet ?? "neutral",
      audio_enabled: !commonReviewOptions.muteEnabled,
      mute_enabled: commonReviewOptions.muteEnabled,
    };
    const finishEvaluation = async (evaluation: LearnGameEvaluation) => {
      await trackStageResolution({
        evaluation,
        game,
        level: curriculum.level,
        route: stageRoute(unitSlug, "game"),
        stage,
        unitSlug,
        userId,
      });

      return evaluation;
    };

    if (attemptNumber === 1 && stage.id === game.stages[0]?.id) {
      await trackEvent({
        eventName: "learn_game_started",
        route: stageRoute(unitSlug, "game"),
        userId,
        properties: {
          unit_slug: unitSlug,
          game_kind: game.gameKind,
          stage_id: stageId,
          stage_kind: stage.kind,
          layout_variant: getStageLayoutVariant(stage, game),
          input_mode:
            inputMode ??
            (stage.kind === "voice_prompt" || stage.kind === "voice_burst"
              ? "voice"
              : isArcadeStage(stage)
                ? "arcade"
                : "structural"),
          attempt_number: attemptNumber,
          retry_count: commonReviewOptions.retryCount,
          ...sharedAnalytics,
        },
      });
    }

    if (attemptNumber > 1) {
      await trackEvent({
        eventName: "learn_game_retry_used",
        route: stageRoute(unitSlug, "game"),
        userId,
        properties: {
          unit_slug: unitSlug,
          stage_id: stageId,
          stage_kind: stage.kind,
          game_kind: game.gameKind,
          layout_variant: getStageLayoutVariant(stage, game),
          input_mode:
            inputMode ??
            (stage.kind === "voice_prompt" || stage.kind === "voice_burst"
              ? "voice"
              : isArcadeStage(stage)
                ? "arcade"
                : "structural"),
          attempt_number: attemptNumber,
          ...sharedAnalytics,
        },
      });
    }

    if (stage.kind === "lane_runner") {
      const correct = compareLaneRunnerCollects(stage, answer.collectedIds ?? []);
      const arcadeStats = deriveArcadeStageStats(stage, {
        solved: correct,
        attemptNumber,
        mistakeCount: answer.arcadeMetrics?.mistakeCount,
        timeRemainingMs: answer.arcadeMetrics?.timeRemainingMs,
        comboPeak: answer.arcadeMetrics?.comboPeak,
        livesRemaining: answer.arcadeMetrics?.livesRemaining,
        completionPath: answer.arcadeMetrics?.completionPath,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            ...arcadeStats,
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (stage.kind === "sort_rush") {
      const correct = compareSortRushAssignments(stage, answer.sortAssignments ?? []);
      const arcadeStats = deriveArcadeStageStats(stage, {
        solved: correct,
        attemptNumber,
        mistakeCount: answer.arcadeMetrics?.mistakeCount,
        timeRemainingMs: answer.arcadeMetrics?.timeRemainingMs,
        comboPeak: answer.arcadeMetrics?.comboPeak,
        livesRemaining: answer.arcadeMetrics?.livesRemaining,
        completionPath: answer.arcadeMetrics?.completionPath,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            ...arcadeStats,
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (stage.kind === "route_race") {
      const correct = compareRouteRacePath(stage, answer.pathIds ?? []);
      const arcadeStats = deriveArcadeStageStats(stage, {
        solved: correct,
        attemptNumber,
        mistakeCount: answer.arcadeMetrics?.mistakeCount,
        timeRemainingMs: answer.arcadeMetrics?.timeRemainingMs,
        comboPeak: answer.arcadeMetrics?.comboPeak,
        livesRemaining: answer.arcadeMetrics?.livesRemaining,
        completionPath: answer.arcadeMetrics?.completionPath,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            ...arcadeStats,
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (stage.kind === "reaction_pick") {
      const correct = compareReactionSelections(stage, answer.reactionSelections ?? []);
      const nearMiss = !correct && isNearMissReactionSelection(stage, answer.reactionSelections ?? []);
      const arcadeStats = deriveArcadeStageStats(stage, {
        solved: correct,
        attemptNumber,
        mistakeCount: answer.arcadeMetrics?.mistakeCount,
        timeRemainingMs: answer.arcadeMetrics?.timeRemainingMs,
        comboPeak: answer.arcadeMetrics?.comboPeak,
        livesRemaining: answer.arcadeMetrics?.livesRemaining,
        completionPath: answer.arcadeMetrics?.completionPath,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            nearMiss,
            ...arcadeStats,
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (stage.kind === "assemble") {
      const correct = compareAssembleAssignments(stage, answer.assembleAssignments ?? []);
      const structuredStats = deriveStructuredStageStats(stage, {
        solved: correct,
        attemptNumber,
        timeRemainingMs: answer.structuralMetrics?.timeRemainingMs,
        livesRemaining: answer.structuralMetrics?.livesRemaining,
        timeExpired: answer.structuralMetrics?.timeExpired,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            ...structuredStats,
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (stage.kind === "choice") {
      const correct = answer.selectedOptionId === stage.correctOptionId;
      const nearMiss = !correct && isNearMissChoice(stage.options, answer.selectedOptionId);
      const structuredStats = deriveStructuredStageStats(stage, {
        solved: correct,
        attemptNumber,
        timeRemainingMs: answer.structuralMetrics?.timeRemainingMs,
        livesRemaining: answer.structuralMetrics?.livesRemaining,
        nearMiss,
        timeExpired: answer.structuralMetrics?.timeExpired,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            nearMiss,
            ...structuredStats,
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (stage.kind === "match") {
      const correct = compareMatches(stage, answer.matches ?? []);
      const structuredStats = deriveStructuredStageStats(stage, {
        solved: correct,
        attemptNumber,
        timeRemainingMs: answer.structuralMetrics?.timeRemainingMs,
        livesRemaining: answer.structuralMetrics?.livesRemaining,
        timeExpired: answer.structuralMetrics?.timeExpired,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            ...structuredStats,
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (stage.kind === "spotlight") {
      const correct = compareSpotlightSelection(stage, answer.hotspotIds ?? []);
      const structuredStats = deriveStructuredStageStats(stage, {
        solved: correct,
        attemptNumber,
        timeRemainingMs: answer.structuralMetrics?.timeRemainingMs,
        livesRemaining: answer.structuralMetrics?.livesRemaining,
        timeExpired: answer.structuralMetrics?.timeExpired,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            ...structuredStats,
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (stage.kind === "state_switch") {
      const correct = compareStateAssignments(stage, answer.stateAssignments ?? []);
      const structuredStats = deriveStructuredStageStats(stage, {
        solved: correct,
        attemptNumber,
        timeRemainingMs: answer.structuralMetrics?.timeRemainingMs,
        livesRemaining: answer.structuralMetrics?.livesRemaining,
        timeExpired: answer.structuralMetrics?.timeExpired,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            ...structuredStats,
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (stage.kind === "sequence") {
      const correct =
        Array.isArray(answer.orderedIds) &&
        answer.orderedIds.length === stage.correctOrderIds.length &&
        answer.orderedIds.every((id, index) => id === stage.correctOrderIds[index]);
      const structuredStats = deriveStructuredStageStats(stage, {
        solved: correct,
        attemptNumber,
        timeRemainingMs: answer.structuralMetrics?.timeRemainingMs,
        livesRemaining: answer.structuralMetrics?.livesRemaining,
        timeExpired: answer.structuralMetrics?.timeExpired,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            ...structuredStats,
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (stage.kind === "priority_board") {
      const correct = comparePriorityAssignments(stage, answer.priorityAssignments ?? []);
      const structuredStats = deriveStructuredStageStats(stage, {
        solved: correct,
        attemptNumber,
        timeRemainingMs: answer.structuralMetrics?.timeRemainingMs,
        livesRemaining: answer.structuralMetrics?.livesRemaining,
        timeExpired: answer.structuralMetrics?.timeExpired,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            ...structuredStats,
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (stage.kind === "map") {
      const correct =
        Array.isArray(answer.pathIds) &&
        answer.pathIds.length === stage.correctPathIds.length &&
        answer.pathIds.every((id, index) => id === stage.correctPathIds[index]);
      const structuredStats = deriveStructuredStageStats(stage, {
        solved: correct,
        attemptNumber,
        timeRemainingMs: answer.structuralMetrics?.timeRemainingMs,
        livesRemaining: answer.structuralMetrics?.livesRemaining,
        timeExpired: answer.structuralMetrics?.timeExpired,
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            ...commonReviewOptions,
            ...structuredStats,
          }
        ),
        retryAllowed: shouldAllowRetry(correct ? "strong" : "practice_more"),
      });
    }

    if (stage.kind !== "voice_prompt" && stage.kind !== "voice_burst") {
      throw new AppError("VALIDATION_ERROR", "Unsupported game stage.", 400);
    }

    const effectiveInputMode =
      inputMode ??
      (answer.fallbackOptionId ? "fallback" : answer.audioDataUrl ? "voice" : undefined);

    if (effectiveInputMode === "fallback") {
      await trackEvent({
        eventName: "learn_game_fallback_used",
        route: stageRoute(unitSlug, "game"),
        userId,
        properties: {
          unit_slug: unitSlug,
          stage_id: stageId,
          stage_kind: stage.kind,
          game_kind: game.gameKind,
          layout_variant: getStageLayoutVariant(stage, game),
          input_mode: "fallback",
          reason: "manual_fallback",
          ...sharedAnalytics,
        },
      });

      const correct = answer.fallbackOptionId === stage.correctOptionId;
      const nearMiss =
        !correct && isNearMissChoice(stage.fallbackOptions, answer.fallbackOptionId);
      const arcadeStats = isArcadeStage(stage)
        ? deriveArcadeStageStats(stage, {
            solved: correct,
            attemptNumber,
            mistakeCount: answer.arcadeMetrics?.mistakeCount,
            timeRemainingMs: answer.arcadeMetrics?.timeRemainingMs,
            comboPeak: answer.arcadeMetrics?.comboPeak,
            livesRemaining: answer.arcadeMetrics?.livesRemaining,
            inputMode: "fallback",
            completionPath: answer.arcadeMetrics?.completionPath,
          })
        : deriveStructuredStageStats(stage, {
            solved: correct,
            attemptNumber,
            livesRemaining: answer.structuralMetrics?.livesRemaining,
            timeRemainingMs: answer.structuralMetrics?.timeRemainingMs,
            resolvedInputMode: "fallback",
            nearMiss,
            timeExpired: answer.structuralMetrics?.timeExpired,
          });

      return finishEvaluation({
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            attemptNumber,
            resolvedInputMode: "fallback",
            ...commonReviewOptions,
            nearMiss,
            ...(arcadeStats ?? {}),
          }
        ),
        retryAllowed: shouldAllowRetry(
          correct ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    }

    if (!answer.audioDataUrl || !answer.audioMimeType) {
      if (
        !answer.fallbackOptionId &&
        (answer.arcadeMetrics?.timeExpired || answer.structuralMetrics?.timeExpired)
      ) {
        return finishEvaluation({
          ...createStageReview(
            stage,
            "practice_more",
            `${stage.retryMessage} Try the stage again before moving on.`,
            {
              attemptNumber,
              resolvedInputMode: null,
              ...commonReviewOptions,
              ...(isArcadeStage(stage)
                ? deriveArcadeStageStats(stage, {
                    solved: false,
                    attemptNumber,
                    mistakeCount: answer.arcadeMetrics?.mistakeCount,
                    timeRemainingMs: answer.arcadeMetrics?.timeRemainingMs ?? 0,
                    comboPeak: answer.arcadeMetrics?.comboPeak,
                    livesRemaining: answer.arcadeMetrics?.livesRemaining,
                    completionPath: answer.arcadeMetrics?.completionPath,
                    timeExpired: true,
                  })
                : deriveStructuredStageStats(stage, {
                    solved: false,
                    attemptNumber,
                    livesRemaining: answer.structuralMetrics?.livesRemaining,
                    timeRemainingMs: answer.structuralMetrics?.timeRemainingMs ?? 0,
                    resolvedInputMode: null,
                    timeExpired: true,
                  })),
            }
          ),
          retryAllowed: true,
        });
      }

      throw new AppError("VALIDATION_ERROR", "Voice stages require audio input.", 400);
    }

    try {
      const transcriptText = await transcribeAudioInput({
        audioDataUrl: answer.audioDataUrl,
        mimeType: answer.audioMimeType,
      });
      const { matchedTarget } = matchesVoiceStage(stage, transcriptText);
      const arcadeStats = isArcadeStage(stage)
        ? deriveArcadeStageStats(stage, {
            solved: matchedTarget,
            attemptNumber,
            mistakeCount: answer.arcadeMetrics?.mistakeCount,
            timeRemainingMs: answer.arcadeMetrics?.timeRemainingMs,
            comboPeak: answer.arcadeMetrics?.comboPeak,
            livesRemaining: answer.arcadeMetrics?.livesRemaining,
            inputMode: "voice",
            completionPath: answer.arcadeMetrics?.completionPath,
          })
        : deriveStructuredStageStats(stage, {
            solved: matchedTarget,
            attemptNumber,
            livesRemaining: answer.structuralMetrics?.livesRemaining,
            timeRemainingMs: answer.structuralMetrics?.timeRemainingMs,
            resolvedInputMode: "voice",
            timeExpired: answer.structuralMetrics?.timeExpired,
          });

      return finishEvaluation({
        ...createStageReview(
          stage,
          matchedTarget ? "strong" : "practice_more",
          matchedTarget ? stage.correctMessage : `${stage.retryMessage} ${stage.coachFocus}`,
          {
            attemptNumber,
            resolvedInputMode: "voice",
            transcriptText,
            ...commonReviewOptions,
            ...(arcadeStats ?? {}),
          }
        ),
        retryAllowed: shouldAllowRetry(
          matchedTarget ? "strong" : "practice_more",
          attemptNumber,
          game.completionRule.maxRetriesPerStage
        ),
      });
    } catch {
      await trackEvent({
        eventName: "learn_game_fallback_used",
        route: stageRoute(unitSlug, "game"),
        userId,
        properties: {
          unit_slug: unitSlug,
          stage_id: stageId,
          stage_kind: stage.kind,
          game_kind: game.gameKind,
          layout_variant: getStageLayoutVariant(stage, game),
          input_mode: "fallback",
          reason: "voice_evaluation_unavailable",
          ...sharedAnalytics,
        },
      });

      return finishEvaluation({
        ...createStageReview(
          stage,
          "practice_more",
          "The mic check was not clear enough. Use the fallback option and keep going.",
          {
            attemptNumber,
            resolvedInputMode: "fallback",
            ...commonReviewOptions,
            ...(isArcadeStage(stage)
              ? deriveArcadeStageStats(stage, {
                  solved: false,
                  attemptNumber,
                  mistakeCount: answer.arcadeMetrics?.mistakeCount,
                  timeRemainingMs: answer.arcadeMetrics?.timeRemainingMs,
                  comboPeak: answer.arcadeMetrics?.comboPeak,
                  livesRemaining: answer.arcadeMetrics?.livesRemaining,
                  inputMode: "fallback",
                  completionPath: answer.arcadeMetrics?.completionPath,
                })
              : deriveStructuredStageStats(stage, {
                  solved: false,
                  attemptNumber,
                  livesRemaining: answer.structuralMetrics?.livesRemaining,
                  timeRemainingMs: answer.structuralMetrics?.timeRemainingMs,
                  resolvedInputMode: "fallback",
                  timeExpired: answer.structuralMetrics?.timeExpired,
                })),
            failureReason: "voice_unavailable",
          }
        ),
        retryAllowed: true,
        fallbackRecommended: true,
      });
    }
  },
};
