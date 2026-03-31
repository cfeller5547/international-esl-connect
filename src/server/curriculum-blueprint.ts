import { inferLearnOpeningQuestion } from "@/server/learn-speaking-prompts";
import { AUTHORED_SPEAKING_MISSIONS } from "@/server/curriculum-speaking-missions";
import type {
  ArcadeComboRules,
  ArcadeHitBoxes,
  ArcadeInteractionModel,
  ArcadeMotionRules,
  ArcadePathRules,
  ArcadeRewardFx,
  ArcadeScoreRules,
  ArcadeSpawnTimeline,
  ArcadeSpawnRules,
  ArcadeSpriteRefs,
  ArcadeTransitionFx,
  AssembleGameStage,
  ChoiceGameStage,
  GameActivityPayload,
  GameChoiceOption,
  GameLayoutVariant,
  GameMapNode,
  GameLane,
  GameSoundSet,
  GameSummaryContent,
  GameStagePresentation,
  GameThemeToken,
  GameStage,
  LaneRunnerGameStage,
  PriorityBoardGameStage,
  ReactionPickGameStage,
  ReactionPickRound,
  RouteRaceGameStage,
  SequenceGameStage,
  SortRushGameStage,
  SpotlightGameStage,
  VoiceBurstGameStage,
  VoicePromptGameStage,
} from "@/server/learn-game-types";
import type { MissionEvidenceTarget } from "@/server/learn-speaking-types";

export const CURRICULUM_LEVELS = [
  "very_basic",
  "basic",
  "intermediate",
  "advanced",
] as const;

export type CurriculumLevel = (typeof CURRICULUM_LEVELS)[number];

export const UNIT_ACTIVITY_TYPES = [
  "lesson",
  "practice",
  "game",
  "speaking",
  "writing",
  "checkpoint",
] as const;

export type UnitActivityType = (typeof UNIT_ACTIVITY_TYPES)[number];

export type LessonCheck = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type PracticeQuestion = {
  id: string;
  prompt: string;
  answer: string;
};

export type UnitBlueprint = {
  slug: string;
  title: string;
  summary: string;
  canDoStatement: string;
  theme: string;
  keyVocabulary: string[];
  languageFocus: string[];
  performanceTask: string;
  scenario: string;
  lessonSections: Array<{ title: string; body: string }>;
  lessonChecks: LessonCheck[];
  practiceQuestions: PracticeQuestion[];
  game: GameActivityPayload;
  speakingMission: {
    scenarioTitle: string;
    scenarioSetup: string;
    counterpartRole: string;
    openingQuestion: string;
    warmupPrompts: string[];
    targetPhrases: string[];
    followUpPrompts: string[];
    successCriteria: string[];
    modelExample: string;
    isBenchmark: boolean;
    requiredTurns: number;
    minimumFollowUpResponses: number;
    evidenceTargets: MissionEvidenceTarget[];
    followUpObjectives: string[];
    benchmarkFocus: string[];
  };
  writingPrompt: string;
  writingCriteria: string[];
  checkpointQuestions: LessonCheck[];
};

export type CurriculumBlueprint = {
  level: CurriculumLevel;
  title: string;
  description: string;
  units: UnitBlueprint[];
};

type SpeakingMissionBlueprint = UnitBlueprint["speakingMission"];

const rankMap: Record<CurriculumLevel, number> = {
  very_basic: 0,
  basic: 1,
  intermediate: 2,
  advanced: 3,
};

export function getLevelRank(level: CurriculumLevel) {
  return rankMap[level];
}

export function normalizeLevelLabel(
  level: string | null | undefined
): CurriculumLevel {
  if (!level) {
    return "very_basic";
  }

  if (level === "foundation") {
    return "very_basic";
  }

  if (CURRICULUM_LEVELS.includes(level as CurriculumLevel)) {
    return level as CurriculumLevel;
  }

  return "very_basic";
}

function stableId(seed: number) {
  return `20000000-0000-4000-8000-${seed.toString().padStart(12, "0")}`;
}

const levelCode: Record<CurriculumLevel, number> = {
  very_basic: 1,
  basic: 2,
  intermediate: 3,
  advanced: 4,
};

const activityCode: Record<UnitActivityType, number> = {
  lesson: 1,
  practice: 2,
  game: 6,
  speaking: 3,
  writing: 4,
  checkpoint: 5,
};

export function getCurriculumId(level: CurriculumLevel) {
  return stableId(100 + levelCode[level]);
}

export function getUnitId(level: CurriculumLevel, unitIndex: number) {
  return stableId(1_000 + levelCode[level] * 100 + unitIndex);
}

export function getLessonContentId(level: CurriculumLevel, unitIndex: number) {
  return stableId(2_000 + levelCode[level] * 100 + unitIndex);
}

export function getPracticeContentId(level: CurriculumLevel, unitIndex: number) {
  return stableId(3_000 + levelCode[level] * 100 + unitIndex);
}

export function getActivityId(
  level: CurriculumLevel,
  unitIndex: number,
  type: UnitActivityType
) {
  return stableId(4_000 + levelCode[level] * 100 + unitIndex * 10 + activityCode[type]);
}

type RawUnitBlueprint = {
  slug: string;
  title: string;
  summary: string;
  canDoStatement: string;
  theme: string;
  keyVocabulary: string[];
  languageFocus: string[];
  performanceTask: string;
  scenario: string;
  authoredContent?: {
    lessonSections?: UnitBlueprint["lessonSections"];
    lessonChecks?: LessonCheck[];
    practiceQuestions?: PracticeQuestion[];
    game?: GameActivityPayload;
    writingPrompt?: string;
    writingCriteria?: string[];
    checkpointQuestions?: LessonCheck[];
  };
};

function formatItemList(items: string[], maxItems = 3) {
  return items
    .filter((item) => item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => `"${item}"`)
    .join(", ");
}

function getPracticeSentenceGuide(level: CurriculumLevel) {
  switch (level) {
    case "very_basic":
      return "Write 1 short sentence";
    case "basic":
      return "Write 1 to 2 connected sentences";
    case "intermediate":
      return "Write 2 to 3 connected sentences";
    case "advanced":
      return "Write 2 to 4 precise sentences";
  }
}

function getWritingSentenceGuide(level: CurriculumLevel) {
  switch (level) {
    case "very_basic":
      return "3 to 5 simple sentences";
    case "basic":
      return "4 to 6 connected sentences";
    case "intermediate":
      return "5 to 7 connected sentences";
    case "advanced":
      return "6 to 8 polished sentences or one short paragraph";
  }
}

function getLevelSpecificWritingCriterion(level: CurriculumLevel) {
  switch (level) {
    case "very_basic":
      return "Use complete simple sentences and include one extra detail or question.";
    case "basic":
      return "Keep the response connected with clear order, time, or comparison language.";
    case "intermediate":
      return "Develop the main idea with a reason, example, or reflection.";
    case "advanced":
      return "Use precise academic or professional language and support the main point clearly.";
  }
}

function createChecks(
  raw: RawUnitBlueprint,
  mission: SpeakingMissionBlueprint
): LessonCheck[] {
  if (raw.authoredContent?.lessonChecks) {
    return raw.authoredContent.lessonChecks;
  }

  return [
    {
      prompt: "Which opening question best fits this unit scene?",
      options: [
        mission.openingQuestion,
        "What is your favorite color?",
        "Can you close the window for me?",
      ],
      correctIndex: 0,
    },
    {
      prompt: "Which phrase would help you answer this scene naturally?",
      options: [
        mission.targetPhrases[0] ?? raw.keyVocabulary[0] ?? raw.canDoStatement,
        "I don't know.",
        "Goodbye.",
      ],
      correctIndex: 0,
    },
  ];
}

function createPracticeQuestions(
  level: CurriculumLevel,
  unitIndex: number,
  raw: RawUnitBlueprint,
  mission: SpeakingMissionBlueprint
): PracticeQuestion[] {
  if (raw.authoredContent?.practiceQuestions) {
    return raw.authoredContent.practiceQuestions.map((question, index) => ({
      ...question,
      id: question.id || `${level}-${unitIndex}-practice-${index + 1}`,
    }));
  }

  const guide = getPracticeSentenceGuide(level);

  return [
    {
      id: `${level}-${unitIndex}-practice-1`,
      prompt: `${guide} that answers the scene opener: "${mission.openingQuestion}"`,
      answer: "free_response",
    },
    {
      id: `${level}-${unitIndex}-practice-2`,
      prompt: `${guide} that uses one of these unit phrases naturally: ${formatItemList(
        mission.targetPhrases,
        2
      )}.`,
      answer: "free_response",
    },
    {
      id: `${level}-${unitIndex}-practice-3`,
      prompt: `${guide} that keeps the conversation moving by answering: "${
        mission.followUpPrompts[0] ?? raw.canDoStatement
      }"`,
      answer: "free_response",
    },
  ];
}

const GAME_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "by",
  "can",
  "class",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "or",
  "the",
  "to",
  "what",
  "with",
  "you",
]);

function normalizeGameToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.\.\./g, " ")
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type GameCandidate = {
  text: string;
  priority: number;
};

function addGameCandidate(
  target: Map<string, GameCandidate>,
  rawValue: string,
  priority: number
) {
  const cleaned = normalizeGameToken(rawValue);

  if (!cleaned || cleaned.length < 2 || cleaned.split(/\s+/).length > 3) {
    return;
  }

  const existing = target.get(cleaned);
  if (!existing || priority > existing.priority) {
    target.set(cleaned, {
      text: cleaned,
      priority,
    });
  }
}

function collectSignificantTokens(source: string) {
  return normalizeGameToken(source)
    .split(/\s+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter((token) => token.length >= 3 && !GAME_STOP_WORDS.has(token));
}

function isSingleStopwordCandidate(value: string) {
  const parts = normalizeGameToken(value).split(/\s+/).filter(Boolean);
  return parts.length === 1 && GAME_STOP_WORDS.has(parts[0]!);
}

function collectGameCandidates(raw: RawUnitBlueprint) {
  const candidates = new Map<string, GameCandidate>();

  for (const value of raw.keyVocabulary) {
    addGameCandidate(candidates, value, 300);
  }

  for (const token of collectSignificantTokens(raw.title)) {
    addGameCandidate(candidates, token, 180);
  }

  for (const token of collectSignificantTokens(raw.theme)) {
    addGameCandidate(candidates, token, 140);
  }

  for (const token of collectSignificantTokens(raw.performanceTask)) {
    addGameCandidate(candidates, token, 120);
  }

  for (const token of collectSignificantTokens(raw.canDoStatement)) {
    addGameCandidate(candidates, token, 100);
  }

  const ordered = Array.from(candidates.values()).sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    const leftWordCount = left.text.split(/\s+/).length;
    const rightWordCount = right.text.split(/\s+/).length;
    if (leftWordCount !== rightWordCount) {
      return leftWordCount - rightWordCount;
    }

    return right.text.length - left.text.length;
  });

  const preferred = ordered.filter((candidate) => !isSingleStopwordCandidate(candidate.text));
  const fallback = ordered.filter((candidate) => isSingleStopwordCandidate(candidate.text));

  return [...preferred, ...fallback].map((candidate) => candidate.text);
}

function stageId(level: CurriculumLevel, unitIndex: number, suffix: string) {
  return `${level}-${unitIndex}-game-${suffix}`;
}

function choiceOption(
  id: string,
  label: string,
  detail?: string,
  isNearMiss = false
): GameChoiceOption {
  return {
    id,
    label,
    detail,
    isNearMiss,
  };
}

function gameAsset(assetName: string) {
  return `/games/stage1/${assetName}.svg`;
}

function spriteAsset(assetName: string) {
  return `/games/stage6/${assetName}.svg`;
}

function gamePresentation(
  layoutVariant: GameLayoutVariant,
  overrides: Omit<GameStagePresentation, "layoutVariant"> = {}
): GameStagePresentation {
  return {
    layoutVariant,
    ...overrides,
  };
}

function makeChoiceStage(
  id: string,
  title: string,
  prompt: string,
  options: GameChoiceOption[],
  correctOptionId: string,
  correctMessage: string,
  retryMessage: string,
  presentation?: GameStagePresentation
): ChoiceGameStage {
  return {
    id,
    kind: "choice",
    title,
    prompt,
    options,
    correctOptionId,
    correctMessage,
    retryMessage,
    presentation,
  };
}

function makeAssembleStage(
  id: string,
  title: string,
  prompt: string,
  slots: AssembleGameStage["slots"],
  options: GameChoiceOption[],
  correctAssignments: Array<{ slotId: string; optionId: string }>,
  correctMessage: string,
  retryMessage: string,
  presentation?: GameStagePresentation
): AssembleGameStage {
  return {
    id,
    kind: "assemble",
    title,
    prompt,
    slots,
    options,
    correctAssignments,
    correctMessage,
    retryMessage,
    presentation,
  };
}

function makeSpotlightStage(
  id: string,
  title: string,
  prompt: string,
  hotspots: SpotlightGameStage["hotspots"],
  correctHotspotIds: string[],
  correctMessage: string,
  retryMessage: string,
  options?: {
    selectionMode?: "single" | "multiple";
    presentation?: GameStagePresentation;
  }
): SpotlightGameStage {
  return {
    id,
    kind: "spotlight",
    title,
    prompt,
    hotspots,
    correctHotspotIds,
    selectionMode: options?.selectionMode ?? "single",
    correctMessage,
    retryMessage,
    presentation: options?.presentation,
  };
}

function makeSequenceStage(
  id: string,
  title: string,
  prompt: string,
  items: GameChoiceOption[],
  correctOrderIds: string[],
  correctMessage: string,
  retryMessage: string,
  presentation?: GameStagePresentation
): SequenceGameStage {
  return {
    id,
    kind: "sequence",
    title,
    prompt,
    items,
    correctOrderIds,
    correctMessage,
    retryMessage,
    presentation,
  };
}

function makePriorityBoardStage(
  id: string,
  title: string,
  prompt: string,
  lanes: PriorityBoardGameStage["lanes"],
  cards: PriorityBoardGameStage["cards"],
  correctAssignments: Array<{ cardId: string; laneId: string }>,
  correctMessage: string,
  retryMessage: string,
  presentation?: GameStagePresentation
): PriorityBoardGameStage {
  return {
    id,
    kind: "priority_board",
    title,
    prompt,
    lanes,
    cards,
    correctAssignments,
    correctMessage,
    retryMessage,
    presentation,
  };
}

function makeVoicePromptStage(
  id: string,
  title: string,
  prompt: string,
  targetPhrase: string,
  coachFocus: string,
  fallbackOptions: GameChoiceOption[],
  correctOptionId: string,
  correctMessage: string,
  retryMessage: string,
  options?: {
    presentation?: GameStagePresentation;
    requiredPhrases?: string[];
    acceptedResponses?: string[];
  }
): VoicePromptGameStage {
  return {
    id,
    kind: "voice_prompt",
    title,
    prompt,
    targetPhrase,
    coachFocus,
    requiredPhrases: options?.requiredPhrases,
    acceptedResponses: options?.acceptedResponses,
    fallbackOptions,
    correctOptionId,
    correctMessage,
    retryMessage,
    presentation: options?.presentation,
  };
}

type ArcadeStageOptions = {
  presentation?: GameStagePresentation;
  timerMs?: number;
  lives?: number;
  soundSet?: GameSoundSet;
  theme?: GameThemeToken;
  interactionModel?: ArcadeInteractionModel;
  scoreRules?: Partial<ArcadeScoreRules>;
  comboRules?: Partial<ArcadeComboRules>;
  spawnRules?: ArcadeSpawnRules;
  pathRules?: ArcadePathRules;
  spriteRefs?: ArcadeSpriteRefs;
  motionRules?: ArcadeMotionRules;
  hitBoxes?: ArcadeHitBoxes;
  spawnTimeline?: ArcadeSpawnTimeline;
  failWindowMs?: number;
  rewardFx?: ArcadeRewardFx;
  transitionFx?: ArcadeTransitionFx;
};

function arcadeSpriteDefaults(kind: LaneRunnerGameStage["kind"] | SortRushGameStage["kind"] | RouteRaceGameStage["kind"] | ReactionPickGameStage["kind"] | VoiceBurstGameStage["kind"]): ArcadeSpriteRefs {
  switch (kind) {
    case "lane_runner":
      return {
        player: spriteAsset("runner-player"),
        target: spriteAsset("runner-target"),
        hazard: spriteAsset("runner-hazard"),
        board: spriteAsset("lane-board"),
        neutral: spriteAsset("runner-target"),
      };
    case "sort_rush":
      return {
        target: spriteAsset("sort-card"),
        board: spriteAsset("sort-board"),
        accent: spriteAsset("sort-accent"),
        neutral: spriteAsset("sort-accent"),
      };
    case "route_race":
      return {
        player: spriteAsset("route-marker"),
        target: spriteAsset("route-node"),
        hazard: spriteAsset("route-detour"),
        board: spriteAsset("route-board"),
        neutral: spriteAsset("route-marker"),
      };
    case "reaction_pick":
      return {
        neutral: spriteAsset("reaction-neutral"),
        target: spriteAsset("reaction-good"),
        hazard: spriteAsset("reaction-bad"),
        board: spriteAsset("reaction-board"),
      };
    case "voice_burst":
      return {
        player: spriteAsset("voice-mic"),
        target: spriteAsset("voice-wave"),
        board: spriteAsset("voice-board"),
        neutral: spriteAsset("voice-mic"),
      };
  }
}

function arcadeScoreRules(overrides: Partial<ArcadeScoreRules> = {}): ArcadeScoreRules {
  return {
    correct: 100,
    miss: 35,
    streakBonus: 16,
    clearBonus: 120,
    timeBonusMultiplier: 0.02,
    ...overrides,
  };
}

function arcadeComboRules(overrides: Partial<ArcadeComboRules> = {}): ArcadeComboRules {
  return {
    maxCombo: 5,
    breakOnMiss: true,
    ...overrides,
  };
}

function arcadeMotionDefaults(kind: ArcadeStageOptions["interactionModel"]): ArcadeMotionRules {
  switch (kind) {
    case "cross_dash":
      return { dashStep: 1, driftPx: 8, travelMs: 170 };
    case "conveyor_bins":
      return { conveyorSpeed: 1.15, travelMs: 210, driftPx: 4 };
    case "grid_runner":
      return { routeSnapMs: 180, travelMs: 210, driftPx: 6 };
    case "target_tag":
      return { targetFloatPx: 14, travelMs: 160 };
    case "split_decision":
      return { targetFloatPx: 8, travelMs: 140 };
    case "burst_callout":
      return { driftPx: 3, travelMs: 120 };
    default:
      return {};
  }
}

function arcadeHitBoxDefaults(kind: ArcadeStageOptions["interactionModel"]): ArcadeHitBoxes {
  switch (kind) {
    case "cross_dash":
      return { targetRadius: 0.74, lanePadding: 0.12 };
    case "conveyor_bins":
      return { targetRadius: 0.82, binPadding: 0.1 };
    case "grid_runner":
      return { targetRadius: 0.78, nodeRadius: 0.24 };
    case "target_tag":
      return { targetRadius: 0.76 };
    case "split_decision":
      return { targetRadius: 0.88 };
    case "burst_callout":
      return { targetRadius: 0.9 };
    default:
      return {};
  }
}

function arcadeSpawnTimelineDefaults(kind: ArcadeStageOptions["interactionModel"]): ArcadeSpawnTimeline {
  switch (kind) {
    case "cross_dash":
      return { introMs: 600, rampEveryMs: 2800, spawnEveryMs: 1200 };
    case "conveyor_bins":
      return { introMs: 450, rampEveryMs: 2400, spawnEveryMs: 1100, closeLaneEveryMs: 5200 };
    case "grid_runner":
      return { introMs: 500, rampEveryMs: 2600, spawnEveryMs: 1250 };
    case "target_tag":
      return { introMs: 350, rampEveryMs: 2100, spawnEveryMs: 950 };
    case "split_decision":
      return { introMs: 320, rampEveryMs: 1900, spawnEveryMs: 900 };
    case "burst_callout":
      return { introMs: 300, rampEveryMs: 1600, spawnEveryMs: 1000 };
    default:
      return {};
  }
}

function arcadeRewardFxDefaults(kind: ArcadeStageOptions["interactionModel"]): ArcadeRewardFx {
  switch (kind) {
    case "cross_dash":
      return {
        hitBurst: "lane-hit",
        missFlash: "lane-miss",
        comboGlow: "lane-streak",
        medalReveal: "lane-medal",
      };
    case "conveyor_bins":
      return {
        hitBurst: "sort-snap",
        missFlash: "sort-jam",
        comboGlow: "sort-streak",
        medalReveal: "sort-medal",
      };
    case "grid_runner":
      return {
        hitBurst: "route-snap",
        missFlash: "route-detour",
        comboGlow: "route-streak",
        medalReveal: "route-medal",
      };
    case "target_tag":
      return {
        hitBurst: "target-pop",
        missFlash: "target-fade",
        comboGlow: "target-streak",
        medalReveal: "target-medal",
      };
    case "split_decision":
      return {
        hitBurst: "decision-lock",
        missFlash: "decision-slip",
        comboGlow: "decision-streak",
        medalReveal: "decision-medal",
      };
    case "burst_callout":
      return {
        hitBurst: "voice-pulse",
        missFlash: "voice-drop",
        comboGlow: "voice-rise",
        medalReveal: "voice-medal",
      };
    default:
      return {};
  }
}

function arcadeTransitionDefaults(kind: ArcadeStageOptions["interactionModel"]): ArcadeTransitionFx {
  switch (kind) {
    case "cross_dash":
      return { introMs: 260, clearMs: 360, stageSwapMs: 320 };
    case "conveyor_bins":
      return { introMs: 220, clearMs: 340, stageSwapMs: 300 };
    case "grid_runner":
      return { introMs: 240, clearMs: 360, stageSwapMs: 320 };
    case "target_tag":
      return { introMs: 180, clearMs: 300, stageSwapMs: 280 };
    case "split_decision":
      return { introMs: 160, clearMs: 280, stageSwapMs: 260 };
    case "burst_callout":
      return { introMs: 180, clearMs: 320, stageSwapMs: 280 };
    default:
      return {};
  }
}

function arcadeFailWindowDefault(kind: ArcadeStageOptions["interactionModel"]) {
  switch (kind) {
    case "cross_dash":
      return 900;
    case "conveyor_bins":
      return 850;
    case "grid_runner":
      return 880;
    case "target_tag":
      return 760;
    case "split_decision":
      return 720;
    case "burst_callout":
      return 1200;
    default:
      return 900;
  }
}

function makeLaneRunnerStage(
  id: string,
  title: string,
  prompt: string,
  lanes: GameLane[],
  tokens: LaneRunnerGameStage["tokens"],
  targetSequenceIds: string[],
  correctMessage: string,
  retryMessage: string,
  options: ArcadeStageOptions = {}
): LaneRunnerGameStage {
  const interactionModel = options.interactionModel ?? "cross_dash";
  return {
    id,
    kind: "lane_runner",
    title,
    prompt,
    lanes,
    tokens,
    targetSequenceIds,
    timerMs: options.timerMs ?? 24000,
    lives: options.lives ?? 3,
    scoreRules: arcadeScoreRules(options.scoreRules),
    comboRules: arcadeComboRules(options.comboRules),
    hudVariant: "lane_runner",
    interactionModel,
    soundSet: options.soundSet ?? "hallway",
    theme: options.theme,
    spriteRefs: {
      ...arcadeSpriteDefaults("lane_runner"),
      ...(options.spriteRefs ?? {}),
    },
    spawnRules: options.spawnRules,
    pathRules: options.pathRules,
    motionRules: { ...arcadeMotionDefaults(interactionModel), ...(options.motionRules ?? {}) },
    hitBoxes: { ...arcadeHitBoxDefaults(interactionModel), ...(options.hitBoxes ?? {}) },
    spawnTimeline: { ...arcadeSpawnTimelineDefaults(interactionModel), ...(options.spawnTimeline ?? {}) },
    failWindowMs: options.failWindowMs ?? arcadeFailWindowDefault(interactionModel),
    rewardFx: { ...arcadeRewardFxDefaults(interactionModel), ...(options.rewardFx ?? {}) },
    transitionFx: { ...arcadeTransitionDefaults(interactionModel), ...(options.transitionFx ?? {}) },
    correctMessage,
    retryMessage,
    presentation: options.presentation,
  };
}

function makeSortRushStage(
  id: string,
  title: string,
  prompt: string,
  lanes: GameLane[],
  cards: SortRushGameStage["cards"],
  correctAssignments: SortRushGameStage["correctAssignments"],
  correctMessage: string,
  retryMessage: string,
  options: ArcadeStageOptions = {}
): SortRushGameStage {
  const interactionModel = options.interactionModel ?? "conveyor_bins";
  return {
    id,
    kind: "sort_rush",
    title,
    prompt,
    lanes,
    cards,
    correctAssignments,
    timerMs: options.timerMs ?? 22000,
    lives: options.lives ?? 3,
    scoreRules: arcadeScoreRules(options.scoreRules),
    comboRules: arcadeComboRules(options.comboRules),
    hudVariant: "sort_rush",
    interactionModel,
    soundSet: options.soundSet ?? "planner",
    theme: options.theme,
    spriteRefs: {
      ...arcadeSpriteDefaults("sort_rush"),
      ...(options.spriteRefs ?? {}),
    },
    spawnRules: options.spawnRules,
    pathRules: options.pathRules,
    motionRules: { ...arcadeMotionDefaults(interactionModel), ...(options.motionRules ?? {}) },
    hitBoxes: { ...arcadeHitBoxDefaults(interactionModel), ...(options.hitBoxes ?? {}) },
    spawnTimeline: { ...arcadeSpawnTimelineDefaults(interactionModel), ...(options.spawnTimeline ?? {}) },
    failWindowMs: options.failWindowMs ?? arcadeFailWindowDefault(interactionModel),
    rewardFx: { ...arcadeRewardFxDefaults(interactionModel), ...(options.rewardFx ?? {}) },
    transitionFx: { ...arcadeTransitionDefaults(interactionModel), ...(options.transitionFx ?? {}) },
    correctMessage,
    retryMessage,
    presentation: options.presentation,
  };
}

function makeRouteRaceStage(
  id: string,
  title: string,
  prompt: string,
  nodes: GameMapNode[],
  correctPathIds: string[],
  correctMessage: string,
  retryMessage: string,
  options: ArcadeStageOptions = {}
): RouteRaceGameStage {
  const interactionModel = options.interactionModel ?? "grid_runner";
  return {
    id,
    kind: "route_race",
    title,
    prompt,
    nodes,
    correctPathIds,
    timerMs: options.timerMs ?? 24000,
    lives: options.lives ?? 3,
    scoreRules: arcadeScoreRules(options.scoreRules),
    comboRules: arcadeComboRules(options.comboRules),
    hudVariant: "route_race",
    interactionModel,
    soundSet: options.soundSet ?? "route",
    theme: options.theme,
    spriteRefs: {
      ...arcadeSpriteDefaults("route_race"),
      ...(options.spriteRefs ?? {}),
    },
    spawnRules: options.spawnRules,
    pathRules: options.pathRules,
    motionRules: { ...arcadeMotionDefaults(interactionModel), ...(options.motionRules ?? {}) },
    hitBoxes: { ...arcadeHitBoxDefaults(interactionModel), ...(options.hitBoxes ?? {}) },
    spawnTimeline: { ...arcadeSpawnTimelineDefaults(interactionModel), ...(options.spawnTimeline ?? {}) },
    failWindowMs: options.failWindowMs ?? arcadeFailWindowDefault(interactionModel),
    rewardFx: { ...arcadeRewardFxDefaults(interactionModel), ...(options.rewardFx ?? {}) },
    transitionFx: { ...arcadeTransitionDefaults(interactionModel), ...(options.transitionFx ?? {}) },
    correctMessage,
    retryMessage,
    presentation: options.presentation,
  };
}

