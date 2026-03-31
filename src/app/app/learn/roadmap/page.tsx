import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrackedLink } from "@/components/ui-kit/tracked-link";
import { PageShell } from "@/components/ui-kit/page-shell";
import { toTitleCase } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { CurriculumService } from "@/server/services/curriculum-service";

function UnitStatusBadge({
  status,
}: {
  status: "completed" | "unlocked" | "locked";
}) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <CheckCircle2 className="size-4" />
        Complete
      </span>
    );
  }

  if (status === "unlocked") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <Sparkles className="size-4" />
        In progress
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <LockKeyhole className="size-4" />
      Locked
    </span>
  );
}

export default async function LearnRoadmapPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const curriculum = await CurriculumService.getAssignedCurriculum(user.id);
  const currentUnit = curriculum.currentUnit;
  const heroUnit = currentUnit ?? curriculum.units.at(-1) ?? null;
  const currentPosition = currentUnit
    ? `Unit ${currentUnit.orderIndex} of ${curriculum.units.length}`
    : `${curriculum.units.length} of ${curriculum.units.length} units complete`;

  await trackEvent({
    eventName: "curriculum_roadmap_viewed",
    route: "/app/learn/roadmap",
    userId: user.id,
    properties: {
      level: curriculum.level,
      current_unit_slug: currentUnit?.slug ?? null,
      total_units: curriculum.units.length,
    },
  });

  return (
    <PageShell className="px-0 py-0">
      <div className="space-y-4 sm:space-y-6">
        <Card className="surface-glow overflow-hidden border-border/70 bg-card/95">
          <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Link
                href="/app/learn"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 transition hover:border-primary/40 hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Back to Learn
              </Link>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-foreground">
                {toTitleCase(curriculum.level)}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-primary/25 bg-primary/8 px-3 py-1 text-primary"
              >
                {currentPosition}
              </Badge>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                Learn roadmap
              </p>
              <h1 className="max-w-4xl text-[2rem] font-semibold tracking-tight text-foreground sm:text-[2.6rem]">
                See the full path for your current level
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Your assigned curriculum stays focused on one next step at a time. This roadmap lets
                you zoom out and see all 6 units in order.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {heroUnit ? (
                <TrackedLink
                  href={heroUnit.href}
                  eventName="curriculum_roadmap_unit_clicked"
                  route="/app/learn/roadmap"
                  properties={{
                    level: curriculum.level,
                    unit_slug: heroUnit.slug,
                    unit_status: heroUnit.status,
                    click_target: currentUnit ? "hero_current_unit" : "hero_latest_unit",
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground sm:w-auto"
                >
                  {currentUnit ? "Open current unit" : "Review latest unit"}
                  <ArrowRight className="size-4" />
                </TrackedLink>
              ) : null}
              <Link
                href="/app/learn"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/35 hover:bg-primary/5 sm:w-auto"
              >
                Back to Learn
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              Current level
            </p>
            <CardTitle className="text-2xl">All units in order</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {curriculum.units.map((unit) => {
              const summary = unit.canDoStatement.trim() || unit.summary.trim();
              const isCurrent = unit.status === "unlocked";
              const isCompleted = unit.status === "completed";

              return (
                <div
                  key={unit.id}
                  className={`rounded-[1.5rem] border px-5 py-5 ${
                    isCurrent
                      ? "border-primary/40 bg-primary/8"
                      : isCompleted
                        ? "border-border/70 bg-background/90"
                        : "border-border/60 bg-background/60"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-3 py-1 text-foreground">
                            Unit {unit.orderIndex}
                          </Badge>
                          <UnitStatusBadge status={unit.status} />
                        </div>
                        <h2 className="text-xl font-semibold tracking-tight text-foreground">
                          {unit.title}
                        </h2>
                      </div>
                    </div>

                    <p className="text-sm leading-6 text-muted-foreground">{summary}</p>

                    {isCurrent ? (
                      <TrackedLink
                        href={unit.href}
                        eventName="curriculum_roadmap_unit_clicked"
                        route="/app/learn/roadmap"
                        properties={{
                          level: curriculum.level,
                          unit_slug: unit.slug,
                          unit_status: unit.status,
                          click_target: "current_unit_card",
                        }}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
                      >
                        Open current unit
                        <ArrowRight className="size-4" />
                      </TrackedLink>
                    ) : null}

                    {isCompleted ? (
                      <TrackedLink
                        href={unit.href}
                        eventName="curriculum_roadmap_unit_clicked"
                        route="/app/learn/roadmap"
                        properties={{
                          level: curriculum.level,
                          unit_slug: unit.slug,
                          unit_status: unit.status,
                          click_target: "completed_unit_card",
                        }}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
                      >
                        Review unit
                        <ArrowRight className="size-4" />
                      </TrackedLink>
                    ) : null}

                    {unit.status === "locked" ? (
                      <p className="text-sm text-muted-foreground">
                        Finish the earlier unit and checkpoint to unlock this one.
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {curriculum.archivedCurricula.length > 0 ? (
          <Card className="border-border/70 bg-card/95">
            <CardHeader className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                Archived prior levels
              </p>
              <CardTitle className="text-xl">Previous curriculum history</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {curriculum.archivedCurricula.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[1.25rem] border border-border/70 bg-muted/10 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{entry.title}</p>
                    <span className="text-sm text-muted-foreground">
                      {entry.completedUnits}/{entry.totalUnits}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Completed before promotion to {toTitleCase(curriculum.level)}.
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
