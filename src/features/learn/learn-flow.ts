export type LearnActivityType =
  | "lesson"
  | "practice"
  | "game"
  | "speaking"
  | "writing"
  | "checkpoint";

type ActivityMeta = {
  eyebrow: string;
  label: string;
  shortLabel: string;
  learnerLabel: string;
  estimatedMinutes: number;
  completionLabel: string;
};

export const LEARN_ACTIVITY_META: Record<LearnActivityType, ActivityMeta> = {
  lesson: {
    eyebrow: "Discover",
    label: "Lesson",
    shortLabel: "Lesson",
    learnerLabel: "lesson",
    estimatedMinutes: 8,
    completionLabel: "Lesson",
  },
  practice: {
    eyebrow: "Practice",
    label: "Practice",
    shortLabel: "Practice",
    learnerLabel: "practice",
    estimatedMinutes: 10,
    completionLabel: "Practice",
  },
  game: {
    eyebrow: "Play",
    label: "Game",
    shortLabel: "Game",
    learnerLabel: "unit game",
    estimatedMinutes: 5,
    completionLabel: "Game",
  },
  speaking: {
    eyebrow: "Apply",
    label: "Speaking",
    shortLabel: "Speak",
    learnerLabel: "speaking rehearsal",
    estimatedMinutes: 7,
    completionLabel: "Speaking practice",
  },
  writing: {
    eyebrow: "Write",
    label: "Writing",
    shortLabel: "Write",
    learnerLabel: "writing response",
    estimatedMinutes: 9,
    completionLabel: "Writing task",
  },
  checkpoint: {
    eyebrow: "Check",
    label: "Checkpoint",
    shortLabel: "Check",
    learnerLabel: "checkpoint",
    estimatedMinutes: 6,
    completionLabel: "Checkpoint",
  },
};

type LearnActivityLike = {
  activityType: LearnActivityType;
  status: "locked" | "unlocked" | "completed";
  orderIndex: number;
  title: string;
  description: string;
};

type LearnUnitLike = {
  orderIndex: number;
  activities: LearnActivityLike[];
};

export function getActivityStepIndex(
  activities: LearnActivityLike[],
  activityType: LearnActivityType
) {
  const sorted = [...activities].sort((a, b) => a.orderIndex - b.orderIndex);
  const index = sorted.findIndex((activity) => activity.activityType === activityType);

  return index === -1 ? 1 : index + 1;
}

export function getCompletedActivityCount(activities: LearnActivityLike[]) {
  return activities.filter((activity) => activity.status === "completed").length;
}

export function getActivityProgressValue(
  activities: LearnActivityLike[],
  activityType: LearnActivityType
) {
  const total = Math.max(activities.length, 1);
  return Math.round((getActivityStepIndex(activities, activityType) / total) * 100);
}

export function getCurrentUnitProgressValue(unit: LearnUnitLike) {
  const total = Math.max(unit.activities.length, 1);
  return Math.round((getCompletedActivityCount(unit.activities) / total) * 100);
}

export function getRemainingMinutes(
  activities: LearnActivityLike[],
  currentActivityType: LearnActivityType
) {
  const sorted = [...activities].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentIndex = sorted.findIndex((activity) => activity.activityType === currentActivityType);

  if (currentIndex === -1) {
    return 0;
  }

  return sorted
    .slice(currentIndex)
    .reduce(
      (total, activity) =>
        total + LEARN_ACTIVITY_META[activity.activityType].estimatedMinutes,
      0
    );
}

export function getActivityPreview(
  activities: LearnActivityLike[],
  activityType: LearnActivityType
) {
  const sorted = [...activities].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentIndex = sorted.findIndex((activity) => activity.activityType === activityType);

  if (currentIndex === -1) {
    return null;
  }

  return sorted[currentIndex + 1] ?? null;
}

export function getUnitStepSummary(
  activities: LearnActivityLike[],
  activityType: LearnActivityType
) {
  const stepIndex = getActivityStepIndex(activities, activityType);
  const totalSteps = Math.max(activities.length, 1);

  return {
    stepIndex,
    totalSteps,
    label: `Step ${stepIndex} of ${totalSteps}`,
  };
}
