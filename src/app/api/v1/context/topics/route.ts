import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { ContextService } from "@/server/services/context-service";

const schema = z.object({
  topics: z.array(z.string().min(1)).min(1),
  activeFrom: z.string(),
  activeTo: z.string(),
});

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const result = await ContextService.saveManualTopics({
      userId: user.id,
      ...payload,
    });

    return ok({
      syllabusProfileId: result.id,
      topics: payload.topics,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
