import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { AssessmentConversationService } from "@/server/services/assessment-conversation-service";

const schema = z.object({
  assessmentAttemptId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);

    return ok(
      await AssessmentConversationService.createRealtimeClientSecret({
        assessmentAttemptId: payload.assessmentAttemptId,
        userId: user.id,
      })
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
