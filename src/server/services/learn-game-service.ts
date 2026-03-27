import { env } from "@/server/env";
import { prisma } from "@/server/prisma";

import type {
  AssembleGameStage,
  ChoiceGameStage,
  GameActivityPayload,
  GameStage,
  GameStagePresentation,
  LearnGameEvaluation,
  LearnGameReview,
  LearnGameReviewStage,
  MapGameStage,
  MatchGameStage,
  PriorityBoardGameStage,
  SequenceGameStage,
  SpotlightGameStage,
  StateSwitchGameStage,
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
    stages: items,
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
    .filter((stage): stage is GameStage => Boolean(stage));

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
            stage.stageKind === "choice" ||
            stage.stageKind === "match" ||
            stage.stageKind === "sequence" ||
            stage.stageKind === "map" ||
            stage.stageKind === "voice_prompt"
              ? stage.stageKind
              : "voice_prompt",
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

function getStageLayoutVariant(stage: GameStage, game: GameActivityPayload) {
  return stage.presentation?.layoutVariant ?? game.layoutVariant;
}

function createStageReview(
  stage: GameStage,
  outcome: "strong" | "practice_more",
  coachNote: string,
  options?: Partial<Pick<LearnGameReviewStage, "resolvedInputMode" | "transcriptText">>
): LearnGameEvaluation {
  return {
    stageId: stage.id,
    stageKind: stage.kind,
    stageTitle: stage.title,
    outcome,
    coachNote,
    transcriptText: options?.transcriptText ?? null,
    resolvedInputMode: options?.resolvedInputMode ?? null,
    retryAllowed: true,
    fallbackRecommended: false,
  };
}

function matchesAcceptedResponse(expected: string, actual: string) {
  const similarity = getSimilarity(expected, actual);
  return expected === actual || actual.includes(expected) || similarity >= 0.72;
}

function matchesVoiceStage(stage: VoicePromptGameStage, transcriptText: string) {
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
      audioDataUrl?: string;
      audioMimeType?: string;
      fallbackOptionId?: string;
    };
  }): Promise<LearnGameEvaluation> {
    const { unit, activity } = await CurriculumService.getUnitActivity(userId, unitSlug, "game");
    const game = normalizeGamePayload(activity.payload, unit.title);
    const stage = game.stages.find((entry) => entry.id === stageId);

    if (!stage) {
      throw new AppError("NOT_FOUND", "Game stage not found.", 404);
    }

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
          input_mode: inputMode ?? (stage.kind === "voice_prompt" ? "voice" : "structural"),
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
          input_mode: inputMode ?? (stage.kind === "voice_prompt" ? "voice" : "structural"),
        },
      });
    }

    if (stage.kind === "assemble") {
      const correct = compareAssembleAssignments(stage, answer.assembleAssignments ?? []);

      return {
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage
        ),
        retryAllowed: attemptNumber <= game.completionRule.maxRetriesPerStage,
      };
    }

    if (stage.kind === "choice") {
      const correct = answer.selectedOptionId === stage.correctOptionId;

      return {
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage
        ),
        retryAllowed: attemptNumber <= game.completionRule.maxRetriesPerStage,
      };
    }

    if (stage.kind === "match") {
      const correct = compareMatches(stage, answer.matches ?? []);

      return {
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage
        ),
        retryAllowed: attemptNumber <= game.completionRule.maxRetriesPerStage,
      };
    }

    if (stage.kind === "spotlight") {
      const correct = compareSpotlightSelection(stage, answer.hotspotIds ?? []);

      return {
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage
        ),
        retryAllowed: attemptNumber <= game.completionRule.maxRetriesPerStage,
      };
    }

    if (stage.kind === "state_switch") {
      const correct = compareStateAssignments(stage, answer.stateAssignments ?? []);

      return {
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage
        ),
        retryAllowed: attemptNumber <= game.completionRule.maxRetriesPerStage,
      };
    }

    if (stage.kind === "sequence") {
      const correct =
        Array.isArray(answer.orderedIds) &&
        answer.orderedIds.length === stage.correctOrderIds.length &&
        answer.orderedIds.every((id, index) => id === stage.correctOrderIds[index]);

      return {
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage
        ),
        retryAllowed: attemptNumber <= game.completionRule.maxRetriesPerStage,
      };
    }

    if (stage.kind === "priority_board") {
      const correct = comparePriorityAssignments(stage, answer.priorityAssignments ?? []);

      return {
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage
        ),
        retryAllowed: attemptNumber <= game.completionRule.maxRetriesPerStage,
      };
    }

    if (stage.kind === "map") {
      const correct =
        Array.isArray(answer.pathIds) &&
        answer.pathIds.length === stage.correctPathIds.length &&
        answer.pathIds.every((id, index) => id === stage.correctPathIds[index]);

      return {
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage
        ),
        retryAllowed: attemptNumber <= game.completionRule.maxRetriesPerStage,
      };
    }

    if (inputMode === "fallback") {
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
        },
      });

      const correct = answer.fallbackOptionId === stage.correctOptionId;

      return {
        ...createStageReview(
          stage,
          correct ? "strong" : "practice_more",
          correct ? stage.correctMessage : stage.retryMessage,
          {
            resolvedInputMode: "fallback",
          }
        ),
        retryAllowed: attemptNumber <= game.completionRule.maxRetriesPerStage,
      };
    }

    if (!answer.audioDataUrl || !answer.audioMimeType) {
      throw new AppError("VALIDATION_ERROR", "Voice stages require audio input.", 400);
    }

    try {
      const transcriptText = await transcribeAudioInput({
        audioDataUrl: answer.audioDataUrl,
        mimeType: answer.audioMimeType,
      });
      const { matchedTarget } = matchesVoiceStage(stage, transcriptText);

      return {
        ...createStageReview(
          stage,
          matchedTarget ? "strong" : "practice_more",
          matchedTarget ? stage.correctMessage : `${stage.retryMessage} ${stage.coachFocus}`,
          {
            resolvedInputMode: "voice",
            transcriptText,
          }
        ),
        retryAllowed: attemptNumber <= game.completionRule.maxRetriesPerStage,
      };
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
        },
      });

      return {
        ...createStageReview(
          stage,
          "practice_more",
          "The mic check was not clear enough. Use the fallback option and keep going.",
          {
            resolvedInputMode: "fallback",
          }
        ),
        retryAllowed: true,
        fallbackRecommended: true,
      };
    }
  },
};
