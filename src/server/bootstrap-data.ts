import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/prisma";
import { reconcileCurriculumProgressForUser } from "@/server/services/curriculum-service";

import {
  CURRICULUM_BLUEPRINTS,
  getActivityId,
  getCurriculumId,
  getLessonContentId,
  getPracticeContentId,
  getUnitId,
  normalizeLevelLabel,
} from "./curriculum-blueprint";

const LEGACY_CONTENT_ITEMS: Prisma.ContentItemCreateInput[] = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    sourceType: "teacher_provided",
    contentType: "lesson",
    title: "Preterite Core Practice",
    description: "Teacher-aligned lesson for narration in the past tense.",
    targetLanguage: "spanish",
    skillTags: ["grammar", "reading"],
    topicTags: ["preterite", "chapter 3 vocabulary"],
    difficultyBand: "intermediate",
    status: "published",
    publishedAt: new Date("2026-03-05T00:00:00.000Z"),
    assets: {
      create: [
        {
          assetType: "text",
          textPayload: {
            sections: [
              {
                title: "When to use the preterite",
                body: "Use the preterite for completed actions in the past.",
              },
              {
                title: "Signal words",
                body: "Ayer, anoche, una vez, de repente.",
              },
            ],
            checks: [
              {
                prompt: "Choose the best sentence for a completed action.",
                options: ["Yo estudiaba ayer.", "Yo estudie ayer."],
                correctIndex: 1,
              },
              {
                prompt: "What clue helps you choose the preterite?",
                options: ["An action in progress", "A finished event"],
                correctIndex: 1,
              },
            ],
          },
          metadataPayload: {
            nextWorksheetId: "11111111-1111-1111-1111-111111111102",
            targetStarterKey: "today",
          },
        },
      ],
    },
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
    sourceType: "teacher_provided",
    contentType: "worksheet",
    title: "Chapter 3 Worksheet A",
    description: "Applied practice that follows the lesson.",
    targetLanguage: "spanish",
    skillTags: ["grammar", "writing"],
    topicTags: ["preterite", "chapter 3 vocabulary"],
    difficultyBand: "intermediate",
    status: "published",
    publishedAt: new Date("2026-03-05T00:00:00.000Z"),
    assets: {
      create: [
        {
          assetType: "text",
          textPayload: {
            questions: [
              {
                id: "w1",
                prompt: "Complete the sentence: Ayer yo ____ al parque.",
                answer: "fui",
              },
              {
                id: "w2",
                prompt: "Write one sentence about what you did after class.",
                answer: "free_response",
              },
            ],
          },
          metadataPayload: {
            recommendedSpeakScenario: "presentation_practice",
          },
        },
      ],
    },
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    sourceType: "placeholder",
    contentType: "lesson",
    title: "Past Tense Starter",
    description: "Fallback practice when teacher-provided content is unavailable.",
    targetLanguage: "spanish",
    skillTags: ["grammar"],
    topicTags: ["preterite"],
    difficultyBand: "basic",
    status: "published",
    publishedAt: new Date("2026-03-05T00:00:00.000Z"),
    assets: {
      create: [
        {
          assetType: "text",
          textPayload: {
            sections: [
              {
                title: "Completed actions",
                body: "Use the past tense when an action is complete.",
              },
            ],
            checks: [
              {
                prompt: "Choose the completed action.",
                options: ["I was reading", "I read the chapter"],
                correctIndex: 1,
              },
            ],
          },
          metadataPayload: {},
        },
      ],
    },
  },
  {
    id: "11111111-1111-1111-1111-111111111104",
    sourceType: "placeholder",
    contentType: "lesson",
    title: "Academic Vocabulary Builder",
    description: "Daily challenge style vocabulary practice.",
    targetLanguage: "english",
    skillTags: ["vocabulary", "reading"],
    topicTags: ["daily challenge", "academic language"],
    difficultyBand: "intermediate",
    status: "published",
    publishedAt: new Date("2026-03-05T00:00:00.000Z"),
    assets: {
      create: [
        {
          assetType: "text",
          textPayload: {
            sections: [
              {
                title: "High-frequency academic verbs",
                body: "Analyze, compare, infer, justify.",
              },
            ],
            checks: [
              {
                prompt: "Which verb means to explain with evidence?",
                options: ["justify", "guess"],
                correctIndex: 0,
              },
            ],
          },
          metadataPayload: {},
        },
      ],
    },
  },
];

