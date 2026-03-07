import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { ContextService } from "@/server/services/context-service";

const schema = z.object({
  schoolName: z.string().optional(),
  className: z.string().optional(),
  instructorName: z.string().optional(),
  periodLabel: z.string().optional(),
  courseLevel: z.string().optional(),
});

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const profile = await ContextService.saveClassProfile({
      userId: user.id,
      ...payload,
    });

    return ok(profile);
  } catch (error) {
    return toErrorResponse(error);
  }
}
