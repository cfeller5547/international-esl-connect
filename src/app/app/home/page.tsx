import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SkillCard } from "@/components/ui-kit/skill-card";
import { StreakPanel } from "@/components/ui-kit/streak-panel";
import { ManualTopicsForm } from "@/features/home/manual-topics-form";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { prisma } from "@/server/prisma";
import { ContextService } from "@/server/services/context-service";
import { RecommendationService } from "@/server/services/recommendation-service";
import { StreakService } from "@/server/services/streak-service";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const [recommendation, latestReport, streak, topics] = await Promise.all([
    RecommendationService.getRecommendation(user.id, "home"),
    prisma.report.findFirst({
      where: { userId: user.id },
      include: { skillSnapshots: true },
      orderBy: { createdAt: "desc" },
    }),
    StreakService.getSnapshot(user.id),
    ContextService.getActiveTopics(user.id),
  ]);

  await trackEvent({
    eventName: "home_primary_cta_rendered",
    route: "/app/home",
    userId: user.id,
    properties: {
      action_type: recommendation.actionType,
      target_url: recommendation.targetUrl,
      reason_code: recommendation.reasonCode,
    },
  });

  if (topics.length === 0) {
    await trackEvent({
      eventName: "class_context_prompt_shown",
      route: "/app/home",
      userId: user.id,
      properties: {},
    });
  }

  return (
    <PageShell className="px-0 py-0">
      <div className="space-y-6">
        <Card className="surface-glow border-border/70 bg-card/95">
          <CardHeader className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
              Primary next step
            </p>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-3xl">{recommendation.title}</CardTitle>
                <p className="max-w-2xl text-sm text-muted-foreground">{recommendation.reason}</p>
              </div>
              <Button variant="accent" size="lg" asChild>
                <Link href={recommendation.targetUrl}>{recommendation.title}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <QuickActionCard
              href={recommendation.targetUrl}
              title="Continue curriculum"
              body="Open the next required unit activity in your assigned curriculum."
            />
            <QuickActionCard
              href="/app/tools/homework"
              title="Homework Help"
              body="Upload an assignment and get step-by-step support."
            />
            <QuickActionCard
              href="/app/tools/test-prep"
              title="Test Prep Sprint"
              body="Build a short plan around your next exam date."
            />
          </CardContent>
        </Card>

        <StreakPanel
          currentStreakDays={streak.currentStreakDays}
          longestStreakDays={streak.longestStreakDays}
          nextMilestoneDays={streak.nextMilestoneDays}
        />

        {topics.length === 0 ? (
          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="text-xl">Add class context</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload a syllabus later, or add your weekly topics now so Home, Speak,
                and Tools can stay aligned with class.
              </p>
            </CardHeader>
            <CardContent>
              <ManualTopicsForm />
            </CardContent>
          </Card>
        ) : null}

        <Accordion type="single" collapsible className="rounded-3xl border border-border/70 bg-card/95 px-4">
          <AccordionItem value="summary" className="border-none">
            <AccordionTrigger className="text-lg font-semibold">
              Skills snapshot and recent progress
            </AccordionTrigger>
            <AccordionContent className="space-y-5 pb-6">
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {topics.map((topic) => (
                  <span key={topic} className="rounded-full bg-muted px-3 py-1">
                    {topic}
                  </span>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {latestReport?.skillSnapshots.map((snapshot) => {
                  const visual = snapshot.visualPayload as Record<string, unknown>;
                  return (
                    <SkillCard
                      key={snapshot.id}
                      skill={snapshot.skill}
                      score={snapshot.score}
                      interpretation={snapshot.interpretationText}
                      action={snapshot.recommendedActionText}
                      delta={typeof visual.delta === "number" ? visual.delta : null}
                      compact
                    />
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </PageShell>
  );
}

function QuickActionCard({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="rounded-3xl border border-border/70 bg-muted/25 px-4 py-4 transition hover:bg-muted/45">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}
