import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { ReportService } from "@/server/services/report-service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const reports = await ReportService.listReports(user.id);

    return ok({
      reports: reports.map((report) => ({
        reportId: report.id,
        createdAt: report.createdAt,
        overallScore: report.overallScore,
        levelLabel: report.levelLabel,
        reportType: report.reportType,
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
