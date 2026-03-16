import { cookies } from "next/headers";
import { z } from "zod";

import { toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { AssessmentConversationService } from "@/server/services/assessment-conversation-service";

const schema = z.object({
  assessmentAttemptId: z.string().min(1),
  transcript: z.array(
    z.object({
      speaker: z.enum(["ai", "student"]),
      text: z.string(),
      countsTowardProgress: z.boolean().optional(),
    })
  ),
  studentInput: z.object({
    text: z.string().optional(),
    audioDataUrl: z.string().optional(),
    audioMimeType: z.string().optional(),
    durationSeconds: z.number().int().positive().optional(),
    voiceCaptured: z.boolean().optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, schema);
    const cookieStore = await cookies();
    const guestSessionToken = cookieStore.get("guest_session")?.value;

    if (!guestSessionToken) {
      throw new Error("Guest session missing.");
    }

    const reply = await AssessmentConversationService.submitTurn({
      assessmentAttemptId: payload.assessmentAttemptId,
      transcript: payload.transcript,
      studentInput: payload.studentInput,
      guestSessionToken,
    });

    return ok(reply);
  } catch (error) {
    return toErrorResponse(error);
  }
}
