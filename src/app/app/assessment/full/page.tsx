import { AssessmentForm } from "@/features/assessment/assessment-form";
import {
  FULL_DIAGNOSTIC_CONVERSATION,
  FULL_DIAGNOSTIC_PROMPTS,
  FULL_DIAGNOSTIC_QUESTIONS,
} from "@/features/assessment/question-bank";
import { getCurrentUser } from "@/server/auth";
import { AssessmentService } from "@/server/services/assessment-service";

export default async function FullDiagnosticPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const fullDiagnostic = await AssessmentService.getFullDiagnosticBootstrap({
    userId: user.id,
    reusableQuestionIds: FULL_DIAGNOSTIC_QUESTIONS.map((question) => question.id),
  });

  const importedQuestionCount = fullDiagnostic.importedObjectiveCount;
  const introNote =
    importedQuestionCount > 0
      ? `We carried over ${importedQuestionCount} completed baseline question${importedQuestionCount === 1 ? "" : "s"} so you can continue from the deeper diagnostic instead of starting over.`
      : undefined;

  return (
    <AssessmentForm
      storageKey={`full-diagnostic-${fullDiagnostic.attempt.id}`}
      assessmentAttemptId={fullDiagnostic.attempt.id}
      endpoint="/api/v1/assessment/full/complete"
      questions={FULL_DIAGNOSTIC_QUESTIONS}
      prompts={[...FULL_DIAGNOSTIC_PROMPTS]}
      title="Full diagnostic"
      description="Expand the baseline with more objective items, a short writing prompt, and a longer AI conversation."
      submitLabel="Complete full diagnostic"
      includesWritingPrompt
      backHref="/app/home"
      initialState={fullDiagnostic.initialState}
      introNote={introNote}
      conversationExperience={{
        ...FULL_DIAGNOSTIC_CONVERSATION,
        turnEndpoint: "/api/v1/assessment/full/conversation/turn",
      }}
    />
  );
}
