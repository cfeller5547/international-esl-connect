import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { CurriculumService } from "@/server/services/curriculum-service";

const schema = z.object({
  unitSlug: z.string().min(1),
  activityType: z.enum(["lesson", "practice", "speaking", "writing", "checkpoint"]),
  score: z.number().int().min(0).max(100),
  responsePayload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const result = await CurriculumService.completeUnitActivity({
      userId: user.id,
      unitSlug: payload.unitSlug,
      activityType: payload.activityType,
      score: payload.score,
      responsePayload: payload.responsePayload,
    });

    return ok(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
