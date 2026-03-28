import { notFound } from "next/navigation";

import { HomeworkSessionPanel } from "@/features/homework-help/homework-session-panel";
import {
  buildHomeworkCompletionSummary,
  getHomeworkConfidenceState,
  hydrateHomeworkSessionState,
} from "@/lib/homework-help";
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

  const session = await prisma.homeworkHelpSession
    .findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
      select: {
        id: true,
        status: true,
        homeworkUpload: {
          select: {
            status: true,
            parsedPayload: true,
          },
        },
        steps: {
          select: {
            questionIndex: true,
            result: true,
            hintLevelUsed: true,
            studentAnswer: true,
            feedbackPayload: true,
          },
        },
      },
    })
    .catch((error) => {
      console.error("tools:homework session lookup failed", error);
      return null;
    });

  if (!session) {
    notFound();
  }

  const parsed = session.homeworkUpload.parsedPayload as {
    rawText?: string;
    assignmentTitle?: string;
    assignmentSummary?: string;
    subject?: string;
      difficultyLevel?: string;
      contentShape?: string;
      reviewNotes?: string[];
      questions?: Array<{
        index: number;
        promptText: string;
      questionType: string;
      focusSkill?: string;
      studentGoal?: string;
      answerFormat?: string;
      successCriteria?: string[];
      planSteps?: string[];
        commonPitfalls?: string[];
      }>;
    };
  const questions = parsed.questions ?? [];
  const sessionState = hydrateHomeworkSessionState({
    questions,
    savedState: null,
    steps: session.steps,
  });
  const completionSummary = buildHomeworkCompletionSummary({
    questions,
    state: sessionState,
  });
  const confidenceState = getHomeworkConfidenceState({
    status: session.homeworkUpload.status,
    questionCount: questions.length,
  });

  return (
    <HomeworkSessionPanel
      sessionId={session.id}
      sessionStatus={session.status}
      assignmentTitle={parsed.assignmentTitle ?? "Homework help"}
      assignmentSummary={
        parsed.assignmentSummary ?? "Work through each question with guided coaching."
      }
      subject={parsed.subject ?? "general coursework"}
      difficultyLevel={parsed.difficultyLevel ?? "moderate"}
      contentShape={parsed.contentShape ?? "mixed_or_unclear"}
      confidenceState={confidenceState}
      reviewNotes={parsed.reviewNotes ?? []}
      rawText={parsed.rawText ?? "No source text available."}
      questions={questions}
      initialSessionState={sessionState}
      completionSummary={completionSummary}
    />
  );
}
