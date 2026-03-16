import { cookies } from "next/headers";
import { z } from "zod";

import { toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { OnboardingService } from "@/server/services/onboarding-service";

const assessmentPayloadSchema = z.object({
  objectiveAnswers: z.array(
    z.object({
      questionId: z.string(),
      value: z.string(),
      correctValue: z.string().optional(),
      skill: z.enum([
        "listening",
        "speaking",
        "reading",
        "writing",
        "vocabulary",
        "grammar",
      ]),
    })
  ),
  conversationTurns: z.array(
    z.object({
      prompt: z.string(),
      answer: z.string(),
    })
  ),
  writingSample: z.string().optional(),
});

const schema = z.object({
  assessmentAttemptId: z.string().min(1),
  payload: assessmentPayloadSchema,
});

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, schema);
    const cookieStore = await cookies();
    const guestSessionToken = cookieStore.get("guest_session")?.value;

    if (!guestSessionToken) {
      throw new Error("Guest session missing.");
    }

    const report = await OnboardingService.completeFullDiagnostic({
      guestSessionToken,
      assessmentAttemptId: payload.assessmentAttemptId,
      payload: payload.payload,
    });

    return ok({
      reportPreviewId: report.id,
      overallScore: report.overallScore,
      levelLabel: report.levelLabel,
      redirectTo: "/signup",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