function makeReactionPickStage(
  id: string,
  title: string,
  prompt: string,
  rounds: ReactionPickRound[],
  correctMessage: string,
  retryMessage: string,
  options: ArcadeStageOptions = {}
): ReactionPickGameStage {
  const interactionModel = options.interactionModel ?? "split_decision";
  return {
    id,
    kind: "reaction_pick",
    title,
    prompt,
    rounds,
    timerMs: options.timerMs ?? 18000,
    lives: options.lives ?? 3,
    scoreRules: arcadeScoreRules(options.scoreRules),
    comboRules: arcadeComboRules(options.comboRules),
    hudVariant: "reaction_pick",
    interactionModel,
    soundSet: options.soundSet ?? "comparison",
    theme: options.theme,
    spriteRefs: {
      ...arcadeSpriteDefaults("reaction_pick"),
      ...(options.spriteRefs ?? {}),
    },
    spawnRules: options.spawnRules,
    pathRules: options.pathRules,
    motionRules: { ...arcadeMotionDefaults(interactionModel), ...(options.motionRules ?? {}) },
    hitBoxes: { ...arcadeHitBoxDefaults(interactionModel), ...(options.hitBoxes ?? {}) },
    spawnTimeline: { ...arcadeSpawnTimelineDefaults(interactionModel), ...(options.spawnTimeline ?? {}) },
    failWindowMs: options.failWindowMs ?? arcadeFailWindowDefault(interactionModel),
    rewardFx: { ...arcadeRewardFxDefaults(interactionModel), ...(options.rewardFx ?? {}) },
    transitionFx: { ...arcadeTransitionDefaults(interactionModel), ...(options.transitionFx ?? {}) },
    correctMessage,
    retryMessage,
    presentation: options.presentation
      ? {
          ...options.presentation,
          answerRevealMode: options.presentation.answerRevealMode ?? "postanswer",
        }
      : undefined,
  };
}

function makeVoiceBurstStage(
  id: string,
  title: string,
  prompt: string,
  targetPhrase: string,
  coachFocus: string,
  fallbackOptions: GameChoiceOption[],
  correctOptionId: string,
  correctMessage: string,
  retryMessage: string,
  options?: ArcadeStageOptions & {
    requiredPhrases?: string[];
    acceptedResponses?: string[];
  }
): VoiceBurstGameStage {
  const interactionModel = options?.interactionModel ?? "burst_callout";
  return {
    id,
    kind: "voice_burst",
    title,
    prompt,
    targetPhrase,
    coachFocus,
    requiredPhrases: options?.requiredPhrases,
    acceptedResponses: options?.acceptedResponses,
    fallbackOptions,
    correctOptionId,
    timerMs: options?.timerMs ?? 18000,
    lives: options?.lives ?? 3,
    scoreRules: arcadeScoreRules(options?.scoreRules),
    comboRules: arcadeComboRules({
      maxCombo: 3,
      breakOnMiss: false,
      ...(options?.comboRules ?? {}),
    }),
    hudVariant: "voice_burst",
    interactionModel,
    soundSet: options?.soundSet ?? "neutral",
    theme: options?.theme,
    spriteRefs: {
      ...arcadeSpriteDefaults("voice_burst"),
      ...(options?.spriteRefs ?? {}),
    },
    spawnRules: options?.spawnRules,
    pathRules: options?.pathRules,
    motionRules: { ...arcadeMotionDefaults(interactionModel), ...(options?.motionRules ?? {}) },
    hitBoxes: { ...arcadeHitBoxDefaults(interactionModel), ...(options?.hitBoxes ?? {}) },
    spawnTimeline: { ...arcadeSpawnTimelineDefaults(interactionModel), ...(options?.spawnTimeline ?? {}) },
    failWindowMs: options?.failWindowMs ?? arcadeFailWindowDefault(interactionModel),
    rewardFx: { ...arcadeRewardFxDefaults(interactionModel), ...(options?.rewardFx ?? {}) },
    transitionFx: { ...arcadeTransitionDefaults(interactionModel), ...(options?.transitionFx ?? {}) },
    correctMessage,
    retryMessage,
    presentation: options?.presentation,
  };
}

function createGamePayload(
  gameId: string,
  gameTitle: string,
  gameKind: string,
  introText: string,
  stages: GameStage[],
  options?: {
    theme?: GameThemeToken;
    layoutVariant?: GameLayoutVariant;
    ambientSet?: GameSoundSet;
    celebrationVariant?: GameActivityPayload["celebrationVariant"];
    assetName?: string;
    sceneAssetName?: string;
    summaryAssetName?: string;
    summary?: GameSummaryContent;
    maxRetriesPerStage?: number;
  }
): GameActivityPayload {
  const hasArcadeStages = stages.some((stage) =>
    ["lane_runner", "sort_rush", "route_race", "reaction_pick", "voice_burst"].includes(stage.kind)
  );
  const defaultAmbientSet = stages.reduce<GameSoundSet | undefined>((current, stage) => {
    if (current) {
      return current;
    }

    if ("soundSet" in stage && typeof stage.soundSet === "string") {
      return stage.soundSet;
    }

    return undefined;
  }, undefined);

  return {
    gameId,
    gameTitle,
    gameKind,
    theme: options?.theme ?? "teal",
    layoutVariant: options?.layoutVariant ?? "generic",
    ambientSet: options?.ambientSet ?? defaultAmbientSet ?? "neutral",
    celebrationVariant:
      options?.celebrationVariant ?? (hasArcadeStages ? "arcade_pulse" : "structured_glow"),
    assetRefs: {
      hero: gameAsset(options?.assetName ?? "name-tag-mixer"),
      scene: options?.sceneAssetName ? gameAsset(options.sceneAssetName) : undefined,
      summary: options?.summaryAssetName ? gameAsset(options.summaryAssetName) : undefined,
    },
    introText,
    stages,
    summary:
      options?.summary ??
      ({
        strength: `${gameTitle} kept the unit language active and ready for speaking.`,
        nextFocus: "Carry the same clear language into the speaking step.",
        bridgeToSpeaking: "Use the same language you just practiced in the conversation that opens next.",
      } satisfies GameSummaryContent),
    completionRule: {
      requiredStageCount: stages.length,
      maxRetriesPerStage: options?.maxRetriesPerStage ?? 1,
    },
  };
}

function createFallbackGame(
  raw: RawUnitBlueprint,
  level: CurriculumLevel,
  unitIndex: number
): GameActivityPayload {
  const tokens = collectGameCandidates(raw).slice(0, 4);
  const phraseOptions = tokens.slice(0, 3).map((token, index) =>
    choiceOption(`${stageId(level, unitIndex, `fallback-choice-${index + 1}`)}`, token)
  );
  const orderedIdeas = [
    choiceOption(`${stageId(level, unitIndex, "sequence-1")}`, raw.keyVocabulary[0] ?? "start"),
    choiceOption(`${stageId(level, unitIndex, "sequence-2")}`, raw.keyVocabulary[1] ?? "build"),
    choiceOption(`${stageId(level, unitIndex, "sequence-3")}`, raw.keyVocabulary[2] ?? "finish"),
  ];
  const targetPhrase =
    AUTHORED_SPEAKING_MISSIONS[raw.slug]?.targetPhrases[0] ??
    raw.keyVocabulary[0] ??
    raw.canDoStatement;

  return createGamePayload(
    `${level}-${unitIndex}-game`,
    "Unit Game",
    "unit_challenge",
    `Play a quick unit challenge before you use this language in speaking.`,
    [
      makeChoiceStage(
        stageId(level, unitIndex, "choice"),
        "Best fit",
        `Which phrase best matches the main idea of ${raw.title}?`,
        [
          choiceOption("correct", targetPhrase),
          ...(phraseOptions.length > 0
            ? phraseOptions
            : [
                choiceOption("alt-1", raw.keyVocabulary[1] ?? "detail"),
                choiceOption("alt-2", raw.keyVocabulary[2] ?? "example"),
              ]),
        ],
        "correct",
        `Good. That phrase matches the unit goal.`,
        `Choose the phrase that fits the unit task more directly.`,
      ),
      makeSequenceStage(
        stageId(level, unitIndex, "sequence"),
        "Build the flow",
        `Put the ideas in a clear order before speaking.`,
        orderedIdeas,
        orderedIdeas.map((item) => item.id),
        `Good. The order keeps the unit task easy to follow.`,
        `Try a clearer order from first idea to last detail.`,
      ),
      makeVoicePromptStage(
        stageId(level, unitIndex, "voice"),
        "Say the key phrase",
        `Say the phrase you are most likely to use in the speaking step.`,
        targetPhrase,
        `Say "${targetPhrase}" clearly so it feels natural in the conversation.`,
        [
          choiceOption("correct", targetPhrase),
          choiceOption("alt-1", raw.keyVocabulary[1] ?? "Try again"),
          choiceOption("alt-2", raw.keyVocabulary[2] ?? "One more detail"),
        ],
        "correct",
        `Good. You are ready to carry that phrase into speaking.`,
        `Stay closer to the target phrase and keep it simple.`,
      ),
    ]
  );
}

