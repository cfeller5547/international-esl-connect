import { addDays, subDays } from "date-fns";

import { SKILLS } from "../src/lib/constants";
import { prisma } from "../src/server/prisma";
import {
  calculateOverallScore,
  createComparisonPayload,
  generateReportNarration,
  getLevelLabel,
} from "../src/server/ai/heuristics";

const SEEDED_CONTEXT = "seeded_progress_demo";
const DEFAULT_EMAIL = "chrisfeller2000@gmail.com";
const REPORT_INTERVAL_DAYS = 21;

const seededSkillScores = [
  {
    listening: 38,
    speaking: 34,
    reading: 42,
    writing: 33,
    vocabulary: 40,
    grammar: 37,
  },
  {
    listening: 42,
    speaking: 39,
    reading: 46,
    writing: 38,
    vocabulary: 44,
    grammar: 41,
  },
  {
    listening: 46,
    speaking: 43,
    reading: 50,
    writing: 42,
    vocabulary: 48,
    grammar: 45,
  },
  {
    listening: 49,
    speaking: 47,
    reading: 54,
    writing: 46,
    vocabulary: 52,
    grammar: 49,
  },
  {
    listening: 52,
    speaking: 50,
    reading: 57,
    writing: 49,
    vocabulary: 55,
    grammar: 52,
  },
  {
    listening: 54,
    speaking: 53,
    reading: 58,
    writing: 51,
    vocabulary: 56,
    grammar: 54,
  },
] as const;

const reportTypes = [
  "baseline_quick",
  "baseline_full",
  "reassessment",
  "reassessment",
  "reassessment",
  "reassessment",
] as const;

function scoreMap(
  scores: Record<(typeof SKILLS)[number], number>
) {
  return Object.fromEntries(
    SKILLS.map((skill) => [skill, scores[skill]])
  ) as Record<(typeof SKILLS)[number], number>;
}

function buildScoring(scores: Record<(typeof SKILLS)[number], number>) {
  const overallScore = calculateOverallScore(scores);
  const levelLabel = getLevelLabel(overallScore);

  return {
    overallScore,
    levelLabel,
    skills: SKILLS.map((skill) => ({
      skill,
      score: scores[skill],
      evidence: [
        `Seeded demo trend for ${skill}.`,
        `Score path set for progress visualization.`,
      ],
    })),
  };
}

