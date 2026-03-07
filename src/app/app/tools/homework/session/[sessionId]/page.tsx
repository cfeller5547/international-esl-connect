import { notFound } from "next/navigation";

import { HomeworkSessionPanel } from "@/features/homework-help/homework-session-panel";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/prisma";

export default async function ToolsHomeworkSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getCurrentUser();
  const { sessionId } = await params;

  if (!user) {
    return null;
  }

  const session = await prisma.homeworkHelpSession.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
    },
    include: {
      homeworkUpload: true,
    },
  });

  if (!session) {
    notFound();
  }

  const parsed = session.homeworkUpload.parsedPayload as {
    rawText?: string;
    questions?: Array<{ index: number; promptText: string; questionType: string }>;
  };

  return (
    <HomeworkSessionPanel
      sessionId={session.id}
      rawText={parsed.rawText ?? "No source text available."}
      questions={parsed.questions ?? []}
    />
  );
}
