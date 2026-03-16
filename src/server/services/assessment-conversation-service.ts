import { FULL_DIAGNOSTIC_CONVERSATION } from "@/features/assessment/question-bank";
import { isClarificationRequest } from "@/lib/conversation-utils";
import { AppError } from "@/server/errors";
import { env } from "@/server/env";
import { openai } from "@/server/openai";
import { prisma } from "@/server/prisma";
import { serializeRealtimeClientSecret } from "@/server/realtime-client-secret";

import {
  createOpeningPrompt,
  generateConversationReply,
  transcribeAudioInput,
  type ConversationContext,
  type ConversationTurnLike,
} from "../ai/openai-conversation";

type AssessmentConversationTurnLike = ConversationTurnLike & {
  countsTowardProgress?: boolean;
};

type TurnInput = {
  text?: string;
  audioDataUrl?: string;
  audioMimeType?: string;
  durationSeconds?: number;
  voiceCaptured?: boolean;
};

type SubmitTurnArgs = {
  assessmentAttemptId: string;
  transcript: AssessmentConversationTurnLike[];
  studentInput: TurnInput;
  userId?: string;
  guestSessionToken?: string;
};

function normalizeTranscript(turns: AssessmentConversationTurnLike[]) {
  return turns
    .map((turn) => ({
      speaker: turn.speaker,
      text: turn.text.trim(),
      countsTowardProgress: turn.countsTowardProgress,
    }))
    .filter((turn) => turn.text.length > 0);
}

function buildContext(interactionMode: "text" | "voice"): ConversationContext {
  return {
    surface: "assessment",
    missionKind: "guided",
    interactionMode,
    scenarioKey: "full_diagnostic_assessment",
    scenarioTitle: FULL_DIAGNOSTIC_CONVERSATION.scenarioTitle,
    scenarioSetup: FULL_DIAGNOSTIC_CONVERSATION.scenarioSetup,
    canDoStatement: "I can answer simple questions about my classes, routines, and goals.",
    performanceTask:
      "Have a short conversation with the placement coach and respond with clear details.",
    counterpartRole: FULL_DIAGNOSTIC_CONVERSATION.counterpartRole,
    introductionText: FULL_DIAGNOSTIC_CONVERSATION.introductionText,
    openingQuestion: FULL_DIAGNOSTIC_CONVERSATION.openingQuestion,
    targetPhrases: [...FULL_DIAGNOSTIC_CONVERSATION.helpfulPhrases],
    followUpPrompts: [...FULL_DIAGNOSTIC_CONVERSATION.followUpPrompts],
    successCriteria: [...FULL_DIAGNOSTIC_CONVERSATION.successCriteria],
    modelExample: FULL_DIAGNOSTIC_CONVERSATION.modelExample,
    starterPrompt: FULL_DIAGNOSTIC_CONVERSATION.openingTurn,
  };
}

function buildClosingReply(studentTranscriptText: string) {
  const wordCount = studentTranscriptText.trim().split(/\s+/).filter(Boolean).length;

  return {
    aiResponseText:
      wordCount < 8
        ? "Thanks. I got that. We'll use the rest of your diagnostic to understand your English more clearly."
        : "Thanks. That gives me a clear picture of how you use English right now.",
    microCoaching: "",
    turnSignals: {
      fluencyIssue: wordCount < 6,
      grammarIssue: /\bgoed\b/i.test(studentTranscriptText),
      vocabOpportunity: wordCount < 14,
    },
  };
}

function buildClarificationReply(lastAiTurn: string) {
  const source = lastAiTurn.toLowerCase();

  if (source.includes("what do you usually do")) {
    return "I mean, what activities do you do in that class, like reading, labs, or group work?";
  }

  if (source.includes("enjoy the most") || source.includes("like best")) {
    return "I mean, which part of class do you like best, for example labs, reading, or discussion?";
  }

  if (source.includes("feels easiest") || source.includes("still feels hard")) {
    return "I mean, which English skill feels easier for you right now, like reading, speaking, writing, or listening?";
  }

  if (source.includes("how do you usually ask")) {
    return "I mean, what do you say when you need help from your teacher?";
  }

  if (source.includes("what is one thing you want to improve")) {
    return "I mean, what is one English skill you want to get better at this semester?";
  }

  return "I mean, can you answer my last question in one or two simple sentences?";
}

async function getAuthorizedAttempt({
  assessmentAttemptId,
  userId,
  guestSessionToken,
}: {
  assessmentAttemptId: string;
  userId?: string;
  guestSessionToken?: string;
}) {
  const attempt = await prisma.assessmentAttempt.findFirst({
    where: {
      id: assessmentAttemptId,
      status: "in_progress",
      context: {
        in: ["onboarding_full", "reassessment"],
      },
      ...(userId ? { userId } : {}),
      ...(guestSessionToken
        ? {
            guestSession: {
              sessionToken: guestSessionToken,
            },
          }
        : {}),
    },
  });

  if (!attempt) {
    throw new AppError("NOT_FOUND", "Assessment attempt not found.", 404);
  }

  return attempt;
}

