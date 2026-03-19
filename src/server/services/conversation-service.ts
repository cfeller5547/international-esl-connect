import { AppError } from "@/server/errors";
import { prisma } from "@/server/prisma";
import { env } from "@/server/env";
import { Prisma } from "@/generated/prisma/client";
import { serializeRealtimeClientSecret } from "@/server/realtime-client-secret";
import { buildSpeakTurnCoaching, filterSpeakVocabulary, sanitizeSpeakPhraseTerm } from "@/lib/speak";

import {
  createOpeningPrompt,
  evaluateMissionTranscript,
  generateConversationReply,
  transcribeAudioInput,
  type ConversationContext,
  type ConversationMissionKind,
  type ConversationReply,
  type ConversationSurface,
  type MissionReview,
} from "../ai/openai-conversation";
import { trackEvent } from "../analytics";
import { openai } from "@/server/openai";

import { StreakService } from "./streak-service";
import { UsageService } from "./usage-service";

type StartConversationSessionInput = {
  userId: string;
  mode: "free_speech" | "guided";
  interactionMode: "text" | "voice";
  surface: ConversationSurface;
  missionKind: ConversationMissionKind;
  scenarioKey?: string | null;
  curriculumUnitId?: string | null;
  curriculumActivityId?: string | null;
  retryOfSessionId?: string | null;
  summaryPayload?: Record<string, unknown>;
  openingPrompt?: string;
  seedOpeningTurn?: boolean;
};

type SubmitConversationTurnInput = {
  sessionId: string;
  userId: string;
  studentInput: {
    text?: string;
    audioRef?: string;
    audioDataUrl?: string;
    audioMimeType?: string;
    durationSeconds?: number;
  };
};

type RealtimeTranscriptTurnInput = {
  speaker: "ai" | "student";
  text: string;
};

type PersistedTurnCoaching = {
  turnIndex: number;
  microCoaching: string;
  coachLabel: string;
  turnSignals: {
    fluencyIssue: boolean;
    grammarIssue: boolean;
    vocabOpportunity: boolean;
  };
};

function normalizeTranscriptTurns(turns: RealtimeTranscriptTurnInput[]) {
  return turns
    .map((turn) => ({
      speaker: turn.speaker,
      text: turn.text.trim(),
    }))
    .filter((turn) => turn.text.length > 0);
}

function deriveRealtimeStudentCoaching({
  studentText,
  context,
  turnIndex,
}: {
  studentText: string;
  context: ConversationContext;
  turnIndex: number;
}): PersistedTurnCoaching {
  const normalizedText = studentText.trim();
  const wordCount = normalizedText.split(/\s+/).filter(Boolean).length;
  const includesLowercaseI = /\bi\b/.test(normalizedText) && !/\bI\b/.test(normalizedText);
  const usesTargetPhrase = context.targetPhrases.some((phrase) => {
    const normalizedPhrase = phrase.replace(/\.\.\.$/, "").trim().toLowerCase();
    return normalizedPhrase.length > 0 && normalizedText.toLowerCase().includes(normalizedPhrase);
  });
  const turnSignals = {
    fluencyIssue: wordCount < 6,
    grammarIssue: /\b(goed|wented|eated)\b/i.test(normalizedText) || includesLowercaseI,
    vocabOpportunity: !usesTargetPhrase && wordCount < 14,
  };

  const microCoaching = turnSignals.grammarIssue
    ? "Keep the sentence complete and check the verb form."
    : turnSignals.fluencyIssue
      ? "Add one more clear detail so the answer feels complete."
      : turnSignals.vocabOpportunity
        ? context.targetPhrases[0]
          ? `Work in a phrase like "${context.targetPhrases[0]}" on the next answer.`
          : "Use one stronger phrase from the topic on the next answer."
        : context.successCriteria[0]
          ? `Good. Keep moving toward this goal: ${context.successCriteria[0]}`
          : "Good. Keep the next answer just as clear.";

  const visibleCoaching = buildSpeakTurnCoaching({
    microCoaching,
    turnSignals,
    mode: context.missionKind === "free_speech" ? "free_speech" : "guided",
  });

  return {
    turnIndex,
    microCoaching: visibleCoaching?.note ?? "",
    coachLabel: visibleCoaching?.label ?? "Keep this move",
    turnSignals,
  };
}

