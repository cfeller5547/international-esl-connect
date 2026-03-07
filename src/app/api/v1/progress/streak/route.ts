import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { StreakService } from "@/server/services/streak-service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    return ok(await StreakService.getSnapshot(user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
