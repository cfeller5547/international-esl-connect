import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { HomeworkHelpService } from "@/server/services/homework-help-service";

const schema = z.object({
  sessionId: z.string().min(1),
  questionIndex: z.number().int().min(0),
  studentAnswer: z.string(),
  requestHintLevel: z.number().int().min(0).max(3),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const result = await HomeworkHelpService.submitStep({
      ...payload,
      userId: user.id,
    });

    return ok(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
