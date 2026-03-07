import { notFound } from "next/navigation";

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

  return (
    <SpeakSessionPanel
      sessionId={session.id}
      initialTurns={session.turns.map((turn) => ({
        speaker: turn.speaker as "ai" | "student",
        text: turn.transcriptText,
      }))}
    />
  );
}
