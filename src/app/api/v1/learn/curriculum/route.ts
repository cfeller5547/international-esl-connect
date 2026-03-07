import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { CurriculumService } from "@/server/services/curriculum-service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const curriculum = await CurriculumService.getAssignedCurriculum(user.id);

    return ok(curriculum);
  } catch (error) {
    return toErrorResponse(error);
  }
}
