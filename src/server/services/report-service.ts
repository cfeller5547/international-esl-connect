import { prisma } from "@/server/prisma";

import { SKILLS } from "@/lib/constants";
import type { ProgressHistoryPoint, SkillKey } from "@/lib/progress";

import {
  createComparisonPayload,
  generateReportNarration,
  generateShareCardSvg,
} from "../ai/heuristics";
import { trackEvent } from "../analytics";

type ScoreResult = {
  overallScore: number;
  levelLabel: "very_basic" | "basic" | "intermediate" | "advanced";
  skills: Array<{
    skill: string;
    score: number;
    evidence: string[];
  }>;
};

function scoreMap(skills: Array<{ skill: string; score: number }>) {
  return Object.fromEntries(skills.map((item) => [item.skill, item.score]));
}

export const ReportService = {
  async createReport({
    userId,
    guestSessionId,
    assessmentAttemptId,
    reportType,
    scoring,
  }: {
    userId?: string | null;
    guestSessionId?: string | null;
    assessmentAttemptId: string;
    reportType: "baseline_quick" | "baseline_full" | "reassessment" | "mini_mock";
    scoring: ScoreResult;
  }) {
    const previousReport = userId
      ? await prisma.report.findFirst({
          where: {
            userId,
            assessmentAttemptId: { not: assessmentAttemptId },
          },
          include: {
            skillSnapshots: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : null;

    const currentScores = scoreMap(scoring.skills);
    const previousScores = previousReport
      ? scoreMap(previousReport.skillSnapshots.map((snapshot) => ({
          skill: snapshot.skill,
          score: snapshot.score,
        })))
      : null;

    const narration = generateReportNarration({
      skillScores: currentScores,
      previousSkillScores: previousScores,
    });

    const report = await prisma.report.upsert({
      where: { assessmentAttemptId },
      update: {
        userId,
        guestSessionId,
        reportType,
        overallScore: scoring.overallScore,
        levelLabel: scoring.levelLabel,
        summaryPayload: narration,
      },
      create: {
        userId,
        guestSessionId,
        assessmentAttemptId,
        reportType,
        overallScore: scoring.overallScore,
        levelLabel: scoring.levelLabel,
        summaryPayload: narration,
      },
    });

    await prisma.reportSkillSnapshot.deleteMany({
      where: { reportId: report.id },
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
          delta:
            previousScores && previousScores[skill.skill] !== undefined
              ? skill.score - previousScores[skill.skill]
              : null,
        },
      })),
    });

    await prisma.reportComparison.deleteMany({
      where: { reportId: report.id },
    });

    if (previousReport && previousScores) {
      await prisma.reportComparison.create({
        data: {
          reportId: report.id,
          previousReportId: previousReport.id,
          deltaPayload: createComparisonPayload(currentScores, previousScores),
        },
      });
    }

    return prisma.report.findUniqueOrThrow({
      where: { id: report.id },
      include: {
        skillSnapshots: true,
        comparisonAsCurrent: true,
      },
    });
  },

  async listReports(userId: string) {
    return prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async getProgressHistory(userId: string): Promise<ProgressHistoryPoint[]> {
    const reports = await prisma.report.findMany({
      where: { userId },
      include: {
        skillSnapshots: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return reports.map((report) => {
      const skills = SKILLS.reduce<Record<SkillKey, number>>((current, skill) => {
        const matchingSnapshot = report.skillSnapshots.find((snapshot) => snapshot.skill === skill);
        current[skill] = matchingSnapshot?.score ?? 0;
        return current;
      }, {} as Record<SkillKey, number>);

      return {
        reportId: report.id,
        createdAt: report.createdAt.toISOString(),
        overallScore: report.overallScore,
        reportType: report.reportType,
        levelLabel: report.levelLabel,
        skills,
      };
    });
  },

  async getReport(reportId: string, userId?: string) {
    return prisma.report.findFirst({
      where: {
        id: reportId,
        ...(userId ? { userId } : {}),
      },
      include: {
        skillSnapshots: true,
        comparisonAsCurrent: true,
      },
    });
  },

  async createShareCard({
    userId,
    reportId,
    cardType,
  }: {
    userId: string;
    reportId?: string | null;
    cardType: "level" | "conversation_milestone" | "improvement" | "level_up";
  }) {
    const report = reportId
      ? await prisma.report.findFirst({
          where: {
            id: reportId,
            userId,
          },
        })
      : null;

    const assetUrl = generateShareCardSvg({
      title:
        cardType === "improvement"
          ? "Progress snapshot"
          : cardType === "level_up"
            ? "Level up"
            : "Learning milestone",
      subtitle: report
        ? `Generated from your ${report.reportType.replaceAll("_", " ")} report`
        : "Generated from your latest milestone",
      score: report?.overallScore ?? 72,
      label: report?.levelLabel ?? "intermediate",
    });

    const shareCard = await prisma.shareCard.create({
      data: {
        userId,
        reportId,
        cardType,
        assetUrl,
        metadataPayload: {
          reportId,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    await trackEvent({
      eventName: "share_card_generated",
      route: reportId ? `/app/progress/reports/${reportId}` : "/app/progress",
      userId,
      properties: {
        card_type: cardType,
        report_id: reportId,
      },
    });

    return shareCard;
  },
};
