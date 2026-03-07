import { z } from "zod";

import { toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { OnboardingService } from "@/server/services/onboarding-service";

const schema = z.object({
  guestSessionToken: z.string().min(1),
  firstName: z.string().min(1),
  ageBand: z.enum(["13-15", "16-18", "18-24"]),
  targetLanguage: z.enum(["english", "spanish", "chinese"]),
  nativeLanguage: z.enum(["english", "spanish", "chinese"]),
  isTakingClass: z.boolean(),
  schoolLevel: z.enum(["high_school", "college"]),
});

export async function PUT(request: Request) {
  try {
    const payload = await parseJson(request, schema);
    await OnboardingService.saveProfile(payload.guestSessionToken, payload);
    return ok({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
