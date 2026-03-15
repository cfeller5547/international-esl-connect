import { AppError } from "@/server/errors";
import {
  createLearnOpeningPrompt,
  inferLearnOpeningQuestion,
  isGenericLearnOpeningQuestion,
} from "@/server/learn-speaking-prompts";
import { env } from "@/server/env";
import { prisma } from "@/server/prisma";

import { trackEvent } from "../analytics";
import type { MissionReview } from "../ai/openai-conversation";

import { ConversationService } from "./conversation-service";
import { CurriculumService } from "./curriculum-service";
import { UsageService } from "./usage-service";

type SpeakingMissionPayload = {
  scenarioTitle: string;
  scenarioSetup: string;
  counterpartRole: string;
  openingQuestion: string;
  warmupPrompts: string[];
  targetPhrases: string[];
  followUpPrompts: string[];
  successCriteria: string[];
  modelExample: string;
  isBenchmark: boolean;
};

function inferCounterpartRole(text: string) {
  const normalized = text.toLowerCase();

  if (normalized.includes("interview")) {
    return "interviewer";
  }

  if (normalized.includes("customer")) {
    return "customer";
  }

  if (
    normalized.includes("classmate") ||
    normalized.includes("partner") ||
    normalized.includes("group")
  ) {
    return "classmate";
  }

  if (normalized.includes("teacher") || normalized.includes("class")) {
    return "teacher";
  }

  return "conversation partner";
}

function inferOpeningQuestion({
  scenarioTitle,
  scenarioSetup,
  canDoStatement,
  performanceTask,
}: {
  scenarioTitle: string;
  scenarioSetup: string;
  canDoStatement: string;
  performanceTask: string;
}) {
  return inferLearnOpeningQuestion({
    scenarioTitle,
    scenarioSetup,
    canDoStatement,
    performanceTask,
  });
}

function getRequiredTurns(isBenchmark: boolean) {
  return isBenchmark ? 4 : 3;
}

function getDeliveryMode(
  interactionMode: "text" | "voice"
): "text_chat" | "realtime_voice" {
  return interactionMode === "voice" ? "realtime_voice" : "text_chat";
}

function normalizePayload(
  payload: Record<string, unknown>,
  fallback: {
    unitTitle: string;
    scenario: string;
    canDoStatement: string;
    performanceTask: string;
  }
): SpeakingMissionPayload {
  const scenarioSetup =
    typeof payload.scenarioSetup === "string"
      ? payload.scenarioSetup
      : fallback.scenario;

  return {
    scenarioTitle:
      typeof payload.scenarioTitle === "string"
        ? payload.scenarioTitle
        : `${fallback.unitTitle} speaking mission`,
    scenarioSetup,
    counterpartRole:
      typeof payload.counterpartRole === "string"
        ? payload.counterpartRole
        : inferCounterpartRole(scenarioSetup),
    openingQuestion:
      typeof payload.openingQuestion === "string" &&
      !isGenericLearnOpeningQuestion(payload.openingQuestion)
        ? payload.openingQuestion
        : inferOpeningQuestion({
            scenarioTitle:
              typeof payload.scenarioTitle === "string"
                ? payload.scenarioTitle
                : fallback.unitTitle,
            scenarioSetup,
            canDoStatement: fallback.canDoStatement,
            performanceTask: fallback.performanceTask,
          }),
    warmupPrompts: Array.isArray(payload.warmupPrompts)
      ? payload.warmupPrompts.map(String)
      : [fallback.canDoStatement],
    targetPhrases: Array.isArray(payload.targetPhrases)
      ? payload.targetPhrases.map(String)
      : [],
    followUpPrompts: Array.isArray(payload.followUpPrompts)
      ? payload.followUpPrompts.map(String)
      : [fallback.performanceTask],
    successCriteria: Array.isArray(payload.successCriteria)
      ? payload.successCriteria.map(String)
      : [fallback.canDoStatement],
    modelExample:
      typeof payload.modelExample === "string"
        ? payload.modelExample
        : fallback.performanceTask,
    isBenchmark: Boolean(payload.isBenchmark),
  };
}

