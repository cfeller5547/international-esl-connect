import { z } from "zod";

import { trackEvent } from "@/server/analytics";
import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { AssessmentService } from "@/server/services/assessment-service";

const schema = z.object({
  context: z.literal("onboarding_full"),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    await parseJson(request, schema);
    const attempt = await AssessmentService.startAssessment({
      userId: user.id,
      context: "onboarding_full",
    });

    await trackEvent({
      eventName: "full_diagnostic_started",
      route: "/app/assessment/full",
      userId: user.id,
      properties: {
        attempt_id: attempt.id,
      },
    });

    return ok({
      assessmentAttemptId: attempt.id,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
