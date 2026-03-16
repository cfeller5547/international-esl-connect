import { prisma } from "@/server/prisma";

import { scoreAssessment } from "../ai/heuristics";
import { trackEvent } from "../analytics";

import { CurriculumService } from "./curriculum-service";
import { ReportService } from "./report-service";

type AssessmentPayload = {
  objectiveAnswers: Array<{
    questionId: string;
    value: string;
    skill: "listening" | "speaking" | "reading" | "writing" | "vocabulary" | "grammar";
    correctValue?: string;
  }>;
  conversationTurns: Array<{
    prompt: string;
    answer: string;
  }>;
  writingSample?: string;
  durationSeconds?: number;
};

export type AssessmentFormState = {
  answers: Record<string, string>;
  conversation: Record<string, string>;
  writingSample: string;
};

function emptyAssessmentFormState(): AssessmentFormState {
  return {
    answers: {},
    conversation: {},
    writingSample: "",
  };
}

function buildAssessmentFormStateFromPayload(payload: AssessmentPayload | null | undefined) {
  if (!payload) {
    return emptyAssessmentFormState();
  }

  return {
    answers: Object.fromEntries(
      payload.objectiveAnswers
        .filter((answer) => answer.value !== "")
        .map((answer) => [answer.questionId, answer.value])
    ),
    conversation: Object.fromEntries(
      payload.conversationTurns
        .map((turn, index) => [String(index), turn.answer] as const)
        .filter(([, answer]) => answer.trim() !== "")
    ),
    writingSample: payload.writingSample ?? "",
  };
}