async function repairGenericOpeningTurn({
  session,
  mission,
  canDoStatement,
  performanceTask,
}: {
  session: Awaited<ReturnType<typeof ConversationService.getLatestLearnSession>>;
  mission: SpeakingMissionPayload;
  canDoStatement: string;
  performanceTask: string;
}) {
  if (!session || session.status !== "active") {
    return session;
  }

  const firstTurn = session.turns[0];
  const studentTurnCount = session.turns.filter((turn) => turn.speaker === "student").length;

  if (!firstTurn || studentTurnCount > 0 || !isGenericLearnOpeningQuestion(firstTurn.transcriptText)) {
    return session;
  }

  const repairedOpening = createLearnOpeningPrompt({
    scenarioTitle: mission.scenarioTitle,
    scenarioSetup: mission.scenarioSetup,
    canDoStatement,
    performanceTask,
    counterpartRole: mission.counterpartRole,
    openingQuestion: mission.openingQuestion,
  });

  if (repairedOpening === firstTurn.transcriptText) {
    return session;
  }

  await prisma.speakTurn.update({
    where: {
      id: firstTurn.id,
    },
    data: {
      transcriptText: repairedOpening,
    },
  });

  return {
    ...session,
    turns: [
      {
        ...firstTurn,
        transcriptText: repairedOpening,
      },
      ...session.turns.slice(1),
    ],
  };
}

