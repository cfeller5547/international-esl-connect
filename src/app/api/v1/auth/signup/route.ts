import { cookies } from "next/headers";
import { z } from "zod";

import { toAgeBandEnum } from "@/lib/mappers";
import { trackEvent } from "@/server/analytics";
import { setAuthSession, hashPassword } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { prisma } from "@/server/prisma";
import { OnboardingService } from "@/server/services/onboarding-service";
import { UsageService } from "@/server/services/usage-service";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  ageConfirmed13Plus: z.boolean(),
  guestSessionToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, schema);

    if (!payload.ageConfirmed13Plus) {
      throw new AppError("VALIDATION_ERROR", "You must confirm that you are 13+.", 400);
    }

    const cookieStore = await cookies();
    const guestSessionToken =
      payload.guestSessionToken ?? cookieStore.get("guest_session")?.value ?? undefined;
    const guestSession = guestSessionToken
      ? await OnboardingService.getGuestSessionByToken(guestSessionToken)
      : null;
    const profile = (guestSession?.profilePayload ?? {}) as Record<string, string | boolean>;

    const existing = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    if (existing) {
      throw new AppError(
        "VALIDATION_ERROR",
        "An account with this email already exists.",
        409
      );
    }

    const user = await prisma.user.create({
      data: {
        email: payload.email.toLowerCase(),
        passwordHash: await hashPassword(payload.password),
        firstName: typeof profile.firstName === "string" ? profile.firstName : null,
        ageBand: toAgeBandEnum(typeof profile.ageBand === "string" ? profile.ageBand : "18-24"),
        nativeLanguage:
          typeof profile.nativeLanguage === "string" ? (profile.nativeLanguage as never) : "english",
        targetLanguage:
          typeof profile.targetLanguage === "string" ? (profile.targetLanguage as never) : "spanish",
        schoolLevel:
          typeof profile.schoolLevel === "string" ? (profile.schoolLevel as never) : "high_school",
      },
    });

    await UsageService.getOrCreateSubscription(user.id);

    if (guestSessionToken) {
      await OnboardingService.migrateGuestSessionToUser({
        guestSessionToken,
        userId: user.id,
      });
    }

    await setAuthSession({
      userId: user.id,
      email: user.email,
    });

    await trackEvent({
      eventName: "signup_completed",
      route: "/signup",
      userId: user.id,
      guestSessionToken,
      properties: {
        conversion_source: "onboarding_results",
      },
    });

    return ok({
      userId: user.id,
      redirectTo: "/app/home",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
