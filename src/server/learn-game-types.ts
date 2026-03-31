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
  | "arcade_lane_runner"
  | "arcade_sort_rush"
  | "arcade_route_race"
  | "arcade_reaction_pick"
  | "arcade_voice_burst"
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
  isNearMiss?: boolean;
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
  resolvedSpeechText?: string;
  answerRevealMode?: "preanswer" | "postanswer";
  scenePrompt?: string;
  dialoguePrompt?: string;
  sceneHotspots?: GameSceneHotspot[];
  lanes?: GameLane[];
  connections?: GameMapConnection[];
};

export type GameCelebrationVariant = "arcade_pulse" | "structured_glow";

export type ArcadeHudVariant =
  | "lane_runner"
  | "sort_rush"
  | "route_race"
  | "reaction_pick"
  | "voice_burst";

export type ArcadeInteractionModel =
  | "cross_dash"
  | "conveyor_bins"
  | "grid_runner"
  | "target_tag"
  | "split_decision"
  | "burst_callout";

export type ArcadeSpriteRefs = {
  player?: string;
  target?: string;
  hazard?: string;
  board?: string;
  accent?: string;
  neutral?: string;
};

export type ArcadeMotionRules = {
  dashStep?: number;
  driftPx?: number;
  travelMs?: number;
  conveyorSpeed?: number;
  routeSnapMs?: number;
  targetFloatPx?: number;
};

export type ArcadeHitBoxes = {
  targetRadius?: number;
  lanePadding?: number;
  binPadding?: number;
  nodeRadius?: number;
};

export type ArcadeSpawnTimeline = {
  spawnEveryMs?: number;
  closeLaneEveryMs?: number;
  rampEveryMs?: number;
  introMs?: number;
};

export type ArcadeRewardFx = {
  hitBurst?: string;
  missFlash?: string;
  comboGlow?: string;
  medalReveal?: string;
};

export type ArcadeTransitionFx = {
  introMs?: number;
  clearMs?: number;
  stageSwapMs?: number;
};

export type GameSoundSet =
  | "hallway"
  | "classroom"
  | "counter"
  | "route"
  | "weather"
  | "planner"
  | "story"
  | "scene"
  | "deadline"
  | "station"
  | "comparison"
  | "neutral";

export type ArcadeScoreRules = {
  correct: number;
  miss: number;
  streakBonus: number;
  clearBonus: number;
  timeBonusMultiplier?: number;
};

export type ArcadeComboRules = {
  maxCombo: number;
  breakOnMiss: boolean;
};

export type ArcadeSpawnRules = {
  spawnRateMs: number;
  speed: number;
  laneCount?: number;
  waveSize?: number;
};

export type ArcadePathRules = {
  startNodeId?: string;
  finishNodeId?: string;
  branchPenalty?: number;
  allowBacktrack?: boolean;
};

export type GameMedal = "gold" | "silver" | "bronze" | "retry";

export type GameStageResult = "cleared" | "retry";

export type GameCompletionPath = "structural" | "arcade" | "voice" | "fallback" | "mixed";

export type GameDifficultyBand = "very_basic" | "basic" | "intermediate" | "advanced";

export type GameChallengeProfile = "arcade" | "recall" | "construction" | "voice";

export type GameFailureReason =
  | "incorrect"
  | "timeout"
  | "lives_depleted"
  | "voice_unavailable"
  | null;

export type GameStageChallenge = {
  difficultyBand: GameDifficultyBand;
  timerMs?: number;
  lives: number;
  medalWindowAttempts: number;
  perActionWindowMs?: number;
  speedRampStepMs?: number;
  fallbackMedalCap?: Exclude<GameMedal, "retry">;
  voiceOnlyGold?: boolean;
};

type GameStageBase = {
  challengeProfile?: GameChallengeProfile;
  challenge?: GameStageChallenge;
};

