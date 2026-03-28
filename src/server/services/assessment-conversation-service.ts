import { FULL_DIAGNOSTIC_CONVERSATION } from "@/features/assessment/question-bank";
import {
  classifyLiveStudentTurn,
  type LiveStudentTurnFeedback,
} from "@/lib/conversation-utils";
import { AppError } from "@/server/errors";
import { env } from "@/server/env";
import { openai } from "@/server/openai";
import { prisma } from "@/server/prisma";
import { serializeRealtimeClientSecret } from "@/server/realtime-client-secret";
import { createRealtimeTurnDetectionConfig } from "@/server/realtime-voice-policy";

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
    evidenceTargets: [],
    followUpObjectives: [],
    benchmarkFocus: [],
    requiredTurns: 3,
    minimumFollowUpResponses: 0,
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

function buildRepairReply(lastAiTurn: string, feedback: LiveStudentTurnFeedback) {
  if (feedback.disposition === "clarification_request") {
    return buildClarificationReply(lastAiTurn);
  }

  if (feedback.disposition === "acknowledgement_only") {
    return "Answer the question first, then add one short detail.";
  }

  if (feedback.disposition === "noise_or_unintelligible") {
    return "I didn't catch that clearly. Can you say it again in one short sentence?";
  }

  if (feedback.disposition === "off_task_short") {
    return "Start with one full answer to my question, then add one detail.";
  }

  return "Can you answer my last question in one or two simple sentences?";
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
    "Role: you are Maya, a warm placement coach having a short live English conversation with a learner.",
    "Style: sound like a real person speaking naturally, not a robot, test engine, scripted narrator, or worksheet.",
    "Turn-taking: keep spoken replies short for audio, usually one or two sentences plus one follow-up question.",
    "Patience: be patient with pauses. ESL learners may need a few seconds to finish a thought.",
    "Noise: if the audio is unclear, noisy, or sounds like background speech, ask for a clear short answer instead of moving on.",
    "Clarification: if the learner says what, sorry, say that again, or sounds confused, rephrase your last question in simpler English and stay in English.",
    "Guardrails: do not mention scoring, pronunciation analysis, evaluation, rubrics, or that you are grading the learner. Do not answer for the learner.",
    "Variety: avoid repeating the same repair phrase every turn.",
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

    const studentTurnFeedback = classifyLiveStudentTurn(studentTranscriptText);
    const countsTowardProgress = studentTurnFeedback.countsTowardProgress;
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
            aiResponseText: buildRepairReply(lastAiTurn, studentTurnFeedback),
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
      disposition: studentTurnFeedback.disposition,
      reasonCode: studentTurnFeedback.reasonCode,
      turnSignals: reply.turnSignals,
      durationSeconds: studentInput.durationSeconds ?? 0,
    };
  },
};