async function recalculateUserReportHistory(userId: string) {
  const reports = await prisma.report.findMany({
    where: { userId },
    include: {
      skillSnapshots: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (reports.length === 0) {
    return;
  }

  await prisma.reportComparison.deleteMany({
    where: {
      reportId: {
        in: reports.map((report) => report.id),
      },
    },
  });

  for (let index = 0; index < reports.length; index += 1) {
    const report = reports[index];
    const previousReport = index > 0 ? reports[index - 1] : null;

    const currentScores = scoreMap(
      Object.fromEntries(
        report.skillSnapshots.map((snapshot) => [snapshot.skill, snapshot.score])
      ) as Record<(typeof SKILLS)[number], number>
    );
    const previousScores = previousReport
      ? scoreMap(
          Object.fromEntries(
            previousReport.skillSnapshots.map((snapshot) => [snapshot.skill, snapshot.score])
          ) as Record<(typeof SKILLS)[number], number>
        )
      : null;

    await prisma.report.update({
      where: { id: report.id },
      data: {
        summaryPayload: generateReportNarration({
          skillScores: currentScores,
          previousSkillScores: previousScores,
        }) as never,
      },
    });

    for (const snapshot of report.skillSnapshots) {
      await prisma.reportSkillSnapshot.update({
        where: { id: snapshot.id },
        data: {
          visualPayload: {
            score: snapshot.score,
            delta:
              previousScores && previousScores[snapshot.skill as (typeof SKILLS)[number]] !== undefined
                ? snapshot.score - previousScores[snapshot.skill as (typeof SKILLS)[number]]
                : null,
          } as never,
        },
      });
    }

    if (previousReport && previousScores) {
      await prisma.reportComparison.create({
        data: {
          reportId: report.id,
          previousReportId: previousReport.id,
          deltaPayload: createComparisonPayload(currentScores, previousScores) as never,
        },
      });
    }
  }
}

async function main() {
  const email = process.argv[2] ?? DEFAULT_EMAIL;
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      reports: {
        where: {
          assessmentAttempt: {
            context: {
              not: SEEDED_CONTEXT,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          reportType: true,
          overallScore: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(`User not found for ${email}`);
  }

  const deletedAttempts = await prisma.assessmentAttempt.deleteMany({
    where: {
      userId: user.id,
      context: SEEDED_CONTEXT,
    },
  });

  const anchorEndDate = user.reports[0]
    ? subDays(user.reports[0].createdAt, 21)
    : subDays(new Date(), 14);
  const startDate = subDays(
    anchorEndDate,
    REPORT_INTERVAL_DAYS * (seededSkillScores.length - 1)
  );

  const createdReportIds: string[] = [];

  for (let index = 0; index < seededSkillScores.length; index += 1) {
    const targetDate = addDays(startDate, REPORT_INTERVAL_DAYS * index);
    const scoring = buildScoring(seededSkillScores[index]);

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        userId: user.id,
        context: SEEDED_CONTEXT,
        status: "completed",
        responsesPayload: {
          seededDemo: true,
          iteration: index + 1,
          note: "Generated for local progress timeline preview.",
        } as never,
        startedAt: subDays(targetDate, 0),
        completedAt: targetDate,
      },
    });

    await prisma.assessmentSkillScore.createMany({
      data: scoring.skills.map((skill) => ({
        assessmentAttemptId: attempt.id,
        skill: skill.skill as never,
        score: skill.score,
        evidencePayload: {
          seededDemo: true,
          evidence: skill.evidence,
        } as never,
      })),
    });

    await prisma.assessmentConversationMetric.create({
      data: {
        assessmentAttemptId: attempt.id,
        turnCount: reportTypes[index] === "baseline_quick" ? 3 : 4,
        durationSeconds: 180 + index * 30,
        pronunciationScore: Math.max(scoring.overallScore - 6, 35),
        fluencyScore: Math.max(scoring.overallScore - 2, 35),
        grammarUsageScore: seededSkillScores[index].grammar,
        listeningResponseScore: seededSkillScores[index].listening,
      },
    });

    const report = await prisma.report.create({
      data: {
        userId: user.id,
        assessmentAttemptId: attempt.id,
        reportType: reportTypes[index],
        overallScore: scoring.overallScore,
        levelLabel: scoring.levelLabel,
        summaryPayload: generateReportNarration({
          skillScores: scoreMap(seededSkillScores[index]),
          previousSkillScores: null,
        }) as never,
        createdAt: targetDate,
      },
    });

    await prisma.reportSkillSnapshot.createMany({
      data: scoring.skills.map((skill) => ({
        reportId: report.id,
        skill: skill.skill as never,
        score: skill.score,
        interpretationText:
          skill.score >= 70
            ? `You are using ${skill.skill} with growing confidence.`
            : `Keep building consistency in ${skill.skill}.`,
        recommendedActionText: `Practice ${skill.skill} in your next study block.`,
        visualPayload: {
          score: skill.score,
          delta: null,
        } as never,
      })),
    });

    createdReportIds.push(report.id);
  }

  await recalculateUserReportHistory(user.id);

  const finalReports = await prisma.report.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      reportType: true,
      overallScore: true,
      levelLabel: true,
      createdAt: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        email,
        userId: user.id,
        removedSeededAttempts: deletedAttempts.count,
        addedSeededReports: createdReportIds.length,
        totalReports: finalReports.length,
        reports: finalReports,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