function createRealtimeInstructions(context: ConversationContext) {
  const followUpHints =
    context.followUpPrompts.length > 0
      ? context.followUpPrompts.join(" | ")
      : "Ask one natural follow-up question at a time that keeps the learner talking.";
  const targetPhraseHint =
    context.targetPhrases.length > 0
      ? `Work these phrases in naturally when they fit: ${context.targetPhrases.join(", ")}.`
      : "Favor natural, everyday English over formal lecture language.";

  if (context.surface === "learn") {
    const counterpartRole = context.counterpartRole ?? "conversation partner";

    return [
      `You are role-playing as the learner's ${counterpartRole} in a short ESL curriculum conversation.`,
      "Sound like a real, warm person inside the scene, not a coach or test engine.",
      "Keep responses short and natural for live audio, usually one or two sentences plus one follow-up question.",
      "Acknowledge what the learner just said before you ask the next question.",
      "Stay fully inside the authored scenario and do not mention exercises, unit goals, target phrases, or feedback while the conversation is live.",
      "If the learner struggles, simplify your language and gently rephrase instead of switching languages.",
      `Scenario title: ${context.scenarioTitle}.`,
      `Scenario setup: ${context.scenarioSetup}.`,
      `Opening line: ${createOpeningPrompt(context)}`,
      `Can-do goal: ${context.canDoStatement ?? "Keep the conversation clear and useful."}`,
      `Performance task: ${context.performanceTask ?? "Respond naturally and keep the conversation moving."}`,
      targetPhraseHint,
      `Follow-up style: ${followUpHints}`,
    ].join(" ");
  }

  if (context.missionKind === "free_speech") {
    const laneLabel = context.starterLabel ?? context.scenarioTitle;

    return [
      "You are a warm English conversation partner for an ESL learner.",
      "Sound like a real person having a natural conversation, not a teacher script, chatbot, or worksheet.",
      "Keep responses short and natural for live audio, usually one or two sentences plus one open follow-up question.",
      "Open with one short human question and let the topic drift naturally if the learner takes it somewhere real.",
      "Do not introduce yourself with role-play framing and do not mention exercises, goals, target phrases, or feedback while the conversation is live.",
      "Naturally recast or model better English inside your reply when useful instead of explicitly correcting the learner.",
      "If the learner struggles, simplify your language and gently rephrase instead of switching languages.",
      `Conversation lane: ${laneLabel}.`,
      `Opening question: ${createOpeningPrompt(context)}`,
      `Learner level: ${context.learnerLevel ?? "n/a"}.`,
      `Current focus skill: ${context.focusSkill ?? "n/a"}.`,
      `Active class topic: ${context.activeTopic ?? "n/a"}.`,
      `Context hint: ${context.contextHint ?? "n/a"}.`,
      targetPhraseHint,
      `Follow-up style: ${followUpHints}`,
    ].join(" ");
  }

  return [
    "You are ESL International Connect, a live English conversation partner for an ESL learner.",
    "Sound like a real, warm, patient person having a spoken conversation, not like a test engine.",
    "Keep responses short and natural for audio, usually one or two sentences plus one follow-up question.",
    "Stay fully inside the current scenario and help the learner keep talking.",
    "Naturally recast or model better English inside your reply when useful instead of explicitly correcting the learner.",
    "Do not give long evaluations or score explanations during the live conversation.",
    "If the learner struggles, simplify your language and gently rephrase instead of switching languages.",
    `Scenario title: ${context.scenarioTitle}.`,
    `Scenario setup: ${context.scenarioSetup}.`,
    `Can-do goal: ${context.canDoStatement ?? "Keep the conversation clear and useful."}`,
    `Performance task: ${context.performanceTask ?? "Respond naturally and keep the conversation moving."}`,
    `Learner level: ${context.learnerLevel ?? "n/a"}.`,
    `Current focus skill: ${context.focusSkill ?? "n/a"}.`,
    `Why this session matters now: ${context.recommendationReason ?? "n/a"}.`,
    targetPhraseHint,
    `Follow-up style: ${followUpHints}`,
  ].join(" ");
}

