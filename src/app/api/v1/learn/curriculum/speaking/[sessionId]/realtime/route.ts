import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { LearnSpeakingService } from "@/server/services/learn-speaking-service";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{ sessionId: string }>;
  }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { sessionId } = await context.params;

    return ok(
      await LearnSpeakingService.createRealtimeClientSecret({
        sessionId,
        userId: user.id,
      })
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
