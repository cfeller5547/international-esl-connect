import { addDays, endOfDay, startOfDay, subDays } from "date-fns";

import { FREE_TIER_LIMITS } from "@/lib/constants";
import { AppError } from "@/server/errors";
import { prisma } from "@/server/prisma";

import { trackEvent } from "../analytics";

type MetricKey =
  | "speak_voice_seconds"
  | "speak_text_turns"
  | "homework_uploads"
  | "reassessments"
  | "test_prep_plans";

function getUsageWindow(metricKey: MetricKey) {
  const now = new Date();

  switch (metricKey) {
    case "speak_text_turns":
    case "homework_uploads":
      return {
        windowType: "daily" as const,
        windowStart: startOfDay(now),
        windowEnd: endOfDay(now),
      };
    case "reassessments":
    case "test_prep_plans":
      return {
        windowType: "monthly" as const,
        windowStart: startOfDay(subDays(now, 29)),
        windowEnd: endOfDay(now),
      };
    case "speak_voice_seconds":
      return {
        windowType: "lifetime" as const,
        windowStart: new Date("2026-01-01T00:00:00.000Z"),
        windowEnd: addDays(now, 3650),
      };
  }
}

function getMetricLimit(metricKey: MetricKey) {
  switch (metricKey) {
    case "speak_text_turns":
      return FREE_TIER_LIMITS.speakTextTurnsPerDay;
    case "speak_voice_seconds":
      return FREE_TIER_LIMITS.speakVoiceSecondsLifetimeTrial;
    case "homework_uploads":
      return FREE_TIER_LIMITS.homeworkUploadsPerDay;
    case "reassessments":
      return FREE_TIER_LIMITS.reassessmentsPer30Days;
    case "test_prep_plans":
      return FREE_TIER_LIMITS.testPrepPlansPer30Days;
  }
}

export const UsageService = {
  async getOrCreateSubscription(userId: string) {
    const existing = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return prisma.subscription.create({
      data: {
        userId,
        plan: "free",
        status: "active",
      },
    });
  },

  async getCurrentUsageCounter(userId: string, metricKey: MetricKey) {
    const window = getUsageWindow(metricKey);
    const limitValue = getMetricLimit(metricKey);

    const counter =
      (await prisma.usageCounter.findUnique({
        where: {
          userId_metricKey_windowType_windowStart: {
            userId,
            metricKey,
            windowType: window.windowType,
            windowStart: window.windowStart,
          },
        },
      })) ??
      (await prisma.usageCounter.create({
        data: {
          userId,
          metricKey,
          windowType: window.windowType,
          windowStart: window.windowStart,
          windowEnd: window.windowEnd,
          usedValue: 0,
          limitValue,
        },
      }));

    return counter;
  },

  async assertWithinLimit(userId: string, metricKey: MetricKey, amount = 1) {
    const subscription = await this.getOrCreateSubscription(userId);
    const counter = await this.getCurrentUsageCounter(userId, metricKey);

    if (subscription.plan === "pro") {
      return counter;
    }

    if (counter.usedValue + amount > counter.limitValue) {
      await trackEvent({
        eventName: "plan_limit_reached",
        route: "/app/more/billing",
        userId,
        properties: {
          limit_key: metricKey,
          used_value: counter.usedValue,
          limit_value: counter.limitValue,
        },
      });

      throw new AppError("PLAN_LIMIT_REACHED", "Free-tier limit reached.", 402, {
        limitKey: metricKey,
        resetAt: counter.windowEnd.toISOString(),
      });
    }

    return counter;
  },

  async increment(userId: string, metricKey: MetricKey, amount = 1) {
    const counter = await this.getCurrentUsageCounter(userId, metricKey);

    return prisma.usageCounter.update({
      where: { id: counter.id },
      data: {
        usedValue: counter.usedValue + amount,
      },
    });
  },

  async getUsageSnapshot(userId: string) {
    const subscription = await this.getOrCreateSubscription(userId);
    const [
      speakTextTurns,
      speakVoiceSeconds,
      homeworkUploads,
      reassessments,
      testPrepPlans,
    ] = await Promise.all([
      this.getCurrentUsageCounter(userId, "speak_text_turns"),
      this.getCurrentUsageCounter(userId, "speak_voice_seconds"),
      this.getCurrentUsageCounter(userId, "homework_uploads"),
      this.getCurrentUsageCounter(userId, "reassessments"),
      this.getCurrentUsageCounter(userId, "test_prep_plans"),
    ]);

    return {
      plan: subscription.plan,
      limits: FREE_TIER_LIMITS,
      usage: {
        speakTextTurnsToday: speakTextTurns.usedValue,
        speakVoiceSecondsLifetime: speakVoiceSeconds.usedValue,
        homeworkUploadsToday: homeworkUploads.usedValue,
        reassessmentsLast30Days: reassessments.usedValue,
        testPrepPlansLast30Days: testPrepPlans.usedValue,
      },
    };
  },

  async upgradeToPro(userId: string) {
    return prisma.subscription.upsert({
      where: { userId },
      update: {
        plan: "pro",
        status: "active",
        renewalAt: addDays(new Date(), 30),
      },
      create: {
        userId,
        plan: "pro",
        status: "active",
        renewalAt: addDays(new Date(), 30),
      },
    });
  },
};