let bootstrapPromise: Promise<void> | null = null;
let bootstrapComplete = false;

const REQUIRED_ACTIVITY_TYPES = [
  "lesson",
  "practice",
  "game",
  "speaking",
  "writing",
  "checkpoint",
] as const;

const CURRICULUM_LEVELS = CURRICULUM_BLUEPRINTS.map((curriculum) => curriculum.level);
const EXPECTED_UNIT_COUNT = CURRICULUM_BLUEPRINTS.reduce(
  (total, curriculum) => total + curriculum.units.length,
  0
);
const EXPECTED_ACTIVITY_COUNT = EXPECTED_UNIT_COUNT * REQUIRED_ACTIVITY_TYPES.length;
const EXPECTED_CURRICULUM_CONTENT_IDS = CURRICULUM_BLUEPRINTS.flatMap((curriculum) =>
  curriculum.units.flatMap((_, index) => {
    const unitIndex = index + 1;
    return [
      getLessonContentId(curriculum.level, unitIndex),
      getPracticeContentId(curriculum.level, unitIndex),
    ];
  })
);
const EXPECTED_CONTENT_ITEM_IDS = [
  ...LEGACY_CONTENT_ITEMS.map((item) => item.id as string),
  ...EXPECTED_CURRICULUM_CONTENT_IDS,
];

function getRuntimeBootstrapMode() {
  return process.env.RUNTIME_BOOTSTRAP_MODE?.toLowerCase() ?? "auto";
}

function activityPayloadLooksCurrent(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const gamePayload = payload as {
    completionRule?: { maxRetriesPerStage?: unknown };
    stages?: Array<{ challengeProfile?: unknown; challenge?: { medalWindowAttempts?: unknown } }>;
  };

  if (!Array.isArray(gamePayload.stages) || gamePayload.stages.length === 0) {
    return false;
  }

  const retries = gamePayload.completionRule?.maxRetriesPerStage;
  if (typeof retries !== "number" || retries < 3) {
    return false;
  }

  return gamePayload.stages.every((stage) => {
    if (typeof stage.challengeProfile !== "string") {
      return false;
    }

    const medalWindowAttempts = stage.challenge?.medalWindowAttempts;
    return typeof medalWindowAttempts === "number" && medalWindowAttempts >= 3;
  });
}

