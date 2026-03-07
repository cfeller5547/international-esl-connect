import { AuthPageShell } from "@/features/onboarding/auth-page-shell";
import { PreSignupStepper } from "@/components/ui-kit/pre-signup-stepper";
import { AuthForm } from "@/features/onboarding/auth-form";

export default function SignupPage() {
  return (
    <div className="space-y-8">
      <PreSignupStepper showBrand={false} />
      <AuthPageShell mode="signup">
        <AuthForm mode="signup" />
      </AuthPageShell>
    </div>
  );
}
