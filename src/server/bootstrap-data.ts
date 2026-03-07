import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/prisma";

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
            targetStarterKey: "school_day",
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
          type: "speaking",
          title: "Speaking Mission",
          description: `Use the unit language in a guided speaking response.`,
          contentItemId: null,
          payload: {
            prompts: unit.speakingPrompts,
            scenario: unit.scenario,
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
    await ensureLegacyContent();
    await upsertCurriculumContent();
    await upsertCurricula();
    await backfillCurrentLevels();
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