async function getBootstrapStatus() {
  const mode = getRuntimeBootstrapMode();

  if (mode === "force") {
    return {
      needsCurriculumContent: true,
      needsCurricula: true,
      needsLegacyDrillBackfill: true,
      needsCurrentLevelBackfill: true,
      needsGameProgressBackfill: true,
    };
  }

  if (mode === "off") {
    return {
      needsCurriculumContent: false,
      needsCurricula: false,
      needsLegacyDrillBackfill: false,
      needsCurrentLevelBackfill: false,
      needsGameProgressBackfill: false,
    };
  }

  const [
    curriculaCount,
    unitCount,
    activityCount,
    legacyDrillCount,
    staleUserCount,
    contentItemCount,
    contentAssetCount,
    sampleGameActivity,
  ] = await Promise.all([
    prisma.curriculum.count({
      where: {
        targetLanguage: "english",
        level: { in: CURRICULUM_LEVELS },
        active: true,
      },
    }),
    prisma.curriculumUnit.count({
      where: {
        curriculum: {
          targetLanguage: "english",
          level: { in: CURRICULUM_LEVELS },
        },
      },
    }),
    prisma.curriculumUnitActivity.count({
      where: {
        activityType: { in: REQUIRED_ACTIVITY_TYPES as unknown as string[] },
        required: true,
        unit: {
          curriculum: {
            targetLanguage: "english",
            level: { in: CURRICULUM_LEVELS },
          },
        },
      },
    }),
    prisma.curriculumUnitActivity.count({
      where: { activityType: "drill" },
    }),
    prisma.user.count({
      where: {
        OR: [{ currentLevel: null }, { currentLevel: "foundation" }],
      },
    }),
    prisma.contentItem.count({
      where: {
        id: { in: EXPECTED_CONTENT_ITEM_IDS },
      },
    }),
    prisma.contentAsset.count({
      where: {
        contentItemId: { in: EXPECTED_CONTENT_ITEM_IDS },
      },
    }),
    prisma.curriculumUnitActivity.findFirst({
      where: { activityType: "game" },
      select: { activityPayload: true },
    }),
  ]);

  const needsCurriculumContent =
    contentItemCount !== EXPECTED_CONTENT_ITEM_IDS.length ||
    contentAssetCount < EXPECTED_CONTENT_ITEM_IDS.length;
  const needsCurricula =
    curriculaCount !== CURRICULUM_BLUEPRINTS.length ||
    unitCount !== EXPECTED_UNIT_COUNT ||
    activityCount !== EXPECTED_ACTIVITY_COUNT ||
    !activityPayloadLooksCurrent(sampleGameActivity?.activityPayload);
  const needsLegacyDrillBackfill = legacyDrillCount > 0;
  const needsCurrentLevelBackfill = staleUserCount > 0;

  return {
    needsCurriculumContent,
    needsCurricula,
    needsLegacyDrillBackfill,
    needsCurrentLevelBackfill,
    needsGameProgressBackfill: needsCurricula || needsLegacyDrillBackfill,
  };
}

async function moveExistingActivityOrderIndexes(unitId: string) {
  const existing = await prisma.curriculumUnitActivity.findMany({
    where: { unitId },
    select: {
      id: true,
      activityType: true,
      orderIndex: true,
    },
  });

  const temporaryOrderIndex: Partial<Record<string, number>> = {
    speaking: 13,
    writing: 14,
    checkpoint: 15,
  };

  for (const entry of existing) {
    const temporaryIndex = temporaryOrderIndex[entry.activityType];

    if (!temporaryIndex) {
      continue;
    }

    if (entry.orderIndex >= 10) {
      continue;
    }

    await prisma.curriculumUnitActivity.update({
      where: { id: entry.id },
      data: {
        orderIndex: temporaryIndex,
      },
    });
  }
}

function curriculumSkillTags(level: string) {
  if (level === "very_basic") {
    return ["reading", "writing", "vocabulary"];
  }

  if (level === "basic") {
    return ["reading", "writing", "grammar"];
  }

  if (level === "intermediate") {
    return ["reading", "writing", "speaking"];
  }

  return ["reading", "writing", "speaking", "grammar"];
}

async function ensureLegacyContent() {
  const count = await prisma.contentItem.count({
    where: {
      id: {
        in: LEGACY_CONTENT_ITEMS.map((item) => item.id as string),
      },
    },
  });

  if (count === LEGACY_CONTENT_ITEMS.length) {
    return;
  }

  for (const item of LEGACY_CONTENT_ITEMS) {
    const existing = await prisma.contentItem.findUnique({
      where: { id: item.id as string },
    });

    if (existing) {
      continue;
    }

    await prisma.contentItem.create({ data: item });
  }
}

