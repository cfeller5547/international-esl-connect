import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { TestPrepService } from "@/server/services/test-prep-service";

const schema = z.object({
  targetDate: z.string().min(1),
  topics: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const plan = await TestPrepService.createPlan({
      userId: user.id,
      ...payload,
    });

    return ok({
      planId: plan.id,
      summary: `${payload.topics.length}-topic plan created`,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