function readContextFromSummaryPayload(
  payload: Record<string, unknown>,
  surface: ConversationSurface,
  missionKind: ConversationMissionKind,
  interactionMode: "text" | "voice",
  scenarioKey?: string | null
): ConversationContext {
  return {
    surface,
    missionKind,
    interactionMode,
    scenarioKey,
    starterKey: typeof payload.starterKey === "string" ? payload.starterKey : null,
    starterLabel: typeof payload.starterLabel === "string" ? payload.starterLabel : null,
    scenarioTitle: String(payload.scenarioTitle ?? payload.title ?? "Conversation mission"),
    scenarioSetup: String(
      payload.scenarioSetup ??
        payload.starterPrompt ??
        "Use the target language in a short guided conversation."
    ),
    canDoStatement:
      typeof payload.canDoStatement === "string" ? payload.canDoStatement : null,
    performanceTask:
      typeof payload.performanceTask === "string" ? payload.performanceTask : null,
    counterpartRole:
      typeof payload.counterpartRole === "string" ? payload.counterpartRole : null,
    introductionText:
      typeof payload.introductionText === "string" ? payload.introductionText : null,
    openingQuestion:
      typeof payload.openingQuestion === "string" ? payload.openingQuestion : null,
    targetPhrases: Array.isArray(payload.targetPhrases)
      ? payload.targetPhrases.map(String)
      : [],
    followUpPrompts: Array.isArray(payload.followUpPrompts)
      ? payload.followUpPrompts.map(String)
      : [],
    successCriteria: Array.isArray(payload.successCriteria)
      ? payload.successCriteria.map(String)
      : [],
    modelExample: typeof payload.modelExample === "string" ? payload.modelExample : null,
    starterPrompt: typeof payload.starterPrompt === "string" ? payload.starterPrompt : null,
    learnerLevel: typeof payload.learnerLevel === "string" ? payload.learnerLevel : null,
    focusSkill: typeof payload.focusSkill === "string" ? payload.focusSkill : null,
    recommendationReason:
      typeof payload.recommendationReason === "string"
        ? payload.recommendationReason
        : null,
    activeTopic: typeof payload.activeTopic === "string" ? payload.activeTopic : null,
    contextHint: typeof payload.contextHint === "string" ? payload.contextHint : null,
    isBenchmark: Boolean(payload.isBenchmark),
  };
}

