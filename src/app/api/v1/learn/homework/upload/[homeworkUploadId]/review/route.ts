import { z } from "zod";

import { getHomeworkConfidenceState } from "@/lib/homework-help";
import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { HomeworkHelpService } from "@/server/services/homework-help-service";

const schema = z.object({
  questions: z
    .array(
      z.object({
        promptText: z.string().trim().min(1),
      })
    )
    .min(1),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ homeworkUploadId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { homeworkUploadId } = await params;
    const payload = await parseJson(request, schema);
    const upload = await HomeworkHelpService.reviewUpload({
      userId: user.id,
      homeworkUploadId,
      questions: payload.questions,
    });
    const parsedPayload = upload.parsedPayload as {
      assignmentTitle?: string;
      assignmentSummary?: string;
      subject?: string;
      difficultyLevel?: string;
      reviewNotes?: string[];
      extractionNotes?: string[];
      rawText?: string;
      contentShape?: string;
      questions?: unknown[];
    };
    const questionCount = parsedPayload.questions?.length ?? 0;

    return ok({
      homeworkUploadId: upload.id,
      status: upload.status,
      detectedQuestionCount: questionCount,
      parseConfidence: upload.parseConfidence,
      requiresReview: upload.status === "needs_review",
      confidenceState: getHomeworkConfidenceState({
        status: upload.status,
        questionCount,
      }),
      errorCode: upload.errorCode,
      assignmentTitle: parsedPayload.assignmentTitle ?? null,
      assignmentSummary: parsedPayload.assignmentSummary ?? null,
      subject: parsedPayload.subject ?? null,
      difficultyLevel: parsedPayload.difficultyLevel ?? null,
      contentShape: parsedPayload.contentShape ?? null,
      reviewNotes: parsedPayload.reviewNotes ?? [],
      extractionNotes: parsedPayload.extractionNotes ?? [],
      rawText: parsedPayload.rawText ?? null,
      questions: parsedPayload.questions ?? [],
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
