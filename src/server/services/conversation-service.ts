import { AppError } from "@/server/errors";
import { prisma } from "@/server/prisma";
import { env } from "@/server/env";
import { Prisma } from "@/generated/prisma/client";
import { serializeRealtimeClientSecret } from "@/server/realtime-client-secret";
import {
  classifyLiveStudentTurn,
  type LiveStudentTurnDisposition,
  type LiveStudentTurnReasonCode,
} from "@/lib/conversation-utils";
import type { MissionEvidenceTarget } from "@/server/learn-speaking-types";
import { buildSpeakTurnCoaching, filterSpeakVocabulary, sanitizeSpeakPhraseTerm } from "@/lib/speak";
import { createRealtimeTurnDetectionConfig } from "@/server/realtime-voice-policy";

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

type PersistedStudentTurnFeedback = {
  turnIndex: number;
  disposition: LiveStudentTurnDisposition;
  countsTowardProgress: boolean;
  reasonCode: LiveStudentTurnReasonCode;
  coachLabel: string | null;
  coachNote: string | null;
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

function countsTowardProgressFromMetrics(metricsPayload: unknown) {
  const metrics = metricsPayload as Record<string, unknown> | null;
  return (metrics?.countsTowardProgress as boolean | undefined) ?? true;
}

function hasDetailSignal(text: string) {
  return /\b(because|for example|for instance|when|after|before|so|with|at|in|on|later|then)\b/i.test(
    text
  );
}

function hasFragmentSignal(text: string) {
  return /^(to|for|with|about|at|in|on|from|because|and|but)\b/i.test(text.trim());
}

function deriveRealtimeStudentFeedback({
  studentText,
  previousStudentFeedback,
  context,
  turnIndex,
}: {
  studentText: string;
  previousStudentFeedback?: PersistedStudentTurnFeedback | null;
  context: ConversationContext;
  turnIndex: number;
}): PersistedStudentTurnFeedback {
  const normalizedText = studentText.trim();
  const wordCount = normalizedText.split(/\s+/).filter(Boolean).length;
  const includesLowercaseI = /\bi\b/.test(normalizedText) && !/\bI\b/.test(normalizedText);
  const usesTargetPhrase = context.targetPhrases.some((phrase) => {
    const normalizedPhrase = phrase.replace(/\.\.\.$/, "").trim().toLowerCase();
    return normalizedPhrase.length > 0 && normalizedText.toLowerCase().includes(normalizedPhrase);
  });
  const disposition = classifyLiveStudentTurn(normalizedText);
  const turnSignals = {
    fluencyIssue:
      disposition.disposition === "accepted_answer" &&
      !hasDetailSignal(normalizedText) &&
      wordCount < 10,
    grammarIssue:
      disposition.disposition === "accepted_answer" &&
      (/\b(goed|wented|eated)\b/i.test(normalizedText) ||
        includesLowercaseI ||
        hasFragmentSignal(normalizedText)),
    vocabOpportunity:
      disposition.disposition === "accepted_answer" &&
      !usesTargetPhrase &&
      context.targetPhrases.length > 0 &&
      wordCount >= 6,
  };

  const coachNote =
    disposition.disposition === "accepted_answer"
      ? turnSignals.grammarIssue
        ? previousStudentFeedback?.coachLabel === "Tighten the wording"
          ? "Answer in one full sentence and keep the wording smooth."
          : "Answer in one full sentence and check the verb form."
        : turnSignals.fluencyIssue
          ? previousStudentFeedback?.coachLabel === "Add one more detail"
            ? "Answer first, then add one fresh detail from your own experience."
            : "Answer the question first, then add one clear detail."
          : turnSignals.vocabOpportunity
            ? context.targetPhrases[0]
              ? `Try using "${context.targetPhrases[0]}" naturally in the next answer.`
              : "Use one stronger phrase from the topic in the next answer."
            : context.successCriteria[0]
              ? `Clear answer. Keep building toward this goal: ${context.successCriteria[0]}`
              : "Clear answer. Keep the next one just as direct."
      : null;

  const repairNote =
    disposition.disposition === "clarification_request"
      ? "Sure. Listen for the simpler version and answer that question."
      : disposition.disposition === "acknowledgement_only"
        ? "Answer the question itself first, then add one detail."
        : disposition.disposition === "noise_or_unintelligible"
          ? "I did not catch a clear answer. Say it again in one short sentence."
          : disposition.disposition === "off_task_short"
            ? "Start with one complete answer, then add a detail."
            : null;

  const visibleCoaching =
    disposition.disposition === "accepted_answer"
      ? buildSpeakTurnCoaching({
          microCoaching: coachNote,
          turnSignals,
          mode: context.missionKind === "free_speech" ? "free_speech" : "guided",
        })
      : null;

  return {
    turnIndex,
    disposition: disposition.disposition,
    countsTowardProgress: disposition.countsTowardProgress,
    reasonCode: disposition.reasonCode,
    coachLabel:
      disposition.disposition === "accepted_answer"
        ? (visibleCoaching?.label ?? "Keep this move")
        : disposition.disposition === "noise_or_unintelligible"
          ? "Didn't catch that"
          : disposition.disposition === "clarification_request"
            ? "Let me say it more simply"
            : disposition.disposition === "acknowledgement_only"
              ? "Answer the question"
              : "Use one full answer",
    coachNote:
      disposition.disposition === "accepted_answer"
        ? (visibleCoaching?.note ?? coachNote)
        : repairNote,
    turnSignals,
  };
}

function createRealtimeInstructions(context: ConversationContext) {
  const followUpHints =
    context.followUpPrompts.length > 0
      ? context.followUpPrompts.join(" | ")
      : "Ask one natural follow-up question at a time that keeps the learner talking.";
  const evidenceHints =
    context.evidenceTargets.length > 0
      ? `Evidence priorities: ${context.evidenceTargets.map((target) => target.label).join(" | ")}.`
      : "";
  const benchmarkHints =
    context.benchmarkFocus.length > 0
      ? `Benchmark focus: ${context.benchmarkFocus.join(" | ")}.`
      : "";
  const targetPhraseHint =
    context.targetPhrases.length > 0
      ? `Work these phrases in naturally when they fit: ${context.targetPhrases.join(", ")}.`
      : "Favor natural, everyday English over formal lecture language.";
  const modelExampleHint = context.modelExample?.trim()
    ? `Match the level and specificity of this example when it fits naturally: ${context.modelExample}.`
    : "";

  if (context.surface === "learn") {
    const counterpartRole = context.counterpartRole ?? "conversation partner";

    return [
      `Role: You are role-playing as the learner's ${counterpartRole} in a short ESL curriculum conversation.`,
      "Style: sound like a real, warm person inside the scene, not a coach, robot, or test engine.",
      "Turn-taking: keep spoken replies short, usually one or two sentences plus one follow-up question.",
      "Patience: be patient with pauses. ESL learners may need a few seconds to finish a thought.",
      "Noise: if the audio is unclear, noisy, or sounds like background speech, ask for the answer again instead of moving on.",
      "Clarification: if the learner says what, sorry, say that again, or sounds confused, rephrase your last question in simpler English and stay in English.",
      "Guardrails: do not answer for the learner, switch roles, or mention exercises, unit goals, target phrases, scores, or feedback while the conversation is live.",
      "Variety: avoid repeating the same stock phrase every turn. Vary short acknowledgements and repair language naturally.",
      `Scenario title: ${context.scenarioTitle}.`,
      `Scenario setup: ${context.scenarioSetup}.`,
      `Opening line: ${createOpeningPrompt(context)}`,
      `Can-do goal: ${context.canDoStatement ?? "Keep the conversation clear and useful."}`,
      `Performance task: ${context.performanceTask ?? "Respond naturally and keep the conversation moving."}`,
      targetPhraseHint,
      modelExampleHint,
      evidenceHints,
      benchmarkHints,
      `Follow-up style: ${followUpHints}`,
    ].join(" ");
  }

  if (context.missionKind === "free_speech") {
    const laneLabel = context.starterLabel ?? context.scenarioTitle;

    return [
      "Role: you are a warm English conversation partner for an ESL learner.",
      "Style: sound like a real person having a natural conversation, not a teacher script, chatbot, or worksheet.",
      "Turn-taking: keep replies short for live audio, usually one or two sentences plus one open follow-up question.",
      "Patience: wait through short pauses before you respond.",
      "Noise: if you hear background speech, fragments in other languages, or unclear audio, ask for a clear short answer instead of moving on.",
      "Clarification: if the learner asks you to repeat, restate your last idea in simpler English.",
      "Guardrails: do not answer for the learner and do not mention exercises, goals, target phrases, or feedback while the conversation is live.",
      "Variety: avoid repeating tell me more style prompts. Keep the follow-up tied to what the learner actually said.",
      `Conversation lane: ${laneLabel}.`,
      `Opening question: ${createOpeningPrompt(context)}`,
      `Learner level: ${context.learnerLevel ?? "n/a"}.`,
      `Current focus skill: ${context.focusSkill ?? "n/a"}.`,
      `Active class topic: ${context.activeTopic ?? "n/a"}.`,
      `Context hint: ${context.contextHint ?? "n/a"}.`,
      targetPhraseHint,
      modelExampleHint,
      evidenceHints,
      `Follow-up style: ${followUpHints}`,
    ].join(" ");
  }

  return [
    "Role: you are ESL International Connect, a live English conversation partner for an ESL learner.",
    "Style: sound like a real, warm, patient person having a spoken conversation, not a test engine.",
    "Turn-taking: keep replies short for audio, usually one or two sentences plus one follow-up question.",
    "Patience: wait through brief pauses before responding.",
    "Noise: if the audio is unclear or sounds like background speech, ask the learner to say it again instead of moving on.",
    "Clarification: if the learner asks for repetition, rephrase your last question in simpler English.",
    "Guardrails: stay inside the scenario, do not answer for the learner, and do not give long evaluations or score explanations during the live conversation.",
    "Variety: avoid repeating the same acknowledgement or repair phrase every turn.",
    `Scenario title: ${context.scenarioTitle}.`,
    `Scenario setup: ${context.scenarioSetup}.`,
    `Can-do goal: ${context.canDoStatement ?? "Keep the conversation clear and useful."}`,
    `Performance task: ${context.performanceTask ?? "Respond naturally and keep the conversation moving."}`,
    `Learner level: ${context.learnerLevel ?? "n/a"}.`,
    `Current focus skill: ${context.focusSkill ?? "n/a"}.`,
    `Why this session matters now: ${context.recommendationReason ?? "n/a"}.`,
    targetPhraseHint,
    modelExampleHint,
    evidenceHints,
    benchmarkHints,
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
            turn_detection: createRealtimeTurnDetectionConfig(),
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
    const studentFeedbackEntries = normalizedTurns
      .map((turn, index, allTurns) => {
        if (turn.speaker !== "student") {
          return null;
        }

        const previousAcceptedFeedback = [...allTurns]
          .slice(0, index)
          .reverse()
          .find((candidate) => candidate.speaker === "student");

        return deriveRealtimeStudentFeedback({
          studentText: turn.text,
          previousStudentFeedback:
            previousAcceptedFeedback?.speaker === "student"
              ? deriveRealtimeStudentFeedback({
                  studentText: previousAcceptedFeedback.text,
                  context,
                  turnIndex: index,
                })
              : null,
          context,
          turnIndex: index + 1,
        });
      })
      .filter((feedback): feedback is PersistedStudentTurnFeedback => Boolean(feedback));
    const feedbackByTurnIndex = new Map(
      studentFeedbackEntries.map((feedback) => [feedback.turnIndex, feedback])
    );
    const existingStudentTurnCount = session.turns.filter(
      (turn) =>
        turn.speaker === "student" &&
        ((turn.metricsPayload as Record<string, unknown> | null)?.countsTowardProgress ?? true)
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
                    disposition: feedbackByTurnIndex.get(index + 1)?.disposition ?? "accepted_answer",
                    countsTowardProgress:
                      feedbackByTurnIndex.get(index + 1)?.countsTowardProgress ?? true,
                    reasonCode: feedbackByTurnIndex.get(index + 1)?.reasonCode ?? "accepted",
                    microCoaching: feedbackByTurnIndex.get(index + 1)?.coachNote ?? null,
                    coachLabel: feedbackByTurnIndex.get(index + 1)?.coachLabel ?? null,
                    turnSignals: feedbackByTurnIndex.get(index + 1)?.turnSignals ?? null,
                  } as never)
                : ({
                    source: "realtime",
                  } as never),
          })),
        });
      }
    });

    const studentTurnCount = studentFeedbackEntries.filter(
      (turn) => turn.countsTowardProgress
    ).length;
    const studentCoachings = studentFeedbackEntries
      .filter(
        (feedback) =>
          feedback.disposition === "accepted_answer" &&
          Boolean(feedback.coachNote) &&
          Boolean(feedback.coachLabel)
      )
      .map((feedback) => ({
        turnIndex: feedback.turnIndex,
        microCoaching: feedback.coachNote ?? "",
        coachLabel: feedback.coachLabel ?? "Keep this move",
        turnSignals: feedback.turnSignals,
      }));
    const lastStudentTurn = [...studentFeedbackEntries].reverse()[0] ?? null;

    if (lastStudentTurn) {
      const unitSlug = (session.summaryPayload as Record<string, unknown> | null)?.unitSlug;
      const route =
        session.surface === "learn" && typeof unitSlug === "string"
          ? `/app/learn/unit/${unitSlug}/speaking`
          : session.surface === "speak"
            ? `/app/speak/session/${sessionId}`
            : "/app";

      await trackEvent({
        eventName: "live_voice_turn_processed",
        route,
        userId,
        properties: {
          surface: session.surface,
          mission_kind: session.missionKind,
          turn_disposition: lastStudentTurn.disposition,
          counts_toward_progress: lastStudentTurn.countsTowardProgress,
          clarification_rephrase_used:
            lastStudentTurn.disposition === "clarification_request",
          noise_detected: lastStudentTurn.disposition === "noise_or_unintelligible",
          rejected_turn_count:
            studentFeedbackEntries.filter((entry) => !entry.countsTowardProgress).length,
        },
      });
    }

    return {
      turnCount: normalizedTurns.length,
      studentTurnCount,
      newStudentTurns: Math.max(0, studentTurnCount - existingStudentTurnCount),
      studentCoachings,
      lastStudentTurn,
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

    const turns = session.turns
      .filter(
        (turn) => turn.speaker === "ai" || countsTowardProgressFromMetrics(turn.metricsPayload)
      )
      .map((turn) => ({
        speaker: turn.speaker as "ai" | "student",
        text: turn.transcriptText,
      }));
    const studentTurns = session.turns.filter(
      (turn) => turn.speaker === "student" && countsTowardProgressFromMetrics(turn.metricsPayload)
    );
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
      })).filter(
        (turn, index) =>
          turn.speaker === "ai" ||
          countsTowardProgressFromMetrics(session.turns[index]?.metricsPayload)
      ),
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