export const LearnSpeakingService = {
  async getMissionView(userId: string, unitSlug: string) {
    const { curriculum, unit, activity } = await CurriculumService.getUnitActivity(
      userId,
      unitSlug,
      "speaking"
    );

    const progress = await prisma.userUnitActivityProgress.findUniqueOrThrow({
      where: {
        userId_activityId: {
          userId,
          activityId: activity.id,
        },
      },
    });

    const latestSession = await ConversationService.getLatestLearnSession({
      userId,
      curriculumActivityId: activity.id,
    });
    const subscription = await UsageService.getOrCreateSubscription(userId);

    const mission = normalizePayload(activity.payload, {
      unitTitle: unit.title,
      scenario:
        typeof activity.payload.scenario === "string"
          ? activity.payload.scenario
          : unit.theme,
      canDoStatement: unit.canDoStatement,
      performanceTask: unit.performanceTask,
    });
    const session = await repairGenericOpeningTurn({
      session: latestSession,
      mission,
      canDoStatement: unit.canDoStatement,
      performanceTask: unit.performanceTask,
    });
    const requiredTurns = getRequiredTurns(mission.isBenchmark);

    const savedReview = ((progress.responsePayload as Record<string, unknown>)?.missionReview ??
      null) as MissionReview | null;

    return {
      curriculum,
      unit,
      activity,
      mission,
      plan: subscription.plan as "free" | "pro",
      voiceEnabled: subscription.plan === "pro" && Boolean(env.OPENAI_API_KEY),
      progressStatus: progress.status,
      savedReview,
      session: session
        ? {
            id: session.id,
            status: session.status,
            interactionMode: session.interactionMode as "text" | "voice",
            deliveryMode: getDeliveryMode(session.interactionMode as "text" | "voice"),
            missionKind: session.missionKind,
            startedAt: session.startedAt.toISOString(),
            completedAt: session.completedAt?.toISOString() ?? null,
            retryOfSessionId: session.retryOfSessionId,
            canFinish:
              session.turns.filter((turn) => turn.speaker === "student").length >= requiredTurns,
            review: session.evaluationPayload as MissionReview,
            turns: session.turns.map((turn) => ({
              turnIndex: turn.turnIndex,
              speaker: turn.speaker as "ai" | "student",
              text: turn.transcriptText,
            })),
          }
        : null,
    };
  },

  async startMission({
    userId,
    unitSlug,
    interactionMode,
    retryOfSessionId,
  }: {
    userId: string;
    unitSlug: string;
    interactionMode: "text" | "voice";
    retryOfSessionId?: string | null;
  }) {
    const { unit, activity } = await CurriculumService.getUnitActivity(
      userId,
      unitSlug,
      "speaking"
    );
    const mission = normalizePayload(activity.payload, {
      unitTitle: unit.title,
      scenario:
        typeof activity.payload.scenario === "string"
          ? activity.payload.scenario
          : unit.theme,
      canDoStatement: unit.canDoStatement,
      performanceTask: unit.performanceTask,
    });

    const session = await ConversationService.startSession({
      userId,
      mode: "guided",
      interactionMode,
      surface: "learn",
      missionKind: mission.isBenchmark ? "unit_benchmark" : "unit_speaking",
      curriculumUnitId: unit.id,
      curriculumActivityId: activity.id,
      retryOfSessionId,
      summaryPayload: {
        unitSlug,
        unitTitle: unit.title,
        scenarioTitle: mission.scenarioTitle,
        scenarioSetup: mission.scenarioSetup,
        counterpartRole: mission.counterpartRole,
        openingQuestion: mission.openingQuestion,
        canDoStatement: unit.canDoStatement,
        performanceTask: unit.performanceTask,
        targetPhrases: mission.targetPhrases,
        followUpPrompts: mission.followUpPrompts,
        successCriteria: mission.successCriteria,
        modelExample: mission.modelExample,
        isBenchmark: mission.isBenchmark,
      },
    });

    await trackEvent({
      eventName: retryOfSessionId
        ? "learn_speaking_retry_started"
        : "learn_speaking_mission_started",
      route: `/app/learn/unit/${unitSlug}/speaking`,
      userId,
      properties: {
        unit_slug: unitSlug,
        interaction_mode: interactionMode,
        delivery_mode: getDeliveryMode(interactionMode),
        is_benchmark: mission.isBenchmark,
      },
    });

    const openingTurn = session.openingPrompt;

    return {
      sessionId: session.sessionId,
      deliveryMode: getDeliveryMode(interactionMode),
      openingTurn,
      resumeState: {
        status: "active" as const,
        interactionMode,
        turns: [
          {
            speaker: "ai" as const,
            text: openingTurn,
          },
        ],
      },
      canFinish: false,
    };
  },

  async submitTurn({
    userId,
    sessionId,
    studentInput,
  }: {
    userId: string;
    sessionId: string;
    studentInput: {
      text?: string;
      audioRef?: string;
      audioDataUrl?: string;
      audioMimeType?: string;
      durationSeconds?: number;
    };
  }) {
    const reply = await ConversationService.submitTurn({
      userId,
      sessionId,
      studentInput,
    });
    const session = await ConversationService.getSession(sessionId, userId);
    const studentTurnCount =
      session?.turns.filter((turn) => turn.speaker === "student").length ?? 0;
    const requiredTurns = getRequiredTurns(session?.missionKind === "unit_benchmark");

    return {
      aiResponseText: reply.aiResponseText,
      studentTranscriptText: reply.studentTranscriptText ?? null,
      deliveryMode: getDeliveryMode((session?.interactionMode as "text" | "voice") ?? "text"),
      canFinish: studentTurnCount >= requiredTurns,
    };
  },

  async createRealtimeClientSecret({
    userId,
    sessionId,
  }: {
    userId: string;
    sessionId: string;
  }) {
    const session = await ConversationService.getSession(sessionId, userId);

    if (!session || session.surface !== "learn") {
      throw new AppError("NOT_FOUND", "Learn speaking mission not found.", 404);
    }

    return ConversationService.getRealtimeClientSecret({
      sessionId,
      userId,
    });
  },

  async syncRealtimeTranscript({
    userId,
    sessionId,
    turns,
  }: {
    userId: string;
    sessionId: string;
    turns: Array<{
      speaker: "ai" | "student";
      text: string;
    }>;
  }) {
    const sync = await ConversationService.syncRealtimeTranscript({
      sessionId,
      userId,
      turns,
    });
    const session = await ConversationService.getSession(sessionId, userId);

    if (!session || session.surface !== "learn") {
      throw new AppError("NOT_FOUND", "Learn speaking mission not found.", 404);
    }

    const requiredTurns = getRequiredTurns(session.missionKind === "unit_benchmark");

    return {
      studentTurnCount: sync.studentTurnCount,
      canFinish: sync.studentTurnCount >= requiredTurns,
    };
  },

  async completeMission({
    userId,
    unitSlug,
    sessionId,
  }: {
    userId: string;
    unitSlug: string;
    sessionId: string;
  }) {
    const existingSession = await ConversationService.getSession(sessionId, userId);

    if (!existingSession || existingSession.surface !== "learn") {
      throw new AppError("NOT_FOUND", "Learn speaking mission not found.", 404);
    }

    const studentTurnCount = existingSession.turns.filter(
      (turn) => turn.speaker === "student"
    ).length;
    const requiredTurns = getRequiredTurns(existingSession.missionKind === "unit_benchmark");

    if (studentTurnCount < requiredTurns) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Keep the conversation going a little longer before opening feedback.",
        400
      );
    }

    const completion = await ConversationService.completeSession({
      sessionId,
      userId,
    });
    const session = await ConversationService.getSession(sessionId, userId);

    if (!session || session.surface !== "learn") {
      throw new AppError("NOT_FOUND", "Learn speaking mission not found.", 404);
    }

    await trackEvent({
      eventName: "learn_speaking_mission_completed",
      route: `/app/learn/unit/${unitSlug}/speaking`,
      userId,
      properties: {
        unit_slug: unitSlug,
        interaction_mode: session.interactionMode,
        delivery_mode: getDeliveryMode(session.interactionMode as "text" | "voice"),
        is_benchmark: session.missionKind === "unit_benchmark",
        score: completion.review.score,
      },
    });

    await trackEvent({
      eventName: "learn_speaking_feedback_viewed",
      route: `/app/learn/unit/${unitSlug}/speaking`,
      userId,
      properties: {
        unit_slug: unitSlug,
        status: completion.review.status,
      },
    });

    return completion.review;
  },
};
