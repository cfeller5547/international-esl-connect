import {
  CURRICULUM_LEVELS,
  type CurriculumLevel,
  isCurriculumLevel,
} from "@/server/curriculum-levels";

export const UNIT_ACTIVITY_TYPES = [
  "lesson",
  "practice",
  "game",
  "speaking",
  "writing",
  "checkpoint",
] as const;

export type UnitActivityType = (typeof UNIT_ACTIVITY_TYPES)[number];

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

  if (isCurriculumLevel(level)) {
    return level;
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