export const AssessmentService = {
  async startAssessment({
    userId,
    guestSessionId,
    context,
    testPrepPlanId,
    initialResponsesPayload,
  }: {
    userId?: string | null;
    guestSessionId?: string | null;
    context: "onboarding_quick" | "onboarding_full" | "reassessment" | "mini_mock";
    testPrepPlanId?: string | null;
    initialResponsesPayload?: AssessmentPayload;
  }) {
    const existing = await prisma.assessmentAttempt.findFirst({
      where: {
        userId: userId ?? undefined,
        guestSessionId: guestSessionId ?? undefined,
        context,
        status: "in_progress",
      },
      orderBy: { startedAt: "desc" },
    });

    if (existing) {
      return existing;
    }

    return prisma.assessmentAttempt.create({
      data: {
        userId,
        guestSessionId,
        context,
        status: "in_progress",
        testPrepPlanId,
        responsesPayload: initialResponsesPayload,
      },
    });
  },

  async getFullDiagnosticBootstrap({
    userId,
    reusableQuestionIds,
  }: {
    userId: string;
    reusableQuestionIds: readonly string[];
  }) {
    const latestQuickBaselineAttempt = await prisma.assessmentAttempt.findFirst({
      where: {
        userId,
        context: "onboarding_quick",
        status: "completed",
      },
      orderBy: { completedAt: "desc" },
    });

    const latestQuickBaselinePayload =
      (latestQuickBaselineAttempt?.responsesPayload as AssessmentPayload | null | undefined) ?? null;
    const reusableQuestionIdSet = new Set(reusableQuestionIds);
    const carriedObjectiveAnswers = latestQuickBaselinePayload?.objectiveAnswers.filter((answer) =>
      reusableQuestionIdSet.has(answer.questionId)
    ) ?? [];

    const carryForwardState: AssessmentFormState = {
      answers: Object.fromEntries(
        carriedObjectiveAnswers
          .filter((answer) => answer.value !== "")
          .map((answer) => [answer.questionId, answer.value])
      ),
      conversation: {},
      writingSample: "",
    };

    const attempt = await this.startAssessment({
      userId,
      context: "onboarding_full",
      initialResponsesPayload:
        carriedObjectiveAnswers.length > 0
          ? {
              objectiveAnswers: carriedObjectiveAnswers,
              conversationTurns: [],
            }
          : undefined,
    });

    const attemptPayload = (attempt.responsesPayload as AssessmentPayload | null | undefined) ?? null;
    const attemptState = buildAssessmentFormStateFromPayload(attemptPayload);
    const hasAttemptState =
      Object.keys(attemptState.answers).length > 0 ||
      Object.keys(attemptState.conversation).length > 0 ||
      attemptState.writingSample.trim().length > 0;

    return {
      attempt,
      initialState: hasAttemptState ? attemptState : carryForwardState,
      importedObjectiveCount: Object.keys(carryForwardState.answers).length,
    };
  },

  async getAttempt(assessmentAttemptId: string) {
    return prisma.assessmentAttempt.findUnique({
      where: { id: assessmentAttemptId },
      include: {
        skillScores: true,
        report: true,
      },
    });
  },

  async completeAssessment({
    assessmentAttemptId,
    payload,
    reportType,
    userId,
    guestSessionId,
  }: {
    assessmentAttemptId: string;
    payload: AssessmentPayload;
    reportType: "baseline_quick" | "baseline_full" | "reassessment" | "mini_mock";
    userId?: string | null;
    guestSessionId?: string | null;
  }) {
    const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: assessmentAttemptId },
      include: { report: true },
    });

    const scoring = scoreAssessment(payload);

    await prisma.assessmentSkillScore.deleteMany({
      where: { assessmentAttemptId },
    });

    await prisma.assessmentConversationMetric.deleteMany({
      where: { assessmentAttemptId },
    });

    await prisma.assessmentAttempt.update({
      where: { id: assessmentAttemptId },
      data: {
        responsesPayload: payload,
        status: "completed",
        completedAt: new Date(),
      },
    });

    await prisma.assessmentSkillScore.createMany({
      data: scoring.skills.map((skill) => ({
        assessmentAttemptId,
        skill: skill.skill as never,
        score: skill.score,
        evidencePayload: {
          evidence: skill.evidence,
        },
      })),
    });

    await prisma.assessmentConversationMetric.create({
      data: {
        assessmentAttemptId,
        turnCount: scoring.conversationMetrics.turnCount,
        durationSeconds:
          payload.durationSeconds ?? scoring.conversationMetrics.durationSeconds,
        pronunciationScore: scoring.conversationMetrics.pronunciationScore,
        fluencyScore: scoring.conversationMetrics.fluencyScore,
        grammarUsageScore: scoring.conversationMetrics.grammarUsageScore,
        listeningResponseScore: scoring.conversationMetrics.listeningResponseScore,
      },
    });

    const report = await ReportService.createReport({
      userId,
      guestSessionId,
      assessmentAttemptId,
      reportType,
      scoring,
    });

    if (userId && reportType === "baseline_full") {
      await prisma.user.update({
        where: { id: userId },
        data: {
          fullDiagnosticCompletedAt: new Date(),
        },
      });
    }

    if (userId) {
      await CurriculumService.syncLevelFromReport({
        userId,
        reportType,
        levelLabel: report.levelLabel,
      });
    }

    await trackEvent({
      eventName:
        reportType === "baseline_full"
          ? "full_diagnostic_completed"
          : reportType === "reassessment"
            ? "reassessment_completed"
            : "assessment_completed",
      route:
        reportType === "baseline_full"
          ? attempt.context === "onboarding_full"
            ? "/onboarding/assessment"
            : "/app/assessment/full"
          : reportType === "reassessment"
            ? "/app/progress/reassessment"
            : "/onboarding/assessment",
      userId,
      guestSessionToken: guestSessionId ? undefined : undefined,
      properties: {
        attempt_id: assessmentAttemptId,
        report_id: report.id,
        duration_seconds: payload.durationSeconds ?? scoring.conversationMetrics.durationSeconds,
        overall_score: report.overallScore,
      },
    });

    return report;
  },
};