export type ArcadeStageBase = GameStageBase & {
  timerMs: number;
  lives: number;
  scoreRules: ArcadeScoreRules;
  comboRules: ArcadeComboRules;
  hudVariant: ArcadeHudVariant;
  interactionModel: ArcadeInteractionModel;
  soundSet: GameSoundSet;
  theme?: GameThemeToken;
  assetRefs?: Partial<GameAssetRefs>;
  spriteRefs?: ArcadeSpriteRefs;
  spawnRules?: ArcadeSpawnRules;
  pathRules?: ArcadePathRules;
  motionRules?: ArcadeMotionRules;
  hitBoxes?: ArcadeHitBoxes;
  spawnTimeline?: ArcadeSpawnTimeline;
  failWindowMs?: number;
  rewardFx?: ArcadeRewardFx;
  transitionFx?: ArcadeTransitionFx;
};

export type LaneRunnerToken = {
  id: string;
  label: string;
  detail?: string;
  lane: number;
  // Used as spawn-order / stagger metadata in the lane-runner track runtime.
  column?: number;
  role: "target" | "hazard";
  color?: string;
};

export type ReactionPickRound = {
  id: string;
  prompt: string;
  options: GameChoiceOption[];
  correctOptionId: string;
  dialoguePrompt?: string;
};

export type ChoiceGameStage = GameStageBase & {
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

export type MatchGameStage = GameStageBase & {
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

export type SequenceGameStage = GameStageBase & {
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

export type MapGameStage = GameStageBase & {
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

export type VoicePromptGameStage = GameStageBase & {
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

export type AssembleGameStage = GameStageBase & {
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

export type SpotlightGameStage = GameStageBase & {
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

export type StateSwitchGameStage = GameStageBase & {
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

export type PriorityBoardGameStage = GameStageBase & {
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

export type LaneRunnerGameStage = ArcadeStageBase & {
  id: string;
  kind: "lane_runner";
  title: string;
  prompt: string;
  lanes: GameLane[];
  tokens: LaneRunnerToken[];
  targetSequenceIds: string[];
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type SortRushGameStage = ArcadeStageBase & {
  id: string;
  kind: "sort_rush";
  title: string;
  prompt: string;
  lanes: GameLane[];
  cards: GamePriorityCard[];
  correctAssignments: Array<{ cardId: string; laneId: string }>;
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type RouteRaceGameStage = ArcadeStageBase & {
  id: string;
  kind: "route_race";
  title: string;
  prompt: string;
  nodes: GameMapNode[];
  correctPathIds: string[];
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type ReactionPickGameStage = ArcadeStageBase & {
  id: string;
  kind: "reaction_pick";
  title: string;
  prompt: string;
  rounds: ReactionPickRound[];
  correctMessage: string;
  retryMessage: string;
  presentation?: GameStagePresentation;
};

export type VoiceBurstGameStage = ArcadeStageBase & {
  id: string;
  kind: "voice_burst";
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

export type GameStage =
  | ChoiceGameStage
  | MatchGameStage
  | SequenceGameStage
  | MapGameStage
  | VoicePromptGameStage
  | AssembleGameStage
  | SpotlightGameStage
  | StateSwitchGameStage
  | PriorityBoardGameStage
  | LaneRunnerGameStage
  | SortRushGameStage
  | RouteRaceGameStage
  | ReactionPickGameStage
  | VoiceBurstGameStage;

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
  ambientSet?: GameSoundSet;
  celebrationVariant?: GameCelebrationVariant;
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
  challengeProfile: GameChallengeProfile;
  outcome: "strong" | "practice_more";
  coachNote: string;
  transcriptText: string | null;
  resolvedInputMode: "voice" | "fallback" | null;
  attemptNumber?: number;
  nearMiss?: boolean;
  interactionModel?: ArcadeInteractionModel | "structural";
  retryCount?: number;
  muteEnabled?: boolean;
  scoreDelta?: number;
  combo?: number;
  livesRemaining?: number;
  stageResult?: GameStageResult;
  completionPath?: GameCompletionPath;
  medal?: GameMedal;
  medalCap?: Exclude<GameMedal, "retry">;
  failureReason?: GameFailureReason;
  timeExpired?: boolean;
  nextAllowedAction?: "retry" | "advance";
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
  attemptNumber: number;
  scoreDelta: number;
  combo: number;
  livesRemaining: number;
  stageResult: GameStageResult;
  completionPath: GameCompletionPath;
  medal: GameMedal;
  medalCap: Exclude<GameMedal, "retry">;
  failureReason: GameFailureReason;
  timeExpired: boolean;
  nextAllowedAction: "retry" | "advance";
};
