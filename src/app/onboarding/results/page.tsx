import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/ui-kit/page-shell";
import { ReportRadarChart } from "@/components/ui-kit/report-radar-chart";
import { SkillCard } from "@/components/ui-kit/skill-card";
import { toTitleCase } from "@/lib/utils";
import { trackEvent } from "@/server/analytics";
import { OnboardingService } from "@/server/services/onboarding-service";

export default async function OnboardingResultsPage() {
  const cookieStore = await cookies();
  const guestSessionToken = cookieStore.get("guest_session")?.value;

  if (!guestSessionToken) {
    redirect("/");
  }

  const report = await OnboardingService.getResults(guestSessionToken);

  if (!report) {
    redirect("/onboarding/assessment");
  }

  await trackEvent({
    eventName: "onboarding_results_viewed",
    route: "/onboarding/results",
    guestSessionToken,
    properties: {
      report_preview_id: report.id,
      overall_score: report.overallScore,
      level_label: report.levelLabel,
    },
  });

  return (
    <PageShell className="px-0 py-0">
      <Card className="surface-glow border-border/70 bg-card/95">
        <CardHeader className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
            Quick baseline preview
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-3xl">You are currently {toTitleCase(report.levelLabel)}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Score {report.overallScore}. Create an account to save this report and unlock the
                full diagnostic.
              </p>
            </div>
            <Button variant="accent" size="lg" asChild>
              <Link href="/signup">Create account to save report</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <ReportRadarChart
            data={report.skillSnapshots.map((snapshot) => ({
              skill: snapshot.skill,
              score: snapshot.score,
            }))}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {report.skillSnapshots.map((snapshot) => {
              const visual = snapshot.visualPayload as Record<string, unknown>;
              return (
                <SkillCard
                  key={snapshot.id}
                  skill={snapshot.skill}
                  score={snapshot.score}
                  interpretation={snapshot.interpretationText}
                  action={snapshot.recommendedActionText}
                  delta={typeof visual.delta === "number" ? visual.delta : null}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