export const ConversationService = {
  async startSession({
    userId,
    mode,
    interactionMode,
    surface,
    missionKind,
    scenarioKey,
    curriculumUnitId,
    curriculumActivityId,
    retryOfSessionId,
    summaryPayload = {},
    openingPrompt,
    seedOpeningTurn = true,
  }: StartConversationSessionInput) {
    const subscription = await UsageService.getOrCreateSubscription(userId);

    if (interactionMode === "voice" && subscription.plan !== "pro") {
      throw new AppError(
        "VOICE_MODE_UPGRADE_REQUIRED",
        "Voice input requires Pro on this build.",
        402
      );
    }

    if (interactionMode === "voice" && !openai) {
      throw new AppError(
        "AI_SERVICE_UNAVAILABLE",
        "Voice mode is not configured yet on this environment.",
        503
      );
    }

    const session = await prisma.speakSession.create({
      data: {
        userId,
        mode,
        surface,
        missionKind,
        interactionMode,
        scenarioKey,
        curriculumUnitId,
        curriculumActivityId,
        retryOfSessionId,
        status: "active",
        summaryPayload: summaryPayload as never,
      },
    });

    const initialPrompt =
      openingPrompt ??
      createOpeningPrompt(
        readContextFromSummaryPayload(
          summaryPayload,
          surface,
          missionKind,
          interactionMode,
          scenarioKey
        )
      );

    if (seedOpeningTurn) {
      await prisma.speakTurn.create({
        data: {
          speakSessionId: session.id,
          speaker: "ai",
          turnIndex: 1,
          transcriptText: initialPrompt,
          metricsPayload: {
            initialPrompt: true,
          } as never,
        },
      });
    }

    return {
      sessionId: session.id,
      openingPrompt: initialPrompt,
    };
  },

  async getSession(sessionId: string, userId: string) {
    return prisma.speakSession.findFirst({
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
  },

  async getLatestLearnSession({
    userId,
    curriculumActivityId,
  }: {
    userId: string;
    curriculumActivityId: string;
  }) {
    return prisma.speakSession.findFirst({
      where: {
        userId,
        surface: "learn",
        curriculumActivityId,
      },
      include: {
        turns: {
          orderBy: { turnIndex: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
    });
  },

  async getRealtimeClientSecret({
    sessionId,
    userId,
  }: {
    sessionId: string;
    userId: string;
  }) {
    if (!openai) {
      throw new AppError(
        "AI_SERVICE_UNAVAILABLE",
        "Realtime voice is not configured on this environment.",
        503
      );
    }

    const session = await prisma.speakSession.findFirstOrThrow({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (session.status !== "active") {
      throw new AppError("VALIDATION_ERROR", "This conversation is not active.", 400);
    }

    if (
      !["speak", "learn"].includes(session.surface) ||
      session.interactionMode !== "voice"
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Realtime voice is only available for active voice sessions.",
        400
      );
    }

    const subscription = await UsageService.getOrCreateSubscription(userId);
    if (subscription.plan !== "pro") {
      throw new AppError(
        "VOICE_MODE_UPGRADE_REQUIRED",
        "Voice input requires Pro on this build.",
        402
      );
    }

    const context = readContextFromSummaryPayload(
      session.summaryPayload as Record<string, unknown>,
      session.surface as ConversationSurface,
      (session.missionKind as ConversationMissionKind | null) ?? "guided",
      "voice",
      session.scenarioKey
    );

    const realtimeSession = await openai.realtime.clientSecrets.create({
      expires_after: {
        anchor: "created_at",
        seconds: 60,
      },
      session: {
        type: "realtime",
        model: env.OPENAI_REALTIME_MODEL,
        instructions: createRealtimeInstructions(context),
        output_modalities: ["audio"],
        max_output_tokens: 220,
        audio: {
          input: {
            noise_reduction: {
              type: "near_field",
            },
            transcription: {
              model: env.OPENAI_TRANSCRIPTION_MODEL,
              language: "en",
            },
            turn_detection: {
              type: "server_vad",
              create_response: true,
              interrupt_response: true,
              idle_timeout_ms: 6000,
              prefix_padding_ms: 300,
              silence_duration_ms: 450,
            },
          },
          output: {
            voice: env.OPENAI_REALTIME_VOICE,
            speed: 1,
          },
        },
      },
    });

    return serializeRealtimeClientSecret(realtimeSession, env.OPENAI_REALTIME_MODEL);
  },

  async syncRealtimeTranscript({
    sessionId,
    userId,
    turns,
  }: {
    sessionId: string;
    userId: string;
    turns: RealtimeTranscriptTurnInput[];
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

    if (session.status !== "active") {
      throw new AppError("VALIDATION_ERROR", "This conversation is not active.", 400);
    }

    const normalizedTurns = normalizeTranscriptTurns(turns);
    const context = readContextFromSummaryPayload(
      session.summaryPayload as Record<string, unknown>,
      session.surface as ConversationSurface,
      (session.missionKind as ConversationMissionKind | null) ?? "guided",
      session.interactionMode as "text" | "voice",
      session.scenarioKey
    );
    const studentCoachings = normalizedTurns
      .map((turn, index) =>
        turn.speaker === "student"
          ? deriveRealtimeStudentCoaching({
              studentText: turn.text,
              context,
              turnIndex: index + 1,
            })
          : null
      )
      .filter(
        (coaching): coaching is PersistedTurnCoaching =>
          Boolean(coaching && coaching.microCoaching)
      );
    const coachingByTurnIndex = new Map(
      studentCoachings.map((coaching) => [coaching.turnIndex, coaching])
    );
    const existingStudentTurnCount = session.turns.filter(
      (turn) => turn.speaker === "student"
    ).length;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM "speak_sessions" WHERE id = CAST(${sessionId} AS uuid) FOR UPDATE`
      );

      await tx.speakTurn.deleteMany({
        where: {
          speakSessionId: sessionId,
        },
      });

      if (normalizedTurns.length > 0) {
        await tx.speakTurn.createMany({
          data: normalizedTurns.map((turn, index) => ({
            speakSessionId: sessionId,
            speaker: turn.speaker,
            turnIndex: index + 1,
            transcriptText: turn.text,
            metricsPayload:
              turn.speaker === "student"
                ? ({
                    source: "realtime",
                    microCoaching: coachingByTurnIndex.get(index + 1)?.microCoaching ?? null,
                    coachLabel: coachingByTurnIndex.get(index + 1)?.coachLabel ?? null,
                    turnSignals: coachingByTurnIndex.get(index + 1)?.turnSignals ?? null,
                  } as never)
                : ({
                    source: "realtime",
                  } as never),
          })),
        });
      }
    });

    const studentTurnCount = normalizedTurns.filter(
      (turn) => turn.speaker === "student"
    ).length;

    return {
      turnCount: normalizedTurns.length,
      studentTurnCount,
      newStudentTurns: Math.max(0, studentTurnCount - existingStudentTurnCount),
      studentCoachings,
    };
  },

  async submitTurn({
    sessionId,
    userId,
    studentInput,
  }: SubmitConversationTurnInput): Promise<ConversationReply> {
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

    if (session.status !== "active") {
      throw new AppError("VALIDATION_ERROR", "This conversation is not active.", 400);
    }

    const durationSeconds = Math.max(0, Math.round(studentInput.durationSeconds ?? 0));

    if (session.interactionMode === "voice" && studentInput.audioDataUrl) {
      if (durationSeconds > 0) {
        await UsageService.assertWithinLimit(userId, "speak_voice_seconds", durationSeconds);
        await UsageService.increment(userId, "speak_voice_seconds", durationSeconds);
      }
    } else {
      await UsageService.assertWithinLimit(userId, "speak_text_turns");
      await UsageService.increment(userId, "speak_text_turns");
    }

    const studentText =
      studentInput.text?.trim() ||
      (studentInput.audioDataUrl
        ? await transcribeAudioInput({
            audioDataUrl: studentInput.audioDataUrl,
            mimeType: studentInput.audioMimeType,
          })
        : "");

    if (!studentText) {
      throw new AppError("VALIDATION_ERROR", "A response is required.", 400);
    }

    const nextTurnIndex = session.turns.length + 1;

    await prisma.speakTurn.create({
      data: {
        speakSessionId: session.id,
        speaker: "student",
        turnIndex: nextTurnIndex,
        transcriptText: studentText,
        audioRef: studentInput.audioRef,
        metricsPayload: {
          durationSeconds,
          transcribedFromAudio: Boolean(studentInput.audioDataUrl),
        } as never,
      },
    });

    const context = readContextFromSummaryPayload(
      session.summaryPayload as Record<string, unknown>,
      session.surface as ConversationSurface,
      (session.missionKind as ConversationMissionKind | null) ?? "guided",
      session.interactionMode as "text" | "voice",
      session.scenarioKey
    );

    const reply = await generateConversationReply({
      context,
      turns: [
        ...session.turns.map((turn) => ({
          speaker: turn.speaker as "ai" | "student",
          text: turn.transcriptText,
        })),
        {
          speaker: "student",
          text: studentText,
        },
      ],
      studentInput: studentText,
      includeAudio: session.interactionMode === "voice",
    });

    await prisma.speakTurn.update({
      where: {
        speakSessionId_turnIndex: {
          speakSessionId: session.id,
          turnIndex: nextTurnIndex,
        },
      },
      data: {
        metricsPayload: {
          durationSeconds,
          transcribedFromAudio: Boolean(studentInput.audioDataUrl),
          microCoaching: reply.microCoaching,
          coachLabel: reply.coachLabel,
          turnSignals: reply.turnSignals,
        } as never,
      },
    });

    await prisma.speakTurn.create({
      data: {
        speakSessionId: session.id,
        speaker: "ai",
        turnIndex: nextTurnIndex + 1,
        transcriptText: reply.aiResponseText,
        metricsPayload: {
          source: "assistant_reply",
        } as never,
      },
    });

    return {
      ...reply,
      studentTranscriptText: studentText,
    };
  },

  async completeSession({
    sessionId,
    userId,
    durationSecondsOverride,
  }: {
    sessionId: string;
    userId: string;
    durationSecondsOverride?: number;
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

    const context = readContextFromSummaryPayload(
      session.summaryPayload as Record<string, unknown>,
      session.surface as ConversationSurface,
      (session.missionKind as ConversationMissionKind | null) ?? "guided",
      session.interactionMode as "text" | "voice",
      session.scenarioKey
    );

    const turns = session.turns.map((turn) => ({
      speaker: turn.speaker as "ai" | "student",
      text: turn.transcriptText,
    }));
    const studentTurns = turns.filter((turn) => turn.speaker === "student");
    const review = await evaluateMissionTranscript({
      context,
      turns,
    });

    const durationSeconds =
      typeof durationSecondsOverride === "number"
        ? Math.max(0, Math.round(durationSecondsOverride))
        : studentTurns.length * 30;

    await prisma.speakSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        completedAt: new Date(),
        durationSeconds,
        evaluationPayload: review as never,
        summaryPayload: {
          ...(session.summaryPayload as Record<string, unknown>),
          reviewStatus: review.status,
          score: review.score,
          strength: review.strength,
          improvement: review.improvement,
        } as never,
      },
    });

    if (session.surface === "speak") {
      await StreakService.recordQualifyingActivity(userId);
    }

    return {
      review,
      durationSeconds,
      studentTurnCount: studentTurns.length,
    };
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

    const evaluation = session.evaluationPayload as Partial<MissionReview>;
    if (Array.isArray(evaluation.turns) && Array.isArray(evaluation.vocabulary)) {
      return {
        sessionId,
        status:
          evaluation.status === "ready" ||
          evaluation.status === "almost_there" ||
          evaluation.status === "practice_once_more"
            ? evaluation.status
            : "ready",
        strength:
          typeof evaluation.strength === "string"
            ? evaluation.strength
            : "You kept the conversation moving clearly.",
        improvement:
          typeof evaluation.improvement === "string"
            ? evaluation.improvement
            : "Add one more clear detail on your next round.",
        highlights: Array.isArray(evaluation.highlights) ? evaluation.highlights : [],
        turns: evaluation.turns,
        vocabulary: filterSpeakVocabulary(evaluation.vocabulary, 4),
      };
    }

    const fallback = await evaluateMissionTranscript({
      context: readContextFromSummaryPayload(
        session.summaryPayload as Record<string, unknown>,
        session.surface as ConversationSurface,
        (session.missionKind as ConversationMissionKind | null) ?? "guided",
        session.interactionMode as "text" | "voice",
        session.scenarioKey
      ),
      turns: session.turns.map((turn) => ({
        speaker: turn.speaker as "ai" | "student",
        text: turn.transcriptText,
      })),
    });

    return {
      sessionId,
      status: fallback.status,
      strength: fallback.strength,
      improvement: fallback.improvement,
      highlights: fallback.highlights,
      turns: fallback.turns,
      vocabulary: filterSpeakVocabulary(fallback.vocabulary, 4),
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
    const normalizedPhrase = sanitizeSpeakPhraseTerm(phraseText);
    if (!normalizedPhrase) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Save a short reusable phrase instead of a single word.",
        400
      );
    }

    const session = await prisma.speakSession.findFirstOrThrow({
      where: {
        id: sessionId,
        userId,
      },
    });

    const phrase = await prisma.phraseBankItem.create({
      data: {
        userId,
        sourceSpeakSessionId: sessionId,
        phraseText: normalizedPhrase,
        translationText: translationText?.trim() || normalizedPhrase,
        contextPayload: {
          surface: session.surface,
          missionKind: session.missionKind,
          curriculumActivityId: session.curriculumActivityId,
        } as never,
      },
    });

    await trackEvent({
      eventName:
        session.surface === "learn"
          ? "learn_speaking_phrase_saved"
          : "transcript_phrase_saved",
      route:
        session.surface === "learn" &&
        typeof (session.summaryPayload as Record<string, unknown>)?.unitSlug === "string"
          ? `/app/learn/unit/${String((session.summaryPayload as Record<string, unknown>).unitSlug)}/speaking`
          : `/app/speak/session/${sessionId}`,
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
