import { cookies } from "next/headers";

import { ok } from "@/server/http";
import { toErrorResponse } from "@/server/errors";
import { trackEvent } from "@/server/analytics";
import { OnboardingService } from "@/server/services/onboarding-service";

export async function POST() {
  try {
    const session = await OnboardingService.createGuestSession();
    const cookieStore = await cookies();

    cookieStore.set("guest_session", session.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    await trackEvent({
      eventName: "landing_primary_cta_clicked",
      route: "/",
      guestSessionToken: session.sessionToken,
      properties: {},
    });

    return ok({
      guestSessionToken: session.sessionToken,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
