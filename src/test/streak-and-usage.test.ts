/** @vitest-environment node */

import { afterAll, describe, expect, it } from "vitest";

import { AppError } from "@/server/errors";
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

  it("enforces the documented free-tier text turn limit", async () => {
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

    await UsageService.getOrCreateSubscription(user.id);
    const counter = await UsageService.getCurrentUsageCounter(user.id, "speak_text_turns");

    await prisma.usageCounter.update({
      where: { id: counter.id },
      data: {
        usedValue: counter.limitValue - 1,
      },
    });

    await UsageService.assertWithinLimit(user.id, "speak_text_turns");
    await UsageService.increment(user.id, "speak_text_turns");

    await expect(
      UsageService.assertWithinLimit(user.id, "speak_text_turns")
    ).rejects.toBeInstanceOf(AppError);
  });
});
