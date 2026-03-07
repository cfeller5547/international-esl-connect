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

    const recommendation = await RecommendationService.getRecommendation(user.id, "home");

    return ok({
      actionType: recommendation.actionType,
      title: recommendation.title,
      targetUrl: recommendation.targetUrl,
      reason: recommendation.reason,
      reasonCode: recommendation.reasonCode,
      sourceType: recommendation.sourceType,
      weakestSkill: recommendation.weakestSkill,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
