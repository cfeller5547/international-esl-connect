import {
  buildSpeakLaunchViewModel,
  buildSpeakMissionPayload,
  type SpeakLaunchViewModel,
} from "@/features/speak/speak-view-model";
import { AppError } from "@/server/errors";
import { prisma } from "@/server/prisma";

import { trackEvent } from "../analytics";

import { ContextService } from "./context-service";
import { ConversationService } from "./conversation-service";
import { CurriculumService } from "./curriculum-service";
import { UsageService } from "./usage-service";

async function getSpeakPersonalizationSnapshot(userId: string) {
  const [user, activeTopics, subscription] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        reports: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            skillSnapshots: true,
          },
        },
      },
    }),
    ContextService.getActiveTopics(userId),
    UsageService.getOrCreateSubscription(userId),
  ]);

  const latestReport = user.reports[0] ?? null;
  const weakestSkill =
    latestReport?.skillSnapshots
      .slice()
      .sort((a, b) => a.score - b.score)[0]
      ?.skill ?? null;

  let currentLearnTitle: string | null = null;

  try {
    const nextLearningAction = await CurriculumService.getNextLearningAction(userId);
    currentLearnTitle = nextLearningAction.unitId ? nextLearningAction.title : null;
  } catch {
    currentLearnTitle = null;
  }

  return {
    currentLevel: user.currentLevel ?? latestReport?.levelLabel ?? null,
    weakestSkill,
    activeTopics,
    currentLearnTitle,
    plan: subscription.plan as "free" | "pro",
  };
}

function countCoachedTurns(turns: Array<{ metricsPayload: unknown }>) {
  return turns.filter((turn) => {
    const metrics = turn.metricsPayload as Record<string, unknown> | null;
    return Boolean(metrics?.microCoaching);
  }).length;
}

export const SpeakService = {
  async getLaunchState(userId: string): Promise<{
    viewModel: SpeakLaunchViewModel;
    plan: "free" | "pro";
  }> {
    const snapshot = await getSpeakPersonalizationSnapshot(userId);

    return {
      viewModel: buildSpeakLaunchViewModel(snapshot),
      plan: snapshot.plan,
    };
  },

  async startSession({
    userId,
    type,
    interactionMode,
    id,
    summaryPayload = {},
  }: {
    userId: string;
    type: "free_speech" | "mission";
    interactionMode: "text" | "voice";
    id?: string | null;
    summaryPayload?: Record<string, unknown>;
  }) {
    const snapshot = await getSpeakPersonalizationSnapshot(userId);
    const missionPayload = buildSpeakMissionPayload(type, id ?? null, snapshot);

    try {
      const session = await ConversationService.startSession({
        userId,
        mode: type,
        interactionMode,
        surface: "speak",
        missionKind: type,
        scenarioKey: id ?? type,
        seedOpeningTurn: interactionMode !== "voice",
        summaryPayload: {
          ...missionPayload,
          ...summaryPayload,
        },
      });

      await trackEvent({
        eventName: "speak_session_started",
        route: "/app/speak",
        userId,
        properties: {
          mode: type,
          scenario_key: id ?? type,
        },
      });

      return {
        sessionId: session.sessionId,
        starterPrompt: missionPayload.starterPrompt,
      };
    } catch (error) {
      if (error instanceof AppError && error.code === "VOICE_MODE_UPGRADE_REQUIRED") {
        await trackEvent({
          eventName: "voice_mode_upgrade_prompt_shown",
          route: "/app/speak",
          userId,
          properties: {},
        });
      }

      throw error;
    }
  },

  async submitTurn({
    sessionId,
    userId,
    studentInput,
  }: {
    sessionId: string;
    userId: string;
    studentInput: {
      text?: string;
      audioRef?: string;
      audioDataUrl?: string;
      audioMimeType?: string;
      durationSeconds?: number;
    };
  }) {
    const reply = await ConversationService.submitTurn({
      sessionId,
      userId,
      studentInput,
    });

    const session = await ConversationService.getSession(sessionId, userId);
    const turnIndex =
      session?.turns.filter((turn) => turn.speaker === "student").length ?? 0;

    await trackEvent({
      eventName: "speak_turn_submitted",
      route: `/app/speak/session/${sessionId}`,
      userId,
      properties: {
        turn_index: turnIndex,
        input_mode: session?.interactionMode ?? "text",
      },
    });

    if (session && countCoachedTurns(session.turns) > 0) {
      await trackEvent({
        eventName: "speak_turn_coaching_shown",
        route: `/app/speak/session/${sessionId}`,
        userId,
        properties: {
          input_mode: session.interactionMode,
        },
      });
    }

    return {
      aiResponseText: reply.aiResponseText,
      transcriptUpdated: true,
      microCoaching: reply.microCoaching,
      turnSignals: reply.turnSignals,
      coachLabel: reply.coachLabel,
      aiAudioBase64: reply.aiAudioBase64 ?? null,
      studentTranscriptText: reply.studentTranscriptText ?? null,
    };
  },

  async createRealtimeClientSecret(sessionId: string, userId: string) {
    return ConversationService.getRealtimeClientSecret({
      sessionId,
      userId,
    });
  },

  async syncRealtimeTranscript({
    sessionId,
    userId,
    turns,
  }: {
    sessionId: string;
    userId: string;
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

    if (sync.newStudentTurns > 0) {
      await trackEvent({
        eventName: "speak_turn_submitted",
        route: `/app/speak/session/${sessionId}`,
        userId,
        properties: {
          turn_index: sync.studentTurnCount,
          input_mode: "voice",
          turn_disposition: sync.lastStudentTurn?.disposition ?? "accepted_answer",
          counts_toward_progress: sync.lastStudentTurn?.countsTowardProgress ?? true,
          noise_detected: sync.lastStudentTurn?.disposition === "noise_or_unintelligible",
          clarification_rephrase_used:
            sync.lastStudentTurn?.disposition === "clarification_request",
        },
      });

      if (sync.studentCoachings.length > 0) {
        await trackEvent({
          eventName: "speak_turn_coaching_shown",
          route: `/app/speak/session/${sessionId}`,
          userId,
          properties: {
            input_mode: "voice",
            turn_disposition: sync.lastStudentTurn?.disposition ?? "accepted_answer",
          },
        });
      }
    }

    return sync;
  },

  async completeSession(
    sessionId: string,
    userId: string,
    options?: {
      durationSeconds?: number;
    }
  ) {
    const completion = await ConversationService.completeSession({
      sessionId,
      userId,
      durationSecondsOverride: options?.durationSeconds,
    });
    const session = await ConversationService.getSession(sessionId, userId);

    await trackEvent({
      eventName: "speak_session_completed",
      route: `/app/speak/session/${sessionId}`,
      userId,
      properties: {
        mode: session?.mode ?? "guided",
        duration_seconds: completion.durationSeconds,
        turn_count: completion.studentTurnCount,
      },
    });

    return {
      summary: {
        strengths: [completion.review.strength],
        improvements: [completion.review.improvement],
      },
    };
  },

  async getTranscript(sessionId: string, userId: string) {
    return ConversationService.getTranscript(sessionId, userId);
  },

  async savePhrase({
    sessionId,
    userId,
    phraseText,
    translationText,
  }: {
    sessionId: string;
    userId: string;
    phraseText: string;
    translationText?: string;
  }) {
    return ConversationService.savePhrase({
      sessionId,
      userId,
      phraseText,
      translationText,
    });
  },

  async listSavedPhrases(userId: string) {
    return ConversationService.listSavedPhrases(userId);
  },
};
