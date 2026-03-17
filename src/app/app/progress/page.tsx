import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/ui-kit/page-shell";
import { ProgressInsightsPanel } from "@/components/ui-kit/progress-insights-panel";
import { StreakPanel } from "@/components/ui-kit/streak-panel";
import { getReportTypeLabel } from "@/lib/progress";
import { toTitleCase } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { ReportService } from "@/server/services/report-service";
import { StreakService } from "@/server/services/streak-service";

export default async function ProgressPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const [history, streak] = await Promise.all([
    ReportService.getProgressHistory(user.id),
    StreakService.getSnapshot(user.id),
  ]);
  const reports = [...history].reverse();

  await trackEvent({
    eventName: "progress_library_viewed",
    route: "/app/progress",
    userId: user.id,
    properties: {},
  });

  return (
    <PageShell className="px-0 py-0">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Progress</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review your report history, track streaks, and run a new assessment when you need an update.
            </p>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/app/progress/reassessment">Run new assessment</Link>
          </Button>
        </div>

        <StreakPanel
          currentStreakDays={streak.currentStreakDays}
          longestStreakDays={streak.longestStreakDays}
          nextMilestoneDays={streak.nextMilestoneDays}
        />

        {reports.length > 0 ? (
          <ProgressInsightsPanel
            history={history}
            title="Progress over time"
            description="Follow your score path, spot the skills moving fastest, and open any report directly from the timeline."
          />
        ) : null}

        <div className="grid gap-4">
          {reports.length === 0 ? (
            <Card className="border-border/70 bg-card/95">
              <CardHeader>
                <CardTitle className="text-xl">No saved reports yet</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Complete the quick baseline and full diagnostic to populate your progress library.
                </p>
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => (
              <Link key={report.reportId} href={`/app/progress/reports/${report.reportId}`}>
                <Card className="border-border/70 bg-card/95 transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{getReportTypeLabel(report.reportType)}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Date(report.createdAt).toLocaleDateString()} - {toTitleCase(report.levelLabel)}
                      </p>
                    </div>
                    <span className="font-mono text-2xl font-semibold text-primary">
                      {report.overallScore}
                    </span>
                  </CardHeader>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
