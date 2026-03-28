import Link from "next/link";
import { ArrowRight, BookOpen, ChartColumnBig, Flame, Target, Wrench } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/ui-kit/page-shell";
import { TrackedLink } from "@/components/ui-kit/tracked-link";
import { buildHomeViewModel } from "@/features/home/home-view-model";
import { cn } from "@/lib/utils";
import { getCurrentUser, readAuthPayload } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { prisma } from "@/server/prisma";
import { RecommendationService } from "@/server/services/recommendation-service";
import { StreakService } from "@/server/services/streak-service";

type HomeUser = {
  id: string;
  currentLevel: string | null;
  fullDiagnosticCompletedAt: Date | null;
};

type HomeRecommendationFallback = {
  actionType: string;
  title: string;
  targetUrl: string;
  reason: string;
  reasonCode: string;
};

async function getHomeUser(): Promise<HomeUser | null> {
  try {
    const user = await getCurrentUser();
    if (user) {
      return {
        id: user.id,
        currentLevel: user.currentLevel,
        fullDiagnosticCompletedAt: user.fullDiagnosticCompletedAt,
      };
    }
  } catch (error) {
    console.error("home:getCurrentUser failed", error);
  }

  const auth = await readAuthPayload();
  if (!auth?.userId) {
    return null;
  }

  try {
    return await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        currentLevel: true,
        fullDiagnosticCompletedAt: true,
      },
    });
  } catch (error) {
    console.error("home:fallback user lookup failed", error);
    return null;
  }
}

function getFallbackRecommendation(user: HomeUser): HomeRecommendationFallback {
  if (!user.fullDiagnosticCompletedAt) {
    return {
      actionType: "complete_full_diagnostic",
      title: "Complete full diagnostic",
      targetUrl: "/app/assessment/full",
      reason: "Unlock deeper analysis and confirm the curriculum level that should guide Learn.",
      reasonCode: "home_fallback_complete_full_diagnostic",
    };
  }

  return {
    actionType: "continue_curriculum",
    title: "Continue curriculum",
    targetUrl: "/app/learn",
    reason: "Continue the next guided step in Learn while home data finishes syncing.",
    reasonCode: "home_fallback_continue_curriculum",
  };
}

async function getSafeRecommendation(user: HomeUser) {
  try {
    return await RecommendationService.getRecommendation(user.id, "home");
  } catch (error) {
    console.error("home:recommendation failed", error);
    return getFallbackRecommendation(user);
  }
}

