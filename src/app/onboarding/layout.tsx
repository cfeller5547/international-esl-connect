export const dynamic = "force-dynamic";

import { PreSignupStepper } from "@/components/ui-kit/pre-signup-stepper";
import { PageShell } from "@/components/ui-kit/page-shell";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PageShell className="min-h-screen py-8">
      <PreSignupStepper />
      {children}
    </PageShell>
  );
}
