import { GUIDED_SCENARIOS, SPEAK_STARTERS } from "@/lib/constants";
import { AppError } from "@/server/errors";

import { trackEvent } from "../analytics";

import { ConversationService } from "./conversation-service";

function resolveStarterPrompt(starterKey?: string | null) {
  return (
    SPEAK_STARTERS.find((starter) => starter.key === starterKey)?.prompt ??
    SPEAK_STARTERS[0].prompt
  );
}

function resolveScenario(scenarioKey?: string | null) {
  const scenario =
    GUIDED_SCENARIOS.find((entry) => entry.key === scenarioKey) ??
    GUIDED_SCENARIOS[0];

  return {
    title: scenario?.title ?? "Guided scenario",
    description:
      scenario?.description ?? "Practice a short academic speaking scenario.",
  };
}

export const SpeakService = {
  async getStarters() {
    return SPEAK_STARTERS;
  },

  async startSession({
    userId,
    mode,
    interactionMode,
    starterKey,
    scenarioKey,
    summaryPayload = {},
  }: {
    userId: string;
    mode: "free_speech" | "guided";
    interactionMode: "text" | "voice";
    starterKey?: string | null;
    scenarioKey?: string | null;
    summaryPayload?: Record<string, unknown>;
  }) {
    const starterPrompt = resolveStarterPrompt(starterKey);
    const scenario = resolveScenario(scenarioKey);

    try {
      const session = await ConversationService.startSession({
        userId,
        mode,
        interactionMode,
        surface: "speak",
        missionKind: mode,
        scenarioKey: scenarioKey ?? starterKey,
        seedOpeningTurn: interactionMode !== "voice",
        summaryPayload: {
          starterKey,
          starterPrompt,
          scenarioTitle: mode === "guided" ? scenario.title : "Open speaking practice",
          scenarioSetup:
            mode === "guided"
              ? scenario.description
              : starterPrompt,
          targetPhrases: [],
          followUpPrompts:
            mode === "guided"
              ? [
                  "Answer with one clear idea, then add a helpful detail.",
                  "Explain why that matters.",
                  "Give one specific example from class, work, or daily life.",
                ]
              : [
                  "Say a little more about that.",
                  "Give one specific example.",
                  "Explain why that matters to you.",
                ],
          successCriteria: [
            "Respond clearly to the prompt.",
            "Add at least one useful detail.",
          ],
          ...summaryPayload,
        },
      });

      await trackEvent({
        eventName: "speak_session_started",
        route: "/app/speak",
        userId,
        properties: {
          mode,
          scenario_key: scenarioKey ?? starterKey,
        },
      });

      return {
        sessionId: session.sessionId,
        starterPrompt,
      };
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "VOICE_MODE_UPGRADE_REQUIRED"
      ) {
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

    return {
      aiResponseText: reply.aiResponseText,
      transcriptUpdated: true,
      microCoaching: reply.microCoaching,
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
        },
      });
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
