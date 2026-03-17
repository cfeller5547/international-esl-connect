import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { HomeworkHelpService } from "@/server/services/homework-help-service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ homeworkUploadId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { homeworkUploadId } = await params;
    const upload = await HomeworkHelpService.getUpload(homeworkUploadId, user.id);
    const parsedPayload = upload.parsedPayload as {
      assignmentTitle?: string;
      assignmentSummary?: string;
      subject?: string;
      difficultyLevel?: string;
      reviewNotes?: string[];
      extractionNotes?: string[];
      rawText?: string;
      questions?: unknown[];
    };

    return ok({
      homeworkUploadId: upload.id,
      status: upload.status,
      detectedQuestionCount: parsedPayload.questions?.length ?? 0,
      parseConfidence: upload.parseConfidence,
      requiresReview: upload.status === "needs_review",
      errorCode: upload.errorCode,
      assignmentTitle: parsedPayload.assignmentTitle ?? null,
      assignmentSummary: parsedPayload.assignmentSummary ?? null,
      subject: parsedPayload.subject ?? null,
      difficultyLevel: parsedPayload.difficultyLevel ?? null,
      reviewNotes: parsedPayload.reviewNotes ?? [],
      extractionNotes: parsedPayload.extractionNotes ?? [],
      rawText: parsedPayload.rawText ?? null,
      questions: parsedPayload.questions ?? [],
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
