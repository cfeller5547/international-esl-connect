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
  getCompletedActivityCount,
  getCurrentUnitProgressValue,
  getRemainingMinutes,
  LEARN_ACTIVITY_META,
} from "@/features/learn/learn-flow";
import { toTitleCase } from "@/lib/utils";
import { trackEvent } from "@/server/analytics";
import { getAdminPreviewLevel, getCurrentUser } from "@/server/auth";
import { CurriculumService } from "@/server/services/curriculum-service";

function UnitStatusBadge({ status }: { status: "locked" | "unlocked" | "completed" }) {
  if (status === "completed") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-primary/25 bg-primary/8 px-3 py-1 text-primary"
      >
        Done
      </Badge>
    );
  }

  if (status === "unlocked") {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-primary/25 bg-primary/8 px-3 py-1 text-primary"
      >
        Now
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="rounded-full px-3 py-1 text-muted-foreground">
      Locked
    </Badge>
  );
}

function ActivityStateLabel({
  status,
  isCurrent,
}: {
  status: "locked" | "unlocked" | "completed";
  isCurrent: boolean;
}) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
        <CheckCircle2 className="size-4" />
        Done
      </span>
    );
  }

  if (isCurrent) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
        <Sparkles className="size-4" />
        Continue now
      </span>
    );
  }

  if (status === "unlocked") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
        <CircleDashed className="size-4" />
        Ready next
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
      <LockKeyhole className="size-4" />
      Locked until earlier steps finish
    </span>
  );
}

