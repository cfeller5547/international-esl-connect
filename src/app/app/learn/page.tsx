import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Flag,
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
import { toTitleCase } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { CurriculumService } from "@/server/services/curriculum-service";

function UnitStatusBadge({ status }: { status: "locked" | "unlocked" | "completed" }) {
  if (status === "completed") {
    return (
      <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/8 px-3 py-1 text-primary">
        Done
      </Badge>
    );
  }

  if (status === "unlocked") {
    return (
      <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/8 px-3 py-1 text-primary">
        Now
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1 text-muted-foreground">
      Later
    </Badge>
  );
}

export default async function LearnPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const curriculum = await CurriculumService.getAssignedCurriculum(user.id);
  const currentUnit = curriculum.currentUnit;
  const currentActivity = curriculum.currentActivity;
  const completedUnits = curriculum.units.filter((unit) => unit.status === "completed");
  const upcomingUnits = curriculum.units.filter((unit) => unit.status === "locked");
  const currentUnitProgress = currentUnit ? getCurrentUnitProgressValue(currentUnit) : 100;

  await trackEvent({
    eventName: "curriculum_viewed",
    route: "/app/learn",
    userId: user.id,
    properties: {
      level: curriculum.level,
      current_unit_slug: currentUnit?.slug ?? null,
      current_activity_type: currentActivity?.activityType ?? null,
    },
  });

  return (
    <PageShell className="px-0 py-0">
      <div className="space-y-6">
        <Card className="surface-glow overflow-hidden border-border/70 bg-card/95">
          <CardContent className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.05fr)_320px] lg:px-8 lg:py-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                  Your English path
                </p>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-foreground">
                  {toTitleCase(curriculum.level)}
                </Badge>
              </div>

              {currentUnit && currentActivity ? (
                <>
                  <div className="space-y-3">
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.5rem]">
                      Continue {currentUnit.title}
                    </h1>
                    <p className="max-w-3xl text-base text-muted-foreground">
                      {currentUnit.canDoStatement}
                    </p>
                  </div>

                  <div className="space-y-3 rounded-[1.8rem] border border-border/70 bg-muted/15 px-5 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{currentActivity.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {currentActivity.description}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/25 bg-primary/8 px-3 py-1 text-primary"
                      >
                        Step {currentActivity.orderIndex} of {currentUnit.activities.length}
                      </Badge>
                    </div>
                    <Progress value={currentUnitProgress} className="h-2.5" />
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Flag className="size-4" />
                        Performance task: {currentUnit.performanceTask}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={currentActivity.href}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                    >
                      Continue step
                      <ArrowRight className="size-4" />
                    </Link>
                    <Link
                      href={`/app/learn/unit/${currentUnit.slug}`}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/35 hover:bg-primary/5"
                    >
                      View unit details
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.5rem]">
                      Current curriculum complete
                    </h1>
                    <p className="max-w-3xl text-base text-muted-foreground">
                      You have finished every required unit in your active level. Revisit completed work or wait for your next assessment to unlock a higher curriculum.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/app/progress"
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                    >
                      Open Progress
                      <ArrowRight className="size-4" />
                    </Link>
                    <Link
                      href="/app/speak"
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/35 hover:bg-primary/5"
                    >
                      Practice in Speak
                    </Link>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4 rounded-[1.9rem] border border-border/70 bg-background/75 px-5 py-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Focus now
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {currentActivity?.title ?? "Review your strongest progress"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentActivity?.description ??
                    "Your curriculum is complete for this level. Progress and reassessment are the next meaningful checkpoints."}
                </p>
              </div>

              <div className="rounded-[1.6rem] border border-border/70 bg-card/85 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Curriculum
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {curriculum.curriculum.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {curriculum.curriculum.description}
                </p>
              </div>

              <div className="rounded-[1.6rem] border border-border/70 bg-card/85 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Roadmap status
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {completedUnits.length} of {curriculum.units.length} units finished
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Units unlock in order, and assessment is the only way to move to the next level.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {currentUnit ? (
          <Card className="border-border/70 bg-card/95">
            <CardHeader className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                Current unit
              </p>
              <CardTitle className="text-2xl">{currentUnit.title}</CardTitle>
              <p className="max-w-3xl text-sm text-muted-foreground">{currentUnit.summary}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentUnit.activities.map((activity) => {
                const meta = LEARN_ACTIVITY_META[activity.activityType];
                const isCurrent = currentActivity?.id === activity.id;

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
                              Up next
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                              <CircleDashed className="size-4" />
                              Later in this unit
                            </span>
                          )}
                        </div>
                        <p className="text-lg font-semibold text-foreground">{activity.title}</p>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      </div>

                      {activity.status === "completed" || isCurrent ? (
                        <Link
                          href={activity.href}
                          className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                            isCurrent
                              ? "bg-primary text-primary-foreground"
                              : "border border-border/70 text-foreground transition hover:border-primary/35 hover:bg-primary/5"
                          }`}
                        >
                          {isCurrent ? "Continue" : "Review"}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-border/70 bg-card/95">
            <CardHeader className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                Completed
              </p>
              <CardTitle className="text-xl">What you have already finished</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {completedUnits.length > 0 ? (
                completedUnits.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex flex-col gap-3 rounded-[1.5rem] border border-border/70 bg-muted/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-primary" />
                        <p className="font-semibold text-foreground">
                          Unit {unit.orderIndex}: {unit.title}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{unit.summary}</p>
                    </div>
                    <Link
                      href={`/app/learn/unit/${unit.slug}`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
                    >
                      Review unit
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                  Completed units will collect here as you move through the curriculum.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95">
            <CardHeader className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                Later
              </p>
              <CardTitle className="text-xl">What unlocks next</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-[1.5rem] border border-border/70 bg-background/60 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">
                        Unit {unit.orderIndex}: {unit.title}
                      </p>
                      <p className="text-sm text-muted-foreground">{unit.summary}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <LockKeyhole className="size-4" />
                      Locked
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {curriculum.archivedCurricula.length > 0 ? (
          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="text-xl">Archived prior-level progress</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {curriculum.archivedCurricula.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[1.5rem] border border-border/70 bg-muted/15 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{entry.title}</p>
                    <UnitStatusBadge status="completed" />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {entry.completedUnits} of {entry.totalUnits} units completed before promotion.
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PageShell>
  );
}
