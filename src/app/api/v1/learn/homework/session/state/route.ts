import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { HomeworkHelpService } from "@/server/services/homework-help-service";

const schema = z.object({
  sessionId: z.string().min(1),
  questionIndex: z.number().int().min(0),
  latestDraft: z.string(),
  currentQuestionIndex: z.number().int().min(0),
});

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const sessionState = await HomeworkHelpService.saveSessionState({
      ...payload,
      userId: user.id,
    });

    return ok({
      sessionState,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
