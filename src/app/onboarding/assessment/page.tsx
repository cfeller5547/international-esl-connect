import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AssessmentForm } from "@/features/assessment/assessment-form";
import { QUICK_BASELINE_QUESTIONS } from "@/features/assessment/question-bank";
import { trackEvent } from "@/server/analytics";
import { OnboardingService } from "@/server/services/onboarding-service";

const QUICK_PROMPTS = [
  "Tell me one thing you studied this week.",
  "What felt easy, and what felt hard?",
  "How would you explain today's topic to a classmate?",
];

export default async function OnboardingAssessmentPage() {
  const cookieStore = await cookies();
  const guestSessionToken = cookieStore.get("guest_session")?.value;

  if (!guestSessionToken) {
    redirect("/");
  }

  const attempt = await OnboardingService.startQuickBaseline(guestSessionToken);

  await trackEvent({
    eventName: "assessment_started",
    route: "/onboarding/assessment",
    guestSessionToken,
    properties: {
      context: "onboarding_quick",
    },
  });

  return (
    <AssessmentForm
      storageKey={`quick-baseline-${attempt.id}`}
      assessmentAttemptId={attempt.id}
      endpoint="/api/v1/onboarding/session/assessment/complete"
      questions={QUICK_BASELINE_QUESTIONS}
      prompts={QUICK_PROMPTS}
      title="Quick baseline assessment"
      description="Complete the short baseline before signup. The conversation section is required."
      submitLabel="Complete quick baseline"
      backHref="/onboarding/profile"
      extraPayload={{
        phase: "quick_baseline",
      }}
    />
  );
}
