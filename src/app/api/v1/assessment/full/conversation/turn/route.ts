import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
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
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const reply = await AssessmentConversationService.submitTurn({
      assessmentAttemptId: payload.assessmentAttemptId,
      transcript: payload.transcript,
      studentInput: payload.studentInput,
      userId: user.id,
    });

    return ok(reply);
  } catch (error) {
    return toErrorResponse(error);
  }
}
