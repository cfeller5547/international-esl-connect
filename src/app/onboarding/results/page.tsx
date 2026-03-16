import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingService } from "@/server/services/onboarding-service";

export default async function OnboardingResultsPage() {
  const cookieStore = await cookies();
  const guestSessionToken = cookieStore.get("guest_session")?.value;

  if (!guestSessionToken) {
    redirect("/");
  }

  const report = await OnboardingService.getResults(guestSessionToken);

  if (!report) {
    redirect("/onboarding/assessment");
  }

  redirect("/signup");
}
