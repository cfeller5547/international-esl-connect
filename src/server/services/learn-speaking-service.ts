import { AppError } from "@/server/errors";
import {
  createLearnOpeningPrompt,
  inferLearnOpeningQuestion,
  isGenericLearnOpeningQuestion,
} from "@/server/learn-speaking-prompts";
import { env } from "@/server/env";
import type {
  MissionEvidenceTarget,
  SpeakingMissionPayload,
} from "@/server/learn-speaking-types";
import { prisma } from "@/server/prisma";

import { trackEvent } from "../analytics";
import type { MissionReview } from "../ai/openai-conversation";

import { ConversationService } from "./conversation-service";
import { CurriculumService } from "./curriculum-service";
import { UsageService } from "./usage-service";

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

function getRequiredTurns(payload: Pick<SpeakingMissionPayload, "requiredTurns" | "isBenchmark">) {
  return typeof payload.requiredTurns === "number"
    ? payload.requiredTurns
    : payload.isBenchmark
      ? 4
      : 3;
}

function getMinimumFollowUpResponses(
  payload: Pick<SpeakingMissionPayload, "minimumFollowUpResponses" | "isBenchmark">
) {
  return typeof payload.minimumFollowUpResponses === "number"
    ? payload.minimumFollowUpResponses
    : payload.isBenchmark
      ? 1
      : 1;
}

function countsTowardProgress(
  turn: { speaker: "ai" | "student"; text: string; countsTowardProgress?: boolean }
) {
  return turn.speaker === "student" ? turn.countsTowardProgress !== false : true;
}

function countStudentTurns(
  turns: Array<{
    speaker: "ai" | "student";
    text: string;
    countsTowardProgress?: boolean;
  }>
) {
  return turns.filter((turn) => turn.speaker === "student" && countsTowardProgress(turn)).length;
}

function countSubstantiveFollowUpResponses(
  turns: Array<{
    speaker: "ai" | "student";
    text: string;
    countsTowardProgress?: boolean;
  }>
) {
  return turns
    .filter((turn) => turn.speaker === "student" && countsTowardProgress(turn))
    .slice(1)
    .filter((turn) => turn.text.trim().split(/\s+/).filter(Boolean).length >= 5).length;
}

function canFinishMission(
  turns: Array<{
    speaker: "ai" | "student";
    text: string;
    countsTowardProgress?: boolean;
  }>,
  payload: Pick<
    SpeakingMissionPayload,
    "requiredTurns" | "minimumFollowUpResponses" | "isBenchmark"
  >
) {
  return (
    countStudentTurns(turns) >= getRequiredTurns(payload) &&
    countSubstantiveFollowUpResponses(turns) >= getMinimumFollowUpResponses(payload)
  );
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
    requiredTurns:
      typeof payload.requiredTurns === "number"
        ? payload.requiredTurns
        : Boolean(payload.isBenchmark)
          ? 4
          : 3,
    minimumFollowUpResponses:
      typeof payload.minimumFollowUpResponses === "number"
        ? payload.minimumFollowUpResponses
        : 1,
    evidenceTargets: Array.isArray(payload.evidenceTargets)
      ? payload.evidenceTargets
          .map((target) => {
            const record = target as Record<string, unknown>;
            const kind: "task" | "language" | "detail" | "follow_up" =
              record.kind === "task" ||
              record.kind === "language" ||
              record.kind === "detail" ||
              record.kind === "follow_up"
                ? record.kind
                : "task";
            return {
              key: String(record.key ?? ""),
              label: String(record.label ?? ""),
              kind,
              cues: Array.isArray(record.cues) ? record.cues.map(String) : [],
            } satisfies MissionEvidenceTarget;
          })
          .filter((target) => target.key.length > 0 && target.label.length > 0)
      : [],
    followUpObjectives: Array.isArray(payload.followUpObjectives)
      ? payload.followUpObjectives.map(String)
      : [],
    benchmarkFocus: Array.isArray(payload.benchmarkFocus)
      ? payload.benchmarkFocus.map(String)
      : [],
  };
}

