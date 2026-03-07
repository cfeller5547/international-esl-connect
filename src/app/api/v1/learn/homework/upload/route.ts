import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { HomeworkHelpService } from "@/server/services/homework-help-service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const text = formData.get("text");
    const inputType = String(formData.get("inputType") ?? "text") as
      | "pdf"
      | "image"
      | "text";

    const upload = await HomeworkHelpService.createUpload({
      userId: user.id,
      inputType,
      file: file instanceof File ? file : null,
      text: typeof text === "string" ? text : null,
    });

    return ok({
      homeworkUploadId: upload.id,
      status: upload.status,
      detectedQuestionCount: 0,
      parseConfidence: null,
      requiresReview: false,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
