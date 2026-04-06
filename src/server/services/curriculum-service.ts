import { prisma } from "@/server/prisma";
import { getAdminPreviewLevel, isAdminUserId } from "@/server/auth";
import type { CurriculumLevel } from "@/server/curriculum-levels";

import {
  type UnitActivityType,
  getLevelRank,
  normalizeLevelLabel,
} from "../curriculum-meta";
import { AppError, invariant } from "../errors";
import { trackEvent } from "../analytics";

type ActivityStatus = "locked" | "unlocked" | "completed";
type UnitStatus = "locked" | "unlocked" | "completed";

function determineGameCompletionPath(responsePayload: Record<string, unknown> | undefined) {
  const review = responsePayload?.gameReview as
    | {
        stages?: Array<{
          resolvedInputMode?: "voice" | "fallback" | null;
          completionPath?: "structural" | "arcade" | "voice" | "fallback" | "mixed";
        }>;
      }
    | undefined;
  const completionModes = new Set(
    (review?.stages ?? [])
      .map((stage) => stage.completionPath ?? stage.resolvedInputMode ?? "structural")
      .filter(Boolean)
  );

  if (completionModes.has("mixed")) {
    return "mixed";
  }

  if (completionModes.has("voice") && completionModes.has("fallback")) {
    return "mixed";
  }

  if (completionModes.has("voice")) {
    return "voice";
  }

  if (completionModes.has("fallback")) {
    return "fallback";
  }

  if (completionModes.has("arcade")) {
    return "arcade";
  }

  return "structural";
}

function summarizeGameReviewAnalytics(
  gamePayload: Record<string, unknown>,
  responsePayload: Record<string, unknown> | undefined
) {
  const review = responsePayload?.gameReview as
    | {
        stages?: Array<{
          stageId?: string;
          outcome?: string;
        interactionModel?: string;
        retryCount?: number;
        muteEnabled?: boolean;
        nearMiss?: boolean;
        combo?: number;
        livesRemaining?: number;
        stageResult?: string;
          resolvedInputMode?: "voice" | "fallback" | null;
          completionPath?: "structural" | "arcade" | "voice" | "fallback" | "mixed";
        }>;
      }
    | undefined;
  const payloadStages = Array.isArray(gamePayload.stages)
    ? (gamePayload.stages as Array<Record<string, unknown>>)
    : [];
  const livesByStageId = new Map(
    payloadStages
      .filter((stage) => typeof stage.id === "string" && typeof stage.lives === "number")
      .map((stage) => [String(stage.id), Number(stage.lives)])
  );

  return {
    interactionModel: (() => {
      const models = new Set(
        (review?.stages ?? [])
          .map((stage) => (typeof stage.interactionModel === "string" ? stage.interactionModel : null))
          .filter((value): value is string => Boolean(value))
      );

      if (models.size === 0) {
        payloadStages.forEach((stage) => {
          if (typeof stage.interactionModel === "string") {
            models.add(String(stage.interactionModel));
          }
        });
      }

      if (models.size === 0) {
        return "structural";
      }

      return models.size === 1 ? Array.from(models)[0] : "mixed";
    })(),
    surfaceFamily: (() => {
      const stageKinds = new Set(
        payloadStages
          .map((stage) => (typeof stage.kind === "string" ? String(stage.kind) : null))
          .filter((value): value is string => Boolean(value))
      );

      if (
        Array.from(stageKinds).some((kind) =>
          ["lane_runner", "sort_rush", "route_race", "reaction_pick", "voice_burst"].includes(kind)
        )
      ) {
        return "arcade";
      }

      return "structured";
    })(),
    comboPeak: (review?.stages ?? []).reduce((peak, stage) => {
      const combo = typeof stage.combo === "number" ? Number(stage.combo) : 0;
      return Math.max(peak, combo);
    }, 0),
    retryCount: (review?.stages ?? []).reduce((count, stage) => {
      return count + (typeof stage.retryCount === "number" ? Number(stage.retryCount) : 0);
    }, 0),
    livesLost: (review?.stages ?? []).reduce((total, stage) => {
      const stageId = typeof stage.stageId === "string" ? String(stage.stageId) : "";
      const startingLives = livesByStageId.get(stageId);
      const livesRemaining =
        typeof stage.livesRemaining === "number" ? Number(stage.livesRemaining) : undefined;

      if (startingLives === undefined || livesRemaining === undefined) {
        return total;
      }

      return total + Math.max(0, startingLives - livesRemaining);
    }, 0),
    failCount: (review?.stages ?? []).reduce((count, stage) => {
      return count + (stage.stageResult === "retry" || stage.outcome === "practice_more" ? 1 : 0);
    }, 0),
    voiceUsed: (review?.stages ?? []).some(
      (stage) =>
        stage.resolvedInputMode === "voice" ||
        stage.completionPath === "voice" ||
        stage.completionPath === "mixed"
    ),
    nearMiss: (review?.stages ?? []).some((stage) => stage.nearMiss === true),
    muteEnabled: (review?.stages ?? []).some((stage) => stage.muteEnabled === true),
    audioEnabled: !(review?.stages ?? []).some((stage) => stage.muteEnabled === true),
    answerRevealMode: (() => {
      const revealModes = new Set(
        payloadStages
          .map((stage) => {
            const presentation =
              stage.presentation && typeof stage.presentation === "object"
                ? (stage.presentation as Record<string, unknown>)
                : null;
            return typeof presentation?.answerRevealMode === "string"
              ? String(presentation.answerRevealMode)
              : null;
          })
          .filter((value): value is string => Boolean(value))
      );

      if (revealModes.size === 0) {
        return "preanswer";
      }

      return revealModes.size === 1 ? Array.from(revealModes)[0] : "mixed";
    })(),
    ambientSet:
      typeof gamePayload.ambientSet === "string" ? String(gamePayload.ambientSet) : "neutral",
    celebrationVariant:
      typeof gamePayload.celebrationVariant === "string"
        ? String(gamePayload.celebrationVariant)
        : "structured_glow",
  };
}