export default async function LearnPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const [curriculum, previewLevel] = await Promise.all([
    CurriculumService.getAssignedCurriculum(user.id),
    getAdminPreviewLevel(user.id),
  ]);
  const currentUnit = curriculum.currentUnit;
  const currentActivity = curriculum.currentActivity;
  const completedUnits = curriculum.units.filter((unit) => unit.status === "completed");
  const upcomingUnits = curriculum.units.filter((unit) => unit.status === "locked");
  const nextUnlockUnit = upcomingUnits[0] ?? null;
  const currentUnitProgress = currentUnit ? getCurrentUnitProgressValue(currentUnit) : 100;
  const completedStepCount = currentUnit ? getCompletedActivityCount(currentUnit.activities) : 0;
  const remainingMinutes =
    currentUnit && currentActivity
      ? getRemainingMinutes(currentUnit.activities, currentActivity.activityType)
      : 0;
  const recentCompletedUnits = completedUnits.slice(-2).reverse();
  const currentActivityMeta = currentActivity
    ? LEARN_ACTIVITY_META[currentActivity.activityType]
    : null;

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
      <div className="space-y-4 sm:space-y-6">
        <Card className="surface-glow overflow-hidden border-border/70 bg-card/95">
          <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {currentUnit && currentActivity && currentActivityMeta ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                    Continue learning
                  </p>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-foreground">
                    {toTitleCase(curriculum.level)}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-foreground">
                    Unit {currentUnit.orderIndex}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/25 bg-primary/8 px-3 py-1 text-primary"
                  >
                    {currentActivityMeta.label}
                  </Badge>
                  {previewLevel ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-foreground">
                      Previewing {toTitleCase(previewLevel)}
                    </Badge>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <h1 className="max-w-4xl text-[2rem] font-semibold tracking-tight text-foreground sm:text-[2.6rem]">
                    Continue {currentUnit.title}
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {currentUnit.canDoStatement}
                  </p>
                  {previewLevel ? (
                    <p className="max-w-3xl text-sm leading-6 text-primary">
                      Admin preview is active. Your real assigned level remains{" "}
                      {user.currentLevel ? toTitleCase(user.currentLevel) : "unchanged"}.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-[1.7rem] border border-border/70 bg-muted/15 px-4 py-4 sm:px-5 sm:py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {currentActivity.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
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

                  <div className="mt-4 space-y-2">
                    <Progress value={currentUnitProgress} className="h-2.5" />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <span>
                        {completedStepCount} of {currentUnit.activities.length} steps complete
                      </span>
                      <span>
                        About {Math.max(remainingMinutes, currentActivityMeta.estimatedMinutes)} min
                        left in this unit
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.2rem] border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-start gap-2">
                      <Flag className="mt-0.5 size-4 shrink-0" />
                      <span>
                        Performance task: {currentUnit.performanceTask}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={currentActivity.href}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground sm:w-auto"
                  >
                    Continue {currentActivityMeta.shortLabel.toLowerCase()}
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    href="/app/learn/roadmap"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/35 hover:bg-primary/5 sm:w-auto"
                  >
                    View roadmap
                  </Link>
                  <Link
                    href={`/app/learn/unit/${currentUnit.slug}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/35 hover:bg-primary/5 sm:w-auto"
                  >
                    Unit overview
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                    Continue learning
                  </p>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-foreground">
                    {toTitleCase(curriculum.level)}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <h1 className="text-[2rem] font-semibold tracking-tight text-foreground sm:text-[2.6rem]">
                    Current curriculum complete
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                    You have finished every required unit in your active level. Revisit completed
                    work or move into progress and reassessment when you are ready.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/app/progress"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground sm:w-auto"
                  >
                    Open Progress
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    href="/app/speak"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/35 hover:bg-primary/5 sm:w-auto"
                  >
                    Practice in Speak
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {currentUnit ? (
          <Card className="border-border/70 bg-card/95">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                    Unit steps
                  </p>
                  <CardTitle className="text-2xl">Keep moving through this unit</CardTitle>
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    Finish the active step to keep the unit unlocked. Completed steps stay
                    reviewable, and the next step opens in order.
                  </p>
                </div>
                <Link
                  href={`/app/learn/unit/${currentUnit.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
                >
                  Open full unit overview
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {currentUnit.activities.map((activity) => {
                const meta = LEARN_ACTIVITY_META[activity.activityType];
                const isCurrent = currentActivity?.id === activity.id;

                return (
                  <div
                    key={activity.id}
                    className={`rounded-[1.25rem] border px-4 py-4 transition sm:px-5 ${
                      isCurrent
                        ? "border-primary/40 bg-primary/8"
                        : activity.status === "completed"
                          ? "border-border/70 bg-background/90"
                          : "border-border/60 bg-background/60"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="ghost" className="h-auto rounded-full px-0 text-secondary">
                            {meta.label}
                          </Badge>
                          <ActivityStateLabel status={activity.status} isCurrent={isCurrent} />
                        </div>
                        <p className="text-base font-semibold text-foreground">{activity.title}</p>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      </div>

                      {activity.status === "completed" || isCurrent ? (
                        <Link
                          href={activity.href}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold md:w-auto ${
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

        {recentCompletedUnits.length > 0 || nextUnlockUnit ? (
          <div
            className={`grid gap-4 sm:gap-6 ${
              recentCompletedUnits.length > 0 && nextUnlockUnit ? "xl:grid-cols-2" : ""
            }`}
          >
            {recentCompletedUnits.length > 0 ? (
              <Card className="border-border/70 bg-card/95">
                <CardHeader className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                    Completed
                  </p>
                  <CardTitle className="text-xl">Recently finished</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentCompletedUnits.map((unit) => (
                    <div
                      key={unit.id}
                      className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-muted/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
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
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {nextUnlockUnit ? (
              <Card className="border-border/70 bg-card/95">
                <CardHeader className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                    Next unlock
                  </p>
                  <CardTitle className="text-xl">What opens after this unit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-[1.35rem] border border-border/70 bg-background/70 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="font-semibold text-foreground">
                          Unit {nextUnlockUnit.orderIndex}: {nextUnlockUnit.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{nextUnlockUnit.summary}</p>
                      </div>
                      <UnitStatusBadge status="locked" />
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-dashed border-border/70 px-4 py-4 text-sm text-muted-foreground">
                    Finish the current unit through checkpoint to unlock the next unit in order.
                    {upcomingUnits.length > 1 ? ` ${upcomingUnits.length - 1} more units wait after that.` : ""}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        {curriculum.archivedCurricula.length > 0 ? (
          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="text-xl">Archived prior-level progress</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {curriculum.archivedCurricula.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[1.25rem] border border-border/70 bg-muted/15 px-4 py-4 sm:rounded-[1.5rem]"
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
