import { AssessmentForm } from "@/features/assessment/assessment-form";
import { FULL_DIAGNOSTIC_QUESTIONS } from "@/features/assessment/question-bank";
import { getCurrentUser } from "@/server/auth";
import { AssessmentService } from "@/server/services/assessment-service";

const FULL_PROMPTS = [
  "Describe a class activity you completed recently.",
  "What did you understand well, and what still feels confusing?",
  "Give an example sentence using this week's topic.",
  "What would you ask your teacher if you needed more help?",
];

export default async function FullDiagnosticPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const attempt = await AssessmentService.startAssessment({
    userId: user.id,
    context: "onboarding_full",
  });

  return (
    <AssessmentForm
      storageKey={`full-diagnostic-${attempt.id}`}
      assessmentAttemptId={attempt.id}
      endpoint="/api/v1/assessment/full/complete"
      questions={FULL_DIAGNOSTIC_QUESTIONS}
      prompts={FULL_PROMPTS}
      title="Full diagnostic"
      description="Expand the baseline with more objective items, a short writing prompt, and a longer AI conversation."
      submitLabel="Complete full diagnostic"
      includesWritingPrompt
      backHref="/app/home"
    />
  );
}
