export type GameThemeToken =
  | "ocean"
  | "mint"
  | "sunset"
  | "gold"
  | "sky"
  | "rose"
  | "emerald"
  | "indigo"
  | "violet"
  | "coral"
  | "teal"
  | "amber";

export type GameLayoutVariant =
  | "mixer"
  | "character_cards"
  | "timeline"
  | "counter"
  | "map_route"
  | "weather_cards"
  | "planner"
  | "comic"
  | "scene_hotspots"
  | "kanban"
  | "service_desk"
  | "comparison_split"
  | "slot_strip"
  | "dialogue_pick"
  | "voice_focus"
  | "planner_dense"
  | "scene_focus"
  | "map_focus"
  | "generic";

export type GameAssetRefs = {
  hero: string;
  scene?: string;
  summary?: string;
};

export type GameChoiceOption = {
  id: string;
  label: string;
  detail?: string;
};

export type GameMatchItem = {
  id: string;
  label: string;
  detail?: string;
};

export type GameMapNode = {
  id: string;
  label: string;
  detail?: string;
  x?: number;
  y?: number;
};

export type GameSceneHotspot = {
  id: string;
  optionId: string;
  label: string;
  x: number;
  y: number;
};

export type GameMapConnection = {
  fromId: string;
  toId: string;
};

export type GameLane = {
  id: string;
  label: string;
};

export type GameCardSlot = {
  id: string;
  label: string;
  detail?: string;
};

export type GamePriorityCard = {
  id: string;
  label: string;
  detail?: string;
};

export type GameStateOption = {
  id: string;
  label: string;
  detail?: string;
  assetRef?: string;
};

export type GameStagePresentation = {
  layoutVariant: GameLayoutVariant;
  assetRef?: string;
  boardTitle?: string;
  helperLabel?: string;
  helperText?: string;
  callToAction?: string;
  ctaLabel?: string;
  resolvedTitle?: string;
  resolvedNote?: string;
  scenePrompt?: string;
  dialoguePrompt?: string;
  sceneHotspots?: GameSceneHotspot[];
  lanes?: GameLane[];
  connections?: GameMapConnection[];
};

export type ChoiceGameStage = {
  id: string;
  kind: "choice";
  title: string;
  prompt: string;
  options: GameChoiceOption[];
  correctOptionId: string;
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type MatchGameStage = {
  id: string;
  kind: "match";
  title: string;
  prompt: string;
  leftItems: GameMatchItem[];
  rightItems: GameMatchItem[];
  correctMatches: Array<{ leftId: string; rightId: string }>;
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type SequenceGameStage = {
  id: string;
  kind: "sequence";
  title: string;
  prompt: string;
  items: GameChoiceOption[];
  correctOrderIds: string[];
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type MapGameStage = {
  id: string;
  kind: "map";
  title: string;
  prompt: string;
  nodes: GameMapNode[];
  correctPathIds: string[];
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type VoicePromptGameStage = {
  id: string;
  kind: "voice_prompt";
  title: string;
  prompt: string;
  targetPhrase: string;
  coachFocus: string;
  requiredPhrases?: string[];
  acceptedResponses?: string[];
  fallbackOptions: GameChoiceOption[];
  correctOptionId: string;
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type AssembleGameStage = {
  id: string;
  kind: "assemble";
  title: string;
  prompt: string;
  slots: GameCardSlot[];
  options: GameChoiceOption[];
  correctAssignments: Array<{ slotId: string; optionId: string }>;
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type SpotlightGameStage = {
  id: string;
  kind: "spotlight";
  title: string;
  prompt: string;
  hotspots: Array<{
    id: string;
    label: string;
    detail?: string;
    x: number;
    y: number;
  }>;
  correctHotspotIds: string[];
  selectionMode?: "single" | "multiple";
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type StateSwitchGameStage = {
  id: string;
  kind: "state_switch";
  title: string;
  prompt: string;
  states: GameStateOption[];
  responseOptions: GameChoiceOption[];
  correctAssignments: Array<{ stateId: string; optionId: string }>;
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type PriorityBoardGameStage = {
  id: string;
  kind: "priority_board";
  title: string;
  prompt: string;
  lanes: GameLane[];
  cards: GamePriorityCard[];
  correctAssignments: Array<{ cardId: string; laneId: string }>;
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type GameStage =
  | ChoiceGameStage
  | MatchGameStage
  | SequenceGameStage
  | MapGameStage
  | VoicePromptGameStage
  | AssembleGameStage
  | SpotlightGameStage
  | StateSwitchGameStage
  | PriorityBoardGameStage;

export type GameSummaryContent = {
  strength: string;
  nextFocus: string;
  bridgeToSpeaking: string;
};

export type GameActivityPayload = {
  gameId: string;
  gameTitle: string;
  gameKind: string;
  theme: GameThemeToken;
  layoutVariant: GameLayoutVariant;
  assetRefs: GameAssetRefs;
  introText: string;
  stages: GameStage[];
  summary: GameSummaryContent;
  completionRule: {
    requiredStageCount: number;
    maxRetriesPerStage: number;
  };
};

export type LearnGameReviewStage = {
  stageId: string;
  stageKind: GameStage["kind"];
  stageTitle: string;
  outcome: "strong" | "practice_more";
  coachNote: string;
  transcriptText: string | null;
  resolvedInputMode: "voice" | "fallback" | null;
};

export type LearnGameReview = {
  gameId: string;
  gameTitle: string;
  gameKind: string;
  strength: string;
  nextFocus: string;
  bridgeToSpeaking: string;
  replayStageIds: string[];
  stages: LearnGameReviewStage[];
};

export type LearnGameEvaluation = LearnGameReviewStage & {
  retryAllowed: boolean;
  fallbackRecommended: boolean;
};
