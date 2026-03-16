import { addDays } from "date-fns";

import { prisma } from "@/server/prisma";

import { trackEvent } from "../analytics";

import { AssessmentService } from "./assessment-service";
import { CurriculumService } from "./curriculum-service";

export type GuestOnboardingStepHref =
  | "/onboarding/profile"
  | "/onboarding/assessment"
  | "/signup";

export const OnboardingService = {
  async createGuestSession() {
    const session = await prisma.guestOnboardingSession.create({
      data: {
        sessionToken: crypto.randomUUID(),
        expiresAt: addDays(new Date(), 7),
      },
    });

    return session;
  },

  async getGuestSessionByToken(guestSessionToken: string) {
    return prisma.guestOnboardingSession.findUnique({
      where: { sessionToken: guestSessionToken },
    });
  },

  async getGuestOnboardingState(guestSessionToken: string) {
    const guestSession = await prisma.guestOnboardingSession.findUnique({
      where: { sessionToken: guestSessionToken },
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

    if (!guestSession || guestSession.expiresAt < new Date()) {
      return null;
    }

    const hasProfile = guestSession.profilePayload !== null;
    const hasReport = guestSession.reports.length > 0;
    const nextStepHref: GuestOnboardingStepHref = hasReport
      ? "/signup"
      : hasProfile
        ? "/onboarding/assessment"
        : "/onboarding/profile";

    return {
      guestSession,
      hasProfile,
      hasReport,
      canAccessSignup: hasReport,
      nextStepHref,
    };
  },

  async saveProfile(
    guestSessionToken: string,
    profile: {
      firstName: string;
      ageBand: "13-15" | "16-18" | "18-24";
      targetLanguage: "english" | "spanish" | "chinese";
      nativeLanguage: "english" | "spanish" | "chinese";
      isTakingClass: boolean;
      schoolLevel: "high_school" | "college";
    }
  ) {
    const updated = await prisma.guestOnboardingSession.update({
      where: { sessionToken: guestSessionToken },
      data: {
        profilePayload: profile,
      },
    });

    await trackEvent({
      eventName: "onboarding_profile_saved",
      route: "/onboarding/profile",
      guestSessionToken,
      properties: {
        age_band: profile.ageBand,
        school_level: profile.schoolLevel,
        is_taking_class: profile.isTakingClass,
      },
    });

    return updated;
  },

  async startQuickBaseline(guestSessionToken: string) {
    const guestSession = await this.getGuestSessionByToken(guestSessionToken);

    if (!guestSession) {
      throw new Error("Guest session not found.");
    }

    return AssessmentService.startAssessment({
      guestSessionId: guestSession.id,
      context: "onboarding_quick",
    });
  },

  async startFullDiagnostic(guestSessionToken: string) {
    const guestSession = await this.getGuestSessionByToken(guestSessionToken);

    if (!guestSession) {
      throw new Error("Guest session not found.");
    }

    return AssessmentService.startAssessment({
      guestSessionId: guestSession.id,
      context: "onboarding_full",
    });
  },

  async completeQuickBaseline({
    guestSessionToken,
    assessmentAttemptId,
    payload,
  }: {
    guestSessionToken: string;
    assessmentAttemptId: string;
    payload: Parameters<typeof AssessmentService.completeAssessment>[0]["payload"];
  }) {
    const guestSession = await this.getGuestSessionByToken(guestSessionToken);

    if (!guestSession) {
      throw new Error("Guest session not found.");
    }

    return AssessmentService.completeAssessment({
      assessmentAttemptId,
      payload,
      reportType: "baseline_quick",
      guestSessionId: guestSession.id,
    });
  },

  async completeFullDiagnostic({
    guestSessionToken,
    assessmentAttemptId,
    payload,
  }: {
    guestSessionToken: string;
    assessmentAttemptId: string;
    payload: Parameters<typeof AssessmentService.completeAssessment>[0]["payload"];
  }) {
    const guestSession = await this.getGuestSessionByToken(guestSessionToken);

    if (!guestSession) {
      throw new Error("Guest session not found.");
    }

    return AssessmentService.completeAssessment({
      assessmentAttemptId,
      payload,
      reportType: "baseline_full",
      guestSessionId: guestSession.id,
    });
  },

  async getResults(guestSessionToken: string) {
    const guestSession = await this.getGuestSessionByToken(guestSessionToken);

    if (!guestSession) {
      return null;
    }

    return prisma.report.findFirst({
      where: {
        guestSessionId: guestSession.id,
      },
      include: {
        skillSnapshots: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async migrateGuestSessionToUser({
    guestSessionToken,
    userId,
  }: {
    guestSessionToken: string;
    userId: string;
  }) {
    const guestSession = await this.getGuestSessionByToken(guestSessionToken);

    if (!guestSession) {
      return null;
    }

    const profile = (guestSession.profilePayload ?? {}) as Record<string, unknown>;
    const latestGuestReport = await prisma.report.findFirst({
      where: {
        guestSessionId: guestSession.id,
        reportType: {
          in: ["baseline_quick", "baseline_full", "reassessment"],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    await prisma.$transaction([
      prisma.assessmentAttempt.updateMany({
        where: { guestSessionId: guestSession.id },
        data: { userId },
      }),
      prisma.report.updateMany({
        where: { guestSessionId: guestSession.id },
        data: { userId },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          firstName: (profile.firstName as string | undefined) ?? undefined,
          currentLevel: latestGuestReport?.levelLabel === "foundation"
            ? "very_basic"
            : latestGuestReport?.levelLabel ?? undefined,
          fullDiagnosticCompletedAt:
            latestGuestReport?.reportType === "baseline_full" ? new Date() : undefined,
        },
      }),
    ]);

    if (latestGuestReport) {
      await CurriculumService.syncLevelFromReport({
        userId,
        reportType: latestGuestReport.reportType,
        levelLabel: latestGuestReport.levelLabel,
      });
    }

    await trackEvent({
      eventName: "baseline_report_persisted",
      route: "/signup",
      userId,
      guestSessionToken,
      properties: {
        guest_session_token: guestSessionToken,
      },
    });

    return latestGuestReport;
  },
};
