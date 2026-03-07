import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { HomeworkHelpService } from "@/server/services/homework-help-service";

const schema = z.object({
  homeworkUploadId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const session = await HomeworkHelpService.startSession(user.id, payload.homeworkUploadId);
    return ok({
      sessionId: session.id,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
