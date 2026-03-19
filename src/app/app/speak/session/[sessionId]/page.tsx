import { notFound } from "next/navigation";

import { SpeakRealtimeSessionPanel } from "@/features/speak/speak-realtime-session-panel";
import { SpeakSessionPanel } from "@/features/speak/speak-session-panel";
import {
  buildSpeakTurnCoaching,
  type SpeakMissionDetails,
  type SpeakSessionReview,
} from "@/lib/speak";
import { createOpeningPrompt } from "@/server/ai/openai-conversation";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/prisma";

export default async function SpeakSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getCurrentUser();
  const { sessionId } = await params;

  if (!user) {
    return null;
  }

  const session = await prisma.speakSession.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
    },
    include: {
      turns: {
        orderBy: { turnIndex: "asc" },
      },
    },
  });

  if (!session) {
    notFound();
  }

  const summaryPayload = session.summaryPayload as Record<string, unknown>;
  const mission: SpeakMissionDetails = {
    scenarioTitle: String(summaryPayload.scenarioTitle ?? "Speaking practice"),
    scenarioSetup: String(
      summaryPayload.scenarioSetup ??
        "Have a natural English conversation and keep it moving with clear follow-up questions."
    ),
    counterpartRole:
      typeof summaryPayload.counterpartRole === "string"
        ? summaryPayload.counterpartRole
        : null,
    canDoStatement:
      typeof summaryPayload.canDoStatement === "string"
        ? summaryPayload.canDoStatement
        : null,
    performanceTask:
      typeof summaryPayload.performanceTask === "string"
        ? summaryPayload.performanceTask
        : null,
    targetPhrases: Array.isArray(summaryPayload.targetPhrases)
      ? summaryPayload.targetPhrases.map(String)
      : [],
    recommendationReason:
      typeof summaryPayload.recommendationReason === "string"
        ? summaryPayload.recommendationReason
        : null,
    openingPrompt: createOpeningPrompt({
      surface: "speak",
      missionKind:
        (session.missionKind as "free_speech" | "guided" | null) ?? "guided",
      interactionMode: session.interactionMode as "text" | "voice",
      scenarioKey: session.scenarioKey,
      scenarioTitle: String(summaryPayload.scenarioTitle ?? "Speaking practice"),
      scenarioSetup: String(summaryPayload.scenarioSetup ?? "Have a natural conversation."),
      canDoStatement:
        typeof summaryPayload.canDoStatement === "string"
          ? summaryPayload.canDoStatement
          : null,
      performanceTask:
        typeof summaryPayload.performanceTask === "string"
          ? summaryPayload.performanceTask
          : null,
      counterpartRole:
        typeof summaryPayload.counterpartRole === "string"
          ? summaryPayload.counterpartRole
          : null,
      introductionText:
        typeof summaryPayload.introductionText === "string"
          ? summaryPayload.introductionText
          : null,
      openingQuestion:
        typeof summaryPayload.openingQuestion === "string"
          ? summaryPayload.openingQuestion
          : null,
      targetPhrases: Array.isArray(summaryPayload.targetPhrases)
        ? summaryPayload.targetPhrases.map(String)
        : [],
      followUpPrompts: Array.isArray(summaryPayload.followUpPrompts)
        ? summaryPayload.followUpPrompts.map(String)
        : [],
      successCriteria: Array.isArray(summaryPayload.successCriteria)
        ? summaryPayload.successCriteria.map(String)
        : [],
      starterPrompt:
        typeof summaryPayload.starterPrompt === "string"
          ? summaryPayload.starterPrompt
          : null,
      learnerLevel:
        typeof summaryPayload.learnerLevel === "string"
          ? summaryPayload.learnerLevel
          : null,
      focusSkill:
        typeof summaryPayload.focusSkill === "string" ? summaryPayload.focusSkill : null,
      recommendationReason:
        typeof summaryPayload.recommendationReason === "string"
          ? summaryPayload.recommendationReason
          : null,
      activeTopic:
        typeof summaryPayload.activeTopic === "string" ? summaryPayload.activeTopic : null,
      isBenchmark: Boolean(summaryPayload.isBenchmark),
    }),
    activeTopic:
      typeof summaryPayload.activeTopic === "string" ? summaryPayload.activeTopic : null,
  };
  const turns = session.turns.map((turn) => {
    const metrics = turn.metricsPayload as
      | {
          microCoaching?: string | null;
          turnSignals?: {
            fluencyIssue?: boolean;
            grammarIssue?: boolean;
            vocabOpportunity?: boolean;
          } | null;
        }
      | null;

    return {
      turnIndex: turn.turnIndex,
      speaker: turn.speaker as "ai" | "student",
      text: turn.transcriptText,
      coaching:
        turn.speaker === "student"
          ? buildSpeakTurnCoaching({
              microCoaching: metrics?.microCoaching,
              turnSignals: metrics?.turnSignals ?? null,
            })
          : null,
    };
  });
  const evaluation = session.evaluationPayload as
    | Partial<SpeakSessionReview>
    | null;
  const initialReview =
    evaluation && Array.isArray(evaluation.turns) && Array.isArray(evaluation.vocabulary)
      ? {
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
          vocabulary: evaluation.vocabulary,
        }
      : null;

  if (session.interactionMode === "voice" && session.status === "active") {
    return (
      <SpeakRealtimeSessionPanel
        sessionId={session.id}
        mission={mission}
        initialTurns={turns}
      />
    );
  }

  return (
    <SpeakSessionPanel
      sessionId={session.id}
      mission={mission}
      interactionMode={session.interactionMode as "text" | "voice"}
      status={session.status as "active" | "completed" | "abandoned"}
      initialTurns={turns}
      initialReview={initialReview}
    />
  );
}
