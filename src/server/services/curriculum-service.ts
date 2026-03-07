import { prisma } from "@/server/prisma";

import {
  type CurriculumLevel,
  type UnitActivityType,
  getLevelRank,
  normalizeLevelLabel,
} from "../curriculum-blueprint";
import { AppError, invariant } from "../errors";
import { trackEvent } from "../analytics";

type ActivityStatus = "locked" | "unlocked" | "completed";
type UnitStatus = "locked" | "unlocked" | "completed";

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
  return `/app/learn/unit/${unitSlug}/${activityType}`;
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

  await prisma.userCurriculumProgress.update({
    where: { id: existing.id },
    data: {
      isActive: true,
      archivedAt: null,
    },
  });

  return curriculum.id;
}

async function resolveCurrentLevel(userId: string): Promise<CurriculumLevel> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      reports: {
        where: {
          reportType: {
            in: ["baseline_quick", "baseline_full", "reassessment"],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const normalized = normalizeLevelLabel(user.currentLevel ?? user.reports[0]?.levelLabel);

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
  const level = await resolveCurrentLevel(userId);
  const curriculumId = await setActiveCurriculum(userId, level);

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

async function getCurriculumGraph(userId: string) {
  const { level, curriculumId } = await ensureAssignedProgress(userId);

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
      userProgress: {
        where: { userId, isActive: false },
        include: {
          curriculum: true,
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

  const archivedCurricula = await prisma.userCurriculumProgress.findMany({
    where: {
      userId,
      isActive: false,
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

  return {
    level,
    curriculum: {
      id: curriculum.id,
      title: curriculum.title,
      description: curriculum.description,
      targetLanguage: curriculum.targetLanguage,
    },
    units,
    currentUnit: current.unit,
    currentActivity: current.activity,
    archivedCurricula: archivedCurricula.map((entry) => {
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
    }),
  } satisfies AssignedCurriculumView;
}

function nextActivityForUnit(unit: {
  activities: Array<{
    id: string;
    orderIndex: number;
    activityType: string;
    title: string;
    description: string;
  }>;
}, currentActivityId: string) {
  const ordered = [...unit.activities].sort((a, b) => a.orderIndex - b.orderIndex);
  const index = ordered.findIndex((activity) => activity.id === currentActivityId);
  if (index === -1) {
    return null;
  }

  return ordered[index + 1] ?? null;
}

function nextUnitForCurriculum(units: Array<{ id: string; orderIndex: number }>, currentUnitId: string) {
  const ordered = [...units].sort((a, b) => a.orderIndex - b.orderIndex);
  const index = ordered.findIndex((unit) => unit.id === currentUnitId);
  if (index === -1) {
    return null;
  }

  return ordered[index + 1] ?? null;
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
    const unit = curriculum.units.find((entry) => entry.slug === unitSlug);

    if (!unit) {
      throw new AppError("NOT_FOUND", "Curriculum unit not found.", 404);
    }

    if (unit.status === "locked") {
      throw new AppError("UNIT_LOCKED", "Complete the current unit first.", 403);
    }

    return {
      curriculum,
      unit,
    };
  },

  async getUnitActivity(userId: string, unitSlug: string, activityType: UnitActivityType) {
    const { curriculum, unit } = await this.getUnit(userId, unitSlug);
    const activity = unit.activities.find((entry) => entry.activityType === activityType);

    if (!activity) {
      throw new AppError("NOT_FOUND", "Unit activity not found.", 404);
    }

    if (activity.status === "locked") {
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

    const unitProgress = await prisma.userUnitProgress.findUniqueOrThrow({
      where: {
        userId_unitId: {
          userId,
          unitId: dbUnit.id,
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

    invariant(
      activityProgress.status !== "locked",
      "ACTIVITY_LOCKED",
      "Complete earlier unit steps first.",
      403
    );

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

    const nextActivity = nextActivityForUnit(dbUnit, unitData.activity.id);

    if (nextActivity) {
      await prisma.userUnitActivityProgress.update({
        where: {
          userId_activityId: {
            userId,
            activityId: nextActivity.id,
          },
        },
        data: {
          status: "unlocked",
        },
      });
    }

    const remainingRequired = await prisma.userUnitActivityProgress.count({
      where: {
        unitProgressId: unitProgress.id,
        status: { not: "completed" },
      },
    });

    let nextActionHref = activityHref(unitSlug, activityType);
    let unitCompleted = false;
    let nextAction: UnitActivityCompletionResult["nextAction"] = {
      href: nextActionHref,
      label: "Return to Learn",
      title: "Return to your roadmap",
      description: "Review your curriculum roadmap and choose your next step.",
      unitTitle: unitData.unit.title,
      activityType: null,
      stepIndex: null,
      totalSteps: null,
    };

    if (remainingRequired === 0) {
      unitCompleted = true;

      await prisma.userUnitProgress.update({
        where: { id: unitProgress.id },
        data: {
          status: "completed",
          completedAt: now,
        },
      });

      await trackEvent({
        eventName: "unit_completed",
        route: `/app/learn/unit/${unitSlug}`,
        userId,
        properties: {
          unit_slug: unitSlug,
        },
      });

      const nextUnit = nextUnitForCurriculum(dbUnit.curriculum.units, dbUnit.id);

      if (nextUnit) {
        const nextUnitRecord = await prisma.curriculumUnit.findUniqueOrThrow({
          where: { id: nextUnit.id },
          include: {
            activities: {
              orderBy: { orderIndex: "asc" },
            },
          },
        });

        await prisma.userUnitProgress.update({
          where: {
            userId_unitId: {
              userId,
              unitId: nextUnit.id,
            },
          },
          data: {
            status: "unlocked",
            unlockedAt: now,
          },
        });

        const nextUnitFirstActivity = nextUnitRecord.activities[0];

        if (nextUnitFirstActivity) {
          await prisma.userUnitActivityProgress.update({
            where: {
              userId_activityId: {
                userId,
                activityId: nextUnitFirstActivity.id,
              },
            },
            data: {
              status: "unlocked",
            },
          });

          nextActionHref = activityHref(
            nextUnitRecord.slug,
            nextUnitFirstActivity.activityType
          );
          nextAction = {
            href: nextActionHref,
            label: "Start next unit",
            title: nextUnitFirstActivity.title,
            description: `${nextUnitRecord.title} is now unlocked and ready to begin.`,
            unitTitle: nextUnitRecord.title,
            activityType: nextUnitFirstActivity.activityType as UnitActivityType,
            stepIndex: nextUnitFirstActivity.orderIndex,
            totalSteps: nextUnitRecord.activities.length,
          };
        } else {
          nextActionHref = "/app/learn";
        }

        await prisma.userCurriculumProgress.updateMany({
          where: {
            userId,
            curriculumId: dbUnit.curriculum.id,
            isActive: true,
          },
          data: {
            currentUnitId: nextUnit.id,
          },
        });
      } else {
        await prisma.userCurriculumProgress.updateMany({
          where: {
            userId,
            curriculumId: dbUnit.curriculum.id,
            isActive: true,
          },
          data: {
            completedAt: now,
            currentUnitId: dbUnit.id,
          },
        });

        nextActionHref = "/app/learn";
        nextAction = {
          href: nextActionHref,
          label: "Return to Learn",
          title: "Curriculum milestone complete",
          description:
            "You have completed every required unit in your active curriculum. Review your roadmap while you wait for reassessment.",
          unitTitle: unitData.unit.title,
          activityType: null,
          stepIndex: null,
          totalSteps: null,
        };
      }
    } else if (nextActivity) {
      nextActionHref = activityHref(unitSlug, nextActivity.activityType);
      nextAction = {
        href: nextActionHref,
        label: `Continue to ${nextActivity.activityType}`,
        title: nextActivity.title,
        description: nextActivity.description,
        unitTitle: unitData.unit.title,
        activityType: nextActivity.activityType as UnitActivityType,
        stepIndex: nextActivity.orderIndex,
        totalSteps: dbUnit.activities.length,
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
        currentLevel: await resolveCurrentLevel(userId),
      };
    }

    const currentLevel = await resolveCurrentLevel(userId);
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
