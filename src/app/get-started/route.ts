import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { OnboardingService } from "@/server/services/onboarding-service";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const guestSessionToken = cookieStore.get("guest_session")?.value;

  if (guestSessionToken) {
    const onboardingState = await OnboardingService.getGuestOnboardingState(guestSessionToken);

    if (onboardingState) {
      return NextResponse.redirect(new URL(onboardingState.nextStepHref, request.url));
    }
  }

  const session = await OnboardingService.createGuestSession();
  const response = NextResponse.redirect(new URL("/onboarding/profile", request.url));

  response.cookies.set("guest_session", session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
