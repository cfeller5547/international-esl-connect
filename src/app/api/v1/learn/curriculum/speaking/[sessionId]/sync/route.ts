import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { LearnSpeakingService } from "@/server/services/learn-speaking-service";

const schema = z.object({
  turns: z.array(
    z.object({
      speaker: z.enum(["ai", "student"]),
      text: z.string().min(1),
    })
  ),
});

export async function POST(
  request: Request,
  context: {
    params: Promise<{ sessionId: string }>;
  }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const { sessionId } = await context.params;

    return ok(
      await LearnSpeakingService.syncRealtimeTranscript({
        sessionId,
        userId: user.id,
        turns: payload.turns,
      })
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