function createStageOneGame(
  level: CurriculumLevel,
  unitIndex: number,
  slug: string
): GameActivityPayload | null {
  switch (slug) {
    case "introductions-and-personal-information":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Name Tag Mixer",
        "name_tag_mixer",
        "Sprint through a school hallway, collect the clean intro pieces, and burst out one confident first-meeting line.",
        [
          makeLaneRunnerStage(
            stageId(level, unitIndex, "runner"),
            "Hallway dash",
            "Cross the hallway, collect the greeting, name, country, and question-back pieces, and skip the extra-detail decoys.",
            [
              { id: "lane-1", label: "Front doors" },
              { id: "lane-2", label: "Locker glow" },
              { id: "lane-3", label: "Poster wall" },
              { id: "lane-4", label: "Window side" },
            ],
            [
              { id: "token-hi", label: "Hi", lane: 3, column: 1, role: "target" },
              { id: "token-ana", label: "I'm Ana.", lane: 2, column: 2, role: "target" },
              { id: "token-brazil", label: "I'm from Brazil.", lane: 1, column: 3, role: "target" },
              { id: "token-question", label: "What about you?", lane: 0, column: 4, role: "target" },
              { id: "token-age", label: "I'm sixteen.", lane: 1, column: 1, role: "hazard" },
              { id: "token-weekend", label: "I'm on the robotics team.", lane: 2, column: 4, role: "hazard" },
            ],
            ["token-hi", "token-ana", "token-brazil", "token-question"],
            "Good. You crossed cleanly and picked up the full intro line in order.",
            "Run it again and collect the intro pieces in the order a real first meeting needs.",
            {
              timerMs: 24000,
              soundSet: "hallway",
              theme: "ocean",
              scoreRules: { correct: 120, miss: 40, streakBonus: 18, clearBonus: 150 },
              spriteRefs: {
                board: spriteAsset("name-tag-hallway-board"),
                player: spriteAsset("name-tag-player"),
                target: spriteAsset("name-tag-target"),
                hazard: spriteAsset("name-tag-hazard"),
                neutral: spriteAsset("name-tag-neutral"),
              },
              presentation: gamePresentation("arcade_lane_runner", {
                boardTitle: "Hallway run",
                helperLabel: "Intro rail",
                helperText: "Build the intro rail in order as you cross the hallway. Skip details that come too early.",
                resolvedTitle: "Intro rail locked",
                resolvedNote: "You built a first-meeting opener in the order a real introduction needs.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "reply-rush"),
            "Reply rush",
            "Clear the best first-meeting question before the hallway clock runs out.",
            [
              {
                id: "round-1",
                prompt: "A new classmate says: Hi, I'm Ana.",
                dialoguePrompt: "Pick the simple question that naturally comes next.",
                correctOptionId: "from",
                options: [
                  choiceOption("from", "Where are you from?", "Best first follow-up after only the name."),
                  choiceOption(
                    "class",
                    "What class are you in?",
                    "Possible at school, but it skips past the simplest personal follow-up.",
                    true
                  ),
                  choiceOption(
                    "city",
                    "How old are you?",
                    "Too personal for the first question in a new exchange."
                  ),
                ],
              },
              {
                id: "round-2",
                prompt: "You say: Hi, I'm Leo. I'm from Mexico.",
                correctOptionId: "question-back",
                options: [
                  choiceOption("question-back", "What about you?", "Short, natural, and easy to answer."),
                  choiceOption(
                    "stay",
                    "And you?",
                    "Close, but a little thinner than the strongest question-back.",
                    true
                  ),
                  choiceOption(
                    "meet",
                    "What is your phone number?",
                    "Too personal for the first exchange, even if the tone sounds friendly."
                  ),
                ],
              },
            ],
            "Good. Your reply choices kept the first meeting sounding natural.",
            "Clear the quickest, most natural replies instead of jumping too far ahead.",
            {
              timerMs: 18000,
              soundSet: "hallway",
              theme: "ocean",
              interactionModel: "target_tag",
              spriteRefs: {
                board: spriteAsset("name-tag-chat-board"),
                target: spriteAsset("name-tag-target"),
                hazard: spriteAsset("name-tag-hazard"),
                neutral: spriteAsset("name-tag-neutral"),
              },
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "First-meeting reactions",
                helperLabel: "Keep it moving",
                helperText: "Choose the reply that keeps the exchange light and easy for the other person to answer.",
                callToAction: "Lock reply",
                resolvedTitle: "Reply line ready",
                resolvedNote: "You kept the exchange open without making it too personal too fast.",
              }),
            }
          ),
          makeVoiceBurstStage(
            stageId(level, unitIndex, "voice-burst"),
            "Intro burst",
            "Say one short first-meeting line with your name, country, and one question back.",
            "Hi, I'm Ana from Brazil. What about you?",
            "Keep the line short, bright, and easy for the other person to answer.",
            [
              choiceOption("good", "Hi, I'm Ana from Brazil. What about you?"),
              choiceOption("alt-1", "Hi, I'm Ana. I'm from Brazil."),
              choiceOption("alt-2", "Hello, I'm Ana from Brazil."),
            ],
            "good",
            "Good. That burst line sounds ready for the speaking conversation.",
            "Keep the name, country, and question back together in one short burst.",
            {
              timerMs: 18000,
              soundSet: "neutral",
              theme: "ocean",
              requiredPhrases: ["from", "what about you"],
              spriteRefs: {
                board: spriteAsset("name-tag-chat-board"),
                target: spriteAsset("name-tag-target"),
              },
              acceptedResponses: [
                "Hi, I'm Ana from Brazil. What about you?",
                "Hello, I'm Ana from Brazil. What about you?",
                "Hi, my name is Ana. I'm from Brazil. What about you?",
              ],
              presentation: gamePresentation("voice_focus", {
                boardTitle: "Voice burst",
                helperText: "Say it once or use the quick backup. This is the same line you want ready for speaking.",
                resolvedTitle: "Voice burst cleared",
                resolvedNote: "You kept the intro short enough to sound like a real first meeting, not a speech.",
              }),
            }
          ),
        ],
        {
          theme: "ocean",
          layoutVariant: "arcade_lane_runner",
          assetName: "name-tag-mixer",
          summary: {
            strength: "You built a fast, clean first-meeting intro and kept the replies natural instead of random.",
            nextFocus: "Keep your opener short enough that the other person can answer easily.",
            bridgeToSpeaking: "Open the speaking mission with the same short intro burst and let the other person in quickly.",
          },
          maxRetriesPerStage: 2,
        }
      );
    case "family-friends-and-classroom-language":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Borrow and Describe",
        "borrow_and_describe",
        "Sort people and classroom language quickly so your description and request feel ready in the same scene.",
        [
          makeSortRushStage(
            stageId(level, unitIndex, "people-sort"),
            "People sort",
            "Drop each person card into the lane that fits the best simple description.",
            [
              { id: "family", label: "Family detail" },
              { id: "friend", label: "Friend detail" },
              { id: "teacher", label: "Teacher detail" },
            ],
            [
              { id: "brother", label: "My brother likes soccer after school." },
              { id: "friend-card", label: "My friend is funny and easy to talk to." },
              { id: "teacher-card", label: "My teacher is kind and helpful in class." },
            ],
            [
              { cardId: "brother", laneId: "family" },
              { cardId: "friend-card", laneId: "friend" },
              { cardId: "teacher-card", laneId: "teacher" },
            ],
            "Good. The people details are sorted cleanly.",
            "Sort each person detail into the strongest lane so the scene stays easy to follow.",
            {
              timerMs: 21000,
              soundSet: "classroom",
              theme: "mint",
              presentation: gamePresentation("arcade_sort_rush", {
                boardTitle: "People trays",
                helperText: "Sort the people details fast so the family, friend, and teacher cards stop colliding.",
                resolvedTitle: "People scene sorted",
                resolvedNote: "You separated the people details clearly enough to use them in a real conversation.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "request-pick"),
            "Request pick",
            "Clear the polite classroom request before the queue backs up.",
            [
              {
                id: "round-1",
                prompt: "You need a pencil in class.",
                dialoguePrompt: "Choose the line that sounds polite and specific, not demanding.",
                correctOptionId: "borrow",
                options: [
                  choiceOption("borrow", "Excuse me, can I borrow your pencil for a minute?", "Polite and specific"),
                  choiceOption(
                    "demand",
                    "Can I use your pencil after class?",
                    "Polite, but it misses the right class-time moment",
                    true
                  ),
                  choiceOption("vague", "Do you have an extra pencil today?", "Possible, but less clear about borrowing"),
                ],
              },
              {
                id: "round-2",
                prompt: "Now make the request sound short enough for class.",
                correctOptionId: "minute",
                options: [
                  choiceOption("minute", "for a minute?", "Keeps it short"),
                  choiceOption(
                    "forever",
                    "for this class?",
                    "Possible, but longer than the clean short borrow request",
                    true
                  ),
                  choiceOption("after-school", "until the end of class?", "Related, but less light than the quickest classroom ask"),
                ],
              },
            ],
            "Good. The classroom request now sounds polite and usable.",
            "Pick the request pieces that sound like real classroom English, not direct or vague language.",
            {
              timerMs: 18000,
              soundSet: "classroom",
              theme: "mint",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Classroom queue",
                helperText: "Clear the request choices that sound polite enough to use with a classmate or teacher.",
                resolvedTitle: "Request line ready",
                resolvedNote: "You kept the request polite, short, and realistic for class.",
              }),
            }
          ),
          makeSortRushStage(
            stageId(level, unitIndex, "scene-sort"),
            "Scene split",
            "Sort the final cards into Describe or Ask so the mini-scene feels complete.",
            [
              { id: "describe", label: "Describe" },
              { id: "ask", label: "Ask in class" },
            ],
            [
              { id: "kind-detail", label: "My teacher is kind and helpful." },
              { id: "music-detail", label: "My friend likes music after class." },
              { id: "borrow-line", label: "Can I borrow your notebook for a minute?" },
              { id: "repeat-line", label: "Could you repeat that, please?" },
            ],
            [
              { cardId: "kind-detail", laneId: "describe" },
              { cardId: "music-detail", laneId: "describe" },
              { cardId: "borrow-line", laneId: "ask" },
              { cardId: "repeat-line", laneId: "ask" },
            ],
            "Good. You can now separate people details from classroom language without mixing the two.",
            "Sort the final scene so descriptions stay separate from classroom requests.",
            {
              timerMs: 20000,
              soundSet: "classroom",
              theme: "mint",
              presentation: gamePresentation("arcade_sort_rush", {
                boardTitle: "Describe or ask",
                helperText: "Finish the mini-scene by sorting description language away from classroom request language.",
                resolvedTitle: "Scene split locked",
                resolvedNote: "You kept the people descriptions and classroom requests from blending together awkwardly.",
              }),
            }
          ),
        ],
        {
          theme: "mint",
          layoutVariant: "arcade_sort_rush",
          assetName: "borrow-and-describe",
          summary: {
            strength: "You sorted the people details and classroom requests into a scene that sounds real instead of mixed together.",
            nextFocus: "Keep the request polite and short so it lands quickly in speaking.",
            bridgeToSpeaking: "Carry the same polite request and simple people details into the class conversation next.",
          },
          maxRetriesPerStage: 2,
        }
      );
    case "daily-routines-time-and-schedules":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Day Path",
        "day_path",
        "Race through the day, hit the right time gates, and keep the schedule from breaking into random details.",
        [
          makeRouteRaceStage(
            stageId(level, unitIndex, "route-1"),
            "Morning to evening",
            "Run the clean route from wake-up to after-school work without taking the wrong branch.",
            [
              { id: "wake", label: "Wake up", detail: "Morning", x: 10, y: 70 },
              { id: "bus", label: "Bus stop", detail: "Morning", x: 28, y: 52 },
              { id: "class", label: "Class", detail: "School day", x: 48, y: 35 },
              { id: "lunch", label: "Lunch", detail: "Midday", x: 66, y: 45 },
              { id: "homework", label: "Homework", detail: "Evening", x: 84, y: 68 },
            ],
            ["wake", "bus", "class", "lunch", "homework"],
            "Good. The timeline route now sounds like one real day.",
            "Race the routine in order from morning to after-school time instead of skipping around.",
            {
              timerMs: 23000,
              soundSet: "route",
              theme: "sunset",
              pathRules: {
                startNodeId: "wake",
                finishNodeId: "homework",
                branchPenalty: 1,
              },
              presentation: gamePresentation("arcade_route_race", {
                boardTitle: "Day track",
                helperText: "Hit the time gates in order so the schedule feels smooth from morning to evening.",
                resolvedTitle: "Day route clear",
                resolvedNote: "You kept the schedule chronological instead of turning it into a random list.",
                connections: [
                  { fromId: "wake", toId: "bus" },
                  { fromId: "bus", toId: "class" },
                  { fromId: "class", toId: "lunch" },
                  { fromId: "lunch", toId: "homework" },
                ],
              }),
            }
          ),
          makeRouteRaceStage(
            stageId(level, unitIndex, "route-2"),
            "After-school branch",
            "Take the clean after-school branch and avoid the detour that breaks the routine.",
            [
              { id: "class-end", label: "Class ends", x: 12, y: 42 },
              { id: "homework-stop", label: "Homework", x: 40, y: 55 },
              { id: "practice-stop", label: "Practice", x: 65, y: 35 },
              { id: "home", label: "Home", x: 86, y: 62 },
              { id: "mall", label: "Mall", x: 54, y: 78 },
            ],
            ["class-end", "homework-stop", "home"],
            "Good. You chose the branch that sounds like a believable weekday.",
            "Take the branch that keeps the after-school routine clear and believable.",
            {
              timerMs: 18000,
              soundSet: "route",
              theme: "sunset",
              pathRules: {
                startNodeId: "class-end",
                finishNodeId: "home",
              },
              presentation: gamePresentation("arcade_route_race", {
                boardTitle: "After-school branch",
                helperText: "Pick the route that still sounds like a normal school day, not a random detour.",
                resolvedTitle: "After-school route set",
                resolvedNote: "You kept the routine believable by choosing the branch that supports the day.",
                connections: [
                  { fromId: "class-end", toId: "homework-stop" },
                  { fromId: "homework-stop", toId: "home" },
                  { fromId: "class-end", toId: "practice-stop" },
                  { fromId: "practice-stop", toId: "mall" },
                ],
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "reaction"),
            "Best day line",
            "Clear the strongest routine line before the timer empties.",
            [
              {
                id: "round-1",
                prompt: "Which summary sounds easiest to say in one smooth line?",
                correctOptionId: "good",
                options: [
                  choiceOption("good", "After school I do homework, then I relax at home.", "Clear and connected"),
                  choiceOption(
                    "flat",
                    "After school I do homework, and then I go to practice before I get home.",
                    "Possible, but it changes the route you just built",
                    true
                  ),
                  choiceOption("off", "After school I usually go to the mall for a while.", "Related, but it breaks the weekday routine path"),
                ],
              },
            ],
            "Good. That final line sounds ready for speaking.",
            "Pick the routine line that sounds natural from start to finish, not like disconnected words.",
            {
              timerMs: 12000,
              soundSet: "planner",
              theme: "sunset",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Routine finish",
                helperText: "Clear the line that sounds like something a learner could really say out loud.",
                resolvedTitle: "Routine line locked",
                resolvedNote: "You finished with one connected line instead of a list of separate pieces.",
              }),
            }
          ),
        ],
        {
          theme: "sunset",
          layoutVariant: "arcade_route_race",
          assetName: "day-path",
          summary: {
            strength: "You raced the day in order and kept the schedule believable instead of scattered.",
            nextFocus: "Lead with the time gate first so the listener can follow your day easily.",
            bridgeToSpeaking: "Use the same morning-to-evening flow when you describe your routine in speaking.",
          },
          maxRetriesPerStage: 2,
        }
      );
    case "food-shopping-and-likes-dislikes":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Snack Counter",
        "snack_counter",
        "Work a moving snack counter fast, lock the clean order, then burst out the final line once.",
        [
          makeSortRushStage(
            stageId(level, unitIndex, "order-rush"),
            "Order rush",
            "Sort the moving order cards into the receipt lanes before the counter gets crowded.",
            [
              { id: "starter", label: "Starter" },
              { id: "food", label: "Food" },
              { id: "drink", label: "Drink" },
              { id: "finish", label: "Finish" },
            ],
            [
              { id: "id-like", label: "I'd like", detail: "Polite order start" },
              { id: "sandwich", label: "a sandwich", detail: "Main item" },
              { id: "water", label: "and water", detail: "Drink choice" },
              { id: "please", label: "please.", detail: "Polite finish" },
            ],
            [
              { cardId: "id-like", laneId: "starter" },
              { cardId: "sandwich", laneId: "food" },
              { cardId: "water", laneId: "drink" },
              { cardId: "please", laneId: "finish" },
            ],
            "Good. The counter receipt is complete and ready to say.",
            "Sort the receipt in order so the counter line sounds complete and polite.",
            {
              timerMs: 22000,
              soundSet: "counter",
              theme: "gold",
              presentation: gamePresentation("arcade_sort_rush", {
                boardTitle: "Receipt lanes",
                helperText: "Sort the moving counter pieces into one clean order receipt.",
                resolvedTitle: "Receipt built",
                resolvedNote: "You kept the order in the sequence a real customer would use at the counter.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "counter-pick"),
            "Counter follow-up",
            "Clear the follow-up lines that keep the order moving.",
            [
              {
                id: "round-1",
                prompt: "You already said: I'd like a sandwich and water, please.",
                dialoguePrompt: "Which line is the strongest next move right after the order?",
                correctOptionId: "price",
                options: [
                  choiceOption("price", "How much is it?", "Best next question"),
                  choiceOption("card", "Can I pay by card?", "Useful later"),
                  choiceOption(
                    "cheese",
                    "Can I get it without cheese?",
                    "Possible, but it changes the order instead of moving it forward",
                    true
                  ),
                ],
              },
              {
                id: "round-2",
                prompt: "Now keep the exchange quick and polite.",
                correctOptionId: "thanks",
                options: [
                  choiceOption("thanks", "Thanks.", "Simple close"),
                  choiceOption("homework", "That's everything, thanks.", "Close, but a little longer than the cleanest finish", true),
                  choiceOption("favorite", "Can I also get a fork?", "Possible, but it adds a new request instead of closing the exchange"),
                ],
              },
            ],
            "Good. Those follow-ups fit a real snack exchange.",
            "Clear the lines that keep the counter moving instead of changing the scene.",
            {
              timerMs: 18000,
              soundSet: "counter",
              theme: "gold",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Counter reactions",
                helperText: "Pick the next lines a customer would really use right after ordering.",
                resolvedTitle: "Counter flow ready",
                resolvedNote: "You kept the exchange moving instead of piling on extra changes and side details.",
              }),
            }
          ),
          makeVoiceBurstStage(
            stageId(level, unitIndex, "voice-burst"),
            "Order burst",
            "Say the final order once, clearly and politely.",
            "I'd like a sandwich and water, please.",
            "Keep the food, drink, and polite finish in one short burst.",
            [
              choiceOption("good", "I'd like a sandwich and water, please."),
              choiceOption("alt-1", "Can I get a sandwich and water, please?"),
              choiceOption("alt-2", "I'd like a sandwich and a water, please."),
            ],
            "good",
            "Good. That order line is ready for the snack conversation.",
            "Keep the order short and steady so the cashier can answer quickly.",
            {
              timerMs: 17000,
              soundSet: "neutral",
              theme: "gold",
              requiredPhrases: ["sandwich", "water"],
              acceptedResponses: [
                "I'd like a sandwich and water, please.",
                "Can I get a sandwich and water, please?",
              ],
              presentation: gamePresentation("voice_focus", {
                boardTitle: "Voice burst",
                helperText: "Say it once or use the quick backup. Keep the food, drink, and polite ending together.",
                resolvedTitle: "Order burst cleared",
                resolvedNote: "You kept the order smooth enough to sound like a real counter exchange.",
              }),
            }
          ),
        ],
        {
          theme: "gold",
          layoutVariant: "arcade_sort_rush",
          assetName: "snack-counter",
          summary: {
            strength: "You built a full snack order, kept the counter moving, and finished with one clean order burst.",
            nextFocus: "Keep your follow-up question short so the cashier can answer right away.",
            bridgeToSpeaking: "Carry the same order burst and price question straight into the snack-counter conversation next.",
          },
          maxRetriesPerStage: 2,
        }
      );
    case "home-school-and-neighborhood":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Map Route",
        "map_route",
        "Race across the neighborhood grid, stay on the clean route, and lock the strongest landmark line.",
        [
          makeRouteRaceStage(
            stageId(level, unitIndex, "route-main"),
            "Street race",
            "Trace the clean walk from the school gate to the library before the timer drains.",
            [
              { id: "gate", label: "Front gate", x: 12, y: 78 },
              { id: "office", label: "School office", detail: "Turn here first", x: 30, y: 60 },
              { id: "crosswalk", label: "Crosswalk", detail: "Fastest crossing", x: 54, y: 46 },
              { id: "garden", label: "Garden path", detail: "Longer branch", x: 56, y: 80 },
              { id: "parking", label: "Parking lot", detail: "Dead-end detour", x: 76, y: 84 },
              { id: "library", label: "Library", detail: "Finish", x: 84, y: 42 },
            ],
            ["gate", "office", "crosswalk", "library"],
            "Good. That route is short, direct, and easy to explain.",
            "Race the path that gets to the library cleanly instead of drifting into the longer street detours.",
            {
              timerMs: 23000,
              soundSet: "route",
              theme: "sky",
              pathRules: {
                startNodeId: "gate",
                finishNodeId: "library",
              },
              spriteRefs: {
                board: spriteAsset("map-route-showcase-board"),
                player: spriteAsset("map-route-player"),
                target: spriteAsset("map-route-target"),
                hazard: spriteAsset("map-route-hazard"),
                neutral: spriteAsset("map-route-player"),
              },
              presentation: gamePresentation("arcade_route_race", {
                boardTitle: "Neighborhood grid",
                helperText: "Trace the quickest walk first. Wrong turns should feel like real detours, not random moves.",
                resolvedTitle: "Main route clear",
                resolvedNote: "You stayed on the shortest, easiest route instead of wandering into side streets.",
                assetRef: gameAsset("map-route"),
                connections: [
                  { fromId: "gate", toId: "office" },
                  { fromId: "office", toId: "crosswalk" },
                  { fromId: "crosswalk", toId: "library" },
                  { fromId: "office", toId: "garden" },
                  { fromId: "garden", toId: "parking" },
                ],
              }),
            }
          ),
          makeRouteRaceStage(
            stageId(level, unitIndex, "route-branch"),
            "Landmark branch",
            "Choose the landmark branch that keeps the directions easy after the gate.",
            [
              { id: "start", label: "Gate", x: 10, y: 62 },
              { id: "office-mark", label: "Office sign", detail: "Easy landmark", x: 34, y: 52 },
              { id: "garden-mark", label: "Garden gate", detail: "Long branch", x: 52, y: 78 },
              { id: "alley-mark", label: "Side alley", detail: "Messy detour", x: 70, y: 82 },
              { id: "finish", label: "Library", detail: "Finish", x: 88, y: 52 },
            ],
            ["start", "office-mark", "finish"],
            "Good. You picked the landmark branch that makes the route easy to explain.",
            "Take the branch with the strongest landmark instead of the longer, messier detour.",
            {
              timerMs: 18000,
              soundSet: "route",
              theme: "sky",
              pathRules: {
                startNodeId: "start",
                finishNodeId: "finish",
              },
              spriteRefs: {
                board: spriteAsset("map-route-showcase-board"),
                player: spriteAsset("map-route-player"),
                target: spriteAsset("map-route-target"),
                hazard: spriteAsset("map-route-hazard"),
                neutral: spriteAsset("map-route-player"),
              },
              presentation: gamePresentation("arcade_route_race", {
                boardTitle: "Landmark split",
                helperText: "Pick the branch with the landmark you would actually say out loud in simple directions.",
                resolvedTitle: "Landmark route set",
                resolvedNote: "You chose the landmark that helps the listener orient quickly instead of memorizing too much.",
                connections: [
                  { fromId: "start", toId: "office-mark" },
                  { fromId: "office-mark", toId: "finish" },
                  { fromId: "start", toId: "garden-mark" },
                  { fromId: "garden-mark", toId: "alley-mark" },
                ],
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "direction-pick"),
            "Direction finish",
            "Clear the direction line that sounds easiest to follow.",
            [
              {
                id: "round-1",
                prompt: "A classmate asks: Can you help me find the library?",
                correctOptionId: "good",
                options: [
                  choiceOption("good", "Go through the gate, then walk past the office to the crosswalk.", "Clear first direction plus landmark."),
                  choiceOption("garden", "Walk past the garden and then head toward the library.", "Possible, but it sends the listener onto the longer branch.", true),
                  choiceOption("cafeteria", "Go by the parking lot and cut across later.", "Too vague, and it points to the dead-end side instead of the clean route."),
                ],
              },
            ],
            "Good. That direction line sounds clean and usable.",
            "Pick the line that moves the listener one step at a time instead of overloading them.",
            {
              timerMs: 12000,
              soundSet: "route",
              theme: "sky",
              interactionModel: "split_decision",
              spriteRefs: {
                board: spriteAsset("map-route-showcase-board"),
                target: spriteAsset("map-route-target"),
                hazard: spriteAsset("map-route-hazard"),
                neutral: spriteAsset("map-route-player"),
              },
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Direction finish",
                helperText: "Hit the line that sounds like real simple directions, not a long confusing explanation.",
                resolvedTitle: "Direction line ready",
                resolvedNote: "You finished with a line that a classmate could actually follow while walking.",
              }),
            }
          ),
        ],
        {
          theme: "sky",
          layoutVariant: "arcade_route_race",
          assetName: "map-route",
          summary: {
            strength: "You raced the clean route, picked the strongest landmark, and finished with a direction line someone could actually follow.",
            nextFocus: "Keep each direction to one move at a time so the listener can walk with you.",
            bridgeToSpeaking: "Use the same route, landmark, and short direction line when you guide someone in speaking.",
          },
          maxRetriesPerStage: 2,
        }
      );
    case "simple-plans-weather-and-practical-review":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Weather Switch",
        "weather_switch",
        "React fast as the weather flips and keep the weekend plan realistic under pressure.",
        [
          makeReactionPickStage(
            stageId(level, unitIndex, "plan-pick"),
            "Weekend plan pick",
            "Lock the clear weekend plan before the forecast starts shifting.",
            [
              {
                id: "round-1",
                prompt: "Your friend asks: What are you going to do this weekend?",
                correctOptionId: "good",
                options: [
                  choiceOption("good", "I'm going to visit my friend on Saturday.", "Clear plan plus time"),
                  choiceOption("weather", "I want good weather for the park this weekend.", "Preference, but not the actual plan"),
                  choiceOption("station", "My friend is free on Saturday afternoon.", "Useful detail, but still not the plan itself"),
                ],
              },
            ],
            "Good. The plan is clear before the weather changes.",
            "Choose the line that actually states the plan before you try to adapt it.",
            {
              timerMs: 12000,
              soundSet: "weather",
              theme: "rose",
              interactionModel: "target_tag",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Weekend lock-in",
                helperText: "Start with one real plan first. The weather shift only works if the plan is clear.",
                resolvedTitle: "Plan locked",
                resolvedNote: "You started with a real plan instead of a preference or side detail.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "weather-flip"),
            "Forecast flip",
            "React to each weather change before the timer drops and the plan stops making sense.",
            [
              {
                id: "sunny",
                prompt: "Sunny afternoon",
                correctOptionId: "park",
                options: [
                  choiceOption("park", "Go to the park", "Best in good weather"),
                  choiceOption("movie", "Stay home and watch a movie", "Possible, but stronger as a rainy backup"),
                  choiceOption("cafe", "Meet at a cafe for a while", "Works, but less natural than using the good weather"),
                ],
              },
              {
                id: "rainy",
                prompt: "Now it starts raining.",
                correctOptionId: "movie",
                options: [
                  choiceOption("movie", "Stay home and watch a movie", "Best rainy backup"),
                  choiceOption("cafe", "Meet at a cafe instead", "Possible backup, but weaker for the original plan"),
                  choiceOption("park", "Still go to the park", "Weak backup"),
                ],
              },
              {
                id: "cool",
                prompt: "The rain stops, but the evening turns cool.",
                correctOptionId: "cafe",
                options: [
                  choiceOption("cafe", "Meet at a cafe", "Good cooler-weather switch"),
                  choiceOption("park", "Go back to the park", "Possible, but less smooth after the forecast change"),
                  choiceOption("movie", "Stay home and watch a movie", "Works, but gives up too much after the rain stops"),
                ],
              },
            ],
            "Good. You adapted the plan fast enough to keep the weekend realistic.",
            "React to the forecast change with the strongest backup instead of vague or weak switches.",
            {
              timerMs: 20000,
              soundSet: "weather",
              theme: "rose",
              interactionModel: "target_tag",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Forecast switch",
                helperText: "The forecast changes live. Hit the backup that keeps the weekend plan believable.",
                resolvedTitle: "Forecast handled",
                resolvedNote: "You changed the plan when the weather actually demanded it instead of pretending nothing changed.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "backup-line"),
            "Backup line",
            "Finish with the one backup sentence that sounds ready to say aloud.",
            [
              {
                id: "round-1",
                prompt: "If it rains, what should you say next?",
                correctOptionId: "good",
                options: [
                  choiceOption("good", "If it rains, we can stay home and watch a movie instead.", "Clear switch plus backup"),
                  choiceOption("cafe", "If it rains, we can meet at a cafe instead.", "Possible, but less direct than the strongest backup"),
                  choiceOption("later", "If it rains, we can decide later.", "Too open to feel like a real backup"),
                ],
              },
            ],
            "Good. That backup line sounds practical and ready to use.",
            "Choose the backup line that actually solves the weather problem.",
            {
              timerMs: 12000,
              soundSet: "weather",
              theme: "rose",
              interactionModel: "target_tag",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Backup finish",
                helperText: "Clear the sentence that sounds like a real plan change, not an unfinished idea.",
                resolvedTitle: "Backup line ready",
                resolvedNote: "You finished with one usable backup sentence instead of leaving the plan open.",
              }),
            }
          ),
        ],
        {
          theme: "rose",
          layoutVariant: "arcade_reaction_pick",
          assetName: "weather-switch",
          summary: {
            strength: "You locked the plan fast and changed it quickly when the forecast forced a new move.",
            nextFocus: "Use one simple backup sentence instead of talking around the weather problem.",
            bridgeToSpeaking: "Carry the same plan-and-backup language into the weekend conversation next.",
          },
          maxRetriesPerStage: 2,
        }
      );
    case "habits-and-routines-in-more-detail":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Routine Builder",
        "routine_builder",
        "Sort a fuller weekday under pressure so your routine answer sounds planned instead of list-like.",
        [
          makeSortRushStage(
            stageId(level, unitIndex, "planner-rush"),
            "Planner rush",
            "Drop each routine block into the right lane before the planner closes.",
            [
              { id: "morning", label: "Morning block" },
              { id: "school", label: "School day" },
              { id: "after", label: "After-school plan" },
            ],
            [
              { id: "wake", label: "6:30 - I usually wake up and stretch." },
              { id: "class", label: "8:30 - Before class I review my notes." },
              { id: "practice", label: "4:30 - After school I often go to practice." },
            ],
            [
              { cardId: "wake", laneId: "morning" },
              { cardId: "class", laneId: "school" },
              { cardId: "practice", laneId: "after" },
            ],
            "Good. The planner now moves through the day clearly.",
            "Sort the routine blocks by part of the day instead of stacking them in random order.",
            {
              timerMs: 22000,
              soundSet: "planner",
              theme: "emerald",
              presentation: gamePresentation("arcade_sort_rush", {
                boardTitle: "Weekday planner",
                helperText: "Sort the routine blocks into the planner lanes before the schedule window closes.",
                resolvedTitle: "Planner clear",
                resolvedNote: "You built a routine the listener can picture instead of a loose list of habits.",
              }),
            }
          ),
          makeSortRushStage(
            stageId(level, unitIndex, "detail-rush"),
            "Detail rush",
            "Sort the frequency and detail chips into the right routine lanes.",
            [
              { id: "time", label: "Time phrase" },
              { id: "frequency", label: "Frequency" },
              { id: "task", label: "Task" },
            ],
            [
              { id: "after", label: "After school," },
              { id: "usually", label: "I usually" },
              { id: "homework", label: "finish homework before practice." },
            ],
            [
              { cardId: "after", laneId: "time" },
              { cardId: "usually", laneId: "frequency" },
              { cardId: "homework", laneId: "task" },
            ],
            "Good. The routine details are now lined up cleanly.",
            "Sort the chips into time, frequency, and task so the sentence lands clearly.",
            {
              timerMs: 18000,
              soundSet: "planner",
              theme: "emerald",
              presentation: gamePresentation("arcade_sort_rush", {
                boardTitle: "Detail lanes",
                helperText: "Move the routine chips into the lane that makes the sentence feel connected.",
                resolvedTitle: "Detail line set",
                resolvedNote: "You lined up the time, frequency, and task in a way that sounds natural aloud.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "summary-pick"),
            "Routine finish",
            "Clear the strongest final routine line before time runs out.",
            [
              {
                id: "round-1",
                prompt: "Which line sounds like a connected weekday routine?",
                correctOptionId: "good",
                options: [
                  choiceOption("good", "After school, I usually finish homework before practice.", "Connected and natural"),
                  choiceOption(
                    "flat",
                    "After school, I finish homework and sometimes I practice later.",
                    "Possible, but it sounds less steady than the strongest routine line",
                    true
                  ),
                  choiceOption("off", "On weekends, I usually go downtown with my cousin.", "Related, but it shifts away from the weekday routine"),
                ],
              },
            ],
            "Good. That final line sounds ready for the speaking mission.",
            "Pick the line that sounds like a real routine sentence, not a pile of disconnected pieces.",
            {
              timerMs: 12000,
              soundSet: "planner",
              theme: "emerald",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Routine finish",
                helperText: "Hit the final line that sounds easiest to say out loud in one smooth sentence.",
                resolvedTitle: "Routine finish locked",
                resolvedNote: "You finished with a sentence that sounds planned and connected, not list-like.",
              }),
            }
          ),
        ],
        {
          theme: "emerald",
          layoutVariant: "arcade_sort_rush",
          assetName: "routine-builder",
          summary: {
            strength: "You built a planner-style weekday and finished with one line that sounds connected instead of list-like.",
            nextFocus: "Keep the frequency phrase close to the activity so the sentence stays natural.",
            bridgeToSpeaking: "Use the same routine line when you describe your weekday in speaking.",
          },
          maxRetriesPerStage: 2,
        }
      );
    case "past-events-and-weekend-stories":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Story Chain",
        "story_chain",
        "Race through the weekend beats so the story sounds smooth when you tell it.",
        [
          makeRouteRaceStage(
            stageId(level, unitIndex, "route-race"),
            "Weekend run",
            "Trace the weekend panels in the order that keeps the story moving.",
            [
              { id: "start", label: "Saturday start", detail: "Panel 1", x: 14, y: 58 },
              { id: "visit", label: "Visit cousin", detail: "Panel 2", x: 32, y: 34 },
              { id: "dinner", label: "Cook dinner", detail: "Panel 3", x: 52, y: 58 },
              { id: "movie", label: "Movie night", detail: "Panel 4", x: 72, y: 34 },
              { id: "home", label: "Bus home", detail: "Final panel", x: 88, y: 58 },
            ],
            ["start", "visit", "dinner", "movie", "home"],
            "Good. The weekend run now lands in a clear story order.",
            "Stay on the route that moves from the first event to the final beat.",
            {
              timerMs: 24000,
              theme: "indigo",
              soundSet: "route",
              pathRules: {
                startNodeId: "start",
                finishNodeId: "home",
              },
              spriteRefs: {
                board: spriteAsset("story-comic-board"),
                player: spriteAsset("story-chain-neutral"),
                target: spriteAsset("story-chain-target"),
                hazard: spriteAsset("story-chain-hazard"),
                neutral: spriteAsset("story-chain-neutral"),
              },
              presentation: gamePresentation("arcade_route_race", {
                boardTitle: "Weekend comic",
                helperLabel: "Story route",
                helperText: "Trace the comic-strip order so the story sounds like one weekend, not scattered moments.",
                callToAction: "Lock route",
                resolvedTitle: "Route cleared",
                resolvedNote: "You kept the story moving instead of skipping beats.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "reaction-pick"),
            "Next beat rush",
            "Pick the strongest next story beat before the lane closes.",
            [
              {
                id: "round-dinner",
                prompt: "Panel 2 just ended. Which panel snaps in next and keeps the weekend moving?",
                options: [
                  choiceOption("good-dinner", "Later we cooked dinner together.", "Best next panel after the visit."),
                  choiceOption(
                    "near-talk",
                    "We talked there for a while.",
                    "Possible, but it is a softer side detail than the main next beat.",
                    true
                  ),
                  choiceOption("bad-home", "Finally I went home right away.", "It jumps to the ending and skips the middle panels."),
                ],
                correctOptionId: "good-dinner",
              },
              {
                id: "round-movie",
                prompt: "Dinner panel lands. Which evening panel keeps the story moving cleanly?",
                options: [
                  choiceOption("good-movie", "Then we watched a movie on the couch.", "Natural next panel after dinner."),
                  choiceOption(
                    "near-dessert",
                    "Then we made dessert in the kitchen.",
                    "Possible, but it is a weaker panel than the stronger evening beat.",
                    true
                  ),
                  choiceOption("bad-start", "First I visited my cousin downtown.", "It jumps back to the beginning of the story."),
                ],
                correctOptionId: "good-movie",
              },
            ],
            "Good. You picked the beats that make the middle feel smooth instead of jumpy.",
            "Choose the beat that keeps the story moving forward.",
            {
              timerMs: 17000,
              theme: "indigo",
              soundSet: "comparison",
              interactionModel: "split_decision",
              spriteRefs: {
                board: spriteAsset("story-comic-board"),
                target: spriteAsset("story-chain-target"),
                hazard: spriteAsset("story-chain-hazard"),
                neutral: spriteAsset("story-chain-neutral"),
              },
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Next beat rush",
                helperLabel: "Story beats",
                helperText: "Pick the next panel that keeps the weekend story moving forward, not sideways.",
                callToAction: "Use beat",
                resolvedTitle: "Beat locked",
                resolvedNote: "You kept the middle of the story clear and believable.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "ending-rush"),
            "Ending rush",
            "Grab the ending line that gives the story a real finish.",
            [
              {
                id: "round-ending",
                prompt: "Which ending panel gives the weekend story the cleanest final frame?",
                options: [
                  choiceOption("good-ending", "At the end of the night, I went home tired but happy.", "Final move plus feeling."),
                  choiceOption(
                    "near-ending",
                    "After that, I went home.",
                    "Complete, but flatter and less vivid.",
                    true
                  ),
                  choiceOption("bad-ending", "Finally we cooked dinner together.", "It repeats a middle panel instead of ending the story."),
                ],
                correctOptionId: "good-ending",
              },
            ],
            "Good. The ending now lands with a clear final reaction.",
            "Pick the ending that sounds complete instead of unfinished.",
            {
              timerMs: 12000,
              theme: "indigo",
              soundSet: "comparison",
              interactionModel: "split_decision",
              spriteRefs: {
                board: spriteAsset("story-comic-board"),
                target: spriteAsset("story-chain-target"),
                hazard: spriteAsset("story-chain-hazard"),
                neutral: spriteAsset("story-chain-neutral"),
              },
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Ending rush",
                helperLabel: "Ending card",
                helperText: "Finish with the line that sounds strongest out loud.",
                callToAction: "Finish story",
                resolvedTitle: "Ending cleared",
                resolvedNote: "You landed the story with a clean final beat and feeling.",
              }),
            }
          ),
          makeVoiceBurstStage(
            stageId(level, unitIndex, "story-burst"),
            "Story burst",
            "Say the weekend story in one short start-middle-end line.",
            "First I visited my cousin, then we cooked dinner, later we watched a movie, and finally I went home happy.",
            "Keep the sequence clear enough that the listener hears the full weekend story quickly.",
            [
              choiceOption(
                "good-story",
                "First I visited my cousin, then we cooked dinner, later we watched a movie, and finally I went home happy."
              ),
              choiceOption(
                "alt-story-1",
                "First I visited my cousin, then we watched a movie, and finally I went home."
              ),
              choiceOption(
                "alt-story-2",
                "I visited my cousin, cooked dinner, watched a movie, and went home happy."
              ),
            ],
            "good-story",
            "Good. That story burst sounds ready for the speaking mission.",
            "Keep the weekend beats in one smooth order so the listener can follow the story easily.",
            {
              timerMs: 17000,
              theme: "indigo",
              soundSet: "story",
              requiredPhrases: ["first", "then", "finally"],
              spriteRefs: {
                board: spriteAsset("story-comic-board"),
                target: spriteAsset("story-chain-target"),
                neutral: spriteAsset("story-chain-neutral"),
              },
              acceptedResponses: [
                "First I visited my cousin, then we cooked dinner, later we watched a movie, and finally I went home happy.",
                "First I visited my cousin, then we cooked dinner, then we watched a movie, and finally I went home happy.",
                "I visited my cousin, then we cooked dinner, watched a movie, and finally I went home happy.",
              ],
              presentation: gamePresentation("voice_focus", {
                boardTitle: "Story burst",
                helperText: "Say the weekend story once or use the quick backup. Keep the cousin, dinner, movie, and home beats in order.",
                resolvedTitle: "Story burst cleared",
                resolvedNote: "You turned the exact comic-strip sequence into one spoken story instead of a loose list of events.",
              }),
            }
          ),
        ],
        {
          theme: "indigo",
          layoutVariant: "arcade_route_race",
          assetName: "story-chain",
          summary: {
            strength: "You raced through the weekend story in a clean order and landed it with a real ending.",
            nextFocus: "Keep a time marker in each beat so the listener hears where the story is moving.",
            bridgeToSpeaking: "Use the same start-middle-end rhythm when you tell the weekend story in speaking.",
          },
          maxRetriesPerStage: 2,
        }
      );
    case "what-is-happening-now":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Scene Scan",
        "scene_scan",
        "Dash across the scene, tag the real action, and lock one strong present-time line.",
        [
          makeLaneRunnerStage(
            stageId(level, unitIndex, "lane-runner"),
            "Scene sprint",
            "Cross the classroom lanes, collect live-action tags, and dodge the time-frame traps.",
            [
              { id: "window", label: "Window row" },
              { id: "center", label: "Center desks" },
              { id: "board", label: "Board side" },
            ],
            [
              { id: "tok-reader", lane: 0, column: 1, label: "is reading now", detail: "Live action", role: "target" },
              { id: "tok-writer", lane: 1, column: 2, label: "is writing now", detail: "Live action", role: "target" },
              { id: "tok-speaking", lane: 2, column: 3, label: "is talking now", detail: "Live action", role: "target" },
              { id: "tok-yesterday", lane: 0, column: 4, label: "studied yesterday", detail: "Past, not now", role: "hazard" },
              { id: "tok-usually", lane: 1, column: 1, label: "usually studies", detail: "Habit, not now", role: "hazard" },
              { id: "tok-tomorrow", lane: 2, column: 4, label: "will present later", detail: "Future, not now", role: "hazard" },
            ],
            ["tok-reader", "tok-writer", "tok-speaking"],
            "Good. You tagged the live actions instead of the wrong time clues.",
            "Collect the actions happening right now and avoid the past, habit, and future traps.",
            {
              timerMs: 22000,
              theme: "violet",
              soundSet: "hallway",
              spriteRefs: {
                board: spriteAsset("scene-classroom-board"),
                player: spriteAsset("scene-scan-player"),
                target: spriteAsset("scene-scan-target"),
                hazard: spriteAsset("scene-scan-hazard"),
                neutral: spriteAsset("scene-scan-neutral"),
              },
              spawnRules: {
                spawnRateMs: 900,
                speed: 1.05,
                laneCount: 3,
              },
              presentation: gamePresentation("arcade_lane_runner", {
                boardTitle: "Scene sprint",
                helperLabel: "Live tags",
                helperText: "Grab the actions happening now. Skip past, habit, and future traps.",
                callToAction: "Clear scene",
                resolvedTitle: "Scene tagged",
                resolvedNote: "You stayed in the live scene instead of drifting into other time frames.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "scene-pick"),
            "Live line pick",
            "Choose the strongest live line from the scene details you just tagged.",
            [
              {
                id: "round-reader",
                prompt: "Which line best matches the reader you found near the window?",
                options: [
                  choiceOption("good-reader", "Near the window, one student is reading quietly right now.", "Best live line from the scene."),
                  choiceOption(
                    "near-reader",
                    "Near the window, one student reads there every morning.",
                    "Close, but it turns the live scene into a habit.",
                    true
                  ),
                  choiceOption("bad-reader", "Before class, one student read near the window.", "Wrong time frame for the live scene."),
                ],
                correctOptionId: "good-reader",
              },
              {
                id: "round-writer",
                prompt: "Which extra line keeps the classroom scene alive?",
                options: [
                  choiceOption("good-writer", "In the center, another student is writing notes now.", "Matches the live scene."),
                  choiceOption(
                    "near-writer",
                    "In the center, another student usually writes notes at this time.",
                    "Close, but it sounds like a routine instead of a live detail.",
                    true
                  ),
                  choiceOption("bad-writer", "In the center, another student wrote notes before lunch.", "Past instead of now."),
                ],
                correctOptionId: "good-writer",
              },
            ],
            "Good. You picked the lines that sound live instead of generic.",
            "Stay with the line that still sounds like it is happening now.",
            {
              timerMs: 16000,
              theme: "violet",
              soundSet: "comparison",
              interactionModel: "target_tag",
              spriteRefs: {
                board: spriteAsset("scene-classroom-board"),
                target: spriteAsset("scene-scan-target"),
                hazard: spriteAsset("scene-scan-hazard"),
                neutral: spriteAsset("scene-scan-neutral"),
              },
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Live line pick",
                helperLabel: "Present-time line",
                helperText: "Choose the line that still sounds alive inside the scene.",
                callToAction: "Use line",
                resolvedTitle: "Line locked",
                resolvedNote: "You kept the description anchored in what is happening right now.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "finish-line"),
            "Finish the scene",
            "Grab the final detail that makes the scene more vivid.",
            [
              {
                id: "round-finish",
                prompt: "Which final detail best strengthens the live classroom scene?",
                options: [
                  choiceOption("good-finish", "Near the board, one student is talking to the teacher right now.", "Strong final live detail."),
                  choiceOption(
                    "near-finish",
                    "Near the board, one student often talks to the teacher after class.",
                    "Close, but it slips into a habit instead of the live moment.",
                    true
                  ),
                  choiceOption("bad-finish", "Near the board, one student talked to the teacher yesterday.", "Past event instead of the live scene."),
                ],
                correctOptionId: "good-finish",
              },
            ],
            "Good. The scene now has one more live detail to carry into speaking.",
            "Pick the detail that still sounds present and specific.",
            {
              timerMs: 12000,
              theme: "violet",
              soundSet: "comparison",
              interactionModel: "target_tag",
              spriteRefs: {
                board: spriteAsset("scene-classroom-board"),
                target: spriteAsset("scene-scan-target"),
                hazard: spriteAsset("scene-scan-hazard"),
                neutral: spriteAsset("scene-scan-neutral"),
              },
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Finish the scene",
                helperLabel: "Last detail",
                helperText: "Finish with one more present-time detail that sounds easy to say aloud.",
                callToAction: "Finish scene",
                resolvedTitle: "Scene cleared",
                resolvedNote: "You built a scene that sounds specific, live, and ready to describe.",
              }),
            }
          ),
          makeVoiceBurstStage(
            stageId(level, unitIndex, "scene-burst"),
            "Scene burst",
            "Say one short live scene line with two actions happening now.",
            "Near the window, one student is reading, another is writing notes, and near the board a student is talking to the teacher right now.",
            "Keep the description in the present so the listener can picture the scene right now.",
            [
              choiceOption(
                "good-scene",
                "Near the window, one student is reading, another is writing notes, and near the board a student is talking to the teacher right now."
              ),
              choiceOption(
                "alt-scene-1",
                "One student is reading near the window, another is writing notes, and a student is talking to the teacher now."
              ),
              choiceOption(
                "alt-scene-2",
                "Near the window, one student is reading right now, and another student is writing notes."
              ),
            ],
            "good-scene",
            "Good. That scene burst sounds ready for the speaking task.",
            "Keep the actions in the present so the listener hears the scene as live, not finished.",
            {
              timerMs: 17000,
              theme: "violet",
              soundSet: "scene",
              requiredPhrases: ["is", "now"],
              spriteRefs: {
                board: spriteAsset("scene-classroom-board"),
                target: spriteAsset("scene-scan-target"),
                neutral: spriteAsset("scene-scan-neutral"),
              },
              acceptedResponses: [
                "Near the window, one student is reading, another is writing notes, and near the board a student is talking to the teacher right now.",
                "One student is reading near the window, another student is writing notes, and a student is talking to the teacher right now.",
                "Near the window, one student is reading right now, another student is writing notes, and a student is talking to the teacher.",
              ],
              presentation: gamePresentation("voice_focus", {
                boardTitle: "Scene burst",
                helperText: "Say the live scene once or use the quick backup. Reuse the actions you just tagged on the board.",
                resolvedTitle: "Scene burst cleared",
                resolvedNote: "You turned the tagged actions into one live scene description instead of drifting into habits or past events.",
              }),
            }
          ),
        ],
        {
          theme: "violet",
          layoutVariant: "arcade_lane_runner",
          assetName: "scene-scan",
          summary: {
            strength: "You tagged the live actions fast and built lines that sound present instead of generic.",
            nextFocus: "Keep every line in the now-time frame so the scene never slips into habits or past events.",
            bridgeToSpeaking: "Carry the same live action details into the present-continuous speaking benchmark.",
          },
          maxRetriesPerStage: 2,
        }
      );
    case "school-work-and-responsibilities":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Deadline Dash",
        "deadline_dash",
        "Sort the deadline pressure fast so the work plan sounds real when you explain it.",
        [
          makeSortRushStage(
            stageId(level, unitIndex, "sort-rush"),
            "Now / Next / Finish",
            "Triaging the board fast keeps the plan realistic.",
            [
              { id: "now", label: "Do now" },
              { id: "next", label: "Do next" },
              { id: "finish", label: "Finish later" },
            ],
            [
              { id: "outline", label: "Outline the main points", detail: "First real step" },
              { id: "sources", label: "Check two sources", detail: "Middle step" },
              { id: "slides", label: "Build the slides", detail: "Final prep" },
              { id: "colors", label: "Pick slide colors", detail: "Looks urgent, but can wait" },
            ],
            [
              { cardId: "outline", laneId: "now" },
              { cardId: "sources", laneId: "next" },
              { cardId: "slides", laneId: "finish" },
              { cardId: "colors", laneId: "finish" },
            ],
            "Good. You cleared the board in the order a real deadline plan needs.",
            "Sort the cards into the lane that makes the plan most believable.",
            {
              timerMs: 21000,
              theme: "coral",
              soundSet: "planner",
              presentation: gamePresentation("arcade_sort_rush", {
                boardTitle: "Now / Next / Finish",
                helperLabel: "Deadline board",
                helperText: "Sort fast. Keep urgent work out of the finish lane.",
                callToAction: "Lock board",
                resolvedTitle: "Board cleared",
                resolvedNote: "You sorted the deadline pressure into a plan that makes sense.",
              }),
            }
          ),
          makeSortRushStage(
            stageId(level, unitIndex, "tradeoff-rush"),
            "Tradeoff rush",
            "Keep the real work moving and push the cosmetic choices late.",
            [
              { id: "now", label: "Do now" },
              { id: "next", label: "Do next" },
              { id: "finish", label: "Finish later" },
            ],
            [
              { id: "draft", label: "Write the first draft", detail: "Urgent progress step" },
              { id: "edit", label: "Edit the rough paragraphs", detail: "Next after drafting" },
              { id: "colors", label: "Pick slide colors", detail: "Can wait" },
            ],
            [
              { cardId: "draft", laneId: "now" },
              { cardId: "edit", laneId: "next" },
              { cardId: "colors", laneId: "finish" },
            ],
            "Good. You protected the real work and pushed the cosmetic choice later.",
            "Prioritize the work that actually moves the deadline forward.",
            {
              timerMs: 18000,
              theme: "coral",
              soundSet: "planner",
              presentation: gamePresentation("arcade_sort_rush", {
                boardTitle: "Tradeoff rush",
                helperLabel: "Pressure lane",
                helperText: "When time is tight, push cosmetic work down the board.",
                callToAction: "Save plan",
                resolvedTitle: "Tradeoff cleared",
                resolvedNote: "You protected the important work instead of polishing too early.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "update-pick"),
            "Update pick",
            "Pick the strongest one-line update before the countdown ends.",
            [
              {
                id: "round-update",
                prompt: "What is the strongest update after you sort the task board?",
                options: [
                  choiceOption("good-update", "Tonight I'll finish the outline so I can research tomorrow.", "Specific next step"),
                  choiceOption(
                    "near-update",
                    "Tonight I'll work on it for a while and then see.",
                    "Possible, but too vague",
                    true
                  ),
                  choiceOption("bad-update", "Tomorrow I'll probably work on the slides for a bit.", "Too vague and it skips the first real step"),
                ],
                correctOptionId: "good-update",
              },
            ],
            "Good. The update sounds concrete instead of vague.",
            "Grab the update that tells the listener exactly what happens first.",
            {
              timerMs: 12000,
              theme: "coral",
              soundSet: "comparison",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Update pick",
                helperLabel: "Progress line",
                helperText: "Finish with the line that sounds like a real plan, not a vague promise.",
                callToAction: "Use update",
                resolvedTitle: "Update locked",
                resolvedNote: "You finished with a line that clearly signals the next move.",
              }),
            }
          ),
        ],
        {
          theme: "coral",
          layoutVariant: "arcade_sort_rush",
          assetName: "deadline-dash",
          summary: {
            strength: "You triaged the deadline pressure into a plan that sounds practical instead of wishful.",
            nextFocus: "Lead with the first concrete step so the listener hears how the plan actually starts.",
            bridgeToSpeaking: "Use the same now-next-finish language when you explain your plan in speaking.",
          },
          maxRetriesPerStage: 2,
        }
      );
    case "health-travel-and-everyday-services":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Station Help",
        "station_help",
        "Clear the fast station queue so the help exchange sounds smooth when you say it.",
        [
          makeReactionPickStage(
            stageId(level, unitIndex, "queue-pick"),
            "Queue rush",
            "Pick the fastest useful move for each station question.",
            [
              {
                id: "round-route",
                prompt: "You reach the counter. What should you ask first?",
                options: [
                  choiceOption("good-route", "Which bus goes downtown?", "Best first move"),
                  choiceOption(
                    "near-ticket",
                    "I need a one-way ticket to downtown.",
                    "Useful, but still early if you do not know the route",
                    true
                  ),
                  choiceOption("near-platform", "Which platform is the downtown bus on?", "Related, but easier after the route is clear"),
                ],
                correctOptionId: "good-route",
              },
              {
                id: "round-ticket",
                prompt: "The worker asks for the ticket type. What helps most now?",
                options: [
                  choiceOption("good-ticket", "I need a one-way ticket to downtown.", "Route plus ticket type"),
                  choiceOption("near-time", "What time does it leave?", "Useful, but still one step early", true),
                  choiceOption("near-return", "Do you have a return ticket too?", "Related, but not the ticket type the worker asked for"),
                ],
                correctOptionId: "good-ticket",
              },
            ],
            "Good. You cleared the first station moves in a natural order.",
            "Pick the move that helps the worker answer faster.",
            {
              timerMs: 17000,
              theme: "teal",
              soundSet: "comparison",
              interactionModel: "target_tag",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Queue rush",
                helperLabel: "Counter choices",
                helperText: "Clear the route question first, then the ticket detail.",
                callToAction: "Use move",
                resolvedTitle: "Queue cleared",
                resolvedNote: "You kept the station exchange fast and useful.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "desk-pick"),
            "Desk decision",
            "Pick the final follow-up that keeps the service exchange moving.",
            [
              {
                id: "round-time",
                prompt: "Once the route and ticket are clear, what should you ask next?",
                options: [
                  choiceOption("good-time", "What time does it leave?", "Best next service question"),
                  choiceOption("near-platform", "Which platform is it on?", "Possible, but usually after timing", true),
                  choiceOption("near-return", "Can I pay by card?", "Practical, but it does not move the trip details forward"),
                ],
                correctOptionId: "good-time",
              },
            ],
            "Good. You finished the desk exchange with the right practical question.",
            "Grab the detail that still helps the station worker solve your trip.",
            {
              timerMs: 12000,
              theme: "teal",
              soundSet: "comparison",
              interactionModel: "target_tag",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Desk decision",
                helperLabel: "Last question",
                helperText: "Finish with the practical question that helps you leave on time.",
                callToAction: "Lock question",
                resolvedTitle: "Desk cleared",
                resolvedNote: "You kept the station exchange focused on route, ticket, and timing.",
              }),
            }
          ),
          makeVoiceBurstStage(
            stageId(level, unitIndex, "voice-burst"),
            "Question burst",
            "Say the key service question once and keep the destination and timing together.",
            "Which bus goes downtown, and what time does it leave?",
            "Keep the destination and the time question together.",
            [
              choiceOption("good", "Which bus goes downtown, and what time does it leave?"),
              choiceOption("alt-1", "Which bus goes downtown, and when does it leave?"),
              choiceOption("alt-2", "What bus goes downtown, and what time does it leave?"),
            ],
            "good",
            "Good. You cleared the service question and are ready for the station conversation.",
            "Stay close to the route question with the destination and the timing together.",
            {
              timerMs: 16000,
              theme: "teal",
              soundSet: "neutral",
              requiredPhrases: ["downtown", "time"],
              acceptedResponses: [
                "Which bus goes downtown, and what time does it leave?",
                "Which bus goes downtown, and when does it leave?",
              ],
              presentation: gamePresentation("voice_focus", {
                boardTitle: "Question burst",
                helperLabel: "Say it once",
                helperText: "Say the route question one time. Use quick backup if the mic misses you.",
                callToAction: "Clear voice burst",
                resolvedTitle: "Voice burst cleared",
                resolvedNote: "You kept the service question short, direct, and easy to answer.",
              }),
            }
          ),
        ],
        {
          theme: "teal",
          layoutVariant: "arcade_reaction_pick",
          assetName: "station-help",
          summary: {
            strength: "You cleared the station queue in a smart order and finished with one clean service question.",
            nextFocus: "Lead with the route, then add the ticket and time detail so the worker can answer quickly.",
            bridgeToSpeaking: "Carry the same route-ticket-time sequence into the station help conversation next.",
          },
          maxRetriesPerStage: 2,
        }
      );
    case "comparing-choosing-and-short-narratives":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Choice Showdown",
        "choice_showdown",
        "Build a winning choice fast, then clear one short defense line before speaking.",
        [
          makeReactionPickStage(
            stageId(level, unitIndex, "pick-rush"),
            "Pick rush",
            "Lock the better option before the timer expires.",
            [
              {
                id: "round-choice",
                prompt: "Which opening sounds strongest for the benchmark choice question?",
                options: [
                  choiceOption("good-choice", "I'd choose the study workshop because it helps me this week.", "Clear choice plus reason"),
                  choiceOption(
                    "near-choice",
                    "Maybe the study workshop could be okay for me.",
                    "Possible, but hesitant",
                    true
                  ),
                  choiceOption("bad-choice", "Both are fine, so I don't really know.", "Too weak and indirect"),
                ],
                correctOptionId: "good-choice",
              },
            ],
            "Good. You locked the choice fast instead of sounding unsure.",
            "Grab the opening that sounds direct and easy to defend.",
            {
              timerMs: 12000,
              theme: "amber",
              soundSet: "comparison",
              interactionModel: "split_decision",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Pick rush",
                helperLabel: "Main choice",
                helperText: "Choose the option that sounds strongest right away.",
                callToAction: "Lock pick",
                resolvedTitle: "Pick locked",
                resolvedNote: "You started with a choice that sounds confident, not hesitant.",
              }),
            }
          ),
          makeReactionPickStage(
            stageId(level, unitIndex, "tradeoff-rush"),
            "Tradeoff rush",
            "Grab the contrast line that makes the comparison feel real.",
            [
              {
                id: "round-tradeoff",
                prompt: "Which contrast best shows the weakness of the other option?",
                options: [
                  choiceOption("good-tradeoff", "On the other hand, the work shift gives me money but leaves me with less study time.", "Strong tradeoff"),
                  choiceOption(
                    "near-tradeoff",
                    "On the other hand, the work shift helps now but gives me less time to prepare this week.",
                    "Close, but less pointed than the strongest contrast",
                    true
                  ),
                  choiceOption("bad-tradeoff", "On the other hand, jobs can be tiring after a long day.", "Too generic to compare the two options clearly"),
                ],
                correctOptionId: "good-tradeoff",
              },
            ],
            "Good. The tradeoff now makes the choice feel convincing.",
            "Pick the contrast that still compares the two options directly.",
            {
              timerMs: 12000,
              theme: "amber",
              soundSet: "comparison",
              interactionModel: "split_decision",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Tradeoff rush",
                helperLabel: "Tradeoff line",
                helperText: "Choose the contrast that makes the other option feel weaker for this situation.",
                callToAction: "Use tradeoff",
                resolvedTitle: "Tradeoff locked",
                resolvedNote: "You gave the choice a real contrast instead of a generic complaint.",
              }),
            }
          ),
          makeVoiceBurstStage(
            stageId(level, unitIndex, "voice-burst"),
            "Defense burst",
            "Say the main defense line once with the choice and the reason together.",
            "I'd choose the study workshop because it fits my goals this week.",
            "Keep the choice and the reason in one clear line.",
            [
              choiceOption("good", "I'd choose the study workshop because it fits my goals this week."),
              choiceOption("alt-1", "I would choose the study workshop because it fits my goals this week."),
              choiceOption("alt-2", "I'd choose the workshop because it fits my goals this week."),
            ],
            "good",
            "Good. You are ready to defend that choice in speaking.",
            "Stay close to the main defense line with the choice and because together.",
            {
              timerMs: 16000,
              theme: "amber",
              soundSet: "neutral",
              requiredPhrases: ["choose", "because"],
              acceptedResponses: [
                "I'd choose the study workshop because it fits my goals this week.",
                "I would choose the study workshop because it fits my goals this week.",
              ],
              presentation: gamePresentation("voice_focus", {
                boardTitle: "Defense burst",
                helperLabel: "Say it once",
                helperText: "Say the defense line one time. Use quick backup if the mic misses you.",
                callToAction: "Clear defense burst",
                resolvedTitle: "Defense cleared",
                resolvedNote: "You turned the choice into one short line that sounds easy to defend.",
              }),
            }
          ),
        ],
        {
          theme: "amber",
          layoutVariant: "arcade_reaction_pick",
          assetName: "choice-showdown",
          summary: {
            strength: "You locked the better option fast, added a real tradeoff, and finished with one direct defense line.",
            nextFocus: "Keep the choice and the main reason inside one sentence so the defense lands immediately.",
            bridgeToSpeaking: "Use the same choice-and-tradeoff language when you defend your answer in the speaking benchmark.",
          },
          maxRetriesPerStage: 2,
        }
      );
    default:
      return null;
  }
}

