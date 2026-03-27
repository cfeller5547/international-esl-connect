import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, LockKeyhole, Sparkles } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/ui-kit/page-shell";
import {
  getActivityPreview,
  getUnitStepSummary,
  LEARN_ACTIVITY_META,
  type LearnActivityType,
} from "@/features/learn/learn-flow";

type ActivityStatus = "locked" | "unlocked" | "completed";

type ActivityItem = {
  id: string;
  activityType: LearnActivityType;
  title: string;
  description: string;
  orderIndex: number;
  status: ActivityStatus;
  href: string;
};

type UpcomingAction = {
  title: string;
  description: string;
  href?: string;
  label: string;
} | null;

type LearnActivityShellProps = {
  curriculumTitle: string;
  unitTitle: string;
  unitOrder: number;
  unitSlug: string;
  canDoStatement: string;
  performanceTask: string;
  activityType: LearnActivityType;
  activityTitle: string;
  activityDescription: string;
  activities: ActivityItem[];
  children: ReactNode;
  upcomingAction?: UpcomingAction;
  contentWidth?: "default" | "wide";
  showContext?: boolean;
};

function ActivityStatusIcon({
  status,
  isCurrent,
}: {
  status: ActivityStatus;
  isCurrent: boolean;
}) {
  if (status === "completed") {
    return <CheckCircle2 className="size-4 text-primary" />;
  }

  if (status === "locked") {
    return <LockKeyhole className="size-4 text-muted-foreground" />;
  }

  if (isCurrent) {
    return <Sparkles className="size-4 text-primary" />;
  }

  return <Circle className="size-4 text-muted-foreground" />;
}

export function LearnActivityShell({
  curriculumTitle,
  unitTitle,
  unitOrder,
  unitSlug,
  canDoStatement,
  performanceTask,
  activityType,
  activityTitle,
  activityDescription,
  activities,
  children,
  upcomingAction,
  contentWidth = "default",
  showContext = true,
}: LearnActivityShellProps) {
  const activityMeta = LEARN_ACTIVITY_META[activityType];
  const stepSummary = getUnitStepSummary(activities, activityType);
  const nextActivity = getActivityPreview(activities, activityType);

  return (
    <PageShell className="px-0 py-0">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <Card className="surface-glow overflow-hidden border-border/70 bg-card/95">
          <CardContent className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Link
                href="/app/learn"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 transition hover:border-primary/40 hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Back to roadmap
              </Link>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/25 bg-primary/8 px-3 py-1 text-primary"
                >
                  Unit {unitOrder}
                </Badge>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  {activityMeta.label}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Unit step {stepSummary.stepIndex} of {stepSummary.totalSteps}
                </span>
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                {curriculumTitle}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {unitTitle}
              </h1>
              <p className="text-base text-muted-foreground">
                {activityTitle}. {activityDescription}
              </p>
              <p className="text-sm font-medium text-foreground">{canDoStatement}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {activities
                .slice()
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((entry) => {
                  const entryMeta = LEARN_ACTIVITY_META[entry.activityType];
                  const isCurrent = entry.activityType === activityType;

                  return (
                    <div
                      key={entry.id}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                        isCurrent
                          ? "border-primary/40 bg-primary/8 text-foreground"
                          : entry.status === "completed"
                            ? "border-border/70 bg-muted/10 text-foreground"
                            : "border-border/60 bg-background/70 text-muted-foreground"
                      }`}
                    >
                      <ActivityStatusIcon status={entry.status} isCurrent={isCurrent} />
                      <span>{entryMeta.shortLabel}</span>
                    </div>
                  );
                })}
            </div>

            {showContext ? (
              <Accordion type="single" collapsible>
                <AccordionItem value="details" className="border-none">
                  <AccordionTrigger className="py-1 text-sm font-semibold text-foreground hover:no-underline">
                    Need context?
                  </AccordionTrigger>
                  <AccordionContent className="pt-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[1.35rem] border border-border/70 bg-background/70 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                          Performance task
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">{performanceTask}</p>
                      </div>

                      <div className="rounded-[1.35rem] border border-border/70 bg-background/70 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                          Next step
                        </p>
                        {upcomingAction ? (
                          <div className="mt-2 space-y-2">
                            <p className="text-sm font-medium text-foreground">{upcomingAction.title}</p>
                            <p className="text-sm text-muted-foreground">{upcomingAction.description}</p>
                            {upcomingAction.href ? (
                              <Link
                                href={upcomingAction.href}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
                              >
                                {upcomingAction.label}
                                <ArrowRight className="size-4" />
                              </Link>
                            ) : (
                              <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                                {upcomingAction.label}
                                <ArrowRight className="size-4" />
                              </p>
                            )}
                          </div>
                        ) : nextActivity ? (
                          <div className="mt-2 space-y-2">
                            <p className="text-sm font-medium text-foreground">{nextActivity.title}</p>
                            <p className="text-sm text-muted-foreground">{nextActivity.description}</p>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Completing this step will unlock your next milestone.
                          </p>
                        )}
                      </div>

                      <div className="rounded-[1.35rem] border border-border/70 bg-background/70 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                          More
                        </p>
                        <Link
                          href={`/app/learn/unit/${unitSlug}`}
                          className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                        >
                          Open unit overview
                          <ArrowRight className="size-4" />
                        </Link>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : null}
          </CardContent>
        </Card>

        <div
          className={`mx-auto w-full ${contentWidth === "wide" ? "max-w-4xl" : "max-w-3xl"}`}
        >
          {children}
        </div>
      </div>
    </PageShell>
  );
}
