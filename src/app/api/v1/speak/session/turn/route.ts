import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { SpeakService } from "@/server/services/speak-service";

const schema = z.object({
  sessionId: z.string().min(1),
  studentInput: z.object({
    text: z.string().optional(),
    audioRef: z.string().optional(),
    audioDataUrl: z.string().optional(),
    audioMimeType: z.string().optional(),
    durationSeconds: z.number().min(0).optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    return ok(
      await SpeakService.submitTurn({
        ...payload,
        userId: user.id,
      })
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