function createIntermediateGame(
  level: CurriculumLevel,
  unitIndex: number,
  slug: string
): GameActivityPayload | null {
  switch (slug) {
    case "tell-stories-clearly":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Story Frame",
        "story_frame",
        "Build the story frame before you tell the full experience out loud.",
        [
          makeSequenceStage(
            stageId(level, unitIndex, "sequence"),
            "Set the story order",
            "Put the story beats in the order that makes the experience easy to follow.",
            [
              choiceOption("beat-1", "One time, I got separated from my group during a museum trip.", "Opening event"),
              choiceOption("beat-2", "At first, I felt nervous because my phone battery was almost dead.", "Reaction and tension"),
              choiceOption("beat-3", "Eventually, a staff member helped me find the entrance and my group again.", "Resolution"),
            ],
            ["beat-1", "beat-2", "beat-3"],
            "Good. The story now moves in a clear order.",
            "Rebuild the story so the opening, tension, and resolution make sense in sequence.",
            gamePresentation("comic", {
              boardTitle: "Story beats",
              helperLabel: "Story order",
              helperText: "Order the event, the tension, and the resolution before you tell the full story.",
              callToAction: "Save order",
            })
          ),
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Add the key details",
            "Fill the story slots so the listener gets the setting, the turning point, and the reflection.",
            [
              { id: "context", label: "Setting", detail: "Anchor the time or place" },
              { id: "turn", label: "Turning point", detail: "Show what changed" },
              { id: "reflection", label: "Reflection", detail: "Explain why it still matters" },
            ],
            [
              choiceOption("opt-context", "during a museum trip", "Time and place"),
              choiceOption("opt-turn", "a staff member helped me find the entrance", "Key change"),
              choiceOption("opt-reflection", "it taught me to stay calm when plans change", "Reflection"),
              choiceOption("opt-noise", "I usually eat breakfast early", "Does not belong in this story"),
            ],
            [
              { slotId: "context", optionId: "opt-context" },
              { slotId: "turn", optionId: "opt-turn" },
              { slotId: "reflection", optionId: "opt-reflection" },
            ],
            "Good. The story frame now includes the detail and the reflection that make it memorable.",
            "Fill the story frame with the setting, the turning point, and the reflection that belongs to this experience.",
            gamePresentation("comic", {
              boardTitle: "Story frame",
              helperLabel: "Story details",
              helperText: "Build the frame so the story has context, movement, and a meaningful ending.",
              callToAction: "Lock frame",
            })
          ),
          makeVoicePromptStage(
            stageId(level, unitIndex, "voice"),
            "Say the story frame",
            "Say a short version of the story that includes the event, the resolution, and what you learned.",
            "One time, I got separated from my group during a museum trip, but in the end I found them again and learned to stay calm.",
            "Keep the main event, the ending, and the reflection in one smooth retell.",
            [
              choiceOption("good", "One time, I got separated from my group during a museum trip, but in the end I found them again and learned to stay calm."),
              choiceOption("alt-1", "One time, I got separated from my group during a museum trip."),
              choiceOption("alt-2", "I learned to stay calm in the end."),
            ],
            "good",
            "Good. You are ready to tell the full story in speaking.",
            "Stay closer to a short retell that includes the event, the ending, and what you learned.",
            {
              requiredPhrases: ["in the end", "learned"],
              acceptedResponses: [
                "One time, I got separated from my group during a museum trip, but in the end I found them again and learned to stay calm.",
                "One time, I got separated from my group on a museum trip, and in the end I found them again and learned to stay calm.",
              ],
              presentation: gamePresentation("comic", {
                boardTitle: "Retell line",
                helperLabel: "Retell the frame",
                helperText: "Say one compact version of the story before you expand it in speaking.",
                callToAction: "Check retell",
              }),
            }
          ),
        ],
        {
          theme: "indigo",
          layoutVariant: "comic",
          assetName: "story-chain",
          summary: {
            strength: "Your story now has clear order, concrete detail, and a real reflection.",
            nextFocus: "Keep the turning point and reflection linked so the story sounds meaningful, not just chronological.",
            bridgeToSpeaking: "Use the same story frame when you tell the full experience in speaking.",
          },
        }
      );
    case "explain-opinions-and-give-reasons":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Reason Stack",
        "reason_stack",
        "Stack a clear opinion, one strong reason, and one useful example before the discussion starts.",
        [
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Build the opinion stack",
            "Fill the slots so your opinion answer sounds clear and supported from the beginning.",
            [
              { id: "claim", label: "Opinion", detail: "State the main position" },
              { id: "reason", label: "Reason", detail: "Show why you think that" },
              { id: "example", label: "Example", detail: "Make the reason concrete" },
            ],
            [
              choiceOption("opt-claim", "I think part-time jobs can help students if the schedule stays reasonable.", "Clear position"),
              choiceOption("opt-reason", "One reason is that they can teach responsibility and time management.", "Support"),
              choiceOption("opt-example", "For example, a small weekend job can help a student learn how to manage time.", "Concrete example"),
              choiceOption("opt-noise", "Students take the bus home after class.", "Related topic, wrong function"),
            ],
            [
              { slotId: "claim", optionId: "opt-claim" },
              { slotId: "reason", optionId: "opt-reason" },
              { slotId: "example", optionId: "opt-example" },
            ],
            "Good. The answer now has a clear claim, support, and example.",
            "Rebuild the stack so the opinion comes first and the support stays connected to it.",
            gamePresentation("comparison_split", {
              boardTitle: "Opinion stack",
              helperLabel: "Claim and support",
              helperText: "Start with the opinion, then add a reason and an example that actually support it.",
              callToAction: "Lock opinion",
            })
          ),
          makeChoiceStage(
            stageId(level, unitIndex, "choice"),
            "Pick the strongest concession",
            "Which sentence acknowledges the other side without losing your main point?",
            [
              choiceOption("good", "On the other hand, too many work hours could hurt school performance, so balance matters.", "Acknowledges a drawback while keeping the opinion clear"),
              choiceOption("bad-1", "Jobs exist in many cities and neighborhoods.", "Too vague to help the argument"),
              choiceOption("bad-2", "I went to work with my cousin last summer.", "Detail with no concession"),
            ],
            "good",
            "Good. That keeps the answer balanced without giving away the point.",
            "Choose the sentence that adds a real concession or drawback, not just another fact.",
            gamePresentation("comparison_split", {
              boardTitle: "Concession line",
              helperLabel: "Other-side line",
              helperText: "Pick the line that shows balance while still protecting the opinion.",
              callToAction: "Keep this line",
            })
          ),
          makeVoicePromptStage(
            stageId(level, unitIndex, "voice"),
            "Say your opinion line",
            "Say a short opinion line that includes your position and one reason.",
            "I think part-time jobs can help students if the schedule stays reasonable because they teach responsibility.",
            "Keep the opinion and the reason in the same line so the answer sounds stable from the start.",
            [
              choiceOption("good", "I think part-time jobs can help students if the schedule stays reasonable because they teach responsibility."),
              choiceOption("alt-1", "I think part-time jobs can help students."),
              choiceOption("alt-2", "Responsibility is important for students."),
            ],
            "good",
            "Good. You are ready to defend the opinion in speaking.",
            "Stay closer to one sentence that includes the opinion and one reason.",
            {
              requiredPhrases: ["i think", "because"],
              acceptedResponses: [
                "I think part-time jobs can help students if the schedule stays reasonable because they teach responsibility.",
                "I think part-time jobs can help students if the schedule is reasonable because they teach responsibility.",
              ],
              presentation: gamePresentation("comparison_split", {
                boardTitle: "Opinion line",
                helperLabel: "Say the claim",
                helperText: "Say the opinion and the reason together so the discussion opens with a strong main point.",
                callToAction: "Check opinion",
              }),
            }
          ),
        ],
        {
          theme: "coral",
          layoutVariant: "comparison_split",
          assetName: "choice-showdown",
          summary: {
            strength: "Your opinion now opens clearly and stays supported with a reason and example.",
            nextFocus: "Keep the concession short so it supports the argument instead of distracting from it.",
            bridgeToSpeaking: "Use the same claim, reason, and concession structure in the discussion speaking task.",
          },
        }
      );
    case "solve-problems-and-make-decisions":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Decision Board",
        "decision_board",
        "Sort the options, build the recommendation, and carry one clear decision into the benchmark conversation.",
        [
          makePriorityBoardStage(
            stageId(level, unitIndex, "priority"),
            "Sort the fundraising ideas",
            "Place each idea where it belongs: best fit, possible backup, or weak option.",
            [
              { id: "best-fit", label: "Best fit" },
              { id: "backup", label: "Possible backup" },
              { id: "weak", label: "Weak option" },
            ],
            [
              { id: "car-wash", label: "Weekend car wash", detail: "Many students can join and it can raise money quickly." },
              { id: "bake-sale", label: "Lunch-time bake sale", detail: "Possible, but fewer people can prepare food every day." },
              { id: "expensive-hoodies", label: "Sell expensive class hoodies", detail: "High cost and hard to organize fast." },
            ],
            [
              { cardId: "car-wash", laneId: "best-fit" },
              { cardId: "bake-sale", laneId: "backup" },
              { cardId: "expensive-hoodies", laneId: "weak" },
            ],
            "Good. The board now shows the strongest option and the weaker alternatives clearly.",
            "Sort the ideas so the best recommendation stands out from the backup and the weak option.",
            gamePresentation("kanban", {
              boardTitle: "Decision board",
              helperLabel: "Option tradeoffs",
              helperText: "Sort the ideas by strength before you try to defend one recommendation.",
              callToAction: "Lock board",
            })
          ),
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Build the recommendation",
            "Fill the slots so your decision line includes the recommendation, the reason, and the tradeoff.",
            [
              { id: "recommendation", label: "Recommendation", detail: "Name the best option" },
              { id: "reason", label: "Reason", detail: "Explain why it wins" },
              { id: "tradeoff", label: "Tradeoff", detail: "Show one realistic limitation" },
            ],
            [
              choiceOption("opt-recommendation", "A weekend car wash is the best option for the class trip.", "Decision"),
              choiceOption("opt-reason", "More students can join, so it can raise money faster.", "Support"),
              choiceOption("opt-tradeoff", "It depends on the weather, so we should also plan a backup date too.", "Tradeoff"),
              choiceOption("opt-noise", "Everyone likes warm weather in spring.", "Too general"),
            ],
            [
              { slotId: "recommendation", optionId: "opt-recommendation" },
              { slotId: "reason", optionId: "opt-reason" },
              { slotId: "tradeoff", optionId: "opt-tradeoff" },
            ],
            "Good. That recommendation sounds realistic and justified.",
            "Rebuild the recommendation so it includes the best option, the reason, and one practical tradeoff.",
            gamePresentation("kanban", {
              boardTitle: "Recommendation line",
              helperLabel: "Decision line",
              helperText: "A strong benchmark answer should choose clearly and still show one real tradeoff.",
              callToAction: "Lock decision",
            })
          ),
          makeVoicePromptStage(
            stageId(level, unitIndex, "voice"),
            "Say the decision pitch",
            "Say a short decision pitch that recommends one option and explains why it is the best fit.",
            "I think a weekend car wash is the best option because more students can join and it can raise money quickly.",
            "Keep the recommendation and the reason together so the group hears the decision clearly.",
            [
              choiceOption("good", "I think a weekend car wash is the best option because more students can join and it can raise money quickly."),
              choiceOption("alt-1", "A weekend car wash is the best option."),
              choiceOption("alt-2", "More students can join and it can raise money quickly."),
            ],
            "good",
            "Good. You are ready to defend the decision in the benchmark conversation.",
            "Stay closer to one sentence that gives the best option and the reason together.",
            {
              requiredPhrases: ["best option", "because"],
              acceptedResponses: [
                "I think a weekend car wash is the best option because more students can join and it can raise money quickly.",
                "A weekend car wash is the best option because more students can join and it can raise money quickly.",
              ],
              presentation: gamePresentation("kanban", {
                boardTitle: "Decision pitch",
                helperLabel: "Say the recommendation",
                helperText: "Say the recommendation in one smooth line before the benchmark follow-up pressure starts.",
                callToAction: "Check pitch",
              }),
            }
          ),
        ],
        {
          theme: "amber",
          layoutVariant: "kanban",
          assetName: "deadline-dash",
          summary: {
            strength: "You sorted the options, chose clearly, and backed the recommendation with a tradeoff-aware reason.",
            nextFocus: "Keep the final decision steady when follow-up questions ask about weaker options.",
            bridgeToSpeaking: "Carry the same recommendation and tradeoff language into the benchmark speaking task.",
          },
        }
      );
    case "study-summarize-and-respond":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Signal Sort",
        "signal_sort",
        "Spot the important source signals and build a short summary-response frame before speaking.",
        [
          makeSpotlightStage(
            stageId(level, unitIndex, "spotlight"),
            "Find the support signal",
            "Tap the two source details that actually support the main idea about different class formats.",
            [
              { id: "spot-flexibility", label: "Flexibility", detail: "Online classes help some students manage time", x: 20, y: 34 },
              { id: "spot-discussion", label: "Discussion", detail: "In-person classes can support stronger classroom interaction", x: 65, y: 38 },
              { id: "spot-cafeteria", label: "Lunch menu", detail: "This does not support the reading summary", x: 48, y: 78 },
            ],
            ["spot-flexibility", "spot-discussion"],
            "Good. Those details actually support the main idea.",
            "Tap the details that belong in a summary of the article, not random information around it.",
            {
              selectionMode: "multiple",
              presentation: gamePresentation("scene_hotspots", {
                boardTitle: "Source signals",
                helperLabel: "Article support",
                helperText: "Pick the details that would belong in a good short summary.",
                callToAction: "Use signals",
                assetRef: gameAsset("scene-scan"),
              }),
            }
          ),
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Build the summary-response line",
            "Fill the slots so the answer includes the main idea, one supporting detail, and your response.",
            [
              { id: "main-idea", label: "Main idea", detail: "Summarize the text" },
              { id: "detail", label: "Supporting detail", detail: "Use one source detail" },
              { id: "response", label: "Your response", detail: "React in your own words" },
            ],
            [
              choiceOption("opt-main", "Different class formats support different kinds of learners.", "Main idea"),
              choiceOption("opt-detail", "For example, online classes offer flexibility while in-person classes can improve discussion and focus.", "Source detail"),
              choiceOption("opt-response", "I agree that a mixed approach can work well because students do not all learn in the same way.", "Response"),
              choiceOption("opt-noise", "The school bus arrives very early every day.", "Off-topic"),
            ],
            [
              { slotId: "main-idea", optionId: "opt-main" },
              { slotId: "detail", optionId: "opt-detail" },
              { slotId: "response", optionId: "opt-response" },
            ],
            "Good. The response now sounds like a real summary plus response, not just a copied fact.",
            "Build the line with the main idea, one supporting detail, and a response in your own words.",
            gamePresentation("scene_hotspots", {
              boardTitle: "Summary frame",
              helperLabel: "Summary and response",
              helperText: "A strong answer should summarize first, then react in your own words.",
              callToAction: "Lock summary",
            })
          ),
          makeChoiceStage(
            stageId(level, unitIndex, "choice"),
            "Pick the strongest paraphrase",
            "Which sentence sounds most like a clear paraphrase instead of a copied note?",
            [
              choiceOption("good", "The article suggests that no single class format works best for every learner.", "Clear paraphrase"),
              choiceOption("bad-1", "The article says different formats support different learners, flexibility, and discussion.", "Too list-like and copied"),
              choiceOption("bad-2", "School is different from class and homework.", "Too vague"),
            ],
            "good",
            "Good. That sounds like a learner summary, not a copied line.",
            "Choose the line that sounds like a natural paraphrase of the main idea.",
            gamePresentation("scene_hotspots", {
              boardTitle: "Paraphrase check",
              helperLabel: "Paraphrase",
              helperText: "Pick the version that sounds closest to how you would explain the article in your own words.",
              callToAction: "Keep paraphrase",
            })
          ),
        ],
        {
          theme: "violet",
          layoutVariant: "scene_hotspots",
          assetName: "scene-scan",
          summary: {
            strength: "You separated the main idea from the supporting details and added a real response.",
            nextFocus: "Keep the paraphrase natural so the summary sounds like your own language, not copied notes.",
            bridgeToSpeaking: "Use the same summary-response frame when you explain the reading in speaking.",
          },
        }
      );
    case "future-plans-goals-and-possibilities":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Goal Path",
        "goal_path",
        "Map the goal, the next steps, and the possible challenge before you explain the full plan.",
        [
          makePriorityBoardStage(
            stageId(level, unitIndex, "priority"),
            "Map the next steps",
            "Place each step where it belongs in the path: now, next, or later.",
            [
              { id: "now", label: "Now" },
              { id: "next", label: "Next" },
              { id: "later", label: "Later" },
            ],
            [
              { id: "speaking-group", label: "Join a weekly speaking group", detail: "Immediate practice step" },
              { id: "reading-plan", label: "Read one English article every day", detail: "Next routine to build" },
              { id: "debate-team", label: "Apply for the debate team next year", detail: "Longer-term goal" },
            ],
            [
              { cardId: "speaking-group", laneId: "now" },
              { cardId: "reading-plan", laneId: "next" },
              { cardId: "debate-team", laneId: "later" },
            ],
            "Good. The path now moves from the first step to the longer goal clearly.",
            "Sort the path so the immediate step, the next routine, and the long-term goal make sense together.",
            gamePresentation("planner", {
              boardTitle: "Goal path",
              helperLabel: "Plan steps",
              helperText: "Build the path from the first practical step to the bigger future goal.",
              callToAction: "Save path",
            })
          ),
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Build the goal line",
            "Fill the slots so the answer includes the goal, the first step, and one challenge or possibility.",
            [
              { id: "goal", label: "Goal", detail: "What you want to reach" },
              { id: "step", label: "First step", detail: "What you will do first" },
              { id: "challenge", label: "Challenge or possibility", detail: "What might affect the plan" },
            ],
            [
              choiceOption("opt-goal", "My goal is to improve my English enough to join the debate team next year.", "Goal"),
              choiceOption("opt-step", "First, I'm going to practice speaking every week and read more in English.", "First step"),
              choiceOption("opt-challenge", "If possible, I'd also like to take an extra writing class, but time may be the main challenge.", "Challenge and possibility"),
              choiceOption("opt-noise", "I usually take the bus after school.", "Off-task detail"),
            ],
            [
              { slotId: "goal", optionId: "opt-goal" },
              { slotId: "step", optionId: "opt-step" },
              { slotId: "challenge", optionId: "opt-challenge" },
            ],
            "Good. The plan now sounds realistic and connected.",
            "Rebuild the line so it names the goal, the first step, and one likely challenge or possibility.",
            gamePresentation("planner", {
              boardTitle: "Goal line",
              helperLabel: "Future plan",
              helperText: "A strong future answer should sound concrete, not just hopeful.",
              callToAction: "Lock plan",
            })
          ),
          makeVoicePromptStage(
            stageId(level, unitIndex, "voice"),
            "Say the goal line",
            "Say a short future-plan line that includes the goal and the first step.",
            "My goal is to improve my English enough to join the debate team next year, and first I'm going to practice speaking every week.",
            "Keep the goal and the first step together so the plan sounds concrete from the beginning.",
            [
              choiceOption("good", "My goal is to improve my English enough to join the debate team next year, and first I'm going to practice speaking every week."),
              choiceOption("alt-1", "My goal is to improve my English next year."),
              choiceOption("alt-2", "I'm going to practice speaking every week."),
            ],
            "good",
            "Good. You are ready to explain the full plan in speaking.",
            "Stay closer to one sentence that includes both the goal and the first step.",
            {
              requiredPhrases: ["my goal is", "i'm going to"],
              acceptedResponses: [
                "My goal is to improve my English enough to join the debate team next year, and first I'm going to practice speaking every week.",
                "My goal is to improve my English enough to join the debate team next year, and first I am going to practice speaking every week.",
              ],
              presentation: gamePresentation("planner", {
                boardTitle: "Future line",
                helperLabel: "Say the goal line",
                helperText: "Say the goal and the first step together before you expand the plan in speaking.",
                callToAction: "Check plan",
              }),
            }
          ),
        ],
        {
          theme: "emerald",
          layoutVariant: "planner",
          assetName: "routine-builder",
          summary: {
            strength: "Your future answer now has a clear goal, a practical first step, and a realistic challenge.",
            nextFocus: "Keep the first step concrete so the plan sounds actionable instead of abstract.",
            bridgeToSpeaking: "Use the same goal-step-challenge structure when you explain your plan in speaking.",
          },
        }
      );
    case "real-world-interaction-travel-interviews-presentations":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Interview Launch",
        "interview_launch",
        "Shape a confident interview opening before you handle the benchmark follow-up questions.",
        [
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Build the intro board",
            "Fill the slots so the opening includes your interest, your strength, and one concrete example.",
            [
              { id: "interest", label: "Interest", detail: "Why you want the role" },
              { id: "strength", label: "Strength", detail: "What you do well" },
              { id: "example", label: "Example", detail: "Proof from school, work, or community" },
            ],
            [
              choiceOption("opt-interest", "I'm interested in this role because I enjoy helping people and working with a team.", "Interest"),
              choiceOption("opt-strength", "One strength I have is that I stay calm under pressure.", "Strength"),
              choiceOption("opt-example", "For example, I helped organize a student event last semester and made sure everyone knew what to do.", "Example"),
              choiceOption("opt-noise", "I sometimes take the bus downtown after class.", "Off-task detail"),
            ],
            [
              { slotId: "interest", optionId: "opt-interest" },
              { slotId: "strength", optionId: "opt-strength" },
              { slotId: "example", optionId: "opt-example" },
            ],
            "Good. The opening now sounds like a credible interview answer.",
            "Rebuild the intro so it shows interest, a real strength, and a concrete example.",
            gamePresentation("mixer", {
              boardTitle: "Interview board",
              helperLabel: "Opening answer",
              helperText: "A strong interview answer should sound motivated, specific, and supported by one example.",
              callToAction: "Lock intro",
            })
          ),
          makeChoiceStage(
            stageId(level, unitIndex, "choice"),
            "Pick the strongest follow-up answer",
            "Which answer best responds to a follow-up question about handling new situations?",
            [
              choiceOption("good", "When I face a new situation, I ask clear questions, learn the routine quickly, and stay calm while I adjust.", "Direct follow-up answer"),
              choiceOption("bad-1", "I like trying new things and meeting people.", "Positive, but too general"),
              choiceOption("bad-2", "My classes are busy this semester.", "Off-point"),
            ],
            "good",
            "Good. That answer sounds calm, direct, and professional.",
            "Choose the answer that responds to the follow-up directly instead of repeating the opening.",
            gamePresentation("mixer", {
              boardTitle: "Follow-up answer",
              helperLabel: "Interview follow-up",
              helperText: "Pick the reply that handles a real interview follow-up with connected detail.",
              callToAction: "Keep answer",
            })
          ),
          makeVoicePromptStage(
            stageId(level, unitIndex, "voice"),
            "Say the interview opener",
            "Say a short interview opener that includes your interest, one strength, and one example.",
            "I'm interested in this role because I enjoy helping people and working with a team. One strength I have is that I stay calm under pressure. For example, I helped organize a student event last semester.",
            "Keep the interest, the strength, and the example connected so the answer sounds prepared instead of memorized.",
            [
              choiceOption("good", "I'm interested in this role because I enjoy helping people and working with a team. One strength I have is that I stay calm under pressure. For example, I helped organize a student event last semester."),
              choiceOption("alt-1", "I'm interested in this role because I like helping people."),
              choiceOption("alt-2", "One strength I have is that I stay calm under pressure."),
            ],
            "good",
            "Good. You are ready to open the benchmark interview with a clear and supported answer.",
            "Stay closer to one answer that includes the interest, the strength, and the example together.",
            {
              requiredPhrases: ["interested", "one strength", "for example"],
              acceptedResponses: [
                "I'm interested in this role because I enjoy helping people and working with a team. One strength I have is that I stay calm under pressure. For example, I helped organize a student event last semester.",
                "I am interested in this role because I enjoy helping people and working with a team. One strength I have is that I stay calm under pressure. For example, I helped organize a student event last semester.",
              ],
              presentation: gamePresentation("mixer", {
                boardTitle: "Interview opener",
                helperLabel: "Say the opening",
                helperText: "Say the opening once so the benchmark conversation starts with a clear, supported introduction.",
                callToAction: "Check opener",
              }),
            }
          ),
        ],
        {
          theme: "teal",
          layoutVariant: "mixer",
          assetName: "name-tag-mixer",
          summary: {
            strength: "Your interview opener now sounds motivated, specific, and supported by a real example.",
            nextFocus: "Keep the follow-up answer just as concrete so the benchmark interview stays strong after the first question.",
            bridgeToSpeaking: "Use the same interest-strength-example structure when you open the interview benchmark in speaking.",
          },
        }
      );
    default:
      return null;
  }
}