async function upsertCurriculumContent() {
  for (const curriculum of CURRICULUM_BLUEPRINTS) {
    for (const [index, unit] of curriculum.units.entries()) {
      const unitIndex = index + 1;
      const lessonId = getLessonContentId(curriculum.level, unitIndex);
      const practiceId = getPracticeContentId(curriculum.level, unitIndex);

      await prisma.contentItem.upsert({
        where: { id: lessonId },
        update: {
          sourceType: "teacher_provided",
          contentType: "lesson",
          title: `${unit.title} Lesson`,
          description: unit.summary,
          targetLanguage: "english",
          skillTags: curriculumSkillTags(curriculum.level) as never,
          topicTags: [unit.slug, unit.theme.toLowerCase()] as never,
          difficultyBand: curriculum.level,
          status: "published",
          publishedAt: new Date("2026-03-07T00:00:00.000Z"),
        },
        create: {
          id: lessonId,
          sourceType: "teacher_provided",
          contentType: "lesson",
          title: `${unit.title} Lesson`,
          description: unit.summary,
          targetLanguage: "english",
          skillTags: curriculumSkillTags(curriculum.level) as never,
          topicTags: [unit.slug, unit.theme.toLowerCase()] as never,
          difficultyBand: curriculum.level,
          status: "published",
          publishedAt: new Date("2026-03-07T00:00:00.000Z"),
        },
      });

      await prisma.contentAsset.deleteMany({
        where: { contentItemId: lessonId },
      });

      await prisma.contentAsset.create({
        data: {
          contentItemId: lessonId,
          assetType: "text",
          textPayload: {
            sections: unit.lessonSections,
            checks: unit.lessonChecks,
          } as never,
          metadataPayload: {
            curriculumLevel: curriculum.level,
            unitSlug: unit.slug,
          } as never,
        },
      });

      await prisma.contentItem.upsert({
        where: { id: practiceId },
        update: {
          sourceType: "teacher_provided",
          contentType: "worksheet",
          title: `${unit.title} Practice`,
          description: `Guided practice for ${unit.title}.`,
          targetLanguage: "english",
          skillTags: curriculumSkillTags(curriculum.level) as never,
          topicTags: [unit.slug, `${unit.theme.toLowerCase()} practice`] as never,
          difficultyBand: curriculum.level,
          status: "published",
          publishedAt: new Date("2026-03-07T00:00:00.000Z"),
        },
        create: {
          id: practiceId,
          sourceType: "teacher_provided",
          contentType: "worksheet",
          title: `${unit.title} Practice`,
          description: `Guided practice for ${unit.title}.`,
          targetLanguage: "english",
          skillTags: curriculumSkillTags(curriculum.level) as never,
          topicTags: [unit.slug, `${unit.theme.toLowerCase()} practice`] as never,
          difficultyBand: curriculum.level,
          status: "published",
          publishedAt: new Date("2026-03-07T00:00:00.000Z"),
        },
      });

      await prisma.contentAsset.deleteMany({
        where: { contentItemId: practiceId },
      });

      await prisma.contentAsset.create({
        data: {
          contentItemId: practiceId,
          assetType: "text",
          textPayload: {
            questions: unit.practiceQuestions,
          } as never,
          metadataPayload: {
            curriculumLevel: curriculum.level,
            unitSlug: unit.slug,
          } as never,
        },
      });
    }
  }
}

