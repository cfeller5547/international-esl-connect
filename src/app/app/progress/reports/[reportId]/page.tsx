import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/ui-kit/page-shell";
import { ProgressInsightsPanel } from "@/components/ui-kit/progress-insights-panel";
import { ReportRadarChart } from "@/components/ui-kit/report-radar-chart";
import { SkillCard } from "@/components/ui-kit/skill-card";
import { ShareCardButton } from "@/features/progress/share-card-button";
import { toTitleCase } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { ReportService } from "@/server/services/report-service";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const user = await getCurrentUser();
  const { reportId } = await params;

  if (!user) {
    return null;
  }

  const [report, history] = await Promise.all([
    ReportService.getReport(reportId, user.id),
    ReportService.getProgressHistory(user.id),
  ]);

  if (!report) {
    notFound();
  }

  await trackEvent({
    eventName: "progress_report_viewed",
    route: `/app/progress/reports/${reportId}`,
    userId: user.id,
    properties: {
      report_id: report.id,
      report_type: report.reportType,
    },
  });

  if (report.comparisonAsCurrent) {
    await trackEvent({
      eventName: "report_comparison_viewed",
      route: `/app/progress/reports/${reportId}`,
      userId: user.id,
      properties: {
        report_id: report.id,
        previous_report_id: report.comparisonAsCurrent.previousReportId,
      },
    });
  }

  const summary = report.summaryPayload as {
    summary?: string;
    strengths?: string[];
    risks?: string[];
    nextWeekPlan?: string[];
  };

  const comparison = report.comparisonAsCurrent?.deltaPayload as
    | {
        skills?: Array<{
          skill: string;
          deltaAbs: number;
        }>;
      }
    | undefined;

  return (
    <PageShell className="px-0 py-0">
      <div className="space-y-6">
        <Card className="surface-glow border-border/70 bg-card/95">
          <CardHeader className="space-y-3">
            <CardTitle className="text-3xl">
              {toTitleCase(report.levelLabel)} - score {report.overallScore}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {summary.summary ?? "Your latest report is ready."}
            </p>
          </CardHeader>
          <CardContent className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <ReportRadarChart
              data={report.skillSnapshots.map((snapshot) => ({
                skill: snapshot.skill,
                score: snapshot.score,
              }))}
            />
            <div className="space-y-4">
              <div className="rounded-3xl bg-muted/25 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Next 7 days
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {(summary.nextWeekPlan ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <ShareCardButton reportId={report.id} />
            </div>
          </CardContent>
        </Card>

        {history.length > 0 ? (
          <ProgressInsightsPanel
            history={history}
            currentReportId={report.id}
            title="History"
            description="See where this report sits in your overall score timeline."
            showSkillTrends={false}
            compact
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {report.skillSnapshots.map((snapshot) => {
            const matchingDelta = comparison?.skills?.find(
              (item) => item.skill === snapshot.skill
            )?.deltaAbs;

            return (
              <SkillCard
                key={snapshot.id}
                skill={snapshot.skill}
                score={snapshot.score}
                interpretation={snapshot.interpretationText}
                action={snapshot.recommendedActionText}
                delta={matchingDelta ?? null}
              />
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
