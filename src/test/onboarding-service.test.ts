/** @vitest-environment node */

import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/prisma";
import { OnboardingService } from "@/server/services/onboarding-service";

describe("onboarding service", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("routes a fresh guest session to profile", async () => {
    const guestSession = await prisma.guestOnboardingSession.create({
      data: {
        sessionToken: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const state = await OnboardingService.getGuestOnboardingState(guestSession.sessionToken);

    expect(state?.nextStepHref).toBe("/onboarding/profile");
    expect(state?.canAccessSignup).toBe(false);
  });

  it("routes a profiled guest session to the onboarding diagnostic", async () => {
    const guestSession = await prisma.guestOnboardingSession.create({
      data: {
        sessionToken: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
        profilePayload: {
          firstName: "Ana",
          ageBand: "16-18",
        } as never,
      },
    });

    const state = await OnboardingService.getGuestOnboardingState(guestSession.sessionToken);

    expect(state?.nextStepHref).toBe("/onboarding/assessment");
    expect(state?.canAccessSignup).toBe(false);
  });

  it("routes a guest with a completed diagnostic to signup", async () => {
    const guestSession = await prisma.guestOnboardingSession.create({
      data: {
        sessionToken: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
        profilePayload: {
          firstName: "Min",
          ageBand: "16-18",
        } as never,
      },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        guestSessionId: guestSession.id,
        context: "onboarding_full",
        status: "completed",
        completedAt: new Date(),
      },
    });

    await prisma.report.create({
      data: {
        guestSessionId: guestSession.id,
        assessmentAttemptId: attempt.id,
        reportType: "baseline_full",
        overallScore: 41,
        levelLabel: "basic",
        summaryPayload: {} as never,
      },
    });

    const state = await OnboardingService.getGuestOnboardingState(guestSession.sessionToken);

    expect(state?.nextStepHref).toBe("/signup");
    expect(state?.canAccessSignup).toBe(true);
  });

  it("marks the user as having completed the full diagnostic when a guest full report is migrated", async () => {
    const guestSession = await prisma.guestOnboardingSession.create({
      data: {
        sessionToken: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
        profilePayload: {
          firstName: "Mina",
        } as never,
      },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        guestSessionId: guestSession.id,
        context: "onboarding_full",
        status: "completed",
        completedAt: new Date(),
      },
    });

    const report = await prisma.report.create({
      data: {
        guestSessionId: guestSession.id,
        assessmentAttemptId: attempt.id,
        reportType: "baseline_full",
        overallScore: 63,
        levelLabel: "intermediate",
        summaryPayload: {} as never,
      },
    });

    const user = await prisma.user.create({
      data: {
        email: `onboarding-migrate-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
      },
    });

    const migratedReport = await OnboardingService.migrateGuestSessionToUser({
      guestSessionToken: guestSession.sessionToken,
      userId: user.id,
    });

    const refreshedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(migratedReport?.id).toBe(report.id);
    expect(refreshedUser.fullDiagnosticCompletedAt).not.toBeNull();
    expect(refreshedUser.currentLevel).toBe("intermediate");
  });

  it("treats expired guest sessions as invalid", async () => {
    const guestSession = await prisma.guestOnboardingSession.create({
      data: {
        sessionToken: crypto.randomUUID(),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const state = await OnboardingService.getGuestOnboardingState(guestSession.sessionToken);

    expect(state).toBeNull();
  });
});