async function upsertCurricula() {
  for (const curriculum of CURRICULUM_BLUEPRINTS) {
    const curriculumId = getCurriculumId(curriculum.level);

    await prisma.curriculum.upsert({
      where: {
        level_targetLanguage: {
          level: curriculum.level,
          targetLanguage: "english",
        },
      },
      update: {
        id: curriculumId,
        title: curriculum.title,
        description: curriculum.description,
        active: true,
      },
      create: {
        id: curriculumId,
        level: curriculum.level,
        targetLanguage: "english",
        title: curriculum.title,
        description: curriculum.description,
        active: true,
      },
    });

    for (const [index, unit] of curriculum.units.entries()) {
      const unitIndex = index + 1;
      const unitId = getUnitId(curriculum.level, unitIndex);

      await prisma.curriculumUnit.upsert({
        where: {
          curriculumId_slug: {
            curriculumId,
            slug: unit.slug,
          },
        },
        update: {
          id: unitId,
          title: unit.title,
          summary: unit.summary,
          canDoStatement: unit.canDoStatement,
          theme: unit.theme,
          keyVocabulary: unit.keyVocabulary as never,
          languageFocus: unit.languageFocus as never,
          performanceTask: unit.performanceTask,
          orderIndex: unitIndex,
        },
        create: {
          id: unitId,
          curriculumId,
          slug: unit.slug,
          title: unit.title,
          summary: unit.summary,
          canDoStatement: unit.canDoStatement,
          theme: unit.theme,
          keyVocabulary: unit.keyVocabulary as never,
          languageFocus: unit.languageFocus as never,
          performanceTask: unit.performanceTask,
          orderIndex: unitIndex,
        },
      });

      await moveExistingActivityOrderIndexes(unitId);

      const activityRows = [
        {
          type: "lesson",
          title: "Discover and Learn",
          description: `Core lesson for ${unit.title}.`,
          contentItemId: getLessonContentId(curriculum.level, unitIndex),
          payload: {
            scenario: unit.scenario,
            canDoStatement: unit.canDoStatement,
          },
        },
        {
          type: "practice",
          title: "Guided Practice",
          description: `Practice tasks for ${unit.title}.`,
          contentItemId: getPracticeContentId(curriculum.level, unitIndex),
          payload: {
            scenario: unit.scenario,
            languageFocus: unit.languageFocus,
          },
        },
        {
          type: "game",
          title: "Game",
          description: `Play the unit game before you move into speaking.`,
          contentItemId: null,
          payload: unit.game,
        },
        {
          type: "speaking",
          title: "Speaking Mission",
          description: unit.speakingMission.isBenchmark
            ? `Use the unit language in a benchmark speaking mission.`
            : `Use the unit language in a guided speaking mission.`,
          contentItemId: null,
          payload: {
            scenario: unit.scenario,
            scenarioTitle: unit.speakingMission.scenarioTitle,
            scenarioSetup: unit.speakingMission.scenarioSetup,
            counterpartRole: unit.speakingMission.counterpartRole,
            openingQuestion: unit.speakingMission.openingQuestion,
            warmupPrompts: unit.speakingMission.warmupPrompts,
            targetPhrases: unit.speakingMission.targetPhrases,
            followUpPrompts: unit.speakingMission.followUpPrompts,
            successCriteria: unit.speakingMission.successCriteria,
            modelExample: unit.speakingMission.modelExample,
            isBenchmark: unit.speakingMission.isBenchmark,
            requiredTurns: unit.speakingMission.requiredTurns,
            minimumFollowUpResponses: unit.speakingMission.minimumFollowUpResponses,
            evidenceTargets: unit.speakingMission.evidenceTargets,
            followUpObjectives: unit.speakingMission.followUpObjectives,
            benchmarkFocus: unit.speakingMission.benchmarkFocus,
          },
        },
        {
          type: "writing",
          title: "Writing Task",
          description: `Write a short response that proves the unit goal.`,
          contentItemId: null,
          payload: {
            prompt: unit.writingPrompt,
            criteria: unit.writingCriteria,
          },
        },
        {
          type: "checkpoint",
          title: "Checkpoint",
          description: `Confirm mastery before the next unit unlocks.`,
          contentItemId: null,
          payload: {
            questions: unit.checkpointQuestions,
          },
        },
      ] as const;

      for (const [activityIndex, row] of activityRows.entries()) {
        await prisma.curriculumUnitActivity.upsert({
          where: {
            unitId_activityType: {
              unitId,
              activityType: row.type,
            },
          },
          update: {
            id: getActivityId(curriculum.level, unitIndex, row.type),
            title: row.title,
            description: row.description,
            orderIndex: activityIndex + 1,
            contentItemId: row.contentItemId,
            required: true,
            activityPayload: row.payload as never,
          },
          create: {
            id: getActivityId(curriculum.level, unitIndex, row.type),
            unitId,
            activityType: row.type,
            title: row.title,
            description: row.description,
            orderIndex: activityIndex + 1,
            contentItemId: row.contentItemId,
            required: true,
            activityPayload: row.payload as never,
          },
        });
      }
    }
  }
}

