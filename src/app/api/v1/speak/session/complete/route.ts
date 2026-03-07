import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { SpeakService } from "@/server/services/speak-service";

const schema = z.object({
  sessionId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    return ok(await SpeakService.completeSession(payload.sessionId, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