function normalizeMissionReview(
  review: MissionReview | null,
  mission: SpeakingMissionPayload
): MissionReview | null {
  if (!review) {
    return null;
  }

  if (review.evidenceSummary) {
    return review;
  }

  return {
    ...review,
    evidenceSummary: {
      observed: [],
      missing: mission.evidenceTargets.map((target) => target.label),
      nextFocus:
        mission.evidenceTargets[0]?.label ??
        mission.benchmarkFocus[0] ??
        mission.successCriteria[0] ??
        "Keep answering with one more clear detail.",
      benchmarkFocus: mission.benchmarkFocus[0] ?? null,
      followUpResponsesObserved: 0,
      followUpResponsesRequired: mission.minimumFollowUpResponses,
    },
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
    const savedReview = normalizeMissionReview(
      ((progress.responsePayload as Record<string, unknown>)?.missionReview ?? null) as
        | MissionReview
        | null,
      mission
    );
    const sessionTurns =
      session?.turns.map((turn) => ({
        speaker: turn.speaker as "ai" | "student",
        text: turn.transcriptText,
      })) ?? [];

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
            canFinish: canFinishMission(sessionTurns, mission),
            review: normalizeMissionReview(session.evaluationPayload as MissionReview, mission),
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
      seedOpeningTurn: interactionMode !== "voice",
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
        requiredTurns: mission.requiredTurns,
        minimumFollowUpResponses: mission.minimumFollowUpResponses,
        evidenceTargets: mission.evidenceTargets,
        followUpObjectives: mission.followUpObjectives,
        benchmarkFocus: mission.benchmarkFocus,
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
        turns:
          interactionMode === "voice"
            ? []
            : [
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
    const mission = normalizePayload(
      (session?.summaryPayload as Record<string, unknown>) ?? {},
      {
        unitTitle: "Speaking mission",
        scenario: "",
        canDoStatement: "I can respond clearly and keep the conversation moving.",
        performanceTask: "Complete the speaking mission.",
      }
    );
    const sessionTurns =
      session?.turns.map((turn) => ({
        speaker: turn.speaker as "ai" | "student",
        text: turn.transcriptText,
      })) ?? [];

    return {
      aiResponseText: reply.aiResponseText,
      studentTranscriptText: reply.studentTranscriptText ?? null,
      deliveryMode: getDeliveryMode((session?.interactionMode as "text" | "voice") ?? "text"),
      canFinish: canFinishMission(sessionTurns, mission),
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

    const mission = normalizePayload(
      session.summaryPayload as Record<string, unknown>,
      {
        unitTitle: "Speaking mission",
        scenario: "",
        canDoStatement: "I can respond clearly and keep the conversation moving.",
        performanceTask: "Complete the speaking mission.",
      }
    );
    const currentTurns = session.turns.map((turn) => ({
      speaker: turn.speaker as "ai" | "student",
      text: turn.transcriptText,
      countsTowardProgress:
        ((turn.metricsPayload as Record<string, unknown> | null)?.countsTowardProgress as
          | boolean
          | undefined) ?? true,
    }));

    return {
      studentTurnCount: sync.studentTurnCount,
      canFinish: canFinishMission(currentTurns, mission),
      lastStudentTurn: sync.lastStudentTurn,
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

    const mission = normalizePayload(
      existingSession.summaryPayload as Record<string, unknown>,
      {
        unitTitle: "Speaking mission",
        scenario: "",
        canDoStatement: "I can respond clearly and keep the conversation moving.",
        performanceTask: "Complete the speaking mission.",
      }
    );
    const turns = existingSession.turns.map((turn) => ({
      speaker: turn.speaker as "ai" | "student",
      text: turn.transcriptText,
    }));

    if (!canFinishMission(turns, mission)) {
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
        evidence_covered_count: completion.review.evidenceSummary.observed.length,
        evidence_missing_count: completion.review.evidenceSummary.missing.length,
        follow_up_objectives_met:
          completion.review.evidenceSummary.followUpResponsesObserved >=
          completion.review.evidenceSummary.followUpResponsesRequired,
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