async function backfillDrillContractToGame() {
  await prisma.curriculumUnitActivity.updateMany({
    where: { activityType: "drill" },
    data: {
      activityType: "game",
      title: "Game",
      description: "Play the unit game before you move into speaking.",
    },
  });

  await prisma.activityAttempt.updateMany({
    where: { activityType: "drill" },
    data: {
      activityType: "game",
    },
  });

  const progressRows = await prisma.userUnitActivityProgress.findMany({
    where: {
      responsePayload: {
        not: Prisma.AnyNull,
      },
    },
    select: {
      id: true,
      responsePayload: true,
    },
  });

  for (const row of progressRows) {
    const payload = row.responsePayload as Record<string, unknown> | null;

    if (!payload || !payload.drillReview || payload.gameReview) {
      continue;
    }

    await prisma.userUnitActivityProgress.update({
      where: { id: row.id },
      data: {
        responsePayload: {
          ...payload,
          gameReview: payload.drillReview,
        } as never,
      },
    });
  }
}

async function backfillGameActivityProgress() {
  const unitProgressRows = await prisma.userUnitProgress.findMany({
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

  const touchedUsers = new Set<string>();

  for (const unitProgress of unitProgressRows) {
    for (const activity of unitProgress.unit.activities) {
      const hasProgress = unitProgress.activityProgress.some(
        (entry) => entry.activityId === activity.id
      );

      if (hasProgress) {
        continue;
      }

      await prisma.userUnitActivityProgress.upsert({
        where: {
          userId_activityId: {
            userId: unitProgress.userId,
            activityId: activity.id,
          },
        },
        update: {
          unitProgressId: unitProgress.id,
        },
        create: {
          userId: unitProgress.userId,
          unitProgressId: unitProgress.id,
          activityId: activity.id,
          status: "locked",
        },
      });
    }

    touchedUsers.add(unitProgress.userId);
  }

  for (const userId of touchedUsers) {
    await reconcileCurriculumProgressForUser(userId);
  }
}

async function backfillCurrentLevels() {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ currentLevel: null }, { currentLevel: "foundation" }],
    },
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

  for (const user of users) {
    const latestReport = user.reports[0];
    if (!latestReport) {
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        currentLevel: normalizeLevelLabel(latestReport.levelLabel),
      },
    });
  }
}

export async function bootstrapDatabase() {
  if (bootstrapComplete) {
    return;
  }

  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    const status = await getBootstrapStatus();

    if (
      !status.needsCurriculumContent &&
      !status.needsCurricula &&
      !status.needsLegacyDrillBackfill &&
      !status.needsCurrentLevelBackfill &&
      !status.needsGameProgressBackfill
    ) {
      bootstrapComplete = true;
      return;
    }

    if (status.needsCurriculumContent) {
      await ensureLegacyContent();
      await upsertCurriculumContent();
    }

    if (status.needsLegacyDrillBackfill) {
      await backfillDrillContractToGame();
    }

    if (status.needsCurricula) {
      await upsertCurricula();
    }

    if (status.needsCurrentLevelBackfill) {
      await backfillCurrentLevels();
    }

    if (status.needsGameProgressBackfill) {
      await backfillGameActivityProgress();
    }

    bootstrapComplete = true;
  })();

  try {
    await bootstrapPromise;
  } finally {
    if (!bootstrapComplete) {
      bootstrapPromise = null;
    }
  }
}
