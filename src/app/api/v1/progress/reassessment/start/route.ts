import { trackEvent } from "@/server/analytics";
import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { AssessmentService } from "@/server/services/assessment-service";
import { UsageService } from "@/server/services/usage-service";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    await UsageService.assertWithinLimit(user.id, "reassessments");
    await UsageService.increment(user.id, "reassessments");

    const attempt = await AssessmentService.startAssessment({
      userId: user.id,
      context: "reassessment",
    });

    await trackEvent({
      eventName: "reassessment_started",
      route: "/app/progress/reassessment",
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
