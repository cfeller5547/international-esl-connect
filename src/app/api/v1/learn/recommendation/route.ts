import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { RecommendationService } from "@/server/services/recommendation-service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const recommendation = await RecommendationService.getRecommendation(user.id, "learn");

    return ok({
      title: "Continue curriculum",
      targetUrl: recommendation.targetUrl,
      reason: recommendation.reason,
      reasonCode: recommendation.reasonCode,
      contextSignals: recommendation.contextSignals,
      contentSourceType: recommendation.sourceType,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
