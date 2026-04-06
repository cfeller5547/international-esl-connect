export const CURRICULUM_LEVELS = [
  "very_basic",
  "basic",
  "intermediate",
  "advanced",
] as const;

export type CurriculumLevel = (typeof CURRICULUM_LEVELS)[number];

export function isCurriculumLevel(value: string | null | undefined): value is CurriculumLevel {
  if (!value) {
    return false;
  }

  return CURRICULUM_LEVELS.includes(value as CurriculumLevel);
}
