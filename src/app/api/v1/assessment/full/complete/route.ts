import { z } from "zod";

import { trackEvent } from "@/server/analytics";
import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { AssessmentService } from "@/server/services/assessment-service";

const schema = z.object({
  assessmentAttemptId: z.string().min(1),
  payload: z.object({
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
  }),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const report = await AssessmentService.completeAssessment({
      assessmentAttemptId: payload.assessmentAttemptId,
      payload: payload.payload,
      reportType: "baseline_full",
      userId: user.id,
    });

    await trackEvent({
      eventName: "celebration_milestone_viewed",
      route: `/app/progress/reports/${report.id}`,
      userId: user.id,
      properties: {
        milestone_type: "full_diagnostic_completed",
      },
    });

    return ok({
      reportId: report.id,
      reportType: "baseline_full",
      overallScore: report.overallScore,
      levelLabel: report.levelLabel,
      redirectTo: `/app/progress/reports/${report.id}`,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
