/** @vitest-environment node */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/prisma";
import { bootstrapDatabase } from "@/server/bootstrap-data";
import { CurriculumService } from "@/server/services/curriculum-service";

describe("curriculum service", () => {
  beforeAll(async () => {
    await bootstrapDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("backfills a legacy foundation report to very_basic and initializes progress", async () => {
    const user = await prisma.user.create({
      data: {
        email: `curriculum-backfill-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
      },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        userId: user.id,
        context: "onboarding_quick",
        status: "completed",
        completedAt: new Date(),
      },
    });

    await prisma.report.create({
      data: {
        userId: user.id,
        assessmentAttemptId: attempt.id,
        reportType: "baseline_quick",
        overallScore: 24,
        levelLabel: "foundation",
        summaryPayload: {} as never,
      },
    });

    const curriculum = await CurriculumService.getAssignedCurriculum(user.id);
    const refreshedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(refreshedUser.currentLevel).toBe("very_basic");
    expect(curriculum.level).toBe("very_basic");
    expect(curriculum.units[0]?.status).toBe("unlocked");
    expect(curriculum.units[1]?.status).toBe("locked");
    expect(curriculum.currentActivity?.activityType).toBe("lesson");
  });

  it("requires all five activities and unlocks the next unit sequentially", async () => {
    const user = await prisma.user.create({
      data: {
        email: `curriculum-unlock-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
        currentLevel: "basic",
        fullDiagnosticCompletedAt: new Date(),
      },
    });

    const initial = await CurriculumService.getAssignedCurriculum(user.id);
    const unitSlug = initial.currentUnit?.slug;
    expect(unitSlug).toBeTruthy();

    await CurriculumService.completeUnitActivity({
      userId: user.id,
      unitSlug: unitSlug!,
      activityType: "lesson",
      score: 88,
    });

    let updated = await CurriculumService.getAssignedCurriculum(user.id);
    expect(updated.currentActivity?.activityType).toBe("practice");

    await CurriculumService.completeUnitActivity({
      userId: user.id,
      unitSlug: unitSlug!,
      activityType: "practice",
      score: 84,
    });
    await CurriculumService.completeUnitActivity({
      userId: user.id,
      unitSlug: unitSlug!,
      activityType: "speaking",
      score: 86,
      responsePayload: { answer: "I can explain my weekday routine with more detail now." },
    });
    await CurriculumService.completeUnitActivity({
      userId: user.id,
      unitSlug: unitSlug!,
      activityType: "writing",
      score: 82,
      responsePayload: { answer: "I usually study after dinner because I have class early the next day." },
    });

    updated = await CurriculumService.getAssignedCurriculum(user.id);
    expect(updated.currentActivity?.activityType).toBe("checkpoint");

    const checkpointResult = await CurriculumService.completeUnitActivity({
      userId: user.id,
      unitSlug: unitSlug!,
      activityType: "checkpoint",
      score: 100,
      responsePayload: { answers: { 0: "0", 1: "0" } },
    });

    const completed = await CurriculumService.getAssignedCurriculum(user.id);
    expect(completed.units[0]?.status).toBe("completed");
    expect(completed.units[1]?.status).toBe("unlocked");
    expect(completed.currentUnit?.slug).toBe(completed.units[1]?.slug);
    expect(completed.currentActivity?.activityType).toBe("lesson");
    expect(checkpointResult.nextActionHref).toBe(
      `/app/learn/unit/${completed.units[1]?.slug}/lesson`
    );
    expect(checkpointResult.nextAction.stepIndex).toBe(1);
    expect(checkpointResult.nextAction.totalSteps).toBe(5);
  });

  it("promotes immediately and never demotes on lower reassessment scores", async () => {
    const user = await prisma.user.create({
      data: {
        email: `curriculum-promotion-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
        currentLevel: "basic",
        fullDiagnosticCompletedAt: new Date(),
      },
    });

    const promoted = await CurriculumService.syncLevelFromReport({
      userId: user.id,
      reportType: "reassessment",
      levelLabel: "intermediate",
    });

    const afterPromotion = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(promoted.promoted).toBe(true);
    expect(afterPromotion.currentLevel).toBe("intermediate");

    const demotionAttempt = await CurriculumService.syncLevelFromReport({
      userId: user.id,
      reportType: "reassessment",
      levelLabel: "very_basic",
    });

    const afterDemotionAttempt = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(demotionAttempt.promoted).toBe(false);
    expect(afterDemotionAttempt.currentLevel).toBe("intermediate");
  });

  it("clears the current action once an entire curriculum is finished", async () => {
    const user = await prisma.user.create({
      data: {
        email: `curriculum-complete-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
        currentLevel: "very_basic",
      },
    });

    let view = await CurriculumService.getAssignedCurriculum(user.id);

    while (view.currentUnit && view.currentActivity) {
      const responsePayload =
        view.currentActivity.activityType === "speaking" ||
        view.currentActivity.activityType === "writing"
          ? { answer: "This is a strong enough sample response for automated testing." }
          : view.currentActivity.activityType === "checkpoint"
            ? { answers: { 0: "0", 1: "0" } }
            : undefined;

      await CurriculumService.completeUnitActivity({
        userId: user.id,
        unitSlug: view.currentUnit.slug,
        activityType: view.currentActivity.activityType,
        score: 90,
        responsePayload,
      });

      view = await CurriculumService.getAssignedCurriculum(user.id);
    }

    const nextAction = await CurriculumService.getNextLearningAction(user.id);

    expect(view.currentUnit).toBeNull();
    expect(view.currentActivity).toBeNull();
    expect(nextAction.targetUrl).toBe("/app/learn");
  });
});