function createAdvancedGame(
  level: CurriculumLevel,
  unitIndex: number,
  slug: string
): GameActivityPayload | null {
  switch (slug) {
    case "analyze-arguments-and-evidence":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Evidence Meter",
        "evidence_meter",
        "Sort the strongest support, isolate the weakness, and carry one clear evaluation into speaking.",
        [
          makeSpotlightStage(
            stageId(level, unitIndex, "spotlight"),
            "Find the real support",
            "Tap the two details that actually support the article's main claim about free transportation for students.",
            [
              {
                id: "spot-access",
                label: "Access barrier",
                detail: "Transportation costs can limit access to school and activities.",
                x: 22,
                y: 34,
              },
              {
                id: "spot-attendance",
                label: "Attendance support",
                detail: "Lower travel cost could help students attend more regularly.",
                x: 66,
                y: 40,
              },
              {
                id: "spot-cafeteria",
                label: "Lunch detail",
                detail: "This point does not support the transportation claim.",
                x: 47,
                y: 78,
              },
            ],
            ["spot-access", "spot-attendance"],
            "Good. Those details actually support the claim.",
            "Choose the details that function as evidence for the argument, not unrelated facts.",
            {
              selectionMode: "multiple",
              presentation: gamePresentation("scene_hotspots", {
                boardTitle: "Evidence scan",
                helperLabel: "Support signals",
                helperText: "Find the details that actually strengthen the argument before you evaluate it.",
                callToAction: "Keep support",
              }),
            }
          ),
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Build the evaluation",
            "Fill the slots so your evaluation names the claim, rates the evidence, and adds one weakness.",
            [
              { id: "claim", label: "Claim", detail: "State the article's main idea" },
              { id: "rating", label: "Evaluation", detail: "Judge how convincing the evidence is" },
              { id: "weakness", label: "Weakness", detail: "Add one real limitation or assumption" },
            ],
            [
              choiceOption("opt-claim", "The main claim is that students should have free public transportation.", "Claim"),
              choiceOption("opt-rating", "The evidence is partly convincing because it shows access barriers clearly.", "Evaluation"),
              choiceOption("opt-weakness", "One weakness is that the article does not explain who would pay for the program.", "Limitation"),
              choiceOption("opt-noise", "Students often enjoy traveling with friends.", "Too general"),
            ],
            [
              { slotId: "claim", optionId: "opt-claim" },
              { slotId: "rating", optionId: "opt-rating" },
              { slotId: "weakness", optionId: "opt-weakness" },
            ],
            "Good. The evaluation now sounds analytical instead of descriptive.",
            "Rebuild the line so it identifies the claim, judges the evidence, and names one real weakness.",
            gamePresentation("scene_hotspots", {
              boardTitle: "Evaluation frame",
              helperLabel: "Claim and weakness",
              helperText: "A strong advanced answer should evaluate the evidence, not only repeat the article.",
              callToAction: "Lock evaluation",
            })
          ),
          makeVoicePromptStage(
            stageId(level, unitIndex, "voice"),
            "Say the evaluation line",
            "Say one short evaluation that names the claim and gives one limitation.",
            "The main claim is that students should have free public transportation, but the evidence is only partly convincing because the article never explains who would pay for it.",
            "Keep the claim and the limitation together so the evaluation sounds controlled and precise.",
            [
              choiceOption("good", "The main claim is that students should have free public transportation, but the evidence is only partly convincing because the article never explains who would pay for it."),
              choiceOption("alt-1", "The main claim is that students should have free public transportation."),
              choiceOption("alt-2", "The evidence is partly convincing."),
            ],
            "good",
            "Good. You are ready to evaluate the argument in speaking.",
            "Stay closer to one line that names the claim and the limitation together.",
            {
              requiredPhrases: ["main claim", "partly convincing"],
              acceptedResponses: [
                "The main claim is that students should have free public transportation, but the evidence is only partly convincing because the article never explains who would pay for it.",
                "The main claim is that students should have free public transportation, but the evidence is partly convincing because the article never explains who would pay for it.",
              ],
              presentation: gamePresentation("scene_hotspots", {
                boardTitle: "Evaluation line",
                helperLabel: "Say the critique",
                helperText: "Say one compact critique before you expand the analysis in speaking.",
                callToAction: "Check critique",
              }),
            }
          ),
        ],
        {
          theme: "sky",
          layoutVariant: "scene_hotspots",
          assetName: "scene-scan",
          summary: {
            strength: "Your analysis now separates the claim, the real support, and the weakness clearly.",
            nextFocus: "Keep the evaluation anchored to the evidence instead of drifting into general opinion.",
            bridgeToSpeaking: "Use the same claim-support-weakness structure when you evaluate the article in speaking.",
          },
        }
      );
    case "speak-and-write-in-formal-registers":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Register Shift",
        "register_shift",
        "Turn an informal idea into a cleaner formal response before you present it in speaking.",
        [
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Build the formal version",
            "Fill the slots so the sentence sounds more formal, precise, and audience-aware.",
            [
              { id: "frame", label: "Opening frame", detail: "Signal a more formal stance" },
              { id: "claim", label: "Formal claim", detail: "Use precise, audience-safe wording" },
              { id: "connector", label: "Formal connector", detail: "Link the idea cleanly" },
            ],
            [
              choiceOption("opt-frame", "In my view,", "Formal frame"),
              choiceOption("opt-claim", "students require adequate rest in order to perform effectively in school", "Formal claim"),
              choiceOption("opt-connector", "therefore, later start times may better support learning.", "Formal connector"),
              choiceOption("opt-noise", "kids need more sleep, you know", "Informal wording"),
            ],
            [
              { slotId: "frame", optionId: "opt-frame" },
              { slotId: "claim", optionId: "opt-claim" },
              { slotId: "connector", optionId: "opt-connector" },
            ],
            "Good. The sentence now sounds formal and controlled.",
            "Rebuild the line so the tone and phrasing fit a teacher, report, or formal audience.",
            gamePresentation("comparison_split", {
              boardTitle: "Formal version",
              helperLabel: "Tone shift",
              helperText: "Move the idea from casual wording into a cleaner formal register.",
              callToAction: "Lock version",
            })
          ),
          makeChoiceStage(
            stageId(level, unitIndex, "choice"),
            "Choose the strongest justification",
            "Which explanation best shows why the formal version works better?",
            [
              choiceOption("good", "It sounds more precise, avoids casual wording, and fits a teacher or employer audience.", "Clear register explanation"),
              choiceOption("bad-1", "It is longer, so it must be better.", "Length is not the real reason"),
              choiceOption("bad-2", "It uses a difficult word, which is enough.", "Vocabulary alone is not register control"),
            ],
            "good",
            "Good. That explanation focuses on audience and precision.",
            "Choose the reason that explains the register shift, not just the sentence length.",
            gamePresentation("comparison_split", {
              boardTitle: "Register rationale",
              helperLabel: "Why it works",
              helperText: "Pick the explanation that actually shows why the revised sentence is more formal.",
              callToAction: "Keep rationale",
            })
          ),
          makeVoicePromptStage(
            stageId(level, unitIndex, "voice"),
            "Say the formal line",
            "Say the formal version clearly in one controlled sentence.",
            "In my view, students require adequate rest in order to perform effectively in school, and therefore later start times may better support learning.",
            "Keep the formal phrasing smooth so it sounds usable in a real presentation or response.",
            [
              choiceOption("good", "In my view, students require adequate rest in order to perform effectively in school, and therefore later start times may better support learning."),
              choiceOption("alt-1", "In my view, students require adequate rest in school."),
              choiceOption("alt-2", "Later start times may support learning."),
            ],
            "good",
            "Good. You are ready to use the formal line in speaking.",
            "Stay closer to one formal sentence that keeps the precise wording and the connector.",
            {
              requiredPhrases: ["in my view", "therefore"],
              acceptedResponses: [
                "In my view, students require adequate rest in order to perform effectively in school, and therefore later start times may better support learning.",
                "In my view, students require adequate rest in order to perform effectively in school, therefore later start times may better support learning.",
              ],
              presentation: gamePresentation("comparison_split", {
                boardTitle: "Formal line",
                helperLabel: "Say the formal version",
                helperText: "Say the revised line once so the formal response feels natural before speaking.",
                callToAction: "Check line",
              }),
            }
          ),
        ],
        {
          theme: "violet",
          layoutVariant: "comparison_split",
          assetName: "choice-showdown",
          summary: {
            strength: "Your revision now sounds more precise, audience-aware, and formally structured.",
            nextFocus: "Keep the formal tone steady through the whole answer instead of only the opening phrase.",
            bridgeToSpeaking: "Use the same tone-shift logic when you present the formal version in speaking.",
          },
        }
      );
    case "debate-persuade-and-respond":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Rebuttal Board",
        "rebuttal_board",
        "Sort the argument, build the rebuttal, and carry a steadier position into the benchmark debate.",
        [
          makePriorityBoardStage(
            stageId(level, unitIndex, "priority"),
            "Sort the debate pieces",
            "Place each card where it belongs: main position, likely objection, or weak support.",
            [
              { id: "position", label: "Main position" },
              { id: "objection", label: "Likely objection" },
              { id: "weak", label: "Weak support" },
            ],
            [
              { id: "reduce-homework", label: "Homework should be reduced in lower grades.", detail: "Main stance for the debate." },
              { id: "rigor-concern", label: "Some people worry that less homework could reduce academic rigor.", detail: "Likely objection to answer." },
              { id: "everyone-hates-homework", label: "Everyone dislikes homework.", detail: "Too weak and overgeneralized." },
            ],
            [
              { cardId: "reduce-homework", laneId: "position" },
              { cardId: "rigor-concern", laneId: "objection" },
              { cardId: "everyone-hates-homework", laneId: "weak" },
            ],
            "Good. The board now separates the real stance, the likely objection, and the weak support.",
            "Sort the debate cards so the argument and the objection are clear before you build the rebuttal.",
            gamePresentation("kanban", {
              boardTitle: "Debate board",
              helperLabel: "Position and objection",
              helperText: "A strong benchmark answer needs a clear stance and a clear objection to answer.",
              callToAction: "Lock board",
            })
          ),
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Build the rebuttal",
            "Fill the slots so the rebuttal acknowledges the objection and answers it with a stronger reason.",
            [
              { id: "stance", label: "Stance", detail: "Repeat the position clearly" },
              { id: "concession", label: "Concession", detail: "Acknowledge the objection" },
              { id: "rebuttal", label: "Rebuttal", detail: "Answer with a stronger reason" },
            ],
            [
              choiceOption("opt-stance", "I still believe homework should be reduced in lower grades.", "Main stance"),
              choiceOption("opt-concession", "It is true that schools need to protect academic standards,", "Concession"),
              choiceOption("opt-rebuttal", "but quality practice in class can matter more than a large amount of homework after school.", "Rebuttal"),
              choiceOption("opt-noise", "Students usually take the bus home in the afternoon.", "Off-task detail"),
            ],
            [
              { slotId: "stance", optionId: "opt-stance" },
              { slotId: "concession", optionId: "opt-concession" },
              { slotId: "rebuttal", optionId: "opt-rebuttal" },
            ],
            "Good. The rebuttal now sounds balanced and persuasive.",
            "Rebuild the line so it keeps the stance, acknowledges the objection, and answers it directly.",
            gamePresentation("kanban", {
              boardTitle: "Rebuttal line",
              helperLabel: "Stance and response",
              helperText: "A benchmark debate answer should concede briefly and then return to the stronger point.",
              callToAction: "Lock rebuttal",
            })
          ),
          makeVoicePromptStage(
            stageId(level, unitIndex, "voice"),
            "Say the rebuttal",
            "Say one short rebuttal that keeps the stance and answers the objection.",
            "I still believe homework should be reduced in lower grades because quality practice in class can matter more than a large amount of homework after school.",
            "Keep the stance and the reason together so the benchmark response stays steady under pressure.",
            [
              choiceOption("good", "I still believe homework should be reduced in lower grades because quality practice in class can matter more than a large amount of homework after school."),
              choiceOption("alt-1", "I still believe homework should be reduced in lower grades."),
              choiceOption("alt-2", "Quality practice in class can matter more."),
            ],
            "good",
            "Good. You are ready to defend the position in the benchmark debate.",
            "Stay closer to one sentence that keeps the stance and the rebuttal reason together.",
            {
              requiredPhrases: ["i still believe", "because"],
              acceptedResponses: [
                "I still believe homework should be reduced in lower grades because quality practice in class can matter more than a large amount of homework after school.",
                "I believe homework should be reduced in lower grades because quality practice in class can matter more than a large amount of homework after school.",
              ],
              presentation: gamePresentation("kanban", {
                boardTitle: "Debate line",
                helperLabel: "Say the rebuttal",
                helperText: "Say the rebuttal once so the benchmark debate opens with a controlled position.",
                callToAction: "Check rebuttal",
              }),
            }
          ),
        ],
        {
          theme: "rose",
          layoutVariant: "kanban",
          assetName: "deadline-dash",
          summary: {
            strength: "Your stance now holds together under objection and comes back to a stronger reason.",
            nextFocus: "Keep the concession brief so the rebuttal stays in control during benchmark follow-ups.",
            bridgeToSpeaking: "Carry the same stance-concession-rebuttal structure into the debate benchmark in speaking.",
          },
        }
      );
    case "interpret-complex-texts-and-implied-meaning":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Inference Lens",
        "inference_lens",
        "Find the strongest clues and assemble one interpretation before you explain it in speaking.",
        [
          makeSpotlightStage(
            stageId(level, unitIndex, "spotlight"),
            "Find the inference clues",
            "Tap the two details that best support the idea that the main character has changed by the end of the story.",
            [
              { id: "spot-final-image", label: "Final image", detail: "The ending image feels calm instead of resistant.", x: 24, y: 36 },
              { id: "spot-tone", label: "Quiet tone", detail: "The tone shifts toward acceptance.", x: 68, y: 40 },
              { id: "spot-bus", label: "Bus schedule", detail: "This detail does not support the inference.", x: 46, y: 78 },
            ],
            ["spot-final-image", "spot-tone"],
            "Good. Those clues actually support the inference.",
            "Pick the details that help explain the implied meaning, not just any detail from the text.",
            {
              selectionMode: "multiple",
              presentation: gamePresentation("scene_hotspots", {
                boardTitle: "Inference clues",
                helperLabel: "Text signals",
                helperText: "Find the details that let you justify an interpretation instead of guessing.",
                callToAction: "Keep clues",
              }),
            }
          ),
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Build the interpretation",
            "Fill the slots so the answer states the inference, the support, and the meaning of the tone.",
            [
              { id: "inference", label: "Inference", detail: "What the text implies" },
              { id: "support", label: "Support", detail: "Which detail leads you there" },
              { id: "tone", label: "Tone effect", detail: "How tone supports the interpretation" },
            ],
            [
              choiceOption("opt-inference", "The ending implies that the main character has changed.", "Inference"),
              choiceOption("opt-support", "The final image suggests a new sense of acceptance instead of resistance.", "Support"),
              choiceOption("opt-tone", "The quieter tone supports that interpretation by making the ending feel calmer.", "Tone effect"),
              choiceOption("opt-noise", "The story takes place in a city with buses.", "Irrelevant detail"),
            ],
            [
              { slotId: "inference", optionId: "opt-inference" },
              { slotId: "support", optionId: "opt-support" },
              { slotId: "tone", optionId: "opt-tone" },
            ],
            "Good. The interpretation now has an inference, evidence, and tone support.",
            "Rebuild the line so it explains the implied meaning instead of only repeating the plot.",
            gamePresentation("scene_hotspots", {
              boardTitle: "Interpretation frame",
              helperLabel: "Inference build",
              helperText: "A strong advanced answer should connect implied meaning to a specific clue and tone effect.",
              callToAction: "Lock interpretation",
            })
          ),
          makeChoiceStage(
            stageId(level, unitIndex, "choice"),
            "Pick the stronger alternative reading",
            "Which alternative reading sounds plausible enough to mention without replacing your main interpretation?",
            [
              choiceOption("good", "Another possible reading is that the character is still uncertain, but the calmer ending tone makes acceptance more convincing.", "Balanced alternative reading"),
              choiceOption("bad-1", "The text is only about the weather and nothing else.", "Not supported by the clues"),
              choiceOption("bad-2", "There are no other possible meanings in literature.", "Too absolute"),
            ],
            "good",
            "Good. That keeps the interpretation open without losing the main reading.",
            "Choose the alternative reading that sounds plausible and still respects the evidence.",
            gamePresentation("scene_hotspots", {
              boardTitle: "Alternative reading",
              helperLabel: "Possible second reading",
              helperText: "Advanced interpretation allows another meaning, but it still needs evidence and tone support.",
              callToAction: "Keep reading",
            })
          ),
        ],
        {
          theme: "violet",
          layoutVariant: "scene_hotspots",
          assetName: "scene-scan",
          summary: {
            strength: "Your interpretation now connects implied meaning to a real clue and a tone shift.",
            nextFocus: "Keep the evidence doing the work instead of making the interpretation sound like a guess.",
            bridgeToSpeaking: "Use the same inference-clue-tone structure when you explain the text in speaking.",
          },
        }
      );
    case "academic-and-professional-communication":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Proposal Builder",
        "proposal_builder",
        "Organize a professional recommendation before you explain it to the group.",
        [
          makePriorityBoardStage(
            stageId(level, unitIndex, "priority"),
            "Sort the proposal pieces",
            "Place each card where it belongs: objective, benefit, or clarification detail.",
            [
              { id: "objective", label: "Objective" },
              { id: "benefit", label: "Benefit" },
              { id: "clarification", label: "Clarification" },
            ],
            [
              { id: "online-orientation", label: "Move the orientation session online before the first week.", detail: "Main proposal." },
              { id: "earlier-access", label: "Students can get the information earlier and arrive more prepared.", detail: "Benefit of the recommendation." },
              { id: "support-materials", label: "The school could still offer in-person help for students who need it.", detail: "Clarifies how the proposal would work." },
            ],
            [
              { cardId: "online-orientation", laneId: "objective" },
              { cardId: "earlier-access", laneId: "benefit" },
              { cardId: "support-materials", laneId: "clarification" },
            ],
            "Good. The proposal now has a clear objective, benefit, and clarification.",
            "Sort the cards so the recommendation sounds organized and presentation-ready.",
            gamePresentation("planner", {
              boardTitle: "Proposal board",
              helperLabel: "Objective and benefit",
              helperText: "A professional recommendation should explain the objective, the benefit, and one clarifying detail.",
              callToAction: "Lock proposal",
            })
          ),
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Build the recommendation line",
            "Fill the slots so the answer gives the recommendation, the purpose, and the benefit in one controlled frame.",
            [
              { id: "recommend", label: "Recommendation", detail: "State the proposal" },
              { id: "purpose", label: "Purpose", detail: "Explain the objective" },
              { id: "benefit", label: "Benefit", detail: "Show the value clearly" },
            ],
            [
              choiceOption("opt-recommend", "I recommend moving the orientation session online before the first week of class.", "Recommendation"),
              choiceOption("opt-purpose", "The main objective is to give students access to the information earlier.", "Purpose"),
              choiceOption("opt-benefit", "This approach would reduce confusion and help students arrive more prepared.", "Benefit"),
              choiceOption("opt-noise", "Students often prefer afternoon events in spring.", "Too vague"),
            ],
            [
              { slotId: "recommend", optionId: "opt-recommend" },
              { slotId: "purpose", optionId: "opt-purpose" },
              { slotId: "benefit", optionId: "opt-benefit" },
            ],
            "Good. The recommendation now sounds organized and professional.",
            "Rebuild the line so it states the proposal, the objective, and the benefit clearly.",
            gamePresentation("planner", {
              boardTitle: "Recommendation frame",
              helperLabel: "Professional frame",
              helperText: "A strong recommendation should make the proposal, purpose, and value obvious right away.",
              callToAction: "Lock frame",
            })
          ),
          makeVoicePromptStage(
            stageId(level, unitIndex, "voice"),
            "Say the recommendation",
            "Say one short professional recommendation that includes the proposal and the main objective.",
            "I recommend moving the orientation session online before the first week of class because the main objective is to give students access to the information earlier.",
            "Keep the proposal and the objective in the same line so the recommendation sounds structured and direct.",
            [
              choiceOption("good", "I recommend moving the orientation session online before the first week of class because the main objective is to give students access to the information earlier."),
              choiceOption("alt-1", "I recommend moving the orientation session online before the first week of class."),
              choiceOption("alt-2", "The main objective is to give students access to the information earlier."),
            ],
            "good",
            "Good. You are ready to present the recommendation in speaking.",
            "Stay closer to one structured line that combines the proposal and the objective.",
            {
              requiredPhrases: ["i recommend", "main objective"],
              acceptedResponses: [
                "I recommend moving the orientation session online before the first week of class because the main objective is to give students access to the information earlier.",
                "I recommend moving the orientation session online before the first week of class. The main objective is to give students access to the information earlier.",
              ],
              presentation: gamePresentation("planner", {
                boardTitle: "Recommendation line",
                helperLabel: "Say the proposal",
                helperText: "Say the recommendation once so the professional explanation starts with a clean structure.",
                callToAction: "Check recommendation",
              }),
            }
          ),
        ],
        {
          theme: "teal",
          layoutVariant: "planner",
          assetName: "routine-builder",
          summary: {
            strength: "Your recommendation now explains the proposal, the purpose, and the benefit in a professional frame.",
            nextFocus: "Keep the clarification short so the proposal stays focused on its main objective.",
            bridgeToSpeaking: "Use the same recommendation-purpose-benefit structure when you present the proposal in speaking.",
          },
        }
      );
    case "capstone-synthesize-argue-recommend":
      return createGamePayload(
        `${level}-${unitIndex}-game`,
        "Synthesis Board",
        "synthesis_board",
        "Sort the evidence, build the balanced recommendation, and carry a more stable capstone answer into the benchmark conversation.",
        [
          makePriorityBoardStage(
            stageId(level, unitIndex, "priority"),
            "Sort the capstone inputs",
            "Place each card where it belongs: strongest evidence, key tradeoff, or practical next step.",
            [
              { id: "evidence", label: "Strongest evidence" },
              { id: "tradeoff", label: "Key tradeoff" },
              { id: "next-step", label: "Practical next step" },
            ],
            [
              { id: "sleep-focus", label: "More sleep may improve concentration and attention in class.", detail: "Central supporting evidence." },
              { id: "transportation", label: "Transportation schedules would need adjustment if the day starts later.", detail: "Main tradeoff to acknowledge." },
              { id: "pilot", label: "Test a 30-minute later start as a pilot program first.", detail: "Most practical next step." },
            ],
            [
              { cardId: "sleep-focus", laneId: "evidence" },
              { cardId: "transportation", laneId: "tradeoff" },
              { cardId: "pilot", laneId: "next-step" },
            ],
            "Good. The capstone board now separates the evidence, the tradeoff, and the recommendation path clearly.",
            "Sort the cards so the final answer can synthesize evidence and tradeoffs instead of sounding one-sided.",
            gamePresentation("kanban", {
              boardTitle: "Synthesis board",
              helperLabel: "Evidence and tradeoff",
              helperText: "A capstone recommendation needs evidence, a tradeoff, and a practical next step.",
              callToAction: "Lock board",
            })
          ),
          makeAssembleStage(
            stageId(level, unitIndex, "assemble"),
            "Build the capstone recommendation",
            "Fill the slots so the final answer includes the evidence, the tradeoff, and the practical recommendation.",
            [
              { id: "evidence", label: "Evidence", detail: "What matters most" },
              { id: "tradeoff", label: "Tradeoff", detail: "What the committee must still weigh" },
              { id: "recommendation", label: "Recommendation", detail: "What should happen next" },
            ],
            [
              choiceOption("opt-evidence", "The strongest reason is that students may focus better with more sleep.", "Evidence"),
              choiceOption("opt-tradeoff", "However, transportation schedules would still need adjustment.", "Tradeoff"),
              choiceOption("opt-recommendation", "I recommend a 30-minute later start as a pilot program next year.", "Recommendation"),
              choiceOption("opt-noise", "Students like later starts because mornings feel easier.", "Too weak and informal"),
            ],
            [
              { slotId: "evidence", optionId: "opt-evidence" },
              { slotId: "tradeoff", optionId: "opt-tradeoff" },
              { slotId: "recommendation", optionId: "opt-recommendation" },
            ],
            "Good. The capstone answer now sounds balanced and actionable.",
            "Rebuild the recommendation so it uses evidence, acknowledges a tradeoff, and ends with a practical next step.",
            gamePresentation("kanban", {
              boardTitle: "Capstone frame",
              helperLabel: "Balanced recommendation",
              helperText: "A strong capstone answer should synthesize evidence and tradeoffs before recommending action.",
              callToAction: "Lock frame",
            })
          ),
          makeVoicePromptStage(
            stageId(level, unitIndex, "voice"),
            "Say the capstone line",
            "Say one short recommendation that includes the strongest evidence and the practical next step.",
            "Based on the evidence, I recommend a 30-minute later start as a pilot program because students may focus better with more sleep.",
            "Keep the evidence and the recommendation connected so the capstone answer sounds justified from the start.",
            [
              choiceOption("good", "Based on the evidence, I recommend a 30-minute later start as a pilot program because students may focus better with more sleep."),
              choiceOption("alt-1", "I recommend a 30-minute later start as a pilot program."),
              choiceOption("alt-2", "Students may focus better with more sleep."),
            ],
            "good",
            "Good. You are ready to open the capstone benchmark with a balanced recommendation.",
            "Stay closer to one line that connects the evidence to the recommendation directly.",
            {
              requiredPhrases: ["based on the evidence", "i recommend"],
              acceptedResponses: [
                "Based on the evidence, I recommend a 30-minute later start as a pilot program because students may focus better with more sleep.",
                "Based on the evidence, I recommend a 30 minute later start as a pilot program because students may focus better with more sleep.",
              ],
              presentation: gamePresentation("kanban", {
                boardTitle: "Capstone line",
                helperLabel: "Say the recommendation",
                helperText: "Say the evidence-based recommendation once so the benchmark answer opens with synthesis instead of scattered points.",
                callToAction: "Check recommendation",
              }),
            }
          ),
        ],
        {
          theme: "gold",
          layoutVariant: "kanban",
          assetName: "deadline-dash",
          summary: {
            strength: "Your capstone answer now synthesizes the strongest evidence, the key tradeoff, and a practical next step.",
            nextFocus: "Keep the tradeoff visible without letting it weaken the final recommendation.",
            bridgeToSpeaking: "Use the same evidence-tradeoff-recommendation structure when you handle the capstone benchmark in speaking.",
          },
        }
      );
    default:
      return null;
  }
}

