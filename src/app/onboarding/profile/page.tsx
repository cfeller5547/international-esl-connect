import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/features/onboarding/profile-form";
import { trackEvent } from "@/server/analytics";

export default async function OnboardingProfilePage() {
  const cookieStore = await cookies();
  const guestSessionToken = cookieStore.get("guest_session")?.value;

  if (!guestSessionToken) {
    redirect("/");
  }

  await trackEvent({
    eventName: "onboarding_started",
    route: "/onboarding/profile",
    guestSessionToken,
    properties: {
      target_language: null,
    },
  });

  return (
    <Card className="surface-glow border-border/70 bg-card/95">
      <CardHeader className="space-y-3">
        <CardTitle className="text-xl sm:text-2xl">Build your learning profile</CardTitle>
        <p className="text-sm text-muted-foreground">
          This only takes a minute. We use it to personalize the baseline assessment
          and your first recommendations.
        </p>
      </CardHeader>
      <CardContent>
        <ProfileForm guestSessionToken={guestSessionToken} />
      </CardContent>
    </Card>
  );
}