function createAssessmentRealtimeInstructions() {
  const context = buildContext("voice");

  return [
    "You are Maya, a warm placement coach having a short live English conversation with a learner.",
    "Sound like a real person speaking naturally, not a robot, test engine, scripted narrator, or worksheet.",
    "Keep every spoken reply short and natural for audio, usually one or two sentences plus one follow-up question.",
    "Stay inside the placement interview and help the learner keep talking about classes, routines, and goals.",
    "Acknowledge what the learner just said before you ask the next question.",
    "If the learner asks for clarification with something like 'why?', 'what do you mean?', or 'can you repeat that?', rephrase your last question in simpler English and invite a real answer.",
    "Do not mention scoring, pronunciation analysis, evaluation, rubrics, or that you are grading the learner.",
    "Do not correct the learner during the live exchange.",
    `Scenario title: ${context.scenarioTitle}.`,
    `Scenario setup: ${context.scenarioSetup}.`,
    `Introduction style: ${context.introductionText}.`,
    `Opening question: ${context.openingQuestion}.`,
    `Can-do goal: ${context.canDoStatement}.`,
    `Performance task: ${context.performanceTask}.`,
    `Follow-up style: ${context.followUpPrompts.join(" | ")}.`,
  ].join(" ");
}

export const AssessmentConversationService = {
  responseTarget: FULL_DIAGNOSTIC_CONVERSATION.responseTarget,

  createOpeningTurn() {
    return createOpeningPrompt(buildContext("text"));
  },

  async createRealtimeClientSecret({
    assessmentAttemptId,
    userId,
    guestSessionToken,
  }: {
    assessmentAttemptId: string;
    userId?: string;
    guestSessionToken?: string;
  }) {
    if (!openai) {
      throw new AppError(
        "AI_SERVICE_UNAVAILABLE",
        "Realtime voice is not configured on this environment.",
        503
      );
    }

    await getAuthorizedAttempt({
      assessmentAttemptId,
      userId,
      guestSessionToken,
    });

    const realtimeSession = await openai.realtime.clientSecrets.create({
      expires_after: {
        anchor: "created_at",
        seconds: 60,
      },
      session: {
        type: "realtime",
        model: env.OPENAI_REALTIME_MODEL,
        instructions: createAssessmentRealtimeInstructions(),
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

  async submitTurn({
    assessmentAttemptId,
    transcript,
    studentInput,
    userId,
    guestSessionToken,
  }: SubmitTurnArgs) {
    const attempt = await getAuthorizedAttempt({
      assessmentAttemptId,
      userId,
      guestSessionToken,
    });

    const interactionMode =
      studentInput.audioDataUrl && studentInput.audioDataUrl.length > 0 ? "voice" : "text";
    const context = buildContext(interactionMode);
    const normalizedTranscript = normalizeTranscript(transcript);
    const studentTranscriptText = (
      studentInput.text?.trim() ||
      (studentInput.audioDataUrl
        ? await transcribeAudioInput({
            audioDataUrl: studentInput.audioDataUrl,
            mimeType: studentInput.audioMimeType,
          })
        : "")
    ).trim();

    if (!studentTranscriptText) {
      throw new AppError("VALIDATION_ERROR", "Say your reply before continuing.", 400);
    }

    if (
      FULL_DIAGNOSTIC_CONVERSATION.requireVoice &&
      !studentInput.audioDataUrl &&
      !studentInput.voiceCaptured
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Use the microphone to answer this part of the diagnostic.",
        400
      );
    }

    const countsTowardProgress = !isClarificationRequest(studentTranscriptText);
    const replyCount =
      normalizedTranscript.filter(
        (turn) => turn.speaker === "student" && turn.countsTowardProgress !== false
      ).length + (countsTowardProgress ? 1 : 0);
    const lastAiTurn =
      [...normalizedTranscript].reverse().find((turn) => turn.speaker === "ai")?.text ??
      createOpeningPrompt(context);
    const reply =
      !countsTowardProgress
        ? {
            aiResponseText: buildClarificationReply(lastAiTurn),
            microCoaching: "",
            turnSignals: {
              fluencyIssue: false,
              grammarIssue: false,
              vocabOpportunity: false,
            },
          }
        : replyCount >= FULL_DIAGNOSTIC_CONVERSATION.responseTarget
        ? buildClosingReply(studentTranscriptText)
        : await generateConversationReply({
            context,
            turns: normalizedTranscript.map((turn) => ({
              speaker: turn.speaker,
              text: turn.text,
            })),
            studentInput: studentTranscriptText,
            includeAudio: false,
          });

    return {
      attemptId: attempt.id,
      openingTurn: createOpeningPrompt(context),
      studentTranscriptText,
      aiResponseText: reply.aiResponseText,
      replyCount,
      responseTarget: FULL_DIAGNOSTIC_CONVERSATION.responseTarget,
      canAdvance: replyCount >= FULL_DIAGNOSTIC_CONVERSATION.responseTarget,
      countsTowardProgress,
      turnSignals: reply.turnSignals,
      durationSeconds: studentInput.durationSeconds ?? 0,
    };
  },
};