function createGame(raw: RawUnitBlueprint, level: CurriculumLevel, unitIndex: number): GameActivityPayload {
  if (raw.authoredContent?.game) {
    return raw.authoredContent.game;
  }

  return (
    createStageOneGame(level, unitIndex, raw.slug) ??
    createIntermediateGame(level, unitIndex, raw.slug) ??
    createAdvancedGame(level, unitIndex, raw.slug) ??
    createFallbackGame(raw, level, unitIndex)
  );
}

function inferCounterpartRole(raw: RawUnitBlueprint) {
  const normalized = `${raw.scenario} ${raw.performanceTask}`.toLowerCase();

  if (normalized.includes("interview")) {
    return "interviewer";
  }

  if (normalized.includes("customer")) {
    return "customer";
  }

  if (
    normalized.includes("classmate") ||
    normalized.includes("partner") ||
    normalized.includes("group")
  ) {
    return "classmate";
  }

  if (normalized.includes("teacher") || normalized.includes("class")) {
    return "teacher";
  }

  return "conversation partner";
}

function createOpeningQuestion(raw: RawUnitBlueprint) {
  return inferLearnOpeningQuestion({
    scenarioTitle: raw.title,
    scenarioSetup: raw.scenario,
    canDoStatement: raw.canDoStatement,
    performanceTask: raw.performanceTask,
  });
}