export type CurriculumActivityView = {
  id: string;
  activityType: UnitActivityType;
  title: string;
  description: string;
  orderIndex: number;
  status: ActivityStatus;
  href: string;
  isCurrent: boolean;
  contentItemId: string | null;
  payload: Record<string, unknown>;
  completedAt: string | null;
};

export type CurriculumUnitView = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  canDoStatement: string;
  theme: string;
  performanceTask: string;
  keyVocabulary: string[];
  languageFocus: string[];
  orderIndex: number;
  status: UnitStatus;
  href: string;
  unlockedAt: string | null;
  completedAt: string | null;
  activities: CurriculumActivityView[];
};

export type AssignedCurriculumView = {
  level: CurriculumLevel;
  curriculum: {
    id: string;
    title: string;
    description: string;
    targetLanguage: string;
  };
  currentUnit: CurriculumUnitView | null;
  currentActivity: CurriculumActivityView | null;
  units: CurriculumUnitView[];
  archivedCurricula: Array<{
    id: string;
    level: string;
    title: string;
    completedUnits: number;
    totalUnits: number;
    archivedAt: string | null;
  }>;
};

export type UnitActivityCompletionResult = {
  nextActionHref: string;
  unitCompleted: boolean;
  nextAction: {
    href: string;
    label: string;
    title: string;
    description: string;
    unitTitle: string | null;
    activityType: UnitActivityType | null;
    stepIndex: number | null;
    totalSteps: number | null;
  };
};

function activityHref(unitSlug: string, activityType: string) {
  return `/app/learn/unit/${unitSlug}/${activityType === "drill" ? "game" : activityType}`;
}

function toActivityStatus(value: string | null | undefined): ActivityStatus {
  if (value === "completed" || value === "unlocked") {
    return value;
  }

  return "locked";
}

function toUnitStatus(value: string | null | undefined): UnitStatus {
  if (value === "completed" || value === "unlocked") {
    return value;
  }

  return "locked";
}

function findNextUnitAndActivity(units: CurriculumUnitView[]) {
  for (const unit of units) {
    const activeActivity =
      unit.activities.find((activity) => activity.status === "unlocked") ??
      unit.activities.find((activity) => activity.status !== "completed");

    if (activeActivity) {
      return {
        unit,
        activity: activeActivity,
      };
    }
  }

  return {
    unit: null,
    activity: null,
  };
}

