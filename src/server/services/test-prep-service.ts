import { prisma } from "@/server/prisma";

import { buildTestPrepPlan } from "../ai/heuristics";
import { trackEvent } from "../analytics";

import { AssessmentService } from "./assessment-service";
import { RecommendationService } from "./recommendation-service";
import { UsageService } from "./usage-service";

export const TestPrepService = {
  async createPlan({
    userId,
    targetDate,
    topics,
  }: {
    userId: string;
    targetDate: string;
    topics: string[];
  }) {
    await UsageService.assertWithinLimit(userId, "test_prep_plans");
    await UsageService.increment(userId, "test_prep_plans");

    const latestReport = await prisma.report.findFirst({
      where: { userId },
      include: {
        skillSnapshots: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const weakestSkills =
      latestReport?.skillSnapshots
        .slice()
        .sort((a, b) => a.score - b.score)
        .slice(0, 2)
        .map((snapshot) => snapshot.skill) ?? ["grammar", "speaking"];

    const planPayload = buildTestPrepPlan({
      targetDate: new Date(targetDate),
      topics,
      weakestSkills,
    });

    const plan = await prisma.testPrepPlan.create({
      data: {
        userId,
        targetDate: new Date(targetDate),
        topicsPayload: topics,
        planPayload,
        status: "active",
      },
    });

    await trackEvent({
      eventName: "test_prep_plan_created",
      route: "/app/tools/test-prep",
      userId,
      properties: {
        plan_id: plan.id,
        target_date: targetDate,
        topic_count: topics.length,
      },
    });

    return plan;
  },

  async getPlan(planId: string, userId: string) {
    return prisma.testPrepPlan.findFirst({
      where: {
        id: planId,
        userId,
      },
    });
  },

  async runMiniMock(planId: string, userId: string) {
    const plan = await prisma.testPrepPlan.findFirstOrThrow({
      where: {
        id: planId,
        userId,
      },
    });

    await trackEvent({
      eventName: "test_prep_mini_mock_started",
      route: "/app/tools/test-prep",
      userId,
      properties: {
        plan_id: plan.id,
      },
    });

    const attempt = await AssessmentService.startAssessment({
      userId,
      context: "mini_mock",
      testPrepPlanId: plan.id,
    });

    const report = await AssessmentService.completeAssessment({
      assessmentAttemptId: attempt.id,
      reportType: "mini_mock",
      userId,
      payload: {
        objectiveAnswers: [
          {
            questionId: "mini-1",
            value: "correct",
            correctValue: "correct",
            skill: "grammar",
          },
          {
            questionId: "mini-2",
            value: "correct",
            correctValue: "correct",
            skill: "reading",
          },
          {
            questionId: "mini-3",
            value: "partial",
            correctValue: "correct",
            skill: "vocabulary",
          },
        ],
        conversationTurns: [
          {
            prompt: "Explain one topic from your test plan.",
            answer: "I reviewed preterite endings and explained why I used them.",
          },
          {
            prompt: "What do you still need to practice?",
            answer: "I need more confidence when I answer quickly.",
          },
        ],
        writingSample:
          "I can explain the topic, but I still need to practice my grammar before the test.",
      },
    });

    const recommendation = await RecommendationService.getRecommendation(userId, "learn");

    await trackEvent({
      eventName: "test_prep_mini_mock_completed",
      route: "/app/tools/test-prep",
      userId,
      properties: {
        plan_id: plan.id,
        readiness_score: report.overallScore,
      },
    });

    return {
      planId: plan.id,
      assessmentAttemptId: attempt.id,
      reportId: report.id,
      readinessScore: report.overallScore,
      recommendedNextActions: [
        {
          type: recommendation.actionType,
          targetUrl: recommendation.targetUrl,
        },
      ],
    };
  },
};