async function getSafeLatestReport(userId: string) {
  try {
    return await prisma.report.findFirst({
      where: { userId },
      include: { skillSnapshots: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("home:latestReport failed", error);
    return null;
  }
}

async function getSafeStreak(userId: string) {
  try {
    return await StreakService.getSnapshot(userId);
  } catch (error) {
    console.error("home:streak failed", error);
    return {
      currentStreakDays: 0,
      longestStreakDays: 0,
      nextMilestoneDays: 3,
    };
  }
}

async function trackHomeRender(userId: string, recommendation: HomeRecommendationFallback) {
  try {
    await trackEvent({
      eventName: "home_primary_cta_rendered",
      route: "/app/home",
      userId,
      properties: {
        action_type: recommendation.actionType,
        target_url: recommendation.targetUrl,
        reason_code: recommendation.reasonCode,
      },
    });
  } catch (error) {
    console.error("home:trackEvent failed", error);
  }
}

export default async function HomePage() {
  const user = await getHomeUser();

  if (!user) {
    return null;
  }

  const [recommendation, latestReport, streak] = await Promise.all([
    getSafeRecommendation(user),
    getSafeLatestReport(user.id),
    getSafeStreak(user.id),
  ]);

  const viewModel = buildHomeViewModel({
    recommendation,
    latestReport,
    streak,
    currentLevel: user.currentLevel,
    fullDiagnosticCompletedAt: user.fullDiagnosticCompletedAt,
  });

  await trackHomeRender(user.id, recommendation);

  return (
    <PageShell className="px-0 py-0">
      <div className="space-y-3">
        <Card className="border-border/70 bg-card/98 py-0 shadow-[0_18px_42px_-30px_hsl(var(--primary)/0.18)]">
          <CardContent className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.72fr)_280px] lg:items-start">
            <div className="px-0 py-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                  {viewModel.hero.eyebrow}
                </span>
                <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  {viewModel.hero.contextLabel}
                </span>
              </div>

              <h1 className="mt-4 max-w-3xl text-[2.15rem] leading-[0.98] font-semibold sm:text-[2.65rem] sm:leading-[0.96]">
                {viewModel.hero.title}
              </h1>
              <p className="mt-3 max-w-[44rem] text-[0.97rem] leading-6 text-muted-foreground sm:text-[1rem] sm:leading-7">
                {viewModel.hero.reason}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <TrackedLink
                  href={viewModel.hero.href}
                  eventName="home_primary_cta_clicked"
                  route="/app/home"
                  properties={{
                    action_type: recommendation.actionType,
                    target_url: recommendation.targetUrl,
                    reason_code: recommendation.reasonCode,
                  }}
                  className={cn(buttonVariants({ variant: "accent", size: "lg" }), "w-full sm:w-auto")}
                >
                  {viewModel.hero.ctaLabel}
                  <ArrowRight className="size-4" />
                </TrackedLink>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--background)/0.96),hsl(var(--muted)/0.32))] px-5 py-5 shadow-[inset_0_1px_0_hsl(var(--background)/0.85)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
                {viewModel.hero.sideLabel}
              </p>
              <p className="mt-3 max-w-[14rem] text-[1.45rem] leading-[1.12] font-semibold text-foreground">
                {viewModel.hero.sideTitle}
              </p>
              <p className="mt-2 max-w-[15rem] text-sm leading-6 text-muted-foreground">
                {viewModel.hero.sideBody}
              </p>
              <TrackedLink
                href={viewModel.urgentHomeworkAction.href}
                eventName="homework_quick_action_clicked"
                route="/app/home"
                properties={{
                  target_url: viewModel.urgentHomeworkAction.href,
                }}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-4 rounded-full border-border/70 bg-background/92 px-4 shadow-[0_10px_20px_-18px_hsl(var(--foreground)/0.4)] hover:bg-background lg:mt-5"
                )}
              >
                {viewModel.urgentHomeworkAction.title}
              </TrackedLink>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          {viewModel.supportItems.map((item, index) => (
            <Card
              key={item.label}
              className="border-border/70 bg-card/96 py-0 shadow-[0_14px_28px_-24px_hsl(var(--foreground)/0.32)]"
            >
              <CardContent className="flex items-start gap-3.5 px-5 py-4">
                <div
                  className={cn(
                    "mt-0.5 grid size-[2.125rem] shrink-0 place-items-center rounded-[1rem]",
                    index === 0
                      ? "bg-primary/7 text-primary"
                      : "bg-secondary/10 text-secondary"
                  )}
                >
                  {index === 0 ? <Target className="size-4" /> : <Flame className="size-4" />}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[1.22rem] leading-[1.15] font-semibold text-foreground sm:text-[1.38rem] sm:leading-[1.12]">{item.value}</p>
                  <p className="mt-1 text-sm leading-[1.35rem] text-muted-foreground">{item.detail}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className={cn("grid gap-3", viewModel.secondaryActions.length > 1 && "md:grid-cols-2")}>
          {viewModel.secondaryActions.map((action) => (
            <Link
              key={action.key}
              href={action.href}
              className={cn(
                "group rounded-[1.25rem] border px-5 py-4 shadow-[0_14px_28px_-26px_hsl(var(--foreground)/0.34)] transition",
                action.key === "learn_roadmap" &&
                  "border-primary/12 bg-[linear-gradient(180deg,hsl(var(--primary)/0.04),hsl(var(--card)))] hover:border-primary/22",
                action.key === "test_prep" &&
                  "border-secondary/12 bg-[linear-gradient(180deg,hsl(var(--secondary)/0.04),hsl(var(--card)))] hover:border-secondary/22",
                action.key === "view_progress" &&
                  "border-border/70 bg-card/96 hover:border-border hover:bg-card"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="grid size-[2.125rem] place-items-center rounded-[1rem] bg-background text-primary shadow-[0_10px_20px_-18px_hsl(var(--foreground)/0.42)] ring-1 ring-border/60">
                      {action.key === "learn_roadmap" ? (
                        <BookOpen className="size-4" />
                      ) : action.key === "test_prep" ? (
                        <Wrench className="size-4" />
                      ) : (
                        <ChartColumnBig className="size-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary">
                        {action.key === "learn_roadmap"
                          ? "Keep the plan visible"
                          : action.key === "test_prep"
                            ? "Alternative path"
                            : "Progress"}
                      </p>
                      <p className="mt-1 text-[1.05rem] font-semibold text-foreground">{action.title}</p>
                    </div>
                  </div>
                  <p className="max-w-md text-sm leading-[1.35rem] text-muted-foreground">{action.body}</p>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </Link>
          ))}
        </div>

        <Accordion
          type="single"
          collapsible
          className="rounded-[1.25rem] border border-border/70 bg-card/98 px-5 shadow-[0_14px_28px_-24px_hsl(var(--foreground)/0.3)]"
        >
          <AccordionItem value="summary" className="border-none">
            <AccordionTrigger className="py-4 text-left text-base font-semibold hover:no-underline">
              <div className="space-y-1">
                <p className="text-[1.02rem] font-semibold text-foreground">Your learning picture</p>
                <p className="text-[0.92rem] font-normal text-muted-foreground">
                  {viewModel.learningPicture.state === "report"
                    ? `${viewModel.learningPicture.levelLabel} level - score ${viewModel.learningPicture.overallScore}`
                    : "Your first report will appear here."}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              {viewModel.learningPicture.state === "report" ? (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SummaryStat
                      label="Level"
                      value={viewModel.learningPicture.levelLabel}
                      icon={<Target className="size-4" />}
                    />
                    <SummaryStat
                      label="Overall score"
                      value={String(viewModel.learningPicture.overallScore)}
                      icon={<ChartColumnBig className="size-4" />}
                    />
                    <SummaryStat
                      label="Strongest skill"
                      value={viewModel.learningPicture.strongestSkill ?? "Building"}
                      icon={<ArrowRight className="size-4" />}
                    />
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/35 px-4 py-4">
                    <p className="text-sm font-semibold text-foreground">Current focus</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {viewModel.learningPicture.focusSkill
                        ? `${viewModel.learningPicture.focusSkill} is the best place to push next.`
                        : "Open Progress to review the latest report details."}
                    </p>
                  </div>
                  <Link
                    href="/app/progress"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/85"
                  >
                    Open progress
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Progress becomes useful once your first saved report is in place. Your progress library will keep the full history when you are ready to review it.
                  </p>
                  <Link
                    href="/app/progress"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/85"
                  >
                    Open progress
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </PageShell>
  );
}

function SummaryStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1rem] border border-border/70 bg-card px-4 py-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