async function ensureUserActivityProgressRows(userId: string, curriculumId?: string) {
  const unitProgressRows = await prisma.userUnitProgress.findMany({
    where: {
      userId,
      ...(curriculumId ? { curriculumId } : {}),
    },
    include: {
      unit: {
        include: {
          activities: {
            orderBy: { orderIndex: "asc" },
          },
        },
      },
      activityProgress: true,
    },
  });

  for (const unitProgress of unitProgressRows) {
    for (const activity of unitProgress.unit.activities) {
      const existingProgress = unitProgress.activityProgress.find(
        (entry) => entry.activityId === activity.id
      );

      if (existingProgress) {
        continue;
      }

      await prisma.userUnitActivityProgress.upsert({
        where: {
          userId_activityId: {
            userId,
            activityId: activity.id,
          },
        },
        update: {
          unitProgressId: unitProgress.id,
        },
        create: {
          userId,
          unitProgressId: unitProgress.id,
          activityId: activity.id,
          status: "locked",
        },
      });
    }
  }
}

export async function reconcileCurriculumProgressForUser(userId: string) {
  await ensureUserActivityProgressRows(userId);

  const curriculumProgressRows = await prisma.userCurriculumProgress.findMany({
    where: { userId },
    orderBy: { startedAt: "asc" },
  });

  for (const curriculumProgress of curriculumProgressRows) {
    const unitProgressRows = await prisma.userUnitProgress.findMany({
      where: {
        userId,
        curriculumId: curriculumProgress.curriculumId,
      },
      include: {
        unit: {
          include: {
            activities: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        activityProgress: true,
      },
    });

    const orderedUnits = unitProgressRows
      .slice()
      .sort((left, right) => left.unit.orderIndex - right.unit.orderIndex);

    const firstIncompleteUnit = orderedUnits.find((unitProgress) =>
      unitProgress.unit.activities.some((activity) => {
        const activityProgress = unitProgress.activityProgress.find(
          (entry) => entry.activityId === activity.id
        );

        return activityProgress?.status !== "completed";
      })
    );

    const firstIncompleteActivityId =
      firstIncompleteUnit?.unit.activities.find((activity) => {
        const activityProgress = firstIncompleteUnit.activityProgress.find(
          (entry) => entry.activityId === activity.id
        );

        return activityProgress?.status !== "completed";
      })?.id ?? null;

    for (const unitProgress of orderedUnits) {
      const allActivitiesCompleted = unitProgress.unit.activities.every((activity) => {
        const activityProgress = unitProgress.activityProgress.find(
          (entry) => entry.activityId === activity.id
        );

        return activityProgress?.status === "completed";
      });

      const desiredUnitStatus: UnitStatus = allActivitiesCompleted
        ? "completed"
        : firstIncompleteUnit?.id === unitProgress.id
          ? "unlocked"
          : "locked";

      await prisma.userUnitProgress.update({
        where: { id: unitProgress.id },
        data: {
          status: desiredUnitStatus,
          unlockedAt:
            desiredUnitStatus === "locked" ? null : unitProgress.unlockedAt ?? new Date(),
          completedAt:
            desiredUnitStatus === "completed"
              ? unitProgress.completedAt ?? new Date()
              : null,
        },
      });

      for (const activity of unitProgress.unit.activities) {
        const activityProgress = unitProgress.activityProgress.find(
          (entry) => entry.activityId === activity.id
        );

        if (!activityProgress) {
          continue;
        }

        const desiredActivityStatus: ActivityStatus =
          activityProgress.status === "completed"
            ? "completed"
            : activity.id === firstIncompleteActivityId
              ? "unlocked"
              : "locked";

        if (activityProgress.status === desiredActivityStatus) {
          continue;
        }

        await prisma.userUnitActivityProgress.update({
          where: { id: activityProgress.id },
          data: {
            status: desiredActivityStatus,
          },
        });
      }
    }

    const lastUnit = orderedUnits.at(-1);

    await prisma.userCurriculumProgress.update({
      where: { id: curriculumProgress.id },
      data: {
        currentUnitId: firstIncompleteUnit?.unitId ?? lastUnit?.unitId ?? null,
        completedAt:
          firstIncompleteUnit === undefined
            ? curriculumProgress.completedAt ?? new Date()
            : null,
      },
    });
  }
}

async function createProgressRecords(userId: string, curriculumId: string) {
  const curriculum = await prisma.curriculum.findUniqueOrThrow({
    where: { id: curriculumId },
    include: {
      units: {
        include: {
          activities: {
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  const firstUnit = curriculum.units[0];

  await prisma.userCurriculumProgress.upsert({
    where: {
      userId_curriculumId: {
        userId,
        curriculumId,
      },
    },
    update: {
      isActive: true,
      archivedAt: null,
      currentUnitId: firstUnit?.id ?? null,
    },
    create: {
      userId,
      curriculumId,
      isActive: true,
      currentUnitId: firstUnit?.id ?? null,
    },
  });

  for (const unit of curriculum.units) {
    const unitStatus: UnitStatus = unit.id === firstUnit?.id ? "unlocked" : "locked";

    await prisma.userUnitProgress.upsert({
      where: {
        userId_unitId: {
          userId,
          unitId: unit.id,
        },
      },
      update: {
        curriculumId,
        status: unitStatus,
        unlockedAt: unit.id === firstUnit?.id ? new Date() : null,
      },
      create: {
        userId,
        curriculumId,
        unitId: unit.id,
        status: unitStatus,
        unlockedAt: unit.id === firstUnit?.id ? new Date() : null,
      },
    });

    const unitProgress = await prisma.userUnitProgress.findUniqueOrThrow({
      where: {
        userId_unitId: {
          userId,
          unitId: unit.id,
        },
      },
    });

    const firstActivity = unit.activities[0];

    for (const activity of unit.activities) {
      const status: ActivityStatus =
        unit.id === firstUnit?.id && activity.id === firstActivity?.id ? "unlocked" : "locked";

      await prisma.userUnitActivityProgress.upsert({
        where: {
          userId_activityId: {
            userId,
            activityId: activity.id,
          },
        },
        update: {
          unitProgressId: unitProgress.id,
          status,
        },
        create: {
          userId,
          unitProgressId: unitProgress.id,
          activityId: activity.id,
          status,
        },
      });
    }
  }
}

async function setActiveCurriculum(userId: string, targetLevel: CurriculumLevel) {
  const curriculum = await prisma.curriculum.findFirstOrThrow({
    where: {
      level: targetLevel,
      targetLanguage: "english",
      active: true,
    },
    select: {
      id: true,
    },
  });

  await prisma.userCurriculumProgress.updateMany({
    where: {
      userId,
      isActive: true,
      curriculumId: { not: curriculum.id },
    },
    data: {
      isActive: false,
      archivedAt: new Date(),
    },
  });

  const existing = await prisma.userCurriculumProgress.findUnique({
    where: {
      userId_curriculumId: {
        userId,
        curriculumId: curriculum.id,
      },
    },
  });

  if (!existing) {
    await createProgressRecords(userId, curriculum.id);
    return curriculum.id;
  }

  if (existing.isActive && existing.archivedAt === null) {
    return curriculum.id;
  }

  await prisma.userCurriculumProgress.update({
    where: { id: existing.id },
    data: {
      isActive: true,
      archivedAt: null,
    },
  });

  return curriculum.id;
}

async function resolveCanonicalCurrentLevel(userId: string): Promise<CurriculumLevel> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      currentLevel: true,
    },
  });

  if (user.currentLevel && user.currentLevel !== "foundation") {
    return normalizeLevelLabel(user.currentLevel);
  }

  const latestReport = await prisma.report.findFirst({
    where: {
      userId,
      reportType: {
        in: ["baseline_quick", "baseline_full", "reassessment"],
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      levelLabel: true,
    },
  });

  const normalized = normalizeLevelLabel(user.currentLevel ?? latestReport?.levelLabel);

  if (user.currentLevel !== normalized) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentLevel: normalized,
      },
    });
  }

  return normalized;
}

async function ensureAssignedProgress(userId: string) {
  const level = await resolveCanonicalCurrentLevel(userId);
  const curriculumId = await setActiveCurriculum(userId, level);
  await ensureUserActivityProgressRows(userId, curriculumId);

  const activeProgress = await prisma.userCurriculumProgress.findUniqueOrThrow({
    where: {
      userId_curriculumId: {
        userId,
        curriculumId,
      },
    },
  });

  return {
    level,
    curriculumId,
    activeProgressId: activeProgress.id,
  };
}

async function ensurePreviewCurriculumProgress(userId: string, curriculumId: string) {
  const curriculum = await prisma.curriculum.findUniqueOrThrow({
    where: { id: curriculumId },
    include: {
      units: {
        orderBy: { orderIndex: "asc" },
        include: {
          activities: {
            orderBy: { orderIndex: "asc" },
          },
          userProgress: {
            where: { userId },
            include: {
              activityProgress: {
                where: { userId },
              },
            },
          },
        },
      },
    },
  });

  const firstUnit = curriculum.units[0];

  await prisma.userCurriculumProgress.upsert({
    where: {
      userId_curriculumId: {
        userId,
        curriculumId,
      },
    },
    update: {},
    create: {
      userId,
      curriculumId,
      isActive: false,
      currentUnitId: firstUnit?.id ?? null,
      archivedAt: null,
    },
  });

  for (const unit of curriculum.units) {
    const isFirstUnit = unit.id === firstUnit?.id;
    const unitProgress = await prisma.userUnitProgress.upsert({
      where: {
        userId_unitId: {
          userId,
          unitId: unit.id,
        },
      },
      update: {
        curriculumId,
      },
      create: {
        userId,
        curriculumId,
        unitId: unit.id,
        status: isFirstUnit ? "unlocked" : "locked",
        unlockedAt: isFirstUnit ? new Date() : null,
      },
    });

    const firstActivity = unit.activities[0];

    for (const activity of unit.activities) {
      const isFirstActivity = isFirstUnit && activity.id === firstActivity?.id;
      await prisma.userUnitActivityProgress.upsert({
        where: {
          userId_activityId: {
            userId,
            activityId: activity.id,
          },
        },
        update: {
          unitProgressId: unitProgress.id,
        },
        create: {
          userId,
          unitProgressId: unitProgress.id,
          activityId: activity.id,
          status: isFirstActivity ? "unlocked" : "locked",
        },
      });
    }
  }
}

async function getArchivedCurriculaForUser(userId: string) {
  const archivedCurricula = await prisma.userCurriculumProgress.findMany({
    where: {
      userId,
      isActive: false,
      archivedAt: { not: null },
    },
    include: {
      curriculum: {
        include: {
          units: {
            include: {
              userProgress: {
                where: { userId },
              },
            },
          },
        },
      },
    },
    orderBy: { archivedAt: "desc" },
  });

  return archivedCurricula.map((entry) => {
    const completedUnits = entry.curriculum.units.filter(
      (unit) => unit.userProgress[0]?.status === "completed"
    ).length;

    return {
      id: entry.id,
      level: entry.curriculum.level,
      title: entry.curriculum.title,
      completedUnits,
      totalUnits: entry.curriculum.units.length,
      archivedAt: entry.archivedAt?.toISOString() ?? null,
    };
  });
}

async function buildCurriculumGraphForCurriculumId(
  userId: string,
  curriculumId: string,
  options?: {
    level?: CurriculumLevel;
    includeArchived?: boolean;
  }
) {
  const curriculum = await prisma.curriculum.findUniqueOrThrow({
    where: { id: curriculumId },
    include: {
      units: {
        orderBy: { orderIndex: "asc" },
        include: {
          activities: {
            orderBy: { orderIndex: "asc" },
          },
          userProgress: {
            where: { userId },
            include: {
              activityProgress: {
                where: { userId },
              },
            },
          },
        },
      },
    },
  });

  const units: CurriculumUnitView[] = curriculum.units.map((unit) => {
    const userProgress = unit.userProgress[0];
    const activities: CurriculumActivityView[] = unit.activities.map((activity) => {
      const progress = userProgress?.activityProgress.find(
        (item) => item.activityId === activity.id
      );

      return {
        id: activity.id,
        activityType: activity.activityType as UnitActivityType,
        title: activity.title,
        description: activity.description,
        orderIndex: activity.orderIndex,
        status: toActivityStatus(progress?.status),
        href: activityHref(unit.slug, activity.activityType),
        isCurrent: progress?.status === "unlocked",
        contentItemId: activity.contentItemId,
        payload: (activity.activityPayload ?? {}) as Record<string, unknown>,
        completedAt: progress?.completedAt?.toISOString() ?? null,
      };
    });

    return {
      id: unit.id,
      slug: unit.slug,
      title: unit.title,
      summary: unit.summary,
      canDoStatement: unit.canDoStatement,
      theme: unit.theme,
      performanceTask: unit.performanceTask,
      keyVocabulary: Array.isArray(unit.keyVocabulary) ? unit.keyVocabulary.map(String) : [],
      languageFocus: Array.isArray(unit.languageFocus) ? unit.languageFocus.map(String) : [],
      orderIndex: unit.orderIndex,
      status: toUnitStatus(userProgress?.status),
      href: `/app/learn/unit/${unit.slug}`,
      unlockedAt: userProgress?.unlockedAt?.toISOString() ?? null,
      completedAt: userProgress?.completedAt?.toISOString() ?? null,
      activities,
    };
  });

  const current = findNextUnitAndActivity(units);
  const archivedCurricula = options?.includeArchived === false ? [] : await getArchivedCurriculaForUser(userId);

  return {
    level: options?.level ?? normalizeLevelLabel(curriculum.level),
    curriculum: {
      id: curriculum.id,
      title: curriculum.title,
      description: curriculum.description,
      targetLanguage: curriculum.targetLanguage,
    },
    units,
    currentUnit: current.unit,
    currentActivity: current.activity,
    archivedCurricula,
  } satisfies AssignedCurriculumView;
}

async function getCurriculumGraph(userId: string) {
  const previewLevel = await getAdminPreviewLevel(userId);

  if (previewLevel) {
    const previewCurriculum = await prisma.curriculum.findFirstOrThrow({
      where: {
        active: true,
        targetLanguage: "english",
        level: previewLevel,
      },
      select: {
        id: true,
      },
    });

    await ensurePreviewCurriculumProgress(userId, previewCurriculum.id);

    return buildCurriculumGraphForCurriculumId(userId, previewCurriculum.id, {
      level: previewLevel,
      includeArchived: false,
    });
  }

  const { level, curriculumId } = await ensureAssignedProgress(userId);
  return buildCurriculumGraphForCurriculumId(userId, curriculumId, { level });
}
export const CurriculumService = {
  async getAssignedCurriculum(userId: string) {
    return getCurriculumGraph(userId);
  },

  async getNextLearningAction(userId: string) {
    const curriculum = await getCurriculumGraph(userId);
    const unit = curriculum.currentUnit;
    const activity = curriculum.currentActivity;

    if (!unit || !activity) {
      return {
        title: "Review your completed curriculum",
        targetUrl: "/app/learn",
        reason: "You have completed every required activity in your active curriculum.",
        unitId: null,
        activityId: null,
      };
    }

    return {
      title: `Continue ${unit.title}`,
      targetUrl: activity.href,
      reason: `${activity.title} is the next required step in your ${curriculum.level.replaceAll("_", " ")} curriculum.`,
      unitId: unit.id,
      activityId: activity.id,
    };
  },

  async getUnit(userId: string, unitSlug: string) {
    const curriculum = await getCurriculumGraph(userId);
    const admin = await isAdminUserId(userId);
    const unit = curriculum.units.find((entry) => entry.slug === unitSlug);

    if (unit) {
      if (unit.status === "locked" && !admin) {
        throw new AppError("UNIT_LOCKED", "Complete the current unit first.", 403);
      }

      return {
        curriculum,
        unit,
      };
    }

    if (!admin) {
      throw new AppError("NOT_FOUND", "Curriculum unit not found.", 404);
    }

    const previewUnit = await prisma.curriculumUnit.findFirst({
      where: { slug: unitSlug },
      select: {
        curriculumId: true,
      },
    });

    if (!previewUnit) {
      throw new AppError("NOT_FOUND", "Curriculum unit not found.", 404);
    }

    await ensurePreviewCurriculumProgress(userId, previewUnit.curriculumId);

    const previewCurriculum = await buildCurriculumGraphForCurriculumId(
      userId,
      previewUnit.curriculumId,
      { includeArchived: false }
    );
    const previewUnitView = previewCurriculum.units.find((entry) => entry.slug === unitSlug);

    if (!previewUnitView) {
      throw new AppError("NOT_FOUND", "Curriculum unit not found.", 404);
    }

    return {
      curriculum: previewCurriculum,
      unit: previewUnitView,
    };
  },

  async getUnitActivity(userId: string, unitSlug: string, activityType: UnitActivityType) {
    const admin = await isAdminUserId(userId);
    const { curriculum, unit } = await this.getUnit(userId, unitSlug);
    const activity = unit.activities.find((entry) => entry.activityType === activityType);

    if (!activity) {
      throw new AppError("NOT_FOUND", "Unit activity not found.", 404);
    }

    if (activity.status === "locked" && !admin) {
      throw new AppError("ACTIVITY_LOCKED", "Complete earlier unit steps first.", 403);
    }

    return {
      curriculum,
      unit,
      activity,
    };
  },

  async completeUnitActivity({
    userId,
    unitSlug,
    activityType,
    score,
    responsePayload,
  }: {
    userId: string;
    unitSlug: string;
    activityType: UnitActivityType;
    score: number;
    responsePayload?: Record<string, unknown>;
  }): Promise<UnitActivityCompletionResult> {
    const unitData = await this.getUnitActivity(userId, unitSlug, activityType);
    const admin = await isAdminUserId(userId);

    const dbUnit = await prisma.curriculumUnit.findUniqueOrThrow({
      where: { id: unitData.unit.id },
      include: {
        activities: {
          orderBy: { orderIndex: "asc" },
        },
        curriculum: {
          include: {
            units: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
      },
    });

    const activityProgress = await prisma.userUnitActivityProgress.findUniqueOrThrow({
      where: {
        userId_activityId: {
          userId,
          activityId: unitData.activity.id,
        },
      },
    });

    if (!admin) {
      invariant(
        activityProgress.status !== "locked",
        "ACTIVITY_LOCKED",
        "Complete earlier unit steps first.",
        403
      );
    }

    const now = new Date();

    await prisma.userUnitActivityProgress.update({
      where: { id: activityProgress.id },
      data: {
        status: "completed",
        score,
        responsePayload: (responsePayload ?? {}) as never,
        completedAt: now,
      },
    });

    await prisma.activityAttempt.create({
      data: {
        userId,
        activityType,
        contentId: unitData.activity.contentItemId,
        score,
        status: "completed",
        completedAt: now,
        metadata: {
          curriculumUnitId: dbUnit.id,
          curriculumUnitSlug: dbUnit.slug,
          curriculumActivityId: unitData.activity.id,
          curriculumActivityType: activityType,
        } as never,
      },
    });

    await trackEvent({
      eventName: "unit_activity_completed",
      route: activityHref(unitSlug, activityType),
      userId,
      properties: {
        unit_slug: unitSlug,
        activity_type: activityType,
        score,
      },
    });

    if (activityType === "game") {
      const gamePayload = unitData.activity.payload as Record<string, unknown>;
      const gameAnalytics = summarizeGameReviewAnalytics(gamePayload, responsePayload);
      await trackEvent({
        eventName: "learn_game_completed",
        route: activityHref(unitSlug, activityType),
        userId,
        properties: {
          unit_slug: unitSlug,
          score,
          game_kind:
            typeof gamePayload.gameKind === "string" ? gamePayload.gameKind : "unit_challenge",
          layout_variant:
            typeof gamePayload.layoutVariant === "string"
              ? gamePayload.layoutVariant
              : "generic",
          interaction_model: gameAnalytics.interactionModel,
          surface_family: gameAnalytics.surfaceFamily,
          completion_path: determineGameCompletionPath(responsePayload),
          combo_peak: gameAnalytics.comboPeak,
          lives_lost: gameAnalytics.livesLost,
          fail_count: gameAnalytics.failCount,
          retry_count: gameAnalytics.retryCount,
          near_miss: gameAnalytics.nearMiss,
          answer_reveal_mode: gameAnalytics.answerRevealMode,
          ambient_set: gameAnalytics.ambientSet,
          voice_used: gameAnalytics.voiceUsed,
          mute_enabled: gameAnalytics.muteEnabled,
          audio_enabled: gameAnalytics.audioEnabled,
          celebration_variant: gameAnalytics.celebrationVariant,
        },
      });
    }

    const remainingRequired = await prisma.userUnitActivityProgress.count({
      where: {
        unitProgressId: activityProgress.unitProgressId,
        status: { not: "completed" },
      },
    });

    let unitCompleted = false;

    if (remainingRequired === 0) {
      unitCompleted = true;

      await trackEvent({
        eventName: "unit_completed",
        route: `/app/learn/unit/${unitSlug}`,
        userId,
        properties: {
          unit_slug: unitSlug,
        },
      });
    }

    await reconcileCurriculumProgressForUser(userId);

    const refreshed =
      unitData.curriculum.curriculum.id === (await getCurriculumGraph(userId)).curriculum.id
        ? await getCurriculumGraph(userId)
        : await buildCurriculumGraphForCurriculumId(userId, unitData.curriculum.curriculum.id, {
            includeArchived: false,
          });
    const nextUnit = refreshed.currentUnit;
    const nextActivity = refreshed.currentActivity;
    const nextActionHref = nextActivity?.href ?? "/app/learn";

    let nextAction: UnitActivityCompletionResult["nextAction"];

    if (!nextUnit || !nextActivity) {
      nextAction = {
        href: "/app/learn/roadmap",
        label: "View roadmap",
        title: "Curriculum milestone complete",
        description:
          "You have completed every required unit in your active curriculum. Review your roadmap while you wait for reassessment.",
        unitTitle: unitData.unit.title,
        activityType: null,
        stepIndex: null,
        totalSteps: null,
      };
    } else if (unitCompleted && nextUnit.slug !== unitSlug) {
      nextAction = {
        href: nextActionHref,
        label: "Start next unit",
        title: nextActivity.title,
        description: `${nextUnit.title} is now unlocked and ready to begin.`,
        unitTitle: nextUnit.title,
        activityType: nextActivity.activityType,
        stepIndex: nextActivity.orderIndex,
        totalSteps: nextUnit.activities.length,
      };
    } else {
      nextAction = {
        href: nextActionHref,
        label: `Continue to ${nextActivity.activityType}`,
        title: nextActivity.title,
        description: nextActivity.description,
        unitTitle: nextUnit.title,
        activityType: nextActivity.activityType,
        stepIndex: nextActivity.orderIndex,
        totalSteps: nextUnit.activities.length,
      };
    }

    return {
      nextActionHref,
      unitCompleted,
      nextAction,
    };
  },

  async syncLevelFromReport({
    userId,
    reportType,
    levelLabel,
  }: {
    userId: string;
    reportType: string;
    levelLabel: string;
  }) {
    if (!["baseline_quick", "baseline_full", "reassessment"].includes(reportType)) {
      return {
        promoted: false,
        currentLevel: await resolveCanonicalCurrentLevel(userId),
      };
    }

    const currentLevel = await resolveCanonicalCurrentLevel(userId);
    const incomingLevel = normalizeLevelLabel(levelLabel);

    if (getLevelRank(incomingLevel) <= getLevelRank(currentLevel)) {
      return {
        promoted: false,
        currentLevel,
      };
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        currentLevel: incomingLevel,
      },
    });

    await setActiveCurriculum(userId, incomingLevel);

    await trackEvent({
      eventName: "curriculum_level_promoted",
      route: "/app/progress",
      userId,
      properties: {
        previous_level: currentLevel,
        new_level: incomingLevel,
      },
    });

    return {
      promoted: true,
      currentLevel: incomingLevel,
    };
  },
};
