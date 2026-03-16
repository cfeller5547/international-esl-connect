import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AssessmentForm } from "@/features/assessment/assessment-form";
import {
  FULL_DIAGNOSTIC_CONVERSATION,
  FULL_DIAGNOSTIC_PROMPTS,
  FULL_DIAGNOSTIC_QUESTIONS,
} from "@/features/assessment/question-bank";
import { trackEvent } from "@/server/analytics";
import { OnboardingService } from "@/server/services/onboarding-service";

export default async function OnboardingAssessmentPage() {
  const cookieStore = await cookies();
  const guestSessionToken = cookieStore.get("guest_session")?.value;

  if (!guestSessionToken) {
    redirect("/");
  }

  const attempt = await OnboardingService.startFullDiagnostic(guestSessionToken);

  await trackEvent({
    eventName: "assessment_started",
    route: "/onboarding/assessment",
    guestSessionToken,
    properties: {
      context: "onboarding_full",
    },
  });

  return (
    <AssessmentForm
      storageKey={`onboarding-full-diagnostic-${attempt.id}`}
      assessmentAttemptId={attempt.id}
      endpoint="/api/v1/onboarding/session/assessment/complete"
      questions={FULL_DIAGNOSTIC_QUESTIONS}
      prompts={[...FULL_DIAGNOSTIC_PROMPTS]}
      title="Full diagnostic assessment"
      description="Complete the full diagnostic before signup so we can place you in the right curriculum from the start."
      submitLabel="Continue to signup"
      includesWritingPrompt
      backHref="/onboarding/profile"
      conversationExperience={{
        ...FULL_DIAGNOSTIC_CONVERSATION,
        turnEndpoint: "/api/v1/onboarding/session/assessment/conversation/turn",
      }}
    />
  );
}
