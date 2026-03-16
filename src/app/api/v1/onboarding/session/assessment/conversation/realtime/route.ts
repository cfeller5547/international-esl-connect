import { cookies } from "next/headers";
import { z } from "zod";

import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { AssessmentConversationService } from "@/server/services/assessment-conversation-service";

const schema = z.object({
  assessmentAttemptId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, schema);
    const cookieStore = await cookies();
    const guestSessionToken = cookieStore.get("guest_session")?.value;

    if (!guestSessionToken) {
      throw new AppError("UNAUTHORIZED", "Guest session missing.", 401);
    }

    return ok(
      await AssessmentConversationService.createRealtimeClientSecret({
        assessmentAttemptId: payload.assessmentAttemptId,
        guestSessionToken,
      })
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
