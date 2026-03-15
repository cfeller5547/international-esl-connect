import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { LearnSpeakingService } from "@/server/services/learn-speaking-service";

const schema = z.object({
  unitSlug: z.string().min(1),
  interactionMode: z.enum(["text", "voice"]),
  retryOfSessionId: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    return ok(
      await LearnSpeakingService.startMission({
        userId: user.id,
        unitSlug: payload.unitSlug,
        interactionMode: payload.interactionMode,
        retryOfSessionId: payload.retryOfSessionId,
      })
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
