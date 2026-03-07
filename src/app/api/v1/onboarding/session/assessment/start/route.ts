import { z } from "zod";

import { toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { OnboardingService } from "@/server/services/onboarding-service";

const schema = z.object({
  guestSessionToken: z.string().min(1),
  phase: z.literal("quick_baseline"),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, schema);
    const attempt = await OnboardingService.startQuickBaseline(payload.guestSessionToken);
    return ok({
      assessmentAttemptId: attempt.id,
      phase: payload.phase,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
