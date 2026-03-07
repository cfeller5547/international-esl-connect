import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { LearnService } from "@/server/services/learn-service";

const schema = z.object({
  activityType: z.enum(["lesson", "worksheet", "speaking_apply", "daily_challenge"]),
  activityId: z.string().min(1),
  score: z.number().int().min(0).max(100),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const result = await LearnService.completeActivity({
      userId: user.id,
      ...payload,
    });

    return ok({
      nextAction: result.nextAction,
      inlineProgressDelta: result.inlineProgressDelta,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
