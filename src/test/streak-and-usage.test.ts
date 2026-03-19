/** @vitest-environment node */

import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/prisma";
import { StreakService } from "@/server/services/streak-service";
import { UsageService } from "@/server/services/usage-service";

describe("streaks and limits", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps streak updates idempotent within one day", async () => {
    const user = await prisma.user.create({
      data: {
        email: `streak-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "spanish",
        schoolLevel: "high_school",
        fullDiagnosticCompletedAt: new Date(),
      },
    });

    const first = await StreakService.recordQualifyingActivity(user.id);
    const second = await StreakService.recordQualifyingActivity(user.id);

    expect(first.currentStreakDays).toBe(1);
    expect(second.currentStreakDays).toBe(1);
  });

  it("normalizes subscriptions to active pro access", async () => {
    const user = await prisma.user.create({
      data: {
        email: `limit-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "spanish",
        schoolLevel: "high_school",
        fullDiagnosticCompletedAt: new Date(),
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "free",
        status: "canceled",
      },
    });

    const subscription = await UsageService.getOrCreateSubscription(user.id);

    expect(subscription.plan).toBe("pro");
    expect(subscription.status).toBe("active");
  });
});
