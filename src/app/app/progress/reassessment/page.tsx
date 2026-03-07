import { AssessmentForm } from "@/features/assessment/assessment-form";
import { FULL_DIAGNOSTIC_QUESTIONS } from "@/features/assessment/question-bank";
import { getCurrentUser } from "@/server/auth";
import { AssessmentService } from "@/server/services/assessment-service";

const REASSESSMENT_PROMPTS = [
  "Describe a recent class activity.",
  "What are you explaining more clearly now than before?",
  "Which topic still needs more practice?",
  "What will you focus on next week?",
];

export default async function ReassessmentPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const attempt = await AssessmentService.startAssessment({
    userId: user.id,
    context: "reassessment",
  });

  return (
    <AssessmentForm
      storageKey={`reassessment-${attempt.id}`}
      assessmentAttemptId={attempt.id}
      endpoint="/api/v1/progress/reassessment/complete"
      questions={FULL_DIAGNOSTIC_QUESTIONS}
      prompts={REASSESSMENT_PROMPTS}
      title="Reassessment"
      description="Run a fresh full assessment to compare against your most recent report."
      submitLabel="Complete reassessment"
      includesWritingPrompt
      backHref="/app/progress"
    />
  );
}
