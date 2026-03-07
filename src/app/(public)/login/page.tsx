import { AuthPageShell } from "@/features/onboarding/auth-page-shell";
import { AuthForm } from "@/features/onboarding/auth-form";

export default function LoginPage() {
  return (
    <AuthPageShell mode="login">
      <AuthForm mode="login" />
    </AuthPageShell>
  );
}
