import { differenceInCalendarDays, subDays } from "date-fns";

import { prisma } from "@/server/prisma";

import { trackEvent } from "../analytics";

import { CurriculumService } from "./curriculum-service";

export const RecommendationService = {
  async getRecommendation(userId: string, surface: "home" | "learn" | "speak" = "home") {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        testPrepPlans: {
          where: { status: "active" },
          orderBy: { targetDate: "asc" },
          take: 1,
        },
        homeworkHelpSessions: {
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        homeworkUploads: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user.fullDiagnosticCompletedAt) {
      return this.persistSnapshot(userId, surface, {
        actionType: "complete_full_diagnostic",
        title: "Complete full diagnostic",
        targetUrl: "/app/assessment/full",
        reason: "Unlock deeper analysis and confirm the curriculum level that should guide Learn.",
        reasonCode: "complete_full_diagnostic",
        sourceType: "teacher_provided",
        weakestSkill: null,
        contextSignals: ["full_diagnostic_incomplete"],
      });
    }

    const activeHomeworkSession = user.homeworkHelpSessions[0];
    if (activeHomeworkSession) {
      return this.persistSnapshot(userId, surface, {
        actionType: "resume_homework_help",
        title: "Resume homework help",
        targetUrl: `/app/tools/homework/session/${activeHomeworkSession.id}`,
        reason: "You already have an active homework-help session in progress.",
        reasonCode: "resume_homework_help",
        sourceType: "teacher_provided",
        weakestSkill: null,
        contextSignals: ["active_homework_session"],
      });
    }

    const recentHomework = user.homeworkUploads[0];
    if (
      recentHomework &&
      recentHomework.createdAt >= subDays(new Date(), 1) &&
      recentHomework.status !== "failed"
    ) {
      return this.persistSnapshot(userId, surface, {
        actionType: "start_homework_help",
        title: "Start homework help",
        targetUrl: "/app/tools/homework",
        reason: "You uploaded homework recently. Finish it while the assignment is still fresh.",
        reasonCode: "start_homework_help",
        sourceType: "teacher_provided",
        weakestSkill: null,
        contextSignals: ["recent_homework_upload"],
      });
    }

    const activePlan = user.testPrepPlans[0];
    if (activePlan && differenceInCalendarDays(activePlan.targetDate, new Date()) <= 7) {
      return this.persistSnapshot(userId, surface, {
        actionType: "continue_test_prep",
        title: "Continue test prep",
        targetUrl: "/app/tools/test-prep",
        reason: "Your test date is close, so test prep should take priority right now.",
        reasonCode: "continue_test_prep",
        sourceType: "teacher_provided",
        weakestSkill: null,
        contextSignals: ["active_test_prep_plan"],
      });
    }

    const nextLearningAction = await CurriculumService.getNextLearningAction(userId);

    return this.persistSnapshot(userId, surface, {
      actionType: "continue_curriculum",
      title: surface === "learn" ? "Continue curriculum" : nextLearningAction.title,
      targetUrl: nextLearningAction.targetUrl,
      reason: nextLearningAction.reason,
      reasonCode: "continue_curriculum",
      sourceType: "teacher_provided",
      weakestSkill: null,
      contextSignals: ["curriculum_next_required_activity"],
      unitId: nextLearningAction.unitId,
      activityId: nextLearningAction.activityId,
    });
  },

  async persistSnapshot(
    userId: string,
    surface: "home" | "learn" | "speak",
    payload: {
      actionType: string;
      title: string;
      targetUrl: string;
      reason: string;
      reasonCode: string;
      sourceType: string;
      weakestSkill: string | null;
      contextSignals: string[];
      unitId?: string | null;
      activityId?: string | null;
    }
  ) {
    await prisma.recommendationSnapshot.create({
      data: {
        userId,
        surface,
        recommendationPayload: payload,
      },
    });

    const route =
      surface === "home" ? "/app/home" : surface === "learn" ? "/app/learn" : "/app/speak";

    await trackEvent({
      eventName: "recommendation_rule_applied",
      route,
      userId,
      properties: {
        reason_code: payload.reasonCode,
      },
    });

    return payload;
  },
};
