import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthPageShell } from "@/features/onboarding/auth-page-shell";
import { PreSignupStepper } from "@/components/ui-kit/pre-signup-stepper";
import { AuthForm } from "@/features/onboarding/auth-form";
import { OnboardingService } from "@/server/services/onboarding-service";

export default async function SignupPage() {
  const cookieStore = await cookies();
  const guestSessionToken = cookieStore.get("guest_session")?.value;

  if (!guestSessionToken) {
    redirect("/get-started");
  }

  const onboardingState = await OnboardingService.getGuestOnboardingState(guestSessionToken);

  if (!onboardingState) {
    redirect("/get-started");
  }

  if (!onboardingState.canAccessSignup) {
    redirect(onboardingState.nextStepHref);
  }

  return (
    <div className="space-y-8">
      <PreSignupStepper showBrand={false} />
      <AuthPageShell mode="signup">
        <AuthForm mode="signup" />
      </AuthPageShell>
    </div>
  );
}
