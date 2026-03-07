import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { SpeakService } from "@/server/services/speak-service";

const schema = z.object({
  phraseText: z.string().min(1),
  translationText: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { sessionId } = await params;
    const payload = await parseJson(request, schema);
    return ok(
      await SpeakService.savePhrase({
        sessionId,
        userId: user.id,
        ...payload,
      })
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
