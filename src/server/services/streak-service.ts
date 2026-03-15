import { differenceInCalendarDays } from "date-fns";

import { STREAK_MILESTONES } from "@/lib/constants";
import { prisma } from "@/server/prisma";

import { trackEvent } from "../analytics";

export const StreakService = {
  async getOrCreate(userId: string) {
    return prisma.userStreak.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
      },
    });
  },

  async getSnapshot(userId: string) {
    const streak = await this.getOrCreate(userId);
    const nextMilestoneDays =
      STREAK_MILESTONES.find((milestone) => milestone > streak.currentStreakDays) ?? null;

    return {
      currentStreakDays: streak.currentStreakDays,
      longestStreakDays: streak.longestStreakDays,
      lastQualifyingActivityDate: streak.lastQualifyingActivityAt?.toISOString().slice(0, 10) ?? null,
      nextMilestoneDays,
    };
  },

  async recordQualifyingActivity(userId: string) {
    const streak = await this.getOrCreate(userId);
    const today = new Date();

    const dayDelta = streak.lastQualifyingActivityAt
      ? differenceInCalendarDays(today, streak.lastQualifyingActivityAt)
      : null;

    if (dayDelta === 0) {
      return streak;
    }

    const currentStreakDays =
      dayDelta === 1 || dayDelta === null ? streak.currentStreakDays + 1 : 1;

    const updated = await prisma.userStreak.update({
      where: { id: streak.id },
      data: {
        currentStreakDays,
        longestStreakDays: Math.max(streak.longestStreakDays, currentStreakDays),
        lastQualifyingActivityAt: today,
        lastMilestoneEmitted: STREAK_MILESTONES.includes(currentStreakDays as never)
          ? currentStreakDays
          : streak.lastMilestoneEmitted,
      },
    });

    await trackEvent({
      eventName: "streak_updated",
      route: "/app/progress",
      userId,
      properties: {
        current_streak_days: updated.currentStreakDays,
        longest_streak_days: updated.longestStreakDays,
      },
    });

    if (
      STREAK_MILESTONES.includes(updated.currentStreakDays as never) &&
      streak.lastMilestoneEmitted !== updated.currentStreakDays
    ) {
      await trackEvent({
        eventName: "streak_milestone_reached",
        route: "/app/progress",
        userId,
        properties: {
          milestone_days: updated.currentStreakDays,
        },
      });
    }

    return updated;
  },
};
