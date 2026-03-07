import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { TestPrepService } from "@/server/services/test-prep-service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { planId } = await params;
    return ok(await TestPrepService.getPlan(planId, user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
