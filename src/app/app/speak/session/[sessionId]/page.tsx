import { notFound } from "next/navigation";

import { SpeakRealtimeSessionPanel } from "@/features/speak/speak-realtime-session-panel";
import { SpeakSessionPanel } from "@/features/speak/speak-session-panel";
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
  const turns = session.turns.map((turn) => ({
    speaker: turn.speaker as "ai" | "student",
    text: turn.transcriptText,
  }));

  if (session.interactionMode === "voice" && session.status === "active") {
    return (
      <SpeakRealtimeSessionPanel
        sessionId={session.id}
        initialTurns={turns}
        scenarioTitle={String(summaryPayload.scenarioTitle ?? "Live speaking practice")}
        scenarioSetup={String(
          summaryPayload.scenarioSetup ??
            "Have a natural spoken conversation and keep it moving with clear follow-up questions."
        )}
        starterPrompt={
          typeof summaryPayload.starterPrompt === "string"
            ? summaryPayload.starterPrompt
            : null
        }
      />
    );
  }

  return (
    <SpeakSessionPanel
      sessionId={session.id}
      interactionMode={session.interactionMode as "text" | "voice"}
      status={session.status as "active" | "completed" | "abandoned"}
      initialTurns={turns}
    />
  );
}
