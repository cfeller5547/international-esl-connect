import { prisma } from "@/server/prisma";

import { trackEvent } from "../analytics";

import { ContentService } from "./content-service";
import { StreakService } from "./streak-service";

export const LearnService = {
  async completeActivity({
    userId,
    activityType,
    activityId,
    score,
    metadata,
  }: {
    userId: string;
    activityType: "lesson" | "worksheet" | "speaking_apply" | "daily_challenge";
    activityId: string;
    score: number;
    metadata?: Record<string, unknown>;
  }) {
    const attempt = await prisma.activityAttempt.create({
      data: {
        userId,
        activityType,
        contentId: activityId,
        score,
        status: "completed",
        completedAt: new Date(),
        metadata: (metadata ?? {}) as never,
      },
    });

    await trackEvent({
      eventName: "learn_activity_completed",
      route: `/app/learn/${activityType}/${activityId}`,
      userId,
      properties: {
        activity_type: activityType,
        activity_id: activityId,
        score,
      },
    });

    await StreakService.recordQualifyingActivity(userId);

    let nextAction: { type: string; targetUrl: string } | null = null;
    const inlineProgressDelta: Record<string, number> = {};

    if (activityType === "lesson") {
      const content = await ContentService.getItem(activityId);
      const asset = content.assets[0];
      const nextWorksheetId =
        asset?.metadataPayload && typeof asset.metadataPayload === "object"
          ? (asset.metadataPayload as Record<string, unknown>).nextWorksheetId
          : null;

      if (typeof nextWorksheetId === "string") {
        nextAction = {
          type: "worksheet",
          targetUrl: `/app/learn/worksheet/${nextWorksheetId}`,
        };

        await trackEvent({
          eventName: "learn_chain_step_advanced",
          route: `/app/learn/lesson/${activityId}`,
          userId,
          properties: {
            from_type: "lesson",
            to_type: "worksheet",
          },
        });
      }

      inlineProgressDelta.grammar = 2;
    }

    if (activityType === "worksheet") {
      nextAction = {
        type: "speaking_apply",
        targetUrl: `/app/speak?apply=${activityId}`,
      };

      await trackEvent({
        eventName: "learn_chain_step_advanced",
        route: `/app/learn/worksheet/${activityId}`,
        userId,
        properties: {
          from_type: "worksheet",
          to_type: "speaking_apply",
        },
      });

      inlineProgressDelta.speaking = 2;
    }

    return { attempt, nextAction, inlineProgressDelta };
  },
};
