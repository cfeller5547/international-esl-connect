import { z } from "zod";

import { trackEvent } from "@/server/analytics";
import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { SpeakService } from "@/server/services/speak-service";

const schema = z.object({
  mode: z.enum(["free_speech", "guided"]),
  interactionMode: z.enum(["text", "voice"]),
  starterKey: z.string().optional().nullable(),
  scenarioKey: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    if (payload.starterKey) {
      await trackEvent({
        eventName: "speak_starter_selected",
        route: "/app/speak",
        userId: user.id,
        properties: {
          starter_key: payload.starterKey,
        },
      });
    }

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