function createDefaultEvidenceTargets(
  raw: RawUnitBlueprint,
  mission: Pick<SpeakingMissionBlueprint, "targetPhrases" | "isBenchmark">
): MissionEvidenceTarget[] {
  const targetPhraseCues = mission.targetPhrases
    .map((phrase) => phrase.replace(/\.\.\./g, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  const detailCues = raw.keyVocabulary.slice(0, 3);

  return [
    {
      key: `${raw.slug}-task`,
      kind: "task",
      label: "Answer the task directly",
      cues: targetPhraseCues.slice(0, 2),
    },
    {
      key: `${raw.slug}-language`,
      kind: "language",
      label: "Use the unit language naturally",
      cues: targetPhraseCues.length > 0 ? targetPhraseCues : detailCues,
    },
    {
      key: `${raw.slug}-detail`,
      kind: "detail",
      label: "Add one specific detail or example",
      cues: detailCues,
    },
    {
      key: `${raw.slug}-follow-up`,
      kind: "follow_up",
      label: mission.isBenchmark
        ? "Handle follow-up questions clearly"
        : "Respond clearly to one follow-up",
      cues: [],
    },
  ];
}

function createDefaultFollowUpObjectives(
  raw: RawUnitBlueprint,
  mission: Pick<SpeakingMissionBlueprint, "followUpPrompts">
) {
  const authored = mission.followUpPrompts.slice(0, 4);

  return [
    authored[0] ?? `Ask the learner to answer this task directly: ${raw.performanceTask}`,
    authored[1] ?? `Ask the learner to use one key phrase from ${raw.title}.`,
    authored[2] ?? "Ask for one concrete detail or example.",
    authored[3] ?? "Ask one follow-up that checks whether the learner can keep the answer moving.",
  ];
}

function createSpeakingMission(
  raw: RawUnitBlueprint,
  level: CurriculumLevel,
  unitIndex: number
): SpeakingMissionBlueprint {
  const authoredSpeakingMission = AUTHORED_SPEAKING_MISSIONS[raw.slug];
  const isBenchmark = unitIndex === 3 || unitIndex === 6;
  const targetPhrases =
    authoredSpeakingMission?.targetPhrases ?? raw.keyVocabulary.slice(0, 4);
  const followUpPrompts =
    authoredSpeakingMission?.followUpPrompts ?? [
      `Respond to this scenario: ${raw.scenario}`,
      `Add one useful detail that supports this goal: ${raw.canDoStatement}`,
      `Finish by showing this performance task: ${raw.performanceTask}`,
    ];
  const mission = {
    scenarioTitle: authoredSpeakingMission?.scenarioTitle ?? raw.title,
    scenarioSetup: authoredSpeakingMission?.scenarioSetup ?? raw.scenario,
    counterpartRole:
      authoredSpeakingMission?.counterpartRole ?? inferCounterpartRole(raw),
    openingQuestion:
      authoredSpeakingMission?.openingQuestion ?? createOpeningQuestion(raw),
    warmupPrompts:
      authoredSpeakingMission?.warmupPrompts ?? [
        "Say the main idea of this situation in one sentence.",
        `Practice one phrase using ${raw.keyVocabulary.slice(0, 2).join(" and ")}.`,
      ],
    targetPhrases,
    followUpPrompts,
    successCriteria:
      authoredSpeakingMission?.successCriteria ?? [
        raw.canDoStatement,
        `Use language focus such as ${raw.languageFocus.join(", ")}.`,
        `Include vocabulary such as ${raw.keyVocabulary.slice(0, 3).join(", ")}.`,
      ],
    modelExample: authoredSpeakingMission?.modelExample ?? raw.performanceTask,
    isBenchmark,
    requiredTurns:
      authoredSpeakingMission?.requiredTurns ??
      (level === "advanced"
        ? isBenchmark
          ? 7
          : 5
        : level === "intermediate"
          ? isBenchmark
            ? 6
            : 4
          : level === "basic"
            ? isBenchmark
              ? 5
              : 3
            : isBenchmark
              ? 4
              : 3),
    minimumFollowUpResponses:
      authoredSpeakingMission?.minimumFollowUpResponses ??
      (level === "advanced"
        ? isBenchmark
          ? 3
          : 2
        : level === "intermediate"
          ? isBenchmark
            ? 2
            : 1
          : level === "basic"
            ? isBenchmark
              ? 2
              : 1
            : isBenchmark
              ? 1
              : 0),
    evidenceTargets: [] as MissionEvidenceTarget[],
    followUpObjectives: [] as string[],
    benchmarkFocus:
      authoredSpeakingMission?.benchmarkFocus ??
      (isBenchmark
        ? [`Show that you can ${raw.canDoStatement.replace(/^I can /i, "").replace(/\.$/, "")}.`]
        : []),
  } satisfies SpeakingMissionBlueprint;

  mission.evidenceTargets =
    authoredSpeakingMission?.evidenceTargets ??
    createDefaultEvidenceTargets(raw, mission);
  mission.followUpObjectives =
    authoredSpeakingMission?.followUpObjectives ??
    createDefaultFollowUpObjectives(raw, mission);

  return mission;
}

function createLessonSections(
  raw: RawUnitBlueprint,
  mission: SpeakingMissionBlueprint
) {
  if (raw.authoredContent?.lessonSections) {
    return raw.authoredContent.lessonSections;
  }

  return [
    {
      title: "Scene and purpose",
      body: `In this unit, the learner works inside this situation: ${raw.scenario} The goal is practical, not abstract: ${raw.canDoStatement}`,
    },
    {
      title: "Useful language",
      body: `Focus on ${raw.languageFocus.join(", ")}. Useful phrases for this unit include ${formatItemList(
        mission.targetPhrases
      )}.`,
    },
    {
      title: "What a strong response shows",
      body: `A strong response completes this task: ${raw.performanceTask} It should stay on topic, use key language such as ${raw.keyVocabulary
        .slice(0, 3)
        .join(", ")}, and be ready for a follow-up like "${mission.followUpPrompts[0] ?? mission.openingQuestion}"`,
    },
  ];
}

function createCheckpointQuestions(
  raw: RawUnitBlueprint,
  mission: SpeakingMissionBlueprint
): LessonCheck[] {
  if (raw.authoredContent?.checkpointQuestions) {
    return raw.authoredContent.checkpointQuestions;
  }

  return [
    {
      prompt: "Which response is closest to a strong answer for this unit?",
      options: [
        mission.modelExample,
        "I don't know.",
        "My favorite color is blue.",
      ],
      correctIndex: 0,
    },
    {
      prompt: "Which follow-up would keep this unit conversation moving?",
      options: [
        mission.followUpPrompts[0] ?? mission.openingQuestion,
        "Can you spell your last name for me?",
        "Do you want pizza after class?",
      ],
      correctIndex: 0,
    },
  ];
}

function createUnit(raw: RawUnitBlueprint, level: CurriculumLevel, unitIndex: number): UnitBlueprint {
  const speakingMission = createSpeakingMission(raw, level, unitIndex);

  return {
    ...raw,
    lessonSections: createLessonSections(raw, speakingMission),
    lessonChecks: createChecks(raw, speakingMission),
    practiceQuestions: createPracticeQuestions(level, unitIndex, raw, speakingMission),
    game: createGame(raw, level, unitIndex),
    speakingMission,
    writingPrompt:
      raw.authoredContent?.writingPrompt ??
      `Write the response you could use in this situation: ${raw.scenario} ${raw.performanceTask} Aim for ${getWritingSentenceGuide(
        level
      )}.`,
    writingCriteria:
      raw.authoredContent?.writingCriteria ?? [
        "Answer the situation directly and stay on topic.",
        `Use language from this unit, such as ${formatItemList(
          speakingMission.targetPhrases,
          2
        )} or ${raw.keyVocabulary.slice(0, 3).join(", ")}.`,
        getLevelSpecificWritingCriterion(level),
      ],
    checkpointQuestions: createCheckpointQuestions(raw, speakingMission),
  };
}

function curriculum(
  level: CurriculumLevel,
  title: string,
  description: string,
  units: RawUnitBlueprint[]
): CurriculumBlueprint {
  return {
    level,
    title,
    description,
    units: units.map((unit, index) => createUnit(unit, level, index + 1)),
  };
}

export const CURRICULUM_BLUEPRINTS: CurriculumBlueprint[] = [
  curriculum(
    "very_basic",
    "Very Basic English",
    "A practical survival curriculum for learners who are building first confidence with everyday English.",
    [
      {
        slug: "introductions-and-personal-information",
        title: "Introductions and Personal Information",
        summary: "Start with greetings, names, age, country, and simple personal details.",
        canDoStatement: "I can introduce myself and ask simple personal questions.",
        theme: "First day introductions",
        keyVocabulary: ["hello", "name", "from", "country", "age", "student"],
        languageFocus: ["be statements", "wh- questions", "subject pronouns"],
        performanceTask: "Introduce yourself to a new classmate and ask two basic questions.",
        scenario: "You meet a new student before class starts.",
        authoredContent: {
          lessonSections: [
            {
              title: "Start with your greeting and name",
              body:
                "A clear first answer starts with hello and your name. Keep the first line short so the other person can follow easily.",
            },
            {
              title: "Add one simple personal detail",
              body:
                "After your name, add where you are from or one small detail such as your age or that you are a student.",
            },
            {
              title: "Keep the conversation going",
              body:
                "A good introduction does not stop after one answer. Ask one simple question back, such as where the other person is from or what class they like.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer sounds like a clear first introduction?",
              options: [
                "Hello, my name is Ana. I'm from Brazil.",
                "Student from maybe hello country.",
                "Yesterday I went to the library.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which question helps keep the new conversation going?",
              options: ["What about you?", "How much is the ticket?", "What did you do last weekend?"],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "very_basic-1-practice-1",
              prompt: "Write 1 short sentence that says your name.",
              answer: "free_response",
            },
            {
              id: "very_basic-1-practice-2",
              prompt: "Write 1 short sentence that says where you are from.",
              answer: "free_response",
            },
            {
              id: "very_basic-1-practice-3",
              prompt: "Write 1 short question you can ask a new classmate back.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("very_basic", 1, "introductions-and-personal-information")!,
          writingPrompt:
            "Write a short message to a new classmate. Say your name, where you are from, and one simple question. Aim for 3 to 5 simple sentences.",
          writingCriteria: [
            "Say your name clearly.",
            "Add where you are from or one other simple personal detail.",
            "Ask one simple question back.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit goal?",
              options: [
                "Hello, my name is Ana. I'm from Brazil. What about you?",
                "I like pizza after class.",
                "Go straight and turn left.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question fits this introduction best?",
              options: ["Where are you from?", "How much is the bread?", "What bus goes downtown?"],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "family-friends-and-classroom-language",
        title: "Family Descriptions and Classroom Requests",
        summary: "Describe someone close to you and make a simple request in class.",
        canDoStatement: "I can describe one family member and make a simple classroom request.",
        theme: "People close to me and classroom help",
        keyVocabulary: ["mother", "friend", "teacher", "book", "pencil", "brother"],
        languageFocus: ["have and has", "this and that", "simple descriptions"],
        performanceTask: "Describe one family member and make one classroom request.",
        scenario: "You are talking about your family and asking for help in class.",
        authoredContent: {
          lessonSections: [
            {
              title: "Name one person first",
              body:
                "Start with one clear sentence about one family member or friend. Keep the person easy to identify before you add more detail.",
            },
            {
              title: "Add one simple detail",
              body:
                "Use one short detail such as friendly, funny, or likes music. One detail is enough for this level.",
            },
            {
              title: "Use a polite classroom request",
              body:
                "When you need help in class, ask politely. A short request like Can I borrow your pencil? is clear and useful.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which sentence clearly describes one person?",
              options: [
                "My brother is funny and friendly.",
                "Brother funny maybe class.",
                "How much is the ticket?",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which request is polite for class?",
              options: ["Can I borrow your pencil?", "Give me pencil.", "Where are you from?"],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "very_basic-2-practice-1",
              prompt: "Write 1 short sentence about one family member or friend.",
              answer: "free_response",
            },
            {
              id: "very_basic-2-practice-2",
              prompt: "Write 1 short sentence that adds one detail about that person.",
              answer: "free_response",
            },
            {
              id: "very_basic-2-practice-3",
              prompt: "Write 1 short classroom request for a book or pencil.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("very_basic", 2, "family-friends-and-classroom-language")!,
          writingPrompt:
            "Write a short note about one family member or friend, then add one classroom request. Aim for 3 to 5 simple sentences.",
          writingCriteria: [
            "Name one person clearly.",
            "Add one simple detail about that person.",
            "Include one polite classroom request.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best proves the unit goal?",
              options: [
                "My brother is friendly. He likes soccer. Can I borrow your book?",
                "I usually wake up at six.",
                "It is sunny tomorrow.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question fits this unit best?",
              options: ["What do they like to do?", "What time does the bus leave?", "What are you going to do tomorrow?"],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "daily-routines-time-and-schedules",
        title: "Daily Routines, Time, and Schedules",
        summary: "Talk about everyday habits, times, and simple schedules.",
        canDoStatement: "I can describe my daily routine and say when things happen.",
        theme: "A school day",
        keyVocabulary: ["wake up", "class", "morning", "afternoon", "study", "homework"],
        languageFocus: ["simple present", "time phrases", "frequency words"],
        performanceTask: "Explain your school-day routine from morning to evening.",
        scenario: "You are telling a classmate about your normal weekday.",
        authoredContent: {
          lessonSections: [
            {
              title: "Move through the day in order",
              body:
                "Start with the morning, then move to class time and the afternoon. A clear routine answer sounds easier when the day stays in order.",
            },
            {
              title: "Use simple time words",
              body:
                "Use words like morning, afternoon, before class, and after school. These small time words make the routine easier to follow.",
            },
            {
              title: "Add one real routine detail",
              body:
                "Include one thing you really do, such as homework, study time, or taking the bus. One real detail makes the answer sound stronger.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer sounds like a clear weekday routine?",
              options: [
                "In the morning I wake up early, and after school I do homework.",
                "Morning class homework maybe later.",
                "Last weekend I visited my friend.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase helps put the day in order?",
              options: ["After school", "Next to the library", "How much is it?"],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "very_basic-3-practice-1",
              prompt: "Write 1 short sentence about what you do in the morning.",
              answer: "free_response",
            },
            {
              id: "very_basic-3-practice-2",
              prompt: "Write 1 short sentence about what you do after school.",
              answer: "free_response",
            },
            {
              id: "very_basic-3-practice-3",
              prompt: "Write 1 short sentence that adds one routine detail such as study or homework.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("very_basic", 3, "daily-routines-time-and-schedules")!,
          writingPrompt:
            "Write about your weekday from morning to evening. Aim for 3 to 5 simple sentences.",
          writingCriteria: [
            "Move through the day in a clear order.",
            "Use at least one time word such as morning or after school.",
            "Add one real routine detail.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit benchmark goal?",
              options: [
                "In the morning I wake up at six. After school I study and do homework.",
                "My brother is funny and friendly.",
                "I would like bread and water.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best strengthens this routine answer?",
              options: ["What do you do after class ends?", "Where are you from?", "How much is the ticket?"],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "food-shopping-and-likes-dislikes",
        title: "Food, Shopping, and Likes and Dislikes",
        summary: "Order simple food, talk about preferences, and ask about prices.",
        canDoStatement: "I can say what I like, buy simple items, and understand basic prices.",
        theme: "Food and everyday shopping",
        keyVocabulary: ["apple", "bread", "water", "price", "buy", "like"],
        languageFocus: ["like and do not like", "how much", "shopping phrases"],
        performanceTask: "Order a snack and explain what food you like or do not like.",
        scenario: "You are buying a snack after class.",
        authoredContent: {
          lessonSections: [
            {
              title: "Say what you want first",
              body:
                "At a snack counter, start with the item you want. One clear order helps the other person answer quickly.",
            },
            {
              title: "Ask the price clearly",
              body:
                "A short question like How much is it? is enough. Keep the shopping language simple and direct.",
            },
            {
              title: "Add one food preference",
              body:
                "You can also say what food you like or do not like. This makes the exchange feel more natural.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which sentence sounds like a clear snack order?",
              options: [
                "I'd like bread and water, please.",
                "Food maybe after class.",
                "Go straight and turn left.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which question asks about the price?",
              options: ["How much is it?", "Where are you from?", "What do you do after school?"],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "very_basic-4-practice-1",
              prompt: "Write 1 short sentence that orders one food or drink.",
              answer: "free_response",
            },
            {
              id: "very_basic-4-practice-2",
              prompt: "Write 1 short question about the price.",
              answer: "free_response",
            },
            {
              id: "very_basic-4-practice-3",
              prompt: "Write 1 short sentence that says one food you like or do not like.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("very_basic", 4, "food-shopping-and-likes-dislikes")!,
          writingPrompt:
            "Write a short snack order. Say what you want, ask the price, and add one food preference. Aim for 3 to 5 simple sentences.",
          writingCriteria: [
            "Order one food or drink clearly.",
            "Ask or answer one simple price question.",
            "Say one food you like or do not like.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit goal?",
              options: [
                "I'd like bread and water, please. How much is it? I like simple snacks.",
                "My class starts in the morning.",
                "The library is next to the school.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question keeps the snack conversation moving?",
              options: ["Do you want anything else?", "What grade are you in?", "What happened last weekend?"],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "home-school-and-neighborhood",
        title: "Home, School, and Neighborhood",
        summary: "Describe places around you and give simple directions.",
        canDoStatement: "I can describe my home or school area and give basic directions.",
        theme: "Places around me",
        keyVocabulary: ["home", "school", "library", "street", "near", "next to"],
        languageFocus: ["there is and there are", "place words", "direction phrases"],
        performanceTask: "Describe an important place and explain how to find it.",
        scenario: "A new student asks where places are near school.",
        authoredContent: {
          lessonSections: [
            {
              title: "Name the place clearly",
              body:
                "Start by saying the place you are talking about, such as the library, school office, or street near your school.",
            },
            {
              title: "Use one location phrase",
              body:
                "Short phrases like near and next to help the other person picture the place quickly.",
            },
            {
              title: "Give one or two easy directions",
              body:
                "A strong answer gives one simple direction such as go straight or turn left. Keep the route short and clear.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which sentence clearly says where a place is?",
              options: [
                "The library is next to the school office.",
                "Library maybe class after.",
                "I would like bread and water.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase helps give directions?",
              options: ["Go straight", "I like apples", "Last weekend"],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "very_basic-5-practice-1",
              prompt: "Write 1 short sentence that names one place near your school or home.",
              answer: "free_response",
            },
            {
              id: "very_basic-5-practice-2",
              prompt: "Write 1 short sentence with near or next to.",
              answer: "free_response",
            },
            {
              id: "very_basic-5-practice-3",
              prompt: "Write 1 short direction sentence such as go straight or turn left.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("very_basic", 5, "home-school-and-neighborhood")!,
          writingPrompt:
            "Write a short note that describes one place and how to find it. Aim for 3 to 5 simple sentences.",
          writingCriteria: [
            "Name the place clearly.",
            "Use one location phrase such as near or next to.",
            "Give one or two simple directions.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best proves the unit goal?",
              options: [
                "The library is near the school. Go straight and turn left at the corner.",
                "I am from Mexico and I am a student.",
                "I'm going to visit my friend tomorrow.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question fits this place conversation best?",
              options: ["Is it near the front gate?", "What snack do you like?", "What do you do in the morning?"],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "simple-plans-weather-and-practical-review",
        title: "Weekend Plans and Weather",
        summary: "Talk about near-future plans and explain how the weather changes them.",
        canDoStatement: "I can talk about tomorrow, simple plans, and basic weather.",
        theme: "Weekend plans",
        keyVocabulary: ["tomorrow", "rain", "sunny", "weekend", "visit", "plan"],
        languageFocus: ["going to", "future time expressions", "review structures"],
        performanceTask: "Tell a friend your weekend plan and how the weather might affect it.",
        scenario: "You are making a simple weekend plan with a friend.",
        authoredContent: {
          lessonSections: [
            {
              title: "Say the plan first",
              body:
                "Start with one simple weekend plan. A short line with going to helps the other person understand right away.",
            },
            {
              title: "Add the weather",
              body:
                "Mention a simple weather word such as rainy or sunny. This connects the plan to a real situation.",
            },
            {
              title: "Give one backup idea",
              body:
                "If the weather changes, say one other plan. A backup idea makes the answer stronger and clearer.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which sentence clearly says a weekend plan?",
              options: [
                "I'm going to visit my friend on Saturday.",
                "Weekend maybe later sunny.",
                "My brother likes soccer.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which sentence adds a good backup idea?",
              options: ["If it rains, we can stay home and watch a movie.", "The library is next to the office.", "I wake up at six."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "very_basic-6-practice-1",
              prompt: "Write 1 short sentence about one plan for tomorrow or the weekend.",
              answer: "free_response",
            },
            {
              id: "very_basic-6-practice-2",
              prompt: "Write 1 short sentence that adds the weather.",
              answer: "free_response",
            },
            {
              id: "very_basic-6-practice-3",
              prompt: "Write 1 short sentence that gives one backup plan if the weather changes.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("very_basic", 6, "simple-plans-weather-and-practical-review")!,
          writingPrompt:
            "Write about your weekend plan and what you will do if the weather changes. Aim for 3 to 5 simple sentences.",
          writingCriteria: [
            "State one clear plan.",
            "Mention the weather.",
            "Add one backup idea if the weather changes.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit benchmark goal?",
              options: [
                "I'm going to visit my friend this weekend. If it rains, we can study at home instead.",
                "The station is near the school.",
                "I like bread and water.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best tests the weekend plan clearly?",
              options: ["What will you do if it rains?", "Where are you from?", "Can I borrow your pencil?"],
              correctIndex: 0,
            },
          ],
        },
      },
    ]
  ),
  curriculum(
    "basic",
    "Basic English",
    "A practical everyday curriculum that builds connected sentences, short stories, and simple opinions.",
    [
      {
        slug: "habits-and-routines-in-more-detail",
        title: "Habits and Routines in More Detail",
        summary: "Describe routines with more detail, frequency, and short connected ideas.",
        canDoStatement: "I can explain my routine with time, detail, and frequency.",
        theme: "A fuller picture of daily life",
        keyVocabulary: ["usually", "often", "before", "after", "homework", "exercise"],
        languageFocus: ["simple present detail", "frequency adverbs", "sequence words"],
        performanceTask: "Describe your normal weekday in a clear short paragraph.",
        scenario: "You are telling a teacher or advisor about your daily schedule.",
        authoredContent: {
          lessonSections: [
            {
              title: "Build the timeline first",
              body:
                "A strong answer moves through the day in order. Start with the morning, move through class or work, and end with the evening.",
            },
            {
              title: "Add frequency and routine detail",
              body:
                "Use words like usually, often, and sometimes to show what is regular and what changes. Add one concrete detail such as homework, practice, or exercise.",
            },
            {
              title: "Sound connected, not list-like",
              body:
                "Use linking phrases such as before class, after school, and in the evening so the routine sounds like one clear explanation instead of separate fragments.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer sounds most like a clear weekday routine?",
              options: [
                "I usually wake up at 6:30, and after school I finish homework before practice.",
                "Usually homework after maybe school good.",
                "My day is fine. Goodbye.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which word best shows that something is part of a regular routine?",
              options: ["often", "yesterday", "suddenly"],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "basic-1-practice-1",
              prompt:
                "Write 1 to 2 connected sentences that answer: \"Can you walk me through a normal weekday for you?\"",
              answer: "free_response",
            },
            {
              id: "basic-1-practice-2",
              prompt:
                "Write 1 to 2 connected sentences about the busiest part of your day using one time phrase such as before class or after school.",
              answer: "free_response",
            },
            {
              id: "basic-1-practice-3",
              prompt:
                "Write 1 to 2 connected sentences that explain something you do every day and something you only do sometimes.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("basic", 1, "habits-and-routines-in-more-detail")!,
          writingPrompt:
            "Write a short message to a teacher or advisor that explains your normal weekday from morning to evening. Aim for 4 to 6 connected sentences.",
          writingCriteria: [
            "Move through the day in a clear order.",
            "Use at least one frequency word and one time phrase.",
            "Add one specific detail about homework, practice, exercise, or another regular activity.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit goal?",
              options: [
                "I usually wake up early, and after school I often go to practice before I do homework.",
                "My day is school. That's all.",
                "I went to the park last Saturday.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best pushes for a stronger routine answer?",
              options: [
                "Which part of your day is usually the busiest?",
                "What color is your backpack?",
                "Do you like pizza?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "past-events-and-weekend-stories",
        title: "Past Events and Weekend Stories",
        summary: "Use the simple past to tell short stories about completed events.",
        canDoStatement: "I can describe what happened last weekend in order.",
        theme: "Weekend stories",
        keyVocabulary: ["visited", "watched", "cooked", "later", "finally", "yesterday"],
        languageFocus: ["simple past", "time markers", "story sequence"],
        performanceTask: "Tell a short story about what you did over the weekend.",
        scenario: "A classmate asks what you did last weekend.",
        authoredContent: {
          lessonSections: [
            {
              title: "Start with the event",
              body:
                "A short weekend story should open with when it happened and the main event. That gives the listener a clear starting point.",
            },
            {
              title: "Keep the story moving in order",
              body:
                "Use sequence words such as first, later, after that, and finally so the story feels connected instead of random.",
            },
            {
              title: "End with one reaction",
              body:
                "One detail about who you were with, what changed, or how you felt makes the story sound complete.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which sentence sounds like a good story opening?",
              options: [
                "Last Saturday, I visited my cousin and we spent the afternoon together.",
                "Weekend good and later maybe.",
                "I am visiting my cousin tomorrow.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase helps move a past story to the next event?",
              options: ["Later, ...", "Every day, ...", "Right now, ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "basic-2-practice-1",
              prompt:
                "Write 1 to 2 connected sentences that answer: \"What did you do last weekend?\"",
              answer: "free_response",
            },
            {
              id: "basic-2-practice-2",
              prompt:
                "Write 1 to 2 connected sentences that continue the story using one sequence phrase such as later or after that.",
              answer: "free_response",
            },
            {
              id: "basic-2-practice-3",
              prompt:
                "Write 1 to 2 connected sentences that add one reaction, feeling, or ending detail to the weekend story.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("basic", 2, "past-events-and-weekend-stories")!,
          writingPrompt:
            "Write a short weekend story for a classmate. Explain what happened in order and end with one reaction. Aim for 4 to 6 connected sentences.",
          writingCriteria: [
            "Use the simple past and one clear time marker.",
            "Keep the story in order with at least one sequence phrase.",
            "End with one useful detail or feeling.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer sounds most like a complete weekend story?",
              options: [
                "First I visited my cousin, later we cooked dinner, and finally I went home tired but happy.",
                "Weekend was fun. I don't know.",
                "I usually cook dinner after school.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question helps the learner add a stronger ending detail?",
              options: [
                "How did you feel about it?",
                "What are you doing right now?",
                "How much is the ticket?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "what-is-happening-now",
        title: "What Is Happening Now",
        summary: "Describe actions in progress and current situations clearly.",
        canDoStatement: "I can describe what is happening right now.",
        theme: "Live situations and current action",
        keyVocabulary: ["right now", "working", "reading", "talking", "window", "table"],
        languageFocus: ["present continuous", "action in progress", "scene description"],
        performanceTask: "Describe what people are doing in a study space and help someone picture the scene.",
        scenario: "You are describing what is happening in a study space, library area, or classroom right now.",
        authoredContent: {
          lessonSections: [
            {
              title: "Describe the scene in motion",
              body:
                "This unit is about what is happening right now, not what usually happens. Use is or are plus an -ing verb to describe actions in progress.",
            },
            {
              title: "Show more than one part of the room",
              body:
                "A stronger scene answer mentions more than one person or action. Move the listener from one part of the space to another.",
            },
            {
              title: "Add visual anchors",
              body:
                "Use short location details such as near the window, at the front table, or in the back so the listener can picture the scene.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which sentence uses present continuous correctly for this unit?",
              options: [
                "One student is reading near the window.",
                "One student read near the window.",
                "One student usually read near the window.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which detail helps the listener picture the scene?",
              options: ["In the back, ...", "Yesterday, ...", "Maybe later, ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "basic-3-practice-1",
              prompt:
                "Write 1 to 2 connected sentences that answer: \"What is happening in the study space right now?\"",
              answer: "free_response",
            },
            {
              id: "basic-3-practice-2",
              prompt:
                "Write 1 to 2 connected sentences that describe a second person or action in another part of the room.",
              answer: "free_response",
            },
            {
              id: "basic-3-practice-3",
              prompt:
                "Write 1 to 2 connected sentences that add one location detail such as near the window, at the front, or in the back.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("basic", 3, "what-is-happening-now")!,
          writingPrompt:
            "Write a short description of what is happening in a study space right now. Help the reader picture the scene. Aim for 4 to 6 connected sentences.",
          writingCriteria: [
            "Use present continuous sentences.",
            "Mention more than one person or action.",
            "Add at least one location detail that makes the scene easier to imagine.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit goal?",
              options: [
                "Right now, one student is working at the front table and another person is reading near the window.",
                "I usually study after dinner.",
                "Last weekend I visited my cousin.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best strengthens the benchmark conversation?",
              options: [
                "What else do you notice in another part of the room?",
                "What did you do last weekend?",
                "How much is the ticket?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "school-work-and-responsibilities",
        title: "School, Work, and Responsibilities",
        summary: "Explain duties, obligations, and simple problem-solving language.",
        canDoStatement: "I can talk about responsibilities and what I need to do.",
        theme: "Tasks and responsibilities",
        keyVocabulary: ["need to", "have to", "finish", "assignment", "project", "responsibility"],
        languageFocus: ["obligation language", "instructions", "short explanations"],
        performanceTask: "Explain a task you need to complete and how you will do it step by step.",
        scenario: "You are talking with a teacher or advisor about assignments, deadlines, or another task you need to finish.",
        authoredContent: {
          lessonSections: [
            {
              title: "State the responsibility clearly",
              body:
                "A useful answer names the task right away. The listener should understand what must be finished before you explain the plan.",
            },
            {
              title: "Use obligation language naturally",
              body:
                "Need to, have to, and must show responsibility. Use them to explain why the task matters and why the timeline is important.",
            },
            {
              title: "Turn the plan into steps",
              body:
                "A stronger response breaks the work into first, then, and after that so the plan sounds realistic and organized.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer clearly names the task and the plan?",
              options: [
                "I need to finish my project tonight, and first I'll research two sources before I make the slides.",
                "Project maybe later. I don't know.",
                "I am reading in the library right now.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase best shows responsibility?",
              options: ["I have to ...", "I went ...", "I prefer ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "basic-4-practice-1",
              prompt:
                "Write 1 to 2 connected sentences that answer: \"What do you need to finish first?\"",
              answer: "free_response",
            },
            {
              id: "basic-4-practice-2",
              prompt:
                "Write 1 to 2 connected sentences that explain your first two steps using need to, have to, first, or then.",
              answer: "free_response",
            },
            {
              id: "basic-4-practice-3",
              prompt:
                "Write 1 to 2 connected sentences that explain when the task is due and what part might be hardest.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("basic", 4, "school-work-and-responsibilities")!,
          writingPrompt:
            "Write a short planning note that explains one assignment or task you need to finish and how you will do it. Aim for 4 to 6 connected sentences.",
          writingCriteria: [
            "Name the task clearly at the start.",
            "Use obligation language naturally.",
            "Explain the plan in steps and mention the deadline or hardest part.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best proves the unit goal?",
              options: [
                "I have to finish my report before Friday, so first I'll outline it and then I'll write the introduction tonight.",
                "I like sports and music.",
                "One student is reading near the window.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question would strengthen the task plan?",
              options: [
                "How are you going to finish it on time?",
                "What snack do you want?",
                "Where are you from?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "health-travel-and-everyday-services",
        title: "Transportation and Everyday Help",
        summary: "Ask for help with tickets, times, and basic travel-service problems.",
        canDoStatement: "I can ask for transportation help and handle a simple service exchange.",
        theme: "Getting where I need to go",
        keyVocabulary: ["ticket", "bus stop", "station", "downtown", "leave", "help"],
        languageFocus: ["requests", "service questions", "time and price questions"],
        performanceTask: "Ask for help at a station and get the information you need.",
        scenario: "You need help buying the right ticket and finding the next bus.",
        authoredContent: {
          lessonSections: [
            {
              title: "Start with the problem",
              body:
                "In a service exchange, the other person needs to understand your problem quickly. Say where you need to go or what you need help with first.",
            },
            {
              title: "Ask the key question clearly",
              body:
                "Use direct service questions such as Which bus goes to ...?, What time does it leave?, or How much is the ticket?",
            },
            {
              title: "Add one useful detail",
              body:
                "A short travel detail such as downtown, one-way, round trip, or when you want to leave makes the exchange easier and more realistic.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which sentence asks for transportation help clearly?",
              options: [
                "Can you help me? Which bus goes downtown, and what time does it leave?",
                "I like buses because they are blue.",
                "Yesterday I visited the station.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which detail would help a station worker answer you better?",
              options: ["I need a one-way ticket.", "I usually do homework.", "My friend is funny."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "basic-5-practice-1",
              prompt:
                "Write 1 to 2 connected sentences that explain where you need to go and ask for help.",
              answer: "free_response",
            },
            {
              id: "basic-5-practice-2",
              prompt:
                "Write 1 to 2 connected sentences that ask about the bus, the departure time, or the price.",
              answer: "free_response",
            },
            {
              id: "basic-5-practice-3",
              prompt:
                "Write 1 to 2 connected sentences that add one more useful detail, such as downtown, one-way, or what time you want to leave.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("basic", 5, "health-travel-and-everyday-services")!,
          writingPrompt:
            "Write a short service request for a station worker. Explain where you need to go and what information you need. Aim for 4 to 6 connected sentences.",
          writingCriteria: [
            "Explain the transportation problem clearly.",
            "Ask at least one useful question about time, price, or route.",
            "Add one more travel detail that helps the other person answer you.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit goal?",
              options: [
                "Can you help me? I need to go downtown. Which bus goes there, and how much is the ticket?",
                "I prefer hiking to movies.",
                "Right now, one student is reading.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best keeps the service exchange moving?",
              options: [
                "Do you need a one-way ticket or a round trip?",
                "What did you do last weekend?",
                "What class do you like most?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "comparing-choosing-and-short-narratives",
        title: "Comparing, Choosing, and Short Narratives",
        summary: "Compare options, explain preferences, and write short connected paragraphs.",
        canDoStatement: "I can compare two options and explain my choice.",
        theme: "Decisions and preferences",
        keyVocabulary: ["better", "more", "prefer", "choice", "because", "than"],
        languageFocus: ["comparatives", "preference language", "short connected writing"],
        performanceTask: "Compare two options and explain which one is the better fit for you right now.",
        scenario: "You are choosing between two after-class options and explaining your choice to a friend.",
        authoredContent: {
          lessonSections: [
            {
              title: "Choose early",
              body:
                "In a comparison answer, the listener should know your choice quickly. Say which option you prefer before you start adding reasons.",
            },
            {
              title: "Compare, do not just describe",
              body:
                "Use language such as better, more, less, and than so the comparison is explicit. A strong answer shows why one option wins over the other.",
            },
            {
              title: "Support the choice with one clear reason",
              body:
                "Add one reason such as time, money, convenience, or usefulness. In the benchmark conversation, keep that reason clear even when the follow-up question changes.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer makes the choice clear right away?",
              options: [
                "I'd choose the study workshop because it helps me prepare for class this week.",
                "There are two options and both are fine.",
                "Yesterday I took the bus downtown.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase shows a real comparison?",
              options: ["better because", "right now", "have to"],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "basic-6-practice-1",
              prompt:
                "Write 1 to 2 connected sentences that make a clear choice between two after-class options.",
              answer: "free_response",
            },
            {
              id: "basic-6-practice-2",
              prompt:
                "Write 1 to 2 connected sentences that compare the two options using better, more, less, or than.",
              answer: "free_response",
            },
            {
              id: "basic-6-practice-3",
              prompt:
                "Write 1 to 2 connected sentences that explain one advantage of your choice and one drawback of the other option.",
              answer: "free_response",
            },
          ],
          game: createStageOneGame("basic", 6, "comparing-choosing-and-short-narratives")!,
          writingPrompt:
            "Write a short comparison that explains which after-class option is better for you right now and why. Aim for 4 to 6 connected sentences.",
          writingCriteria: [
            "Make a clear choice in the first part of the response.",
            "Compare the two options with at least one contrast.",
            "Support the choice with a reason and mention one drawback of the other option.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best fits the unit benchmark goal?",
              options: [
                "I'd choose the study workshop because it helps me this week. On the other hand, the work shift gives me money, but it leaves me with less time to prepare.",
                "Both are okay. I don't know.",
                "One student is reading near the window.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best tests the learner's comparison clearly?",
              options: [
                "What is one drawback or challenge with the other option?",
                "What bus goes downtown?",
                "Who were you with last weekend?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
    ]
  ),
  curriculum(
    "intermediate",
    "Intermediate English",
    "A connected communication curriculum focused on stories, opinions, summaries, and real-world interaction.",
    [
      {
        slug: "tell-stories-clearly",
        title: "Tell Stories Clearly",
        summary: "Build longer narratives with sequence, detail, and reflection.",
        canDoStatement: "I can tell a clear story with context, sequence, and detail.",
        theme: "Narrative communication",
        keyVocabulary: ["suddenly", "eventually", "detail", "experience", "memory", "reaction"],
        languageFocus: ["narrative sequencing", "past framing", "reflection"],
        performanceTask: "Tell a connected story about a meaningful past experience.",
        scenario: "You are sharing a memorable experience with a class or group.",
        authoredContent: {
          lessonSections: [
            {
              title: "Set the story before it moves",
              body:
                "A strong story starts by locating the listener. Give the time, place, or situation quickly so the audience understands where the experience begins.",
            },
            {
              title: "Move from event to turning point",
              body:
                "Intermediate storytelling needs more than a list of past actions. Use sequence language such as at first, then, eventually, and in the end so the listener can track the change.",
            },
            {
              title: "End with meaning, not only events",
              body:
                "A memorable story finishes with a reflection, reaction, or lesson. That final move is what makes the experience sound worth telling.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which opening gives the listener the clearest story context?",
              options: [
                "One time, during a school museum trip, I got separated from my group.",
                "It was interesting and a lot happened.",
                "Then I suddenly remembered the entrance.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which ending adds reflection instead of only another event?",
              options: [
                "I still remember it because it taught me to stay calm when plans change.",
                "Then I walked to the bus stop.",
                "After that, the teacher talked.",
              ],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "intermediate-1-practice-1",
              prompt:
                "Write 2 to 3 connected sentences that set the time, place, and opening event of a meaningful experience.",
              answer: "free_response",
            },
            {
              id: "intermediate-1-practice-2",
              prompt:
                "Write 2 to 3 connected sentences that move the story forward with a turning point and one concrete detail.",
              answer: "free_response",
            },
            {
              id: "intermediate-1-practice-3",
              prompt:
                "Write 2 to 3 connected sentences that end the story with your reaction, reflection, or lesson.",
              answer: "free_response",
            },
          ],
          game: createIntermediateGame("intermediate", 1, "tell-stories-clearly")!,
          writingPrompt:
            "Write about one meaningful experience from your life. Set the context, move through the event clearly, and end with a reflection. Aim for 5 to 7 connected sentences.",
          writingCriteria: [
            "Set the context early so the reader understands when or where the story begins.",
            "Use sequence language to move from the event to the turning point and resolution.",
            "End with a clear reflection, reaction, or lesson.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit goal?",
              options: [
                "One time, during a school museum trip, I got separated from my group. At first, I felt nervous, but eventually a staff member helped me find them again. I still remember it because it taught me to stay calm.",
                "I think part-time jobs are useful for students.",
                "My goal is to join the debate team next year.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best strengthens the story?",
              options: [
                "Why do you still remember that experience so clearly?",
                "Which bus goes downtown?",
                "What is the main idea of the article?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "explain-opinions-and-give-reasons",
        title: "Explain Opinions and Give Reasons",
        summary: "Move beyond yes-no answers and support your ideas clearly.",
        canDoStatement: "I can express an opinion and support it with reasons.",
        theme: "Opinion and explanation",
        keyVocabulary: ["opinion", "reason", "support", "benefit", "challenge", "evidence"],
        languageFocus: ["opinion frames", "because and so", "reason organization"],
        performanceTask: "Give an opinion on a familiar topic and support it clearly.",
        scenario: "You are answering a discussion question in class.",
        authoredContent: {
          lessonSections: [
            {
              title: "State the opinion early",
              body:
                "An intermediate opinion answer should not hide the main point. Say what you think near the beginning so the listener can follow the rest of your reasons.",
            },
            {
              title: "Support the idea, do not repeat it",
              body:
                "After the opinion, add a real reason or example. A useful response explains why the opinion makes sense instead of saying the same claim again in different words.",
            },
            {
              title: "Stay steady under challenge",
              body:
                "In a discussion, someone may ask for a drawback or another side. Keep the main opinion clear while you answer the follow-up so the response still sounds organized.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer states the opinion clearly and supports it right away?",
              options: [
                "I think students can benefit from part-time jobs because they learn responsibility and time management.",
                "It is an opinion topic, and there are many things to say.",
                "A lot of people have different ideas in class.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase best signals that you are adding support?",
              options: ["One reason is ...", "Last weekend ...", "At the station ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "intermediate-2-practice-1",
              prompt:
                "Write 2 to 3 connected sentences that answer: \"Do you think students should have part-time jobs during the school year?\"",
              answer: "free_response",
            },
            {
              id: "intermediate-2-practice-2",
              prompt:
                "Write 2 to 3 connected sentences that support your opinion with one reason and one example.",
              answer: "free_response",
            },
            {
              id: "intermediate-2-practice-3",
              prompt:
                "Write 2 to 3 connected sentences that respond to one possible drawback or disagreement without changing your main opinion.",
              answer: "free_response",
            },
          ],
          game: createIntermediateGame("intermediate", 2, "explain-opinions-and-give-reasons")!,
          writingPrompt:
            "Write a short discussion response about whether students should have part-time jobs during the school year. State your opinion clearly, support it, and respond to one challenge. Aim for 5 to 7 connected sentences.",
          writingCriteria: [
            "State the opinion clearly in the opening part of the response.",
            "Support the opinion with at least one reason and one concrete example.",
            "Respond to one challenge or drawback without losing the main point.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best fits the unit goal?",
              options: [
                "I think part-time jobs can help students if the hours stay reasonable because they teach responsibility. For example, a small job can improve time management, although too many hours could hurt school performance.",
                "Jobs are a topic with many ideas, and people talk about them a lot.",
                "During the museum trip, I got lost and felt nervous.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best pushes for stronger support?",
              options: [
                "Can you give one example that shows why your opinion makes sense?",
                "What bus goes downtown?",
                "What is the main idea of the article?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "solve-problems-and-make-decisions",
        title: "Solve Problems and Make Decisions",
        summary: "Use modal verbs and collaborative language to discuss options and solutions.",
        canDoStatement: "I can discuss a problem, suggest solutions, and make a decision.",
        theme: "Planning and problem solving",
        keyVocabulary: ["should", "could", "option", "solution", "decision", "possible"],
        languageFocus: ["modals for advice", "suggestion language", "decision-making discussion"],
        performanceTask: "Discuss a problem and recommend the best solution.",
        scenario: "Your group needs to solve a school or travel problem together.",
        authoredContent: {
          lessonSections: [
            {
              title: "Define the problem before the options",
              body:
                "A clear problem-solving answer names the real issue first. Once the listener understands the problem, the suggested options sound more purposeful and easier to compare.",
            },
            {
              title: "Compare options with tradeoffs",
              body:
                "Intermediate decision-making needs more than one idea. Use should, could, better, and another option to compare solutions and show what each one solves or risks.",
            },
            {
              title: "Move toward a recommendation",
              body:
                "The goal is not only brainstorming. End by choosing the best option and explaining why it is the strongest fit right now.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer defines the problem and moves toward a decision?",
              options: [
                "We need to raise money for the class trip, and I think a weekend car wash is the best option because more people can help.",
                "There are many possible ideas, and groups often talk a lot.",
                "I think the weather might change on Saturday.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase best shows that you are comparing options?",
              options: ["A better option is ...", "One time ...", "The main idea is ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "intermediate-3-practice-1",
              prompt:
                "Write 2 to 3 connected sentences that explain the group problem and suggest one realistic option.",
              answer: "free_response",
            },
            {
              id: "intermediate-3-practice-2",
              prompt:
                "Write 2 to 3 connected sentences that compare your preferred option with one other idea using should, could, better, or another option.",
              answer: "free_response",
            },
            {
              id: "intermediate-3-practice-3",
              prompt:
                "Write 2 to 3 connected sentences that recommend a final decision and explain one tradeoff or weakness the group should consider.",
              answer: "free_response",
            },
          ],
          game: createIntermediateGame("intermediate", 3, "solve-problems-and-make-decisions")!,
          writingPrompt:
            "Write a short recommendation for your group about how to raise money for a class trip. Define the problem, compare options, and recommend the best plan. Aim for 5 to 7 connected sentences.",
          writingCriteria: [
            "Define the problem clearly before comparing solutions.",
            "Compare at least two options with one real reason or tradeoff.",
            "End with a clear recommendation that sounds ready for a group decision.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit benchmark goal?",
              options: [
                "We need to raise money for the class trip, and we could try a bake sale or a car wash. A weekend car wash is the better option because more people can help and it may raise money faster, although we need good weather and enough volunteers.",
                "There are many ideas, and groups should talk about them carefully.",
                "I think part-time jobs can be useful for students.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best tests a stronger decision answer?",
              options: [
                "What is one tradeoff or weakness in the option you did not choose?",
                "What did you do last weekend?",
                "Which detail from the article stood out most?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "study-summarize-and-respond",
        title: "Study, Summarize, and Respond",
        summary: "Read for main ideas, summarize, and respond to information with your own words.",
        canDoStatement: "I can summarize key ideas from a text and respond thoughtfully.",
        theme: "Reading to learn",
        keyVocabulary: ["main idea", "detail", "summary", "response", "source", "evidence"],
        languageFocus: ["summary frames", "paraphrase basics", "response language"],
        performanceTask: "Summarize a short text and respond to its main idea.",
        scenario: "You are reading class material and need to show understanding.",
        authoredContent: {
          lessonSections: [
            {
              title: "Separate the main idea from the details",
              body:
                "A useful summary begins with the central point, not with every example from the text. Start with the main idea, then choose only the details that help explain it.",
            },
            {
              title: "Paraphrase instead of copying",
              body:
                "Intermediate summaries should sound like your own words. You can keep the idea from the source, but the sentence structure should not feel copied line by line.",
            },
            {
              title: "Add a thoughtful response",
              body:
                "After the summary, add one short response that explains why the idea matters, what you agree with, or what question it raises for you.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer sounds most like a summary instead of a copied detail list?",
              options: [
                "The article explains that sleep affects concentration, and it uses student examples to show why rest matters for learning.",
                "The article says students slept six hours, then seven hours, then eight hours.",
                "I think school starts early and buses are loud.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase best introduces a response after the summary?",
              options: ["This matters because ...", "After school ...", "One better option ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "intermediate-4-practice-1",
              prompt:
                "Write 2 to 3 connected sentences that state the main idea of a short class article and one supporting detail.",
              answer: "free_response",
            },
            {
              id: "intermediate-4-practice-2",
              prompt:
                "Write 2 to 3 connected sentences that paraphrase the idea in your own words instead of copying the source directly.",
              answer: "free_response",
            },
            {
              id: "intermediate-4-practice-3",
              prompt:
                "Write 2 to 3 connected sentences that add your response to the text, such as why the idea matters or what question it raises.",
              answer: "free_response",
            },
          ],
          game: createIntermediateGame("intermediate", 4, "study-summarize-and-respond")!,
          writingPrompt:
            "Write a short summary-and-response paragraph about a class text. Explain the main idea, include one useful supporting detail, and add your own response. Aim for 5 to 7 connected sentences.",
          writingCriteria: [
            "State the main idea clearly before the supporting detail.",
            "Paraphrase the source in your own words rather than copying it.",
            "Add one thoughtful response that explains why the idea matters or what you think about it.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit goal?",
              options: [
                "The text argues that regular sleep helps students focus better in class, and it gives examples of stronger concentration after better rest. This matters because students often underestimate how much sleep affects learning.",
                "The article used three examples and one chart with a lot of information.",
                "We should choose the car wash because more people can help.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best strengthens the response part of the answer?",
              options: [
                "Why do you think that main idea matters for students like you?",
                "Which station should I use downtown?",
                "Who did you meet at the museum?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "future-plans-goals-and-possibilities",
        title: "Future Plans, Goals, and Possibilities",
        summary: "Describe goals, intentions, and possibilities using future forms.",
        canDoStatement: "I can explain future plans, goals, and possibilities.",
        theme: "Planning ahead",
        keyVocabulary: ["goal", "plan", "future", "possible", "next step", "prepare"],
        languageFocus: ["will", "going to", "future possibility language"],
        performanceTask: "Explain a future goal and the steps you will take to reach it.",
        scenario: "You are discussing goals for school, work, or travel.",
        authoredContent: {
          lessonSections: [
            {
              title: "Name the goal clearly",
              body:
                "A future-focused answer should tell the listener what you are trying to do. The goal needs to be specific enough that the next steps make sense.",
            },
            {
              title: "Turn the goal into a plan",
              body:
                "Intermediate planning language connects the goal to real actions. Use going to, will, next, and first to show how the plan can actually move forward.",
            },
            {
              title: "Include possibility and challenge",
              body:
                "A stronger future answer also considers what might help or slow the plan. Mentioning one challenge or possibility makes the goal sound realistic, not vague.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer sounds most like a clear future goal with a plan?",
              options: [
                "I'm going to apply for the debate team next semester, and first I'll practice speaking more in class.",
                "Maybe something in the future could happen.",
                "Last semester I had a group presentation.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase best adds a realistic challenge or possibility?",
              options: ["One challenge might be ...", "At first, ...", "One time, ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "intermediate-5-practice-1",
              prompt:
                "Write 2 to 3 connected sentences that explain one future goal for school, community life, or work.",
              answer: "free_response",
            },
            {
              id: "intermediate-5-practice-2",
              prompt:
                "Write 2 to 3 connected sentences that explain your first steps using going to, will, next, or first.",
              answer: "free_response",
            },
            {
              id: "intermediate-5-practice-3",
              prompt:
                "Write 2 to 3 connected sentences that mention one challenge, possibility, or support you may need as the plan develops.",
              answer: "free_response",
            },
          ],
          game: createIntermediateGame("intermediate", 5, "future-plans-goals-and-possibilities")!,
          writingPrompt:
            "Write a short future plan about one goal you want to reach. Explain the goal, the first steps you will take, and one challenge or possibility you need to consider. Aim for 5 to 7 connected sentences.",
          writingCriteria: [
            "State one clear goal that sounds realistic and specific.",
            "Explain the next steps in a logical order using future language.",
            "Mention one challenge, possibility, or support that affects the plan.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best fits the unit goal?",
              options: [
                "I'm going to apply for the debate team next semester, and first I'll practice speaking more in class. After that, I'll ask the coach what skills I should improve, although one challenge may be finding enough time after school.",
                "I like speaking tasks because they are interesting.",
                "The article says sleep improves concentration.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best strengthens the future plan?",
              options: [
                "What is the first step you will take this month?",
                "What happened next in the story?",
                "Which option is cheaper?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "real-world-interaction-travel-interviews-presentations",
        title: "Interviews and Short Presentations",
        summary: "Introduce yourself, explain experience, and respond clearly in formal spoken situations.",
        canDoStatement: "I can introduce myself and respond to follow-up questions in a short formal interaction.",
        theme: "Presenting myself clearly",
        keyVocabulary: ["interview", "presentation", "experience", "strength", "example", "explain"],
        languageFocus: ["functional interaction language", "clear explanations", "follow-up responses"],
        performanceTask: "Introduce yourself for a student role or short presentation and answer a follow-up question.",
        scenario: "You are in a short student interview or presentation.",
        authoredContent: {
          lessonSections: [
            {
              title: "Open with fit and purpose",
              body:
                "A short interview or presentation opening should quickly explain who you are, what role or topic you are discussing, and why you are a good fit or why the topic matters.",
            },
            {
              title: "Support claims with one example",
              body:
                "Intermediate formal speaking needs evidence. If you say you are organized, curious, or prepared, add one short example that proves it.",
            },
            {
              title: "Stay clear during follow-up pressure",
              body:
                "Benchmark formal interaction is not only about the opening. You also need to handle a follow-up question directly while keeping the same message clear and professional.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which opening sounds strongest for a short student interview?",
              options: [
                "Hi, I'm Ana, and I'd like to join the student welcome team because I enjoy helping new students feel comfortable.",
                "My name is Ana and many things are important.",
                "One time, I got separated from my group at a museum.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which sentence best adds evidence instead of only a claim?",
              options: [
                "For example, I helped organize a class event last month and answered questions for new students.",
                "I am a good person and I always try hard.",
                "There are many options and ideas to discuss.",
              ],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "intermediate-6-practice-1",
              prompt:
                "Write 2 to 3 connected sentences that introduce yourself for a student role, interview, or short presentation.",
              answer: "free_response",
            },
            {
              id: "intermediate-6-practice-2",
              prompt:
                "Write 2 to 3 connected sentences that explain one strength or experience with a clear example.",
              answer: "free_response",
            },
            {
              id: "intermediate-6-practice-3",
              prompt:
                "Write 2 to 3 connected sentences that answer a follow-up question such as why you are a good fit or how you would handle a responsibility.",
              answer: "free_response",
            },
          ],
          game: createIntermediateGame(
            "intermediate",
            6,
            "real-world-interaction-travel-interviews-presentations"
          )!,
          writingPrompt:
            "Write a short self-introduction for a student role, interview, or brief presentation. Explain who you are, why you fit the role or topic, and support that claim with one example. Aim for 5 to 7 connected sentences.",
          writingCriteria: [
            "Open with a clear role, purpose, or topic instead of a vague introduction.",
            "Support one strength or claim with a specific example.",
            "Respond to the likely follow-up by showing how you would handle the responsibility or question.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit benchmark goal?",
              options: [
                "Hi, I'm Ana, and I'd like to join the student welcome team because I enjoy helping new students feel comfortable. For example, I helped organize a class event last month, and I would use that experience to answer questions and support new students calmly.",
                "My name is Ana, and I have many interests in different topics.",
                "The best fundraising idea is a weekend car wash.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best tests a stronger interview-style response?",
              options: [
                "Can you give one example that shows why you would be a good fit for this role?",
                "Which detail from the article stands out most?",
                "What bus leaves at 4:00?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
    ]
  ),
  curriculum(
    "advanced",
    "Advanced English",
    "A high-rigor curriculum for argument, interpretation, academic writing, and professional communication.",
    [
      {
        slug: "analyze-arguments-and-evidence",
        title: "Analyze Arguments and Evidence",
        summary: "Identify claims, support, and reasoning in complex ideas and texts.",
        canDoStatement: "I can analyze an argument and evaluate the strength of its evidence.",
        theme: "Critical reading and reasoning",
        keyVocabulary: ["claim", "evidence", "reasoning", "assumption", "support", "counterpoint"],
        languageFocus: ["analytical framing", "evidence commentary", "evaluation language"],
        performanceTask: "Analyze an argument and explain whether its evidence is convincing.",
        scenario: "You are discussing a persuasive article or presentation.",
        authoredContent: {
          lessonSections: [
            {
              title: "Separate the claim from the support",
              body:
                "A strong analytical answer identifies what the argument is claiming before judging whether the support is good enough. If the claim is blurry, the evaluation becomes vague too.",
            },
            {
              title: "Evaluate evidence, not only topic agreement",
              body:
                "Advanced analysis should judge how the evidence works. Ask whether the support is relevant, sufficient, and well explained rather than simply deciding whether you like the topic.",
            },
            {
              title: "Surface one limitation or assumption",
              body:
                "A sharper response names what the argument leaves out. One limitation, hidden assumption, or missing counterpoint makes the evaluation sound genuinely analytical.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer sounds most like evidence analysis instead of general opinion?",
              options: [
                "The article's main claim is clear, but the evidence is only partly convincing because it never explains how the program would be funded.",
                "I agree with the article because transportation is important.",
                "Public transportation is a common topic in many cities.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase best signals that you are naming a limitation?",
              options: ["One weakness is ...", "For example, ...", "In the end, ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "advanced-1-practice-1",
              prompt:
                "Write 2 to 3 polished sentences that identify the main claim of a persuasive article and explain what evidence it uses.",
              answer: "free_response",
            },
            {
              id: "advanced-1-practice-2",
              prompt:
                "Write 2 to 3 polished sentences that evaluate whether the evidence is convincing and explain why.",
              answer: "free_response",
            },
            {
              id: "advanced-1-practice-3",
              prompt:
                "Write 2 to 3 polished sentences that name one limitation, assumption, or missing counterpoint in the argument.",
              answer: "free_response",
            },
          ],
          game: createAdvancedGame("advanced", 1, "analyze-arguments-and-evidence")!,
          writingPrompt:
            "Write a short analytical response to a persuasive article. Identify the main claim, evaluate the evidence, and explain one limitation or missing counterpoint. Aim for 6 to 8 polished sentences or one short paragraph.",
          writingCriteria: [
            "Identify the claim clearly before evaluating it.",
            "Judge the strength of the evidence with specific reasoning rather than general agreement.",
            "Name one limitation, assumption, or counterpoint that affects how convincing the argument is.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit goal?",
              options: [
                "The main claim is that students should have free public transportation. The evidence is partly convincing because it shows that travel costs can limit access to school, but it never explains how the program would be funded.",
                "The article is interesting and transportation is an important topic.",
                "I recommend moving orientation online before the first week.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best strengthens the analysis?",
              options: [
                "What assumption does the argument make that may weaken its case?",
                "What is your weekend plan?",
                "Which option should your group choose?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "speak-and-write-in-formal-registers",
        title: "Speak and Write in Formal Registers",
        summary: "Adapt language for academic, professional, and formal communication.",
        canDoStatement: "I can express ideas in a clear formal register when needed.",
        theme: "Register and tone control",
        keyVocabulary: ["formal", "register", "appropriate", "professional", "audience", "tone"],
        languageFocus: ["formal register", "tone shifts", "precise phrasing"],
        performanceTask: "Rewrite or present an idea in a more formal academic or professional style.",
        scenario: "You are writing or presenting for a teacher, employer, or formal audience.",
        authoredContent: {
          lessonSections: [
            {
              title: "Match tone to audience",
              body:
                "Formal communication is not just longer wording. It means choosing phrasing, structure, and tone that fit a teacher, employer, committee, or professional audience.",
            },
            {
              title: "Prefer precision over decoration",
              body:
                "A formal answer should sound controlled, not inflated. Replace casual phrasing with clearer, more exact wording, but keep the meaning direct and understandable.",
            },
            {
              title: "Explain the shift intentionally",
              body:
                "Advanced register control includes explaining why one version works better for the audience. The strongest answers can justify the tone shift, not just perform it.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which revision sounds most appropriate for a formal academic response?",
              options: [
                "Students require adequate rest in order to perform effectively in school.",
                "Kids need more sleep, you know.",
                "Sleep is cool and everyone talks about it.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase best signals a formal transition?",
              options: ["Therefore, ...", "Anyway, ...", "You know, ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "advanced-2-practice-1",
              prompt:
                "Write 2 to 3 polished sentences that turn an informal opinion into a more formal academic response.",
              answer: "free_response",
            },
            {
              id: "advanced-2-practice-2",
              prompt:
                "Write 2 to 3 polished sentences that explain what makes your revised version more appropriate for a formal audience.",
              answer: "free_response",
            },
            {
              id: "advanced-2-practice-3",
              prompt:
                "Write 2 to 3 polished sentences that keep the same idea but adjust it for a professional audience such as a supervisor or employer.",
              answer: "free_response",
            },
          ],
          game: createAdvancedGame("advanced", 2, "speak-and-write-in-formal-registers")!,
          writingPrompt:
            "Rewrite or present one familiar idea in a more formal register for a teacher or professional audience. Explain the tone shift and keep the meaning clear. Aim for 6 to 8 polished sentences or one short paragraph.",
          writingCriteria: [
            "Use wording and structure that fit a formal audience.",
            "Keep the meaning precise rather than simply making the sentence longer.",
            "Explain why the revised version is more appropriate for the target audience.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best fits the unit goal?",
              options: [
                "In my view, students require adequate rest in order to perform effectively in school. This version is more appropriate because it avoids casual wording and sounds more precise for an academic audience.",
                "Kids need more sleep, and that is basically the same idea.",
                "The main claim is that free transportation helps students.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best tests real register control?",
              options: [
                "How would you adjust that sentence for an employer or professional audience?",
                "What happened next in the story?",
                "Which bus leaves first?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "debate-persuade-and-respond",
        title: "Debate, Persuade, and Respond",
        summary: "Use stance, rebuttal, and persuasive support in spoken and written argument.",
        canDoStatement: "I can defend a position, respond to objections, and persuade an audience.",
        theme: "Persuasion and debate",
        keyVocabulary: ["stance", "rebuttal", "counterargument", "persuade", "convincing", "position"],
        languageFocus: ["stance language", "counterargument moves", "rebuttal"],
        performanceTask: "Present a persuasive argument and respond to an opposing view.",
        scenario: "You are in a structured class debate or persuasive discussion.",
        authoredContent: {
          lessonSections: [
            {
              title: "State the stance without hesitation",
              body:
                "In a debate, the audience should know your position quickly. A strong opening makes the stance explicit before the support and rebuttal begin.",
            },
            {
              title: "Build support that can survive objections",
              body:
                "Advanced persuasion needs more than a single reason. The support should be clear enough that it still sounds credible after the other side raises an objection.",
            },
            {
              title: "Answer objections without losing control",
              body:
                "A real rebuttal does not repeat the original claim. It acknowledges the other side briefly, then returns to the stronger reason and explains why the stance still holds.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer sounds most like a real debate opening?",
              options: [
                "I believe homework should be reduced in lower grades because too much of it can hurt balance and sleep.",
                "Homework is a topic people discuss in school.",
                "There are many sides and many ideas in debates.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase best signals that you are answering an objection?",
              options: ["I would respond that ...", "In the morning, ...", "For example, ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "advanced-3-practice-1",
              prompt:
                "Write 2 to 3 polished sentences that open a debate response with a clear position and one strong reason.",
              answer: "free_response",
            },
            {
              id: "advanced-3-practice-2",
              prompt:
                "Write 2 to 3 polished sentences that explain one likely objection to your position and start a rebuttal.",
              answer: "free_response",
            },
            {
              id: "advanced-3-practice-3",
              prompt:
                "Write 2 to 3 polished sentences that complete the rebuttal and show why your stance still holds under pressure.",
              answer: "free_response",
            },
          ],
          game: createAdvancedGame("advanced", 3, "debate-persuade-and-respond")!,
          writingPrompt:
            "Write a short debate response on whether homework should be reduced in lower grades. State a clear position, support it, and answer one objection with a real rebuttal. Aim for 6 to 8 polished sentences or one short paragraph.",
          writingCriteria: [
            "State the stance clearly and early.",
            "Support the stance with a reason that sounds defensible under challenge.",
            "Acknowledge and answer one objection without losing the main argument.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the benchmark goal?",
              options: [
                "I believe homework should be reduced in lower grades because too much of it can hurt balance and sleep. Although some people worry this could reduce rigor, I would respond that stronger in-class practice can matter more than a large amount of homework after school.",
                "Homework is a debate topic and many people have different views.",
                "The article suggests that transportation costs matter.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best tests a stronger rebuttal?",
              options: [
                "How would you answer someone who says less homework will lower academic standards?",
                "What is the main idea of the article?",
                "What should the committee do next?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "interpret-complex-texts-and-implied-meaning",
        title: "Interpret Complex Texts and Implied Meaning",
        summary: "Read beyond the surface and explain implications, tone, and author purpose.",
        canDoStatement: "I can interpret implied meaning and explain how a text creates it.",
        theme: "Inference and interpretation",
        keyVocabulary: ["implicit", "inference", "tone", "purpose", "subtle", "implication"],
        languageFocus: ["interpretive language", "tone analysis", "purpose explanation"],
        performanceTask: "Explain what a text implies and how the author communicates it.",
        scenario: "You are reading a demanding text that requires interpretation.",
        authoredContent: {
          lessonSections: [
            {
              title: "Move from plot to implication",
              body:
                "An advanced interpretation does more than repeat what happens. It explains what the text implies and why that implied meaning is stronger than a purely literal reading.",
            },
            {
              title: "Ground every interpretation in a clue",
              body:
                "A strong inference always points back to a detail, image, or tonal shift. Without that support, the interpretation sounds like a guess rather than analysis.",
            },
            {
              title: "Leave space for complexity",
              body:
                "Advanced readers can mention another possible interpretation without losing the main one. That balance makes the analysis sound nuanced instead of overconfident.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer sounds most like an interpretation instead of a plot summary?",
              options: [
                "The ending implies that the main character has changed because the final image and quieter tone suggest acceptance.",
                "The story ends with the character walking away in silence.",
                "The plot includes several details about travel and weather.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase best signals implied meaning?",
              options: ["This implies that ...", "Then after that ...", "I recommend that ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "advanced-4-practice-1",
              prompt:
                "Write 2 to 3 polished sentences that state one clear inference about a text and the clue that supports it.",
              answer: "free_response",
            },
            {
              id: "advanced-4-practice-2",
              prompt:
                "Write 2 to 3 polished sentences that explain how tone or author purpose strengthens your interpretation.",
              answer: "free_response",
            },
            {
              id: "advanced-4-practice-3",
              prompt:
                "Write 2 to 3 polished sentences that mention one alternative reading while keeping your main interpretation stronger.",
              answer: "free_response",
            },
          ],
          game: createAdvancedGame("advanced", 4, "interpret-complex-texts-and-implied-meaning")!,
          writingPrompt:
            "Write a short interpretation of a complex text. Explain one implied meaning, support it with a textual clue, and show how tone or author purpose supports your reading. Aim for 6 to 8 polished sentences or one short paragraph.",
          writingCriteria: [
            "State one clear inference rather than only summarizing the plot.",
            "Support the interpretation with a specific textual clue.",
            "Explain how tone, purpose, or an alternative reading affects the strength of your interpretation.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best fits the unit goal?",
              options: [
                "The ending implies that the main character has changed because the final image and quieter tone suggest acceptance instead of resistance. Another reading is possible, but the tone makes this interpretation more convincing.",
                "The story ends quietly and then the scene stops.",
                "I recommend a pilot program because it is practical.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best strengthens the interpretation?",
              options: [
                "Which textual detail makes your interpretation stronger than another possible reading?",
                "What is your strongest argument in the debate?",
                "How would you rewrite that sentence more formally?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "academic-and-professional-communication",
        title: "Academic and Professional Communication",
        summary: "Communicate effectively in meetings, presentations, reports, and formal exchanges.",
        canDoStatement: "I can communicate clearly for academic and professional purposes.",
        theme: "Professional and academic use",
        keyVocabulary: ["proposal", "summary", "presentation", "objective", "recommendation", "clarify"],
        languageFocus: ["presentation structure", "formal explanation", "recommendation language"],
        performanceTask: "Deliver or draft a professional-style explanation or recommendation.",
        scenario: "You are presenting information in school or a workplace setting.",
        authoredContent: {
          lessonSections: [
            {
              title: "Lead with the recommendation or objective",
              body:
                "Professional communication works best when the listener knows the purpose quickly. State the proposal, objective, or recommendation before explaining the details behind it.",
            },
            {
              title: "Organize explanation around value",
              body:
                "A strong professional answer does not only describe a plan. It shows why the proposal matters, what problem it solves, and what benefit it creates for the audience.",
            },
            {
              title: "Clarify without losing structure",
              body:
                "In a meeting or presentation, follow-up questions test whether the explanation stays organized. The answer should clarify the recommendation without starting over or drifting off-topic.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer sounds most like a professional recommendation opening?",
              options: [
                "I recommend moving the orientation session online before the first week because the main objective is to give students access to the information earlier.",
                "There are several ideas and many directions the project could go.",
                "Students often have questions at the start of the term.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase best signals clarification in a meeting-style response?",
              options: ["To clarify, ...", "One time, ...", "At first, ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "advanced-5-practice-1",
              prompt:
                "Write 2 to 3 polished sentences that state one recommendation or proposal and explain its objective.",
              answer: "free_response",
            },
            {
              id: "advanced-5-practice-2",
              prompt:
                "Write 2 to 3 polished sentences that explain the main benefit or problem your recommendation addresses.",
              answer: "free_response",
            },
            {
              id: "advanced-5-practice-3",
              prompt:
                "Write 2 to 3 polished sentences that clarify the recommendation for someone new to the project or discussion.",
              answer: "free_response",
            },
          ],
          game: createAdvancedGame("advanced", 5, "academic-and-professional-communication")!,
          writingPrompt:
            "Write a short professional-style recommendation or explanation. State the proposal, explain the objective and benefit, and clarify how it should be understood by the audience. Aim for 6 to 8 polished sentences or one short paragraph.",
          writingCriteria: [
            "Lead with the recommendation or objective instead of background detail.",
            "Explain the value or problem being solved in clear professional language.",
            "Clarify the proposal without losing structure or focus.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the unit goal?",
              options: [
                "I recommend moving the orientation session online before the first week of class. The main objective is to give students access to the information earlier, and this approach would reduce confusion while helping them arrive more prepared.",
                "There are many possibilities for the project, and each one has value.",
                "The ending implies that the main character has changed.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best strengthens the professional explanation?",
              options: [
                "How would you clarify that recommendation for someone new to the project?",
                "What is the article's hidden assumption?",
                "How would you rebut the other side in the debate?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
      {
        slug: "capstone-synthesize-argue-recommend",
        title: "Capstone: Synthesize, Argue, Recommend",
        summary: "Bring together advanced reading, speaking, and writing in one integrated unit.",
        canDoStatement: "I can synthesize information, build an argument, and recommend a course of action.",
        theme: "Integrated advanced communication",
        keyVocabulary: ["synthesize", "integrate", "justify", "recommendation", "impact", "tradeoff"],
        languageFocus: ["synthesis moves", "argument structure", "decision rationale"],
        performanceTask: "Analyze a complex issue, synthesize perspectives, and recommend a justified next step.",
        scenario: "You are presenting a recommendation on a complex social, academic, or professional issue.",
        authoredContent: {
          lessonSections: [
            {
              title: "Synthesize before you recommend",
              body:
                "A capstone answer should combine more than one idea or source before reaching a conclusion. If the evidence stays separate, the recommendation sounds underdeveloped.",
            },
            {
              title: "Keep the tradeoff visible",
              body:
                "A sophisticated recommendation acknowledges what may be gained and what may become harder. Naming the tradeoff makes the final recommendation sound more realistic and trustworthy.",
            },
            {
              title: "End with the most practical next step",
              body:
                "The strongest capstone answers do not stop at general support. They recommend a practical next move and explain why it is the best option at this moment.",
            },
          ],
          lessonChecks: [
            {
              prompt: "Which answer sounds most like a capstone recommendation?",
              options: [
                "Based on the evidence, I recommend a 30-minute later start as a pilot program because students may focus better with more sleep, although transportation schedules would still need adjustment.",
                "Later start times are interesting, and students often talk about them.",
                "There are advantages and disadvantages on both sides.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which phrase best signals that you are synthesizing evidence before recommending action?",
              options: ["Based on the evidence, ...", "One time, ...", "In the morning, ..."],
              correctIndex: 0,
            },
          ],
          practiceQuestions: [
            {
              id: "advanced-6-practice-1",
              prompt:
                "Write 2 to 3 polished sentences that combine more than one relevant idea or evidence point about the issue.",
              answer: "free_response",
            },
            {
              id: "advanced-6-practice-2",
              prompt:
                "Write 2 to 3 polished sentences that explain one key tradeoff or limitation the decision-maker must consider.",
              answer: "free_response",
            },
            {
              id: "advanced-6-practice-3",
              prompt:
                "Write 2 to 3 polished sentences that recommend the most practical next step and justify why it is the best move right now.",
              answer: "free_response",
            },
          ],
          game: createAdvancedGame("advanced", 6, "capstone-synthesize-argue-recommend")!,
          writingPrompt:
            "Write a capstone recommendation on a complex issue. Synthesize more than one idea, acknowledge a real tradeoff, and recommend the most practical next step. Aim for 6 to 8 polished sentences or one short paragraph.",
          writingCriteria: [
            "Combine evidence or perspectives instead of listing disconnected points.",
            "Acknowledge one meaningful tradeoff or limitation.",
            "End with a justified recommendation that sounds practical and well supported.",
          ],
          checkpointQuestions: [
            {
              prompt: "Which answer best matches the capstone benchmark goal?",
              options: [
                "Based on the evidence, I recommend a 30-minute later start as a pilot program because students may focus better with more sleep. However, transportation schedules would still need adjustment, so a pilot is the most practical next step before making a larger change.",
                "There are different perspectives, and all of them have some value.",
                "I believe homework should be reduced because students need rest.",
              ],
              correctIndex: 0,
            },
            {
              prompt: "Which follow-up question best tests a stronger capstone answer?",
              options: [
                "Why is your recommendation more practical than the other available options?",
                "What detail implies that the main character changed?",
                "How would you shift that sentence into a formal register?",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
    ]
  ),
];
