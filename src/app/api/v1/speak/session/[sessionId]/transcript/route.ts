import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { SpeakService } from "@/server/services/speak-service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { sessionId } = await params;
    return ok(await SpeakService.getTranscript(sessionId, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
