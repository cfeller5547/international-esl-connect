import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { ReportService } from "@/server/services/report-service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { reportId } = await params;
    const report = await ReportService.getReport(reportId, user.id);

    if (!report) {
      throw new AppError("NOT_FOUND", "Report not found.", 404);
    }

    return ok(report);
  } catch (error) {
    return toErrorResponse(error);
  }
}
