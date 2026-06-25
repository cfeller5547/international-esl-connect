import { z } from "zod";

import { trackEvent } from "@/server/analytics";
import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { SpeakService } from "@/server/services/speak-service";

const schema = z.object({
  type: z.enum(["free_speech", "mission"]),
  interactionMode: z.enum(["text", "voice"]),
  id: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    
    await trackEvent({
      eventName: "speak_mission_started",
      route: "/app/speak",
      userId: user.id,
      properties: {
        mission_type: payload.type,
        mission_id: payload.id,
      },
    });

    return ok(
      await SpeakService.startSession({
        userId: user.id,
        ...payload,
      })
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
