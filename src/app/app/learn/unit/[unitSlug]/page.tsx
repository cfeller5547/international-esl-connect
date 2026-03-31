import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  LockKeyhole,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageShell } from "@/components/ui-kit/page-shell";
import {
  getCurrentUnitProgressValue,
  LEARN_ACTIVITY_META,
} from "@/features/learn/learn-flow";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { CurriculumService } from "@/server/services/curriculum-service";

export default async function CurriculumUnitPage({
  params,
}: {
  params: Promise<{ unitSlug: string }>;
}) {
  const user = await getCurrentUser();
  const { unitSlug } = await params;

  if (!user) {
    return null;
  }

  const { unit } = await CurriculumService.getUnit(user.id, unitSlug);
  const activeActivity =
    unit.activities.find((activity) => activity.status === "unlocked") ??
    unit.activities.find((activity) => activity.status === "completed") ??
    null;
  const progressValue = getCurrentUnitProgressValue(unit);

  await trackEvent({
    eventName: "unit_started",
    route: `/app/learn/unit/${unitSlug}`,
    userId: user.id,
    properties: {
      unit_slug: unitSlug,
    },
  });

  return (
    <PageShell className="px-0 py-0">
      <div className="space-y-6">
        <Card className="surface-glow overflow-hidden border-border/70 bg-card/95">
          <CardContent className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.02fr)_320px] lg:px-8 lg:py-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Link
                  href="/app/learn/roadmap"
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 transition hover:border-primary/40 hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                  Back to roadmap
                </Link>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-foreground">
                  Unit {unit.orderIndex}
                </Badge>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                  Unit overview
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.4rem]">
                  {unit.title}
                </h1>
                <p className="max-w-3xl text-base text-muted-foreground">{unit.summary}</p>
                <p className="text-base font-medium text-foreground">{unit.canDoStatement}</p>
              </div>

              <div className="space-y-3 rounded-[1.8rem] border border-border/70 bg-muted/15 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Unit progress</p>
                  <p className="text-sm text-muted-foreground">{progressValue}% complete</p>
                </div>
                <Progress value={progressValue} className="h-2.5" />
                <div className="flex flex-wrap gap-2">
                  {unit.languageFocus.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-border/70 px-3 py-1 text-xs text-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {activeActivity ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={activeActivity.href}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                  >
                    {activeActivity.status === "completed" ? "Review current step" : "Continue step"}
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    href="/app/learn/roadmap"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/35 hover:bg-primary/5"
                  >
                    Return to roadmap
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-[1.9rem] border border-border/70 bg-background/75 px-5 py-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Performance task
                </p>
                <p className="text-lg font-semibold text-foreground">{unit.performanceTask}</p>
              </div>
              <div className="rounded-[1.6rem] border border-border/70 bg-card/85 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Theme
                </p>
                <p className="mt-2 text-sm text-foreground">{unit.theme}</p>
              </div>
              <div className="rounded-[1.6rem] border border-border/70 bg-card/85 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Key vocabulary
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {unit.keyVocabulary.map((item) => (
                    <span key={item} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              Unit flow
            </p>
            <CardTitle className="text-2xl">Move through the steps in order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {unit.activities.map((activity) => {
              const meta = LEARN_ACTIVITY_META[activity.activityType];
              const isCurrent = activity.status === "unlocked";

              return (
                <div
                  key={activity.id}
                  className={`rounded-[1.6rem] border px-5 py-4 ${
                    isCurrent
                      ? "border-primary/40 bg-primary/8"
                      : activity.status === "completed"
                        ? "border-border/70 bg-muted/10"
                        : "border-border/60 bg-background/70"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="ghost" className="rounded-full px-0 text-secondary">
                          {meta.label}
                        </Badge>
                        {activity.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                            <CheckCircle2 className="size-4" />
                            Done
                          </span>
                        ) : isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                            <Sparkles className="size-4" />
                            Now
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                            <LockKeyhole className="size-4" />
                            Later
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-semibold text-foreground">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                    </div>

                    {activity.status === "locked" ? (
                      <div className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <CircleDashed className="size-4" />
                        Complete the earlier steps first
                      </div>
                    ) : (
                      <Link
                        href={activity.href}
                        className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                          isCurrent
                            ? "bg-primary text-primary-foreground"
                            : "border border-border/70 text-foreground transition hover:border-primary/35 hover:bg-primary/5"
                        }`}
                      >
                        {activity.status === "completed" ? "Review" : "Open step"}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
