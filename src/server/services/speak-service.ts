import { SPEAK_STARTERS } from "@/lib/constants";
import { AppError } from "@/server/errors";
import { prisma } from "@/server/prisma";

import {
  generateSpeakReply,
  generateTranscriptAnnotations,
} from "../ai/heuristics";
import { trackEvent } from "../analytics";

import { StreakService } from "./streak-service";
import { UsageService } from "./usage-service";

function resolveStarterPrompt(starterKey?: string | null) {
  return (
    SPEAK_STARTERS.find((starter) => starter.key === starterKey)?.prompt ??
    SPEAK_STARTERS[0].prompt
  );
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
    const subscription = await UsageService.getOrCreateSubscription(userId);

    if (interactionMode === "voice" && subscription.plan !== "pro") {
      await trackEvent({
        eventName: "voice_mode_upgrade_prompt_shown",
        route: "/app/speak",
        userId,
        properties: {},
      });

      throw new AppError(
        "VOICE_MODE_UPGRADE_REQUIRED",
        "Voice input requires Pro on this build.",
        402
      );
    }

    const session = await prisma.speakSession.create({
      data: {
        userId,
        mode,
        interactionMode,
        scenarioKey: scenarioKey ?? starterKey,
        status: "active",
        summaryPayload: {
          starterKey,
          starterPrompt: resolveStarterPrompt(starterKey),
          ...summaryPayload,
        },
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
      sessionId: session.id,
      starterPrompt: resolveStarterPrompt(starterKey),
    };
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
    };
  }) {
    const session = await prisma.speakSession.findFirstOrThrow({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        turns: {
          orderBy: { turnIndex: "asc" },
        },
      },
    });

    await UsageService.assertWithinLimit(userId, "speak_text_turns");
    await UsageService.increment(userId, "speak_text_turns");

    const starterPrompt = String(
      (session.summaryPayload as Record<string, unknown>)?.starterPrompt ??
        resolveStarterPrompt((session.summaryPayload as Record<string, unknown>)?.starterKey as string)
    );

    const studentText = studentInput.text?.trim() ?? "";
    const nextTurnIndex = session.turns.length + 1;

    await prisma.speakTurn.create({
      data: {
        speakSessionId: session.id,
        speaker: "student",
        turnIndex: nextTurnIndex,
        transcriptText: studentText,
        audioRef: studentInput.audioRef,
        metricsPayload: {},
      },
    });

    const reply = generateSpeakReply({
      starterPrompt,
      studentInput: studentText,
    });

    await prisma.speakTurn.create({
      data: {
        speakSessionId: session.id,
        speaker: "ai",
        turnIndex: nextTurnIndex + 1,
        transcriptText: reply.aiResponseText,
        metricsPayload: {
          microCoaching: reply.microCoaching,
          turnSignals: reply.turnSignals,
        },
      },
    });

    await trackEvent({
      eventName: "speak_turn_submitted",
      route: `/app/speak/session/${sessionId}`,
      userId,
      properties: {
        turn_index: nextTurnIndex,
        input_mode: session.interactionMode,
      },
    });

    return {
      aiResponseText: reply.aiResponseText,
      transcriptUpdated: true,
      microCoaching: reply.microCoaching,
    };
  },

  async completeSession(sessionId: string, userId: string) {
    const session = await prisma.speakSession.findFirstOrThrow({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        turns: {
          orderBy: { turnIndex: "asc" },
        },
      },
    });

    const studentTurns = session.turns.filter((turn) => turn.speaker === "student");
    const summary = {
      strengths: ["You stayed engaged through the conversation.", "You added useful detail."],
      improvements: ["Practice longer responses.", "Check verb tense consistency."],
    };

    await prisma.speakSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        completedAt: new Date(),
        durationSeconds: studentTurns.length * 30,
        summaryPayload: {
          ...(session.summaryPayload as Record<string, unknown>),
          ...summary,
        },
      },
    });

    await trackEvent({
      eventName: "speak_session_completed",
      route: `/app/speak/session/${sessionId}`,
      userId,
      properties: {
        mode: session.mode,
        duration_seconds: studentTurns.length * 30,
        turn_count: studentTurns.length,
      },
    });

    const chainContext = session.summaryPayload as Record<string, unknown>;
    if (chainContext?.chainLessonId && chainContext?.chainWorksheetId) {
      await trackEvent({
        eventName: "learn_chain_completed",
        route: `/app/speak/session/${sessionId}`,
        userId,
        properties: {
          lesson_id: chainContext.chainLessonId,
          worksheet_id: chainContext.chainWorksheetId,
          speaking_session_id: sessionId,
        },
      });
    }

    await StreakService.recordQualifyingActivity(userId);

    return { summary };
  },

  async getTranscript(sessionId: string, userId: string) {
    const session = await prisma.speakSession.findFirstOrThrow({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        turns: {
          orderBy: { turnIndex: "asc" },
        },
      },
    });

    const transcript = generateTranscriptAnnotations(
      session.turns.map((turn) => ({
        speaker: turn.speaker,
        text: turn.transcriptText,
      }))
    );

    return {
      sessionId,
      ...transcript,
    };
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
    const phrase = await prisma.phraseBankItem.create({
      data: {
        userId,
        sourceSpeakSessionId: sessionId,
        phraseText,
        translationText,
        contextPayload: {},
      },
    });

    await trackEvent({
      eventName: "transcript_phrase_saved",
      route: `/app/speak/session/${sessionId}`,
      userId,
      properties: {
        session_id: sessionId,
      },
    });

    return phrase;
  },

  async listSavedPhrases(userId: string) {
    return prisma.phraseBankItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },
};
